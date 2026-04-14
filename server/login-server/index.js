/**
 * Login Server - Port 8000
 * 
 * 100% derived from client code analysis.
 * 
 * CLIENT CONNECTION FLOW (from main.min.js):
 * 
 * 1. Connect to login server URL from serversetting.json
 *    Line 77423-77431: connectToLogin(e)
 *    → loads "resource/properties/serversetting.json" → connects to loginserver URL
 * 
 * 2. NO TEA verification on login server
 *    Line 76751: t.loginClient = new TSSocketClient("login-server", false)
 *    verifyEnable = false → no "verify" event handshake
 *    Line 51977-51982: verifyEnable ? (socketOnVerify) : t()  → calls callback directly
 * 
 * 3. Client sends login request via "handler.process" event
 *    Line 77300-77315: clientLoginUser(userId, password, fromChannel, callback)
 *    Line 51969-51970: socket.emit("handler.process", payload, callback)
 * 
 * LOGIN REQUEST FORMAT (line 77300-77315):
 * {
 *   type: "User",          // NOTE: uppercase "User" on login server
 *   action: "loginGame",   // Only action - no separate register action
 *   userId: string,
 *   password: string,      // PLAINTEXT - no hashing on client (line 88576-88584)
 *   fromChannel: string,
 *   channelName: string,
 *   headImageUrl: string,
 *   nickName: string,
 *   subChannel: string,
 *   version: "1.0"         // Always "1.0"
 * }
 * 
 * RESPONSE FORMAT (line 76968-76980 processHandlerWithLogin):
 * {
 *   ret: 0,                // 0 = success (number)
 *   data: JSON string,     // Parsed with JSON.parse after optional LZString decompress
 *   compress: boolean,     // If true, data is LZString.compressFromUTF16 encoded
 *   serverTime: number,
 *   server0Time: number
 * }
 * 
 * ERROR HANDLING:
 *   ret !== 0 → Logger.showInfoLog("登录出错", e.ret) + optional callback
 *   Special: ret=38 → TSBrowser.executeFunction("reload")
 * 
 * GETSERVERLIST REQUEST (line 77316-77340):
 * {
 *   type: "User",
 *   action: "GetServerList",
 *   version: "1.0"
 * }
 * 
 * SAVEHISTORY REQUEST (line 88590-88607):
 * {
 *   type: "User",
 *   action: "SaveHistory",
 *   accountToken: string,
 *   channelCode: string,
 *   serverId: number,
 *   securityCode: string,
 *   subChannel: string,
 *   version: "1.0"
 * }
 * SaveHistory response may return loginToken refresh:
 *   e && e.loginToken && (ts.loginInfo.userInfo.loginToken = e.loginToken)
 * 
 * AUTO-REGISTER:
 *   Client has NO register action. Only loginGame.
 *   If userId not found, server auto-creates account.
 *   Evidence: No "registerGame"/"createAccount" in client code.
 *   loginSuccessCallBack checks e.newUser for first-time creation events.
 *   Default password if empty: "game_origin" (line 88641: e.password || (e.password = "game_origin"))
 */

const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const { config, getServerList } = require('../shared/config');
const { success, error, ErrorCode } = require('../shared/responseHelper');
const { initPool, query, initSchema } = require('../database/connection');
const { info, warn, error: logError } = require('../shared/utils/logger');

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
    cors: { origin: '*' },
    transports: ['websocket', 'polling'],
});

// Online users tracking (userId -> socketId)
const onlineUsers = new Map();

/**
 * Handle "handler.process" event from client
 * 
 * Client emits: socket.emit("handler.process", payload, callback)
 * Server receives: (payload, callback) via io.on('connection')
 * 
 * Line 51969-51970:
 *   e.prototype.sendToServer = function(e, t) {
 *       this.socket && this.socket.emit("handler.process", e, t)
 *   }
 */
