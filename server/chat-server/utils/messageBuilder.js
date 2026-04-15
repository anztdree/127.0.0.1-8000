/**
 * =====================================================
 *  Message Builder — Super Warrior Z Chat Server
 * =====================================================
 *
 *  Factory functions for building chat message objects
 *  that exactly match client's ChatDataBaseClass format.
 *
 *  CLIENT FORMAT (main.min.js line 58685, ChatDataBaseClass.getData):
 *    {
 *      _time: number,          // server timestamp (ms)
 *      _kind: number,          // MESSAGE_KIND (0-6)
 *      _name: string,          // sender nickName
 *      _content: string,       // message text
 *      _id: string,            // sender userId
 *      _image: string,         // sender head image
 *      _param: object|null,    // extra params (array of {cxt, linkType, itemId, displayId, userId})
 *      _type: number,          // msgType / SYSTEM_MESSAGE_TYPE (CRITICAL: must NOT be undefined!)
 *      _headEffect: number,    // head frame/effect ID (was null → BUG, now defaults to 0)
 *      _headBox: number,       // head box/frame ID (client renames to _headBoxId internally)
 *      _oriServerId: number,   // original server ID (cross-server)
 *      _serverId: number,      // current server ID
 *      _showMain: boolean      // whether to show in main broadcast ticker (was missing → BUG)
 *    }
 *
 *  CRITICAL FIXES vs original implementation:
 *    1. _headEffect: null → 0 (client expects number, null can crash UI)
 *    2. _showMain: added (client uses this for broadcast ticker filtering, line 58388)
 *    3. _type: always set explicitly (undefined causes ChatDataBaseClass.getData to return void)
 *
 * =====================================================
 */

'use strict';

var MESSAGE_KIND = require('./chatConstants').MESSAGE_KIND;
var SYSTEM_MESSAGE_TYPE = require('./chatConstants').SYSTEM_MESSAGE_TYPE;
var LIMITS = require('./chatConstants').LIMITS;

/**
 * Build a user chat message matching client's ChatDataBaseClass format.
 *
 * @param {object} senderInfo
 * @param {string} senderInfo.userId - Sender's user ID
 * @param {string} [senderInfo.nickName] - Sender's display name
 * @param {string} [senderInfo.headImage] - Sender's avatar image
 * @param {number} [senderInfo.headBox] - Head box/frame ID (default 0)
 * @param {number} [senderInfo.headEffect] - Head effect ID (default 0)
 * @param {number} [senderInfo.serverId] - Current server ID
 * @param {number} [senderInfo.oriServerId] - Original server ID
 * @param {number} kind - MESSAGE_KIND enum value
 * @param {string} content - Message text
 * @param {number} [msgType=0] - SYSTEM_MESSAGE_TYPE (0 = normal chat)
 * @param {object|null} [param=null] - Extra params for rich text links
 * @param {number} [time] - Server timestamp (auto-generated if omitted)
 * @param {boolean} [showMain=false] - Show in main broadcast ticker
 * @returns {object} Chat message object
 */
function buildChatMessage(senderInfo, kind, content, msgType, param, time, showMain) {
    var serverId = senderInfo.serverId || 0;
    var oriServerId = senderInfo.oriServerId || serverId;

    return {
        _time: time || Date.now(),
        _kind: kind,
        _name: senderInfo.nickName || senderInfo.userId || '',
        _content: content || '',
        _id: senderInfo.userId || '',
        _image: senderInfo.headImage || '',
        _param: param || null,
        _type: (msgType !== undefined && msgType !== null) ? msgType : 0,
        _headEffect: senderInfo.headEffect || 0,
        _headBox: senderInfo.headBox || 0,
        _oriServerId: oriServerId,
        _serverId: serverId,
        _showMain: !!showMain,
    };
}

/**
 * Build a system message (server-generated announcement).
 *
 * WARNING: System messages (_kind==1) are risky!
 * Client's BroadcastSingleton.setChatValue() looks up noticeContent[_type].
 * If _type doesn't exist in noticeContent.json, client crashes: "s[r] is undefined".
 * Only use system messages with _type values that exist in noticeContent.json.
 *
 * @param {string} content - Message text
 * @param {number} sysType - SYSTEM_MESSAGE_TYPE that exists in noticeContent.json
 * @param {object|null} [param=null] - Template params (replaces {0}, {1}, etc.)
 * @param {number} [time] - Server timestamp
 * @returns {object} System chat message object
 */
function buildSystemMessage(content, sysType, param, time) {
    return {
        _time: time || Date.now(),
        _kind: MESSAGE_KIND.SYSTEM,
        _name: 'System',
        _content: content || '',
        _id: '0',
        _image: '',
        _param: param || null,
        _type: sysType || 0,
        _headEffect: 0,
        _headBox: 0,
        _oriServerId: 0,
        _serverId: 0,
        _showMain: false,
    };
}

/**
 * Validate message content before sending.
 * Enforces length limit and basic sanity checks.
 *
 * @param {string} content - Message text to validate
 * @returns {{valid: boolean, reason: string|null}}
 */
function validateContent(content) {
    if (!content || typeof content !== 'string') {
        return { valid: false, reason: 'Content is empty or invalid' };
    }

    var trimmed = content.trim();
    if (trimmed.length === 0) {
        return { valid: false, reason: 'Content is whitespace only' };
    }

    if (trimmed.length > LIMITS.MAX_CONTENT_LENGTH) {
        return { valid: false, reason: 'Content exceeds ' + LIMITS.MAX_CONTENT_LENGTH + ' chars' };
    }

    return { valid: true, reason: null };
}

module.exports = {
    buildChatMessage: buildChatMessage,
    buildSystemMessage: buildSystemMessage,
    validateContent: validateContent,
};
