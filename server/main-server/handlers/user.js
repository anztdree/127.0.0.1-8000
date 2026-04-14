/**
 * =====================================================
 *  User Handler — handlers/user.js
 *  Port 8001 — Main Server
 *
 *  Actions: 13 total
 *  WRITE: 6 | READ: 7
 *
 *  100% derived from client code analysis.
 *
 *  CLIENT enterGame REQUEST (line 77350-77358):
 *    {
 *      type: "user",
 *      action: "enterGame",
 *      loginToken: ts.loginInfo.userInfo.loginToken,
 *      userId: ts.loginInfo.userInfo.userId,
 *      serverId: parseInt(ts.loginInfo.serverItem.serverId),
 *      version: "1.0",
 *      language: ToolCommon.getLanguage(),
 *      gameVersion: ToolCommon.getClientVer()
 *    }
 *
 *  CLIENT enterGame RESPONSE processed by UserDataParser.saveUserData() (line 77643-77724):
 *    Full player state object with 99+ fields.
 *    See defaultData.js generateNewUserData() for complete field list.
 *    CRITICAL: All top-level fields that client reads unconditionally
 *    (currency, user, hangup, summon, totalProps, heros, scheduleInfo,
 *    clickSystem, curMainTask, dragonEquiped) MUST be non-null.
 *
 *  CLIENT registChat REQUEST (line 77392-77397):
 *    {
 *      type: "user",
 *      action: "registChat",
 *      userId: UserInfoSingleton.getInstance().userId,
 *      version: "1.0"
 *    }
 *
 *  CLIENT registChat RESPONSE:
 *    {
 *      _success: boolean,
 *      _chatServerUrl: string,
 *      _worldRoomId: number,
 *      _guildRoomId: number,
 *      _teamDungeonChatRoom: number,
 *      _teamChatRoom: number
 *    }
 *
 *  DB SCHEMA:
 *    users table — stores account info (user_id, password, nick_name, etc.)
 *    user_data table — stores per-server game state as JSON blob (game_data column)
 *    login_tokens table — stores active login tokens for session validation
 *
 *  Usage:
 *    handler.handle(socket, parsedRequest, callback)
 * =====================================================
 */

'use strict';

var RH = require('../../shared/responseHelper');
var DB = require('../../database/connection');
var DefaultData = require('../../shared/defaultData');
var GameData = require('../../shared/gameData/loader');
var logger = require('../../shared/utils/logger');

// =============================================
// ACTION HANDLERS
// =============================================

/**
 * enterGame — The MOST CRITICAL action.
 *
 * Called when client first connects to main server after TEA verify.
 * Returns full player state. If user is new, generates default data.
 *
 * CLIENT FLOW (line 77342-77366):
 *   1. clientEnterGame() sends request via mainClient
 *   2. On success: UserDataParser.saveUserData(response)
 *   3. Then: loginSuccessCallBack(response) → analytics + scene transition
 *   4. Then: reportToLoginEnterInfo() → loginClient.SaveUserEnterInfo
 *   5. Then: setInterval(registChat, 3000)
 *
 * @param {object} socket - Socket.IO socket
 * @param {object} parsed - Parsed request { type, action, userId, loginToken, serverId, version, language, gameVersion }
 * @param {function} callback - Socket.IO acknowledgment callback
 */