async function handleProcess(socket, payload, callback) {
    const { type, action, userId, accountToken } = payload;

    // Better logging: use accountToken when userId is not present
    const displayId = userId || accountToken || '-';
    info('LoginServer', `Request: type=${type}, action=${action}, userId=${displayId}`);

    try {
        // Route to action handler
        switch (action) {
            case 'loginGame':
                await handleLoginGame(socket, payload, callback);
                break;
            case 'GetServerList':
                handleGetServerList(callback);
                break;
            case 'SaveHistory':
                await handleSaveHistory(payload, callback);
                break;
            case 'LoginAnnounce':
                handleLoginAnnounce(callback);
                break;
            case 'SaveUserEnterInfo':
                handleSaveUserEnterInfo(payload, callback);
                break;
            default:
                info('LoginServer', `Action '${action}' not implemented, returning success`);
                if (callback) callback(success({}));
                break;
        }
    } catch (err) {
        logError('LoginServer', `Handler error for ${action}:`, err.message);
        if (callback) callback(error(ErrorCode.UNKNOWN));
    }
}

/**
 * Handle loginGame action
 * 
 * CLIENT REQUEST (line 77300-77315):
 * {
 *   type: "User",
 *   action: "loginGame",
 *   userId: string,
 *   password: string,       // PLAINTEXT - no hash
 *   fromChannel: string,
 *   channelName: string,
 *   headImageUrl: string,
 *   nickName: string,
 *   subChannel: string,
 *   version: "1.0"
 * }
 * 
 * SERVER RESPONSE must include:
 * - userId, channelCode (for SDK login flow)
 * - loginToken (for subsequent enterGame on main server)
 * - newUser flag (loginSuccessCallBack checks e.newUser)
 * 
 * AUTO-REGISTER: No register action exists. If user not found, create account.
 */
async function handleLoginGame(socket, payload, callback) {
    const {
        userId,
        password,
        fromChannel,
        channelName,
        headImageUrl,
        nickName,
        subChannel,
        version,
    } = payload;

    // Validate required fields (ERROR_LACK_PARAM = 8)
    if (!userId) {
        return callback(error(ErrorCode.LACK_PARAM));
    }

    const now = Date.now();

    // Check if user exists
    const existingUsers = await query(
        'SELECT * FROM users WHERE user_id = ?',
        [userId]
    );

    let isNewUser = false;
    let userData;

    if (existingUsers.length === 0) {
        // ============================================
        // AUTO-REGISTER
        // Client has NO register action (100% confirmed from code analysis)
        // Only action: loginGame
        // Client checks e.newUser in loginSuccessCallBack (line 77433)
        // ============================================
        isNewUser = true;

        const insertResult = await query(
            `INSERT INTO users (user_id, password, nick_name, head_image, from_channel, channel_name, sub_channel, last_login_time, create_time, is_new)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1)`,
            [
                userId,
                password || 'game_origin', // Default password from client line 88641
                // SECURITY NOTE: Plaintext password storage is DEV-ONLY practice.
                // The client sends raw passwords with no hashing (line 88576-88584).
                // Production servers should hash passwords before storage.
                nickName || '',
                headImageUrl || '',
                fromChannel || '',
                channelName || '',
                subChannel || '',
                now,
                now,
            ]
        );

        userData = {
            user_id: userId,
            password: password || 'game_origin',
            nick_name: nickName || '',
            head_image: headImageUrl || '',
            from_channel: fromChannel || '',
            channel_name: channelName || '',
            sub_channel: subChannel || '',
            create_time: now,
            last_login_time: now,
            is_new: 1,
        };

        info('LoginServer', `New user auto-registered: ${userId}`);
    } else {
        // Existing user - verify password (PLAINTEXT comparison)
        userData = existingUsers[0];

        if (userData.password !== password) {
            warn('LoginServer', `Wrong password for user: ${userId}`);
            return callback(error(ErrorCode.LOGIN_CHECK_FAILED));
        }

        // Update last login time
        await query(
            'UPDATE users SET last_login_time = ? WHERE user_id = ?',
            [now, userId]
        );

        // Check if user was marked as new (first login after registration)
        isNewUser = userData.is_new === 1;
        if (isNewUser) {
            await query('UPDATE users SET is_new = 0 WHERE user_id = ?', [userId]);
        }
    }

    // Track online user
    onlineUsers.set(userId, socket.id);

    // ============================================
    // Build response
    // 
    // Client loginSuccessCallBack (line 77433-77444) processes:
    //   UserDataParser.saveUserData(e)
    //   e.newUser → analytics events
    // 
    // SDK login stores (line 88719-88731):
    //   ts.loginInfo.userInfo = {
    //     loginToken: e.loginToken,
    //     userId: e.userId,
    //     nickName: e.nickName,
    //     channelCode: e.sdk,
    //     securityCode: e.security
    //   }
    // 
    // For non-SDK origin login (doOriginLoginRequest line 88641):
    //   The response data flows through processHandlerWithLogin callback
    //   which stores ts.loginInfo.userInfo
    // ============================================
    const responseData = {
        userId: userId,
        nickName: userData.nick_name || nickName || userId,
        newUser: isNewUser,
        loginToken: generateLoginToken(userId),
        channelCode: fromChannel || '',
        security: '',
    };

    info('LoginServer', `User logged in: ${userId}, newUser=${isNewUser}`);

    if (callback) {
        callback(success(responseData));
    }
}

