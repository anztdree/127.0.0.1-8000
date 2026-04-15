/**
 * =====================================================
 *  Handler: joinRoom — Super Warrior Z Chat Server
 * =====================================================
 *
 *  Join a chat room. Client calls this after login for each room.
 *
 *  CLIENT CODE (main.min.js line 77490-77499):
 *    ts.processHandlerWithChat({
 *        type: "chat",
 *        action: "joinRoom",
 *        userId: UserInfoSingleton.getInstance().userId,
 *        roomId: e,
 *        version: "1.0"
 *    }, function(e) { e._record = [...] })
 *
 *  Response: { ret: 0, data: JSON.stringify({ _record: [msg1, msg2, ...] }) }
 *
 *  IMPORTANT: Do NOT send system message on join.
 *  Client BroadcastSingleton.setChatValue() accesses noticeContent[_type]
 *  for system messages (_kind==1). If _type doesn't exist in noticeContent,
 *  client crashes: "s[r] is undefined".
 *  The original official server never sent system messages on join.
 *
 * =====================================================
 */

'use strict';

var RH = require('../../shared/responseHelper');
var logger = require('../../shared/utils/logger');

/**
 * Handle joinRoom action.
 *
 * @param {object} deps - Dependencies { roomManager, messageStore, userManager }
 * @param {object} socket - Socket.IO socket
 * @param {object} parsed - Parsed request { userId, roomId, ... }
 * @param {function} callback - Socket.IO callback
 */
function handle(deps, socket, parsed, callback) {
    var userId = parsed.userId;
    var roomId = parsed.roomId;

    if (!roomId) {
        return callback(RH.error(RH.ErrorCode.LACK_PARAM, 'Missing roomId'));
    }

    logger.info('CHAT', 'joinRoom: userId=' + userId + ', roomId=' + roomId);

    // Add socket to room
    deps.roomManager.join(roomId, socket.id);

    // Track room in user's room list
    deps.userManager.addRoom(userId, roomId);

    // Return recent messages for this room
    var record = deps.messageStore.getMessages(roomId);
    callback(RH.success({ _record: record }));
}

module.exports = { handle: handle };