async function enterGame(socket, parsed, callback) {
    var userId = parsed.userId;
    var serverId = parsed.serverId || 1;
    var loginToken = parsed.loginToken;

    // Validate required fields
    if (!userId) {
        logger.warn('USER', 'enterGame: missing userId');
        return callback(RH.error(RH.ErrorCode.LACK_PARAM, 'Missing userId'));
    }

    logger.info('USER', 'enterGame: userId=' + userId + ', serverId=' + serverId);

    try {
        // =============================================
        // Step 1: Validate loginToken (MANDATORY)
        // =============================================
        // loginToken comes from SaveHistory response on login-server.
        // Login-server saves it to login_tokens table (single-use, 24h expiry).
        // We validate it here — NO bypass, NO dev mode fallback.
        //
        // Client flow: loginGame → SaveHistory → clientStartGame → enterGame
        // enterGame request (line 77350-77358):
        //   { type:"user", action:"enterGame", loginToken, userId, serverId, version, language, gameVersion }
        //
        // If validation fails, client shows error (ret !== 0) and may reload page (ret=38).
        if (!loginToken) {
            logger.warn('USER', 'enterGame: missing loginToken for userId=' + userId);
            return callback(RH.error(RH.ErrorCode.SESSION_EXPIRED, 'Missing loginToken'));
        }

        try {
            var tokenRows = await DB.query(
                'SELECT * FROM login_tokens WHERE user_id = ? AND token = ? AND used = 0 AND expires_at > ?',
                [userId, loginToken, Date.now()]
            );
            if (tokenRows.length === 0) {
                // Token not found, expired, or already used
                logger.warn('USER', 'enterGame: invalid/expired loginToken for userId=' + userId);
                return callback(RH.error(RH.ErrorCode.LOGIN_CHECK_FAILED, 'Invalid or expired loginToken'));
            }
            // Mark token as used (single-use — each enterGame needs a fresh token)
            await DB.query(
                'UPDATE login_tokens SET used = 1 WHERE user_id = ? AND token = ?',
                [userId, loginToken]
            );
            logger.info('USER', 'enterGame: loginToken validated and consumed for userId=' + userId);
        } catch (tokenErr) {
            // login_tokens table doesn't exist — DB not initialized properly
            logger.error('USER', 'enterGame: loginToken validation failed (DB error): ' + tokenErr.message);
            return callback(RH.error(RH.ErrorCode.LOGIN_CHECK_FAILED, 'Server database error'));
        }

        // =============================================
        // Step 2: Load or create user_data
        // =============================================
        var isNewPlayer = false;
        var playerData = null;

        try {
            var rows = await DB.query(
                'SELECT * FROM user_data WHERE user_id = ? AND server_id = ?',
                [userId, serverId]
            );

            if (rows.length > 0 && rows[0].game_data) {
                // Existing player — load saved data
                var savedData = rows[0].game_data;

                // Parse JSON if it's a string (MariaDB JSON type may return string)
                if (typeof savedData === 'string') {
                    try {
                        savedData = JSON.parse(savedData);
                    } catch (parseErr) {
                        logger.error('USER', 'enterGame: failed to parse saved game_data for userId=' + userId);
                        savedData = null;
                    }
                }

                if (savedData && typeof savedData === 'object') {
                    // Merge with defaults to fill any missing/null fields
                    // This prevents crashes when client reads new fields that didn't exist before
                    playerData = DefaultData.mergeWithDefaults(savedData, userId, userId, serverId);
                    isNewPlayer = false;
                    logger.info('USER', 'enterGame: loaded existing data for userId=' + userId);
                } else {
                    // Corrupted data — regenerate
                    playerData = DefaultData.generateNewUserData(userId, userId, serverId);
                    isNewPlayer = true;
                    logger.warn('USER', 'enterGame: corrupted data, regenerated for userId=' + userId);
                }
            } else {
                // New player — generate default data
                playerData = DefaultData.generateNewUserData(userId, userId, serverId);
                isNewPlayer = true;
                logger.info('USER', 'enterGame: new player data generated for userId=' + userId);
            }
        } catch (dbErr) {
            // user_data table might not exist — generate defaults and continue
            logger.warn('USER', 'enterGame: DB query failed: ' + dbErr.message + ', generating defaults');
            playerData = DefaultData.generateNewUserData(userId, userId, serverId);
            isNewPlayer = true;
        }

        // =============================================
        // Step 3: Update dynamic fields in playerData
        // =============================================
        var now = Date.now();

        // Update user info with latest login time
        if (playerData.user) {
            playerData.user._lastLoginTime = now;
        }

        // Set newUser flag — only true on FIRST enterGame
        // After first save, this becomes false
        playerData.newUser = isNewPlayer;

        // Set server version info
        playerData.serverVersion = GameData.get('constant') ? '1' : null;
        playerData.serverOpenDate = playerData.serverOpenDate || now;

        // =============================================
        // Step 4: Save playerData to database
        // =============================================
        try {
            var gameDataJson = JSON.stringify(playerData);

            // Try UPDATE first (existing row), then INSERT (new row)
            var updateResult = await DB.query(
                'UPDATE user_data SET game_data = ?, last_login_time = ?, update_time = ? WHERE user_id = ? AND server_id = ?',
                [gameDataJson, now, now, userId, serverId]
            );

            if (updateResult.affectedRows === 0) {
                // No existing row — INSERT
                await DB.query(
                    'INSERT INTO user_data (user_id, server_id, game_data, last_login_time, update_time) VALUES (?, ?, ?, ?, ?)',
                    [userId, serverId, gameDataJson, now, now]
                );
                logger.info('USER', 'enterGame: saved new user_data for userId=' + userId);
            } else {
                logger.info('USER', 'enterGame: updated user_data for userId=' + userId);
            }
        } catch (saveErr) {
            // Save failed — still return data to client, but log error
            logger.error('USER', 'enterGame: failed to save user_data: ' + saveErr.message);
        }

        // =============================================
        // Step 5: Track online status
        // =============================================
        try {
            // Remove old online record for this user+server
            await DB.query(
                'DELETE FROM user_online WHERE user_id = ? AND server_id = ?',
                [userId, serverId]
            );
            // Insert new online record
            await DB.query(
                'INSERT INTO user_online (user_id, server_id, socket_id, login_time) VALUES (?, ?, ?, ?)',
                [userId, serverId, socket.id, now]
            );
        } catch (onlineErr) {
            logger.warn('USER', 'enterGame: online tracking failed: ' + onlineErr.message);
        }

        // =============================================
        // Step 6: Send response to client
        // =============================================
        // CRITICAL: Response format must match UserDataParser.saveUserData() expectations.
        // The response IS the full player state object — NOT wrapped in a container.
        // Client does: UserDataParser.saveUserData(response)
        // which reads response.currency, response.user, response.heros, etc. directly.
        callback(RH.success(playerData));

        // FIX 16: Set socket._userId after enterGame so other handlers can use it
        // (e.g., exitGame uses socket._userId as fallback when parsed.userId is missing)
        socket._userId = userId;

        logger.info('USER', 'enterGame: success for userId=' + userId + ', newUser=' + isNewPlayer);

    } catch (err) {
        logger.error('USER', 'enterGame: unhandled error for userId=' + userId + ': ' + err.message);
        logger.error('USER', 'enterGame: stack: ' + err.stack);
        callback(RH.error(RH.ErrorCode.UNKNOWN, 'Internal server error'));
    }
}