/**
 * Handle GetServerList action
 * 
 * CLIENT REQUEST (line 77332):
 * { type: "User", action: "GetServerList", userId, subChannel, channel }
 * 
 * CLIENT RESPONSE HANDLER - selectNewServer (line 88652-88660):
 *   this.filterByWhiteList(t.serverList);
 *   var o = !t.history || t.history.length <= 0;
 *   var a = t.history.length > 0 ? t.history[0] : t.serverList[0].serverId;
 *   var r = n.matchServerUrl(a, t.serverList);
 * 
 * matchServerUrl (line 88666-88678):
 *   for (var i = 0; i < serverList.length; i++) {
 *     if (serverList[i].serverId === serverId) return serverList[i]
 *   }
 * 
 * onLoginSuccess stores: ts.loginInfo.serverItem = serverObj
 * Server object must have: serverId, name, url, dungeonurl, online, hot, "new"
 */
function handleGetServerList(callback) {
    const serverListData = getServerList();
    info('LoginServer', `GetServerList: ${serverListData.serverList.length} servers`);

    if (callback) {
        callback(success(serverListData));
    }
}

/**
 * Handle LoginAnnounce action
 * 
 * CLIENT REQUEST (line 88765-88773):
 * { type: "User", action: "LoginAnnounce" }
 * 
 * CLIENT RESPONSE HANDLER:
 * Reads e.data as array of notice objects: [{text: {en: "", cn: "", ...}, type: 0, link: ""}]
 * Iterates and builds notice display. Empty array = no notices.
 */
function handleLoginAnnounce(callback) {
    info('LoginServer', 'LoginAnnounce: returning empty notices');
    if (callback) {
        callback(success([]));
    }
}

/**
 * Handle SaveUserEnterInfo action
 * 
 * CLIENT CODE (line 77373-77389):
 *   reportToLoginEnterInfo() — called AFTER enterGame succeeds (line 77360)
 *   Callback: ts.loginClient.destroy() — disconnects login socket after response
 * 
 * CLIENT REQUEST:
 * {
 *   type: "User",
 *   action: "SaveUserEnterInfo",
 *   accountToken: ts.loginInfo.userInfo.userId,
 *   channelCode: ts.loginInfo.userInfo.channelCode,
 *   subChannel: string,
 *   createTime: number,
 *   userLevel: number,
 *   version: "1.0"
 * }
 * 
 * NOTE: No userId field! Uses accountToken instead.
 * NOTE: Callback destroys login socket — response MUST succeed.
 */
function handleSaveUserEnterInfo(payload, callback) {
    const { accountToken, channelCode, subChannel, createTime, userLevel } = payload;
    
    info('LoginServer', `SaveUserEnterInfo: accountToken=${accountToken}, level=${userLevel}`);
    
    // TODO: Store user enter info for analytics
    // This is an analytics/tracking action, no game data needed in response
    
    if (callback) {
        callback(success({}));
    }
}

