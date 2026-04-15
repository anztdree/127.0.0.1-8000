/**
 * =====================================================
 *  Handler: leaveRoom — Super Warrior Z Chat Server
 * =====================================================
 *
 *  Leave a chat room.
 *
 *  CLIENT CODE (main.min.js line 77500-77509):
 *    ts.processHandlerWithChat({
 *        type: "chat",
 *        action: "leaveRoom",
 *        userId: UserInfoSingleton.getInstance().userId,
 *        roomId: e,
 *        version: "1.0"
 *    }, callback)
 *
 *  Response: { ret: 0, data: "{}" } (empty success)
 *
 *  Client calls this when:
 *    - Leaving guild (leaves guild room)
 *    - Leaving team/party (leaves team room)
 *
 * =====================================================
 */

'use strict';

var RH = require('../../shared/responseHelper');
var logger = require('../../shared/utils/logger');

/**
 * Handle leaveRoom action.
 *
 * @param {object} deps - Dependencies { roomManager, userManager }
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

    logger.info('CHAT', 'leaveRoom: userId=' + userId + ', roomId=' + roomId);

    // Remove socket from room
    deps.roomManager.leave(roomId, socket.id);

    // Remove from user's room list
    deps.userManager.removeRoom(userId, roomId);

    callback(RH.success({}));
}

module.exports = { handle: handle };