/**
 * registChat — Register chat room after entering game.
 *
 * Called every 3 seconds until successful (line 77397-77399).
 * Returns chat server connection info.
 *
 * CLIENT CODE (line 77392-77397):
 *   socket.emit("handler.process", {
 *       type: "user", action: "registChat",
 *       userId: UserInfoSingleton.getInstance().userId, version: "1.0"
 *   }, function(n) {
 *       if (n._success) { ... connect chatClient ... }
 *   })
 *
 * @param {object} socket
 * @param {object} parsed
 * @param {function} callback
 */
async function registChat(socket, parsed, callback) {
    var userId = parsed.userId;

    logger.info('USER', 'registChat: userId=' + userId);

    // Check if chat-server is configured
    var configModule = require('../../shared/config');
    var chatServerUrl = 'http://127.0.0.1:' + configModule.config.ports.chat;

    // Return chat registration info
    // Client reads: n._success, n._chatServerUrl, n._worldRoomId, n._guildRoomId, etc.
    callback(RH.success({
        _success: true,
        _chatServerUrl: chatServerUrl,
        _worldRoomId: 1,
        _guildRoomId: 2,
        _teamDungeonChatRoom: 3,
        _teamChatRoom: 4,
    }));
}

/**
 * exitGame — Player exits game, save data and cleanup.
 *
 * CLIENT CODE: Called when player exits or closes game.
 *
 * @param {object} socket
 * @param {object} parsed
 * @param {function} callback
 */
async function exitGame(socket, parsed, callback) {
    var userId = parsed.userId || socket._userId;
    var serverId = parsed.serverId || 1;

    logger.info('USER', 'exitGame: userId=' + userId + ', serverId=' + serverId);

    try {
        // FIX 16: Add server_id filter to online cleanup DELETE query
        // Without server_id filter, exiting one server would clear online status
        // on all servers for this user.
        if (userId) {
            await DB.query(
                'DELETE FROM user_online WHERE user_id = ? AND server_id = ?',
                [userId, serverId]
            );
        }
    } catch (err) {
        logger.warn('USER', 'exitGame: cleanup failed: ' + err.message);
    }

    callback(RH.success({}));
}

