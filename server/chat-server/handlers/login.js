/**
 * =====================================================
 *  Handler: chatLogin — Super Warrior Z Chat Server
 * =====================================================
 *
 *  First action after TEA verify handshake.
 *
 *  CLIENT CODE (main.min.js line 77445-77489):
 *    ts.processHandlerWithChat({
 *        type: "chat",
 *        action: "login",
 *        userId: UserInfoSingleton.getInstance().userId,
 *        serverId: UserInfoSingleton.getInstance().getServerId(),
 *        version: "1.0"
 *    }, callback)
 *
 *  After login success, client joins rooms:
 *    worldRoomId → guildRoomId → teamDungeonChatRoom → teamChatRoom
 *    via Promise.all(ts.chatJoinRequest(roomId)...)
 *
 *  Response: { ret: 0, data: "{}" } (empty success body)
 *
 * =====================================================
 */

'use strict';

var RH = require('../../shared/responseHelper');
var logger = require('../../shared/utils/logger');

/**
 * Handle chat login action.
 *
 * @param {object} deps - Dependencies { userManager }
 * @param {object} socket - Socket.IO socket
 * @param {object} parsed - Parsed request { userId, serverId, ... }
 * @param {function} callback - Socket.IO callback
 */
async function handle(deps, socket, parsed, callback) {
    var userId = parsed.userId;
    var serverId = parsed.serverId || 1;

    if (!userId) {
        return callback(RH.error(RH.ErrorCode.LACK_PARAM, 'Missing userId'));
    }

    logger.info('CHAT', 'login: userId=' + userId + ', serverId=' + serverId);

    try {
        // Register user in userManager (loads from DB, stores in memory)
        var userInfo = await deps.userManager.login(socket.id, socket, userId, serverId);

        // Store user info on socket for quick access
        socket._userId = userId;
        socket._userInfo = userInfo;

        logger.info('CHAT', 'login success: userId=' + userId + ', nick=' + userInfo.nickName);
        callback(RH.success({}));

    } catch (err) {
        logger.error('CHAT', 'login error for userId=' + userId + ': ' + err.message);
        callback(RH.error(RH.ErrorCode.UNKNOWN, 'Login failed'));
    }
}

module.exports = { handle: handle };
