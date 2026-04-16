'use strict';

var RH = require('../../shared/responseHelper');
var logger = require('../../shared/utils/logger');

function handle(socket, parsed, callback) {
    var action = parsed.action;
    var userId = parsed.userId;

    switch (action) {
        case 'getUserMsgList':
        case 'getMsgList':
            // Get friend message simple list (brief summary per friend).
            //
            // CLIENT CODE (line 128907, 169725):
            //   ts.processHandler({
            //       type: "userMsg", action: "getMsgList",
            //       userId: t, version: "1.0"
            //   }, function(t) {
            //       MailInfoManager.getInstance().setMessageFriendSimpleList(t._brief)
            //   })
            //
            // setMessageFriendSimpleList iterates with for(var n in e),
            // reads each entry's .lastMsgTime, .lastReadTime, .msg, .userInfo.
            // Empty object {} = no friends = nothing to iterate.
            //
            // RESPONSE FORMAT: { _brief: { <friendId>: { ... }, ... } }
            //   _brief is an OBJECT keyed by friendId, NOT an array.
            //
            // NOTE: 'getUserMsgList' is dead code — client never sends it.
            //       Kept for forward compatibility.
            logger.info('USERMSG', 'action=' + action + ' userId=' + (userId || '-'));
            callback(RH.success({ _brief: {} }));
            break;

        case 'getMsg':
            // Get detailed message history with a specific friend.
            //
            // CLIENT CODE (line 57436, 129080):
            //   ts.processHandler({
            //       type: "userMsg", action: "getMsg",
            //       userId, friendId, time, version: "1.0"
            //   }, function(t) {
            //       if(t._msgs && t._msgs.length > 0)
            //           MailInfoManager.getInstance().setMessageDetalListByFriendId(friendId, t._msgs)
            //   })
            //
            // RESPONSE FORMAT: { _msgs: [ { _time, _isSelf, _context, ... }, ... ] }
            //   _msgs is an ARRAY of message objects.
            //   Empty array [] = no messages = natural for local-only game.
            logger.info('USERMSG', 'action=getMsg userId=' + (userId || '-') + ' friendId=' + (parsed.friendId || '-'));
            callback(RH.success({ _msgs: [] }));
            break;

        case 'sendMsg':
            // Send a private message to a friend.
            //
            // CLIENT CODE (line 129150, 129430):
            //   ts.processHandler({
            //       type: "userMsg", action: "sendMsg",
            //       userId, friendId, msg, version: "1.0"
            //   }, function(e) {
            //       MailInfoManager.getInstance().setMessageDetalListByFriendId(e.friendId, [e._selfMsg]);
            //       MailInfoManager.getInstance().addSimpleOrChangeSimple(e.friendId, !0, e._selfMsg, t);
            //   })
            //
            // RESPONSE FORMAT: { friendId, _selfMsg: { _time, _isSelf, _context } }
            //   friendId — echoed back so client knows which friend.
            //   _selfMsg — the sent message object added to local list.
            //   _time — server timestamp (ms).
            //   _isSelf — true (sent by this user).
            //   _context — message text content.
            logger.info('USERMSG', 'action=sendMsg userId=' + (userId || '-') + ' friendId=' + (parsed.friendId || '-'));
            callback(RH.success({
                friendId: parsed.friendId,
                _selfMsg: {
                    _time: Date.now(),
                    _isSelf: true,
                    _context: parsed.msg || '',
                },
            }));
            break;

        case 'readMsg':
        case 'readUserMsg':
            // Mark friend messages as read.
            //
            // CLIENT CODE (line 57460, 129224):
            //   ts.processHandler({
            //       type: "userMsg", action: "readMsg",
            //       userId, friendId, version: "1.0"
            //   }, function(e) {
            //       MailInfoManager.getInstance().setMessageReadWithFriendId(o, e._readTime)
            //   })
            //
            // RESPONSE FORMAT: { _readTime: <number> }
            //   _readTime — server timestamp (ms) used to update local read state.
            //   setMessageReadWithFriendId sets lastReadTime = _readTime.
            //
            // NOTE: Client sends "readMsg", NOT "readUserMsg".
            //       "readUserMsg" is old/dead name — kept as alias for compatibility.
            logger.info('USERMSG', 'action=' + action + ' userId=' + (userId || '-') + ' friendId=' + (parsed.friendId || '-'));
            callback(RH.success({ _readTime: Date.now() }));
            break;

        default:
            logger.warn('USERMSG', 'Unknown action: ' + action);
            callback(RH.error(RH.ErrorCode.INVALID_COMMAND, 'Unknown action: ' + action));
            break;
    }
}

module.exports = { handle: handle };
