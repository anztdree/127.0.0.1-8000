/**
 * =====================================================
 *  Handler: getRecord — Super Warrior Z Chat Server
 * =====================================================
 *
 *  Fetch message history for a room.
 *
 *  CLIENT CODE (main.min.js line 58328-58341):
 *    ts.processHandlerWithChat({
 *        type: "chat",
 *        action: "getRecord",
 *        userId: o,
 *        roomId: n,
 *        startTime: t.teamDungeonInfoStartTime,
 *        version: "1.0"
 *    }, function(t) {
 *        for (var n in t._record) {
 *            var o = ChatDataBaseClass.getData(t._record[n]);
 *            ... ts.chatNotifyData(o) ...
 *        }
 *    })
 *
 *  Response: { ret: 0, data: JSON.stringify({ _record: [msg1, msg2, ...] }) }
 *
 *  startTime is optional. When provided, only messages with
 *  _time >= startTime are returned. Used by team dungeon to
 *  fetch messages since the dungeon session started.
 *
 * =====================================================
 */

'use strict';

var RH = require('../../shared/responseHelper');
var logger = require('../../shared/utils/logger');
var LIMITS = require('../utils/chatConstants').LIMITS;

/**
 * Handle getRecord action.
 *
 * @param {object} deps - Dependencies { messageStore }
 * @param {object} socket - Socket.IO socket
 * @param {object} parsed - Parsed request { userId, roomId, startTime }
 * @param {function} callback - Socket.IO callback
 */
function handle(deps, socket, parsed, callback) {
    var userId = parsed.userId;
    var roomId = parsed.roomId;
    var startTime = parsed.startTime || 0;

    if (!roomId) {
        return callback(RH.error(RH.ErrorCode.LACK_PARAM, 'Missing roomId'));
    }

    logger.info('CHAT', 'getRecord: userId=' + userId + ', roomId=' + roomId +
        ', startTime=' + (startTime || 'all'));

    // Get messages filtered by startTime
    var record = deps.messageStore.getMessagesSince(roomId, startTime);

    // Enforce max record size
    if (record.length > LIMITS.MAX_RECORD_SIZE) {
        record = record.slice(record.length - LIMITS.MAX_RECORD_SIZE);
    }

    callback(RH.success({ _record: record }));
}

module.exports = { handle: handle };