/**
 * changeNickName — Change player's display nickname.
 *
 * CLIENT CODE: Opens nickname input UI, validates length (12 chars max from constant.json).
 *
 * @param {object} socket
 * @param {object} parsed - { userId, nickName }
 * @param {function} callback
 */
async function changeNickName(socket, parsed, callback) {
    var userId = parsed.userId;
    var nickName = parsed.nickName;

    if (!nickName || nickName.length === 0) {
        return callback(RH.error(RH.ErrorCode.LACK_PARAM, 'Missing nickName'));
    }

    logger.info('USER', 'changeNickName: userId=' + userId + ', nickName=' + nickName);

    // TODO: Validate nickname (length, forbidden words, etc.)
    // TODO: Update in users table
    // TODO: Update playerData.user._nickName

    callback(RH.success({
        _changeInfo: {
            _nickName: nickName,
        },
    }));
}

/**
 * changeHeadImage — Change player's avatar/head image.
 *
 * @param {object} socket
 * @param {object} parsed - { userId, headImageId }
 * @param {function} callback
 */
async function changeHeadImage(socket, parsed, callback) {
    var userId = parsed.userId;
    var headImageId = parsed.headImageId;

    if (!headImageId) {
        return callback(RH.error(RH.ErrorCode.LACK_PARAM, 'Missing headImageId'));
    }

    logger.info('USER', 'changeHeadImage: userId=' + userId + ', headImageId=' + headImageId);

    callback(RH.success({
        _changeInfo: {
            _headImage: headImageId,
        },
    }));
}

/**
 * changeHeadBox — Change player's equipped head frame/avatar box.
 *
 * @param {object} socket
 * @param {object} parsed - { userId, headBoxId }
 * @param {function} callback
 */
async function changeHeadBox(socket, parsed, callback) {
    var userId = parsed.userId;
    var headBoxId = parsed.headBoxId;

    if (!headBoxId) {
        return callback(RH.error(RH.ErrorCode.LACK_PARAM, 'Missing headBoxId'));
    }

    logger.info('USER', 'changeHeadBox: userId=' + userId + ', headBoxId=' + headBoxId);

    callback(RH.success({
        _changeInfo: {
            _headBox: headBoxId,
        },
    }));
}

/**
 * clickSystem — Record a system UI click event / daily reward claim tracking.
 *
 * @param {object} socket
 * @param {object} parsed - { userId, systemId }
 * @param {function} callback
 */
async function clickSystem(socket, parsed, callback) {
    var userId = parsed.userId;
    var systemId = parsed.systemId;

    logger.info('USER', 'clickSystem: userId=' + userId + ', systemId=' + systemId);

    callback(RH.success({
        _changeInfo: {
            _clickSystem: {},
            _items: {},
        },
    }));
}

/**
 * getBulletinBrief — Get summary/list of bulletin/announcement headers.
 *
 * @param {object} socket
 * @param {object} parsed
 * @param {function} callback
 */
async function getBulletinBrief(socket, parsed, callback) {
    logger.info('USER', 'getBulletinBrief: userId=' + (parsed.userId || '-'));

    callback(RH.success({
        _bulletinBriefList: [],
    }));
}

/**
 * queryPlayerHeadIcon — Query available head icons/avatars.
 *
 * @param {object} socket
 * @param {object} parsed
 * @param {function} callback
 */
async function queryPlayerHeadIcon(socket, parsed, callback) {
    logger.info('USER', 'queryPlayerHeadIcon: userId=' + (parsed.userId || '-'));

    callback(RH.success({
        _headIconList: [],
    }));
}

/**
 * readBulletin — Read full content of a specific bulletin.
 *
 * @param {object} socket
 * @param {object} parsed - { bulletinId }
 * @param {function} callback
 */
async function readBulletin(socket, parsed, callback) {
    var bulletinId = parsed.bulletinId;

    logger.info('USER', 'readBulletin: bulletinId=' + bulletinId);

    callback(RH.success({
        _bulletinDetail: {
            _bulletinId: bulletinId,
            _title: '',
            _content: '',
            _publishTime: 0,
        },
    }));
}