/**
 * Handle SaveHistory action
 * 
 * CLIENT REQUEST (line 88590-88607 startBtnTap):
 * {
 *   type: "User",
 *   action: "SaveHistory",
 *   accountToken: ts.loginInfo.userInfo.userId,
 *   channelCode: ts.loginInfo.userInfo.channelCode,
 *   serverId: ts.loginInfo.serverItem.serverId,
 *   securityCode: ts.loginInfo.userInfo.securityCode,
 *   subChannel: string,
 *   version: "1.0"
 * }
 * 
 * CLIENT RESPONSE HANDLER (line 88605-88611):
 *   var o = function(e) {
 *     e && e.loginToken && (ts.loginInfo.userInfo.loginToken = e.loginToken),
 *     ts.reportLogToPP("disConnectLoginSocket", null),
 *     ts.clientStartGame(!1);
 *     var t = e.todayLoginCount;
 *     4 === t && ToolCommon.ReportToSdkCommon(ReportDataType.blackStoneLoginCount4),
 *     6 === t && ToolCommon.ReportToSdkCommon(ReportDataType.blackStoneLoginCount6)
 *   };
 * 
 * Response MUST include: loginToken (may refresh), todayLoginCount
 * After success: client disconnects login socket, connects to main server
 */
async function handleSaveHistory(payload, callback) {
    const { accountToken, channelCode, serverId, securityCode, subChannel } = payload;

    if (!accountToken) {
        return callback(error(ErrorCode.LACK_PARAM));
    }

    info('LoginServer', `SaveHistory: userId=${accountToken}, serverId=${serverId}`);

    // FIX 8: Track actual daily login count per user (in-memory for now)
    // Client checks todayLoginCount === 4 (line 88609) and === 6 (line 88610)
    // to fire analytics events via ToolCommon.ReportToSdkCommon().
    const loginCountKey = accountToken + '_' + new Date().toISOString().slice(0, 10);
    if (!global._loginCounts) global._loginCounts = {};
    global._loginCounts[loginCountKey] = (global._loginCounts[loginCountKey] || 0) + 1;
    const responseData = {
        loginToken: generateLoginToken(accountToken),
        todayLoginCount: global._loginCounts[loginCountKey],
    };

    if (callback) {
        callback(success(responseData));
    }
}

/**
 * Generate a login token for the session
 * Used for subsequent enterGame authentication on main server (port 8001)
 */
function generateLoginToken(userId) {
    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(2, 10);
    return `${userId}_${timestamp}_${random}`;
}

/**
 * Handle client disconnect
 */
function handleDisconnect(socket) {
    // Find and remove user from online tracking
    for (const [userId, socketId] of onlineUsers.entries()) {
        if (socketId === socket.id) {
            onlineUsers.delete(userId);
            info('LoginServer', `User disconnected: ${userId}`);
            break;
        }
    }
}

// ============================================
// Socket.IO Connection Handler
// ============================================
io.on('connection', (socket) => {
    info('LoginServer', `Client connected: ${socket.id}`);

    // Client sends requests via "handler.process" event
    // Line 51969-51970:
    //   this.socket.emit("handler.process", e, t)
    socket.on('handler.process', (payload, callback) => {
        handleProcess(socket, payload, callback);
    });

    socket.on('disconnect', () => {
        handleDisconnect(socket);
    });
});

// ============================================
// Start Server
// ============================================
async function start() {
    try {
        // Initialize database
        await initPool();
        await initSchema();

        // Start listening
        server.listen(config.ports.login, () => {
            info('LoginServer', `Login server running on port ${config.ports.login}`);
            info('LoginServer', `NO TEA encryption (verifyEnable=false)`);
            console.log('');
            console.log('  ╔══════════════════════════════════════════╗');
            console.log('  ║   Super Warrior Z - Login Server         ║');
            console.log('  ║   Port: 8000 (NO TEA)                    ║');
            console.log('  ║   Actions: loginGame, GetServerList,      ║');
            console.log('  ║   SaveHistory, LoginAnnounce,             ║');
            console.log('  ║   SaveUserEnterInfo                       ║');
            console.log('  ╚══════════════════════════════════════════╝');
            console.log('');
        });
    } catch (err) {
        logError('LoginServer', 'Failed to start:', err.message);
        process.exit(1);
    }
}

start();
