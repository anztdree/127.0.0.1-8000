/**
 * =====================================================
 *  Response Builder — Super Warrior Z Dungeon Server
 * =====================================================
 *
 *  Helpers for building responses matching client expectations.
 *
 *  Push/Notify format (same as chat-server):
 *    { ret: "SUCCESS", data: JSON.stringify(dataObj), action: dataObj.action }
 *
 *  Standard response format:
 *    { ret: 0, data: JSON.stringify(dataObj), compress: bool }
 *
 *  HTTP response format (for teamServerHttpUrl endpoints):
 *    Returns JSON: { ret: 0, data: JSON.stringify(dataObj) }
 * =====================================================
 */

'use strict';

var RH = require('../../shared/responseHelper');

/**
 * Build a Notify push for dungeon-server.
 * Same format as main-server/chat-server Notify.
 *
 * @param {object} dataObj - Push data (must include action field)
 * @returns {object} Notify object { ret:"SUCCESS", data: "..." }
 */
function buildNotify(dataObj) {
    return RH.push(dataObj);
}

/**
 * Broadcast a Notify to all members in a team.
 *
 * @param {Array<object>} members - Team member list with socket references
 * @param {object} dataObj - Push data { action, ... }
 */
function broadcastToTeam(members, dataObj) {
    var notify = buildNotify(dataObj);
    for (var i = 0; i < members.length; i++) {
        var sock = members[i].socket;
        if (sock && sock.connected && sock._verified) {
            sock.emit('Notify', notify);
        }
    }
}

/**
 * Build HTTP response for teamServerHttpUrl endpoints.
 *
 * @param {object} dataObj - Response data
 * @returns {object} HTTP response object
 */
function buildHttpResponse(dataObj) {
    var now = Date.now();
    return {
        ret: 0,
        data: JSON.stringify(dataObj || {}),
        compress: false,
        serverTime: now,
        server0Time: now,
    };
}

/**
 * Build HTTP error response.
 *
 * @param {number} code - Error code
 * @param {string} [msg] - Error message
 * @returns {object}
 */
function buildHttpError(code, msg) {
    var now = Date.now();
    return {
        ret: code,
        data: msg || '',
        compress: false,
        serverTime: now,
        server0Time: now,
    };
}

module.exports = {
    buildNotify: buildNotify,
    broadcastToTeam: broadcastToTeam,
    buildHttpResponse: buildHttpResponse,
    buildHttpError: buildHttpError,
};