/**
 * suggest — Get recommended content.
 *
 * @param {object} socket
 * @param {object} parsed - { suggestType }
 * @param {function} callback
 */
async function suggest(socket, parsed, callback) {
    logger.info('USER', 'suggest: suggestType=' + (parsed.suggestType || '-'));

    callback(RH.success({
        _suggestList: [],
    }));
}

/**
 * saveFastTeam — Save a quick-access battle team composition.
 *
 * @param {object} socket
 * @param {object} parsed - { userId, teamIndex, heroList }
 * @param {function} callback
 */
async function saveFastTeam(socket, parsed, callback) {
    var userId = parsed.userId;
    var teamIndex = parsed.teamIndex;
    var heroList = parsed.heroList;

    logger.info('USER', 'saveFastTeam: userId=' + userId + ', teamIndex=' + teamIndex);

    callback(RH.success({
        _changeInfo: {
            _fastTeam: {},
        },
    }));
}

/**
 * setFastTeamName — Rename a saved quick-access battle team.
 *
 * @param {object} socket
 * @param {object} parsed - { userId, teamIndex, teamName }
 * @param {function} callback
 */
async function setFastTeamName(socket, parsed, callback) {
    var userId = parsed.userId;
    var teamIndex = parsed.teamIndex;
    var teamName = parsed.teamName;

    logger.info('USER', 'setFastTeamName: userId=' + userId + ', teamIndex=' + teamIndex);

    callback(RH.success({
        _changeInfo: {
            _fastTeam: {},
        },
    }));
}

// =============================================
// MAIN ROUTER
// =============================================

/**
 * Main handler function — routes actions to specific handlers.
 *
 * Called by main-server/index.js:
 *   handler.handle(socket, parsed, callback)
 *
 * @param {object} socket - Socket.IO socket instance
 * @param {object} parsed - Parsed request from ResponseHelper.parseRequest()
 *   { type, action, userId, ...params }
 * @param {function} callback - Socket.IO acknowledgment callback
 */
async function handle(socket, parsed, callback) {
    var action = parsed.action;
    var userId = parsed.userId;

    if (!action) {
        logger.warn('USER', 'Missing action in request');
        return callback(RH.error(RH.ErrorCode.LACK_PARAM, 'Missing action'));
    }

    try {
        switch (action) {

            // === CRITICAL: enterGame (first action called after TEA verify) ===
            case 'enterGame':
                await enterGame(socket, parsed, callback);
                break;

            // === CHAT ===
            case 'registChat':
                await registChat(socket, parsed, callback);
                break;

            // === WRITE ACTIONS ===
            case 'changeNickName':
                await changeNickName(socket, parsed, callback);
                break;

            case 'changeHeadImage':
                await changeHeadImage(socket, parsed, callback);
                break;

            case 'changeHeadBox':
                await changeHeadBox(socket, parsed, callback);
                break;

            case 'clickSystem':
                await clickSystem(socket, parsed, callback);
                break;

            case 'exitGame':
                await exitGame(socket, parsed, callback);
                break;

            case 'saveFastTeam':
                await saveFastTeam(socket, parsed, callback);
                break;

            case 'setFastTeamName':
                await setFastTeamName(socket, parsed, callback);
                break;

            // === READ ACTIONS ===
            case 'getBulletinBrief':
                await getBulletinBrief(socket, parsed, callback);
                break;

            case 'queryPlayerHeadIcon':
                await queryPlayerHeadIcon(socket, parsed, callback);
                break;

            case 'readBulletin':
                await readBulletin(socket, parsed, callback);
                break;

            case 'suggest':
                await suggest(socket, parsed, callback);
                break;

            // === UNKNOWN ACTION ===
            default:
                logger.warn('USER', 'Unknown action: ' + action + ' from userId=' + (userId || '-'));
                callback(RH.error(RH.ErrorCode.INVALID_COMMAND, 'Unknown action: ' + action));
                break;
        }
    } catch (err) {
        logger.error('USER', 'Handler error for action=' + action + ': ' + err.message);
        logger.error('USER', 'Stack: ' + err.stack);
        callback(RH.error(RH.ErrorCode.UNKNOWN, 'Internal server error'));
    }
}

module.exports = { handle: handle };
