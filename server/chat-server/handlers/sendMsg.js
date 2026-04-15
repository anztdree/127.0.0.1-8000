/**
 * =====================================================
 *  Handler: sendMsg — Super Warrior Z Chat Server
 * =====================================================
 *
 *  Send a chat message to a room.
 *
 *  CLIENT CODE (main.min.js line 52852-52874):
 *    ts.processHandlerWithChat({
 *        type: "chat",
 *        action: "sendMsg",
 *        userId: UserInfoSingleton.getInstance().userId,
 *        kind: n,           // MESSAGE_KIND (2=WORLD, 3=GUILD, 5=WORLD_TEAM, 6=TEAM)
 *        content: t,        // message text
 *        msgType: a,        // message sub-type / SYSTEM_MESSAGE_TYPE
 *        param: r,          // extra params (array of {cxt, linkType, itemId, displayId, userId})
 *        roomId: i,         // target room ID
 *        version: "1.0"
 *    }, successCallback, errorCallback)
 *
 *  SUCCESS RESPONSE: { ret: 0, data: JSON.stringify({ _time: timestamp }) }
 *  ERROR RESPONSE:   { ret: 36001, ... } → "chat forbidden" popup
 *  BROADCAST:        Notify event → { ret:"SUCCESS", data: {_msg: chatObj} }
 *
 *  The broadcast Notify is sent to ALL room members (including sender).
 *  Client creates local chat bubble immediately on sendMsg success,
 *  then also processes the Notify push. Both display the same message.
 *
 * =====================================================
 */

'use strict';

var RH = require('../../shared/responseHelper');
var logger = require('../../shared/utils/logger');
var MESSAGE_KIND = require('../utils/chatConstants').MESSAGE_KIND;
var CHAT_ERROR = require('../utils/chatConstants').CHAT_ERROR;
var messageBuilder = require('../utils/messageBuilder');

/**
 * Handle sendMsg action.
 *
 * @param {object} deps - Dependencies { roomManager, messageStore, userManager, rateLimiter, io }
 * @param {object} socket - Socket.IO socket
 * @param {object} parsed - Parsed request { userId, kind, content, msgType, param, roomId }
 * @param {function} callback - Socket.IO callback
 */
function handle(deps, socket, parsed, callback) {
    var userId = parsed.userId;
    var kind = parsed.kind || MESSAGE_KIND.WORLD;
    var content = parsed.content || '';
    var msgType = parsed.msgType || 0;
    var param = parsed.param || null;
    var roomId = parsed.roomId;

    if (!roomId) {
        return callback(RH.error(RH.ErrorCode.LACK_PARAM, 'Missing roomId'));
    }

    // Block system messages from clients.
    // Client's BroadcastSingleton.setChatValue() accesses noticeContent[_type]
    // for system messages. If _type not in noticeContent → crash "s[r] is undefined".
    // Only the server should generate system messages (and only with valid _type).
    if (kind === MESSAGE_KIND.SYSTEM) {
        return callback(RH.error(RH.ErrorCode.LACK_PARAM, 'Cannot send system messages'));
    }

    // Validate message content
    var contentCheck = messageBuilder.validateContent(content);
    if (!contentCheck.valid) {
        return callback(RH.error(RH.ErrorCode.LACK_PARAM, contentCheck.reason));
    }

    // Check rate limit
    if (!deps.rateLimiter.check(userId)) {
        logger.warn('CHAT', 'sendMsg: rate limited userId=' + userId);
        return callback(RH.error(CHAT_ERROR.FORBIDDEN, 'Rate limited'));
    }

    // Check chat ban (error 36001)
    if (deps.userManager.isBanned(userId)) {
        logger.warn('CHAT', 'sendMsg: user BANNED userId=' + userId);
        return callback(RH.error(CHAT_ERROR.FORBIDDEN, 'Chat forbidden'));
    }

    var now = Date.now();
    var userInfo = socket._userInfo || { userId: userId, nickName: userId };

    // Determine if message should show in main broadcast ticker.
    // Only WORLD (2) and WORLD_TEAM (5) with msgType > 0 enter the ticker.
    var showMain = (kind === MESSAGE_KIND.WORLD || kind === MESSAGE_KIND.WORLD_TEAM) && msgType > 0;

    // Build the chat message (with all fields matching client ChatDataBaseClass)
    var chatMsg = messageBuilder.buildChatMessage(userInfo, kind, content, msgType, param, now, showMain);

    // Store in room history
    deps.messageStore.store(roomId, chatMsg);

    // Broadcast Notify to all room members
    broadcastToRoom(deps, roomId, chatMsg);

    logger.info('CHAT', 'sendMsg: userId=' + userId + ', kind=' + kind + ', roomId=' + roomId +
        ', content=' + (content.length > 30 ? content.substring(0, 30) + '...' : content));

    // Return server timestamp to sender
    callback(RH.success({ _time: now }));
}

/**
 * Broadcast a push notification to all sockets in a room.
 *
 * CLIENT CODE (line 77204):
 *   this.chatClient.listenNotify(function(e) {
 *       if ("SUCCESS" == e.ret) { ... n._msg ... }
 *   })
 *
 * PUSH FORMAT (line 77204):
 *   { ret: "SUCCESS", data: JSON.stringify({_msg: chatObj}), compress: false }
 *
 * @param {object} deps - Dependencies { roomManager, io }
 * @param {number} roomId
 * @param {object} chatMessage - The chat message object
 */
function broadcastToRoom(deps, roomId, chatMessage) {
    var memberSocketIds = deps.roomManager.getRoomMembers(roomId);
    if (memberSocketIds.length === 0) return;

    var pushData = RH.push({ _msg: chatMessage });

    for (var i = 0; i < memberSocketIds.length; i++) {
        var sock = deps.io.sockets.sockets[memberSocketIds[i]];
        if (sock && sock.connected && sock._verified) {
            sock.emit('Notify', pushData);
        }
    }
}

module.exports = { handle: handle };
