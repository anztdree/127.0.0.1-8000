/**
 * =====================================================
 *  notifications/index.js — Push Notification System
 *  Super Warrior Z Game Server — Main Server
 *
 *  Server-to-client push notification system.
 *  Main server pushes notifications via the "Notify" Socket.IO event.
 *
 *  Client listens:
 *    socket.on("Notify", function(data) {
 *        if ("SUCCESS" == data.ret) {
 *            switch(data.action) {
 *                case "kickout": ...
 *                case "payFinish": ...
 *                ...
 *            }
 *        }
 *    })
 *
 *  PUSH FORMAT (from responseHelper.push):
 *    {
 *      ret: "SUCCESS",          // String "SUCCESS" (NOT number 0)
 *      data: "{ JSON string }",
 *      action: "kickout",       // Matches NOTIFY_ACTION enum
 *      serverTime: 1700000000,
 *      server0Time: 1700000000
 *    }
 *
 *  Usage:
 *    var Notifications = require('./notifications');
 *    Notifications.sendNotify(socket, 'kickout', { reason: 'duplicate_login' });
 *    Notifications.sendNotifyToUser(userId, 'mailNew', { mailId: 123 });
 *    Notifications.broadcastNotify('broadcast', { text: 'Server maintenance in 5 min' });
 * =====================================================
 */

'use strict';

var ResponseHelper = require('../../shared/responseHelper');
var NOTIFY_ACTION = require('./actionTypes');

/**
 * Send a push notification to a specific socket.
 *
 * Uses the "Notify" event which the client listens for (line 77182).
 * The response format uses ret="SUCCESS" (string) which is the
 * client's push detection mechanism.
 *
 * CRITICAL FIX #1: Client reads action from INSIDE the parsed data payload.
 * Client code (line 77182-77188):
 *   var n = t.data;                          // data is JSON string
 *   t.compress && (n = LZString.decompressFromUTF16(n));
 *   var o = JSON.parse(n);                   // o = parsed data object
 *   if("Kickout" == o.action) { ... }       // action read from o (inside data)
 *
 * So the action MUST be inside dataObj, NOT at the top-level of the response.
 *
 * @param {object} socket - Socket.IO socket instance (must be connected)
 * @param {string} action - Notify action type from actionTypes.js (e.g. 'Kickout')
 * @param {object} dataObj - Notification payload object (will be JSON.stringify'd)
 * @returns {boolean} true if sent successfully, false if socket not connected
 *
 * @example
 *  Notifications.sendNotify(socket, 'Kickout', { reason: 'duplicate_login' });
 */
function sendNotify(socket, action, dataObj) {
    if (!socket || !socket.connected) {
        return false;
    }

    // FIX #1: Action must be INSIDE dataObj, not at top-level of response.
    // Client does: o = JSON.parse(t.data); o.action
    // So we merge action into the payload that becomes data string.
    var payload = dataObj || {};
    payload.action = action;

    var pushData = ResponseHelper.push(payload);

    socket.emit('Notify', pushData);
    return true;
}

/**
 * Send a push notification to a specific user by userId.
 *
 * Looks up the user's active socket from connectedClients map
 * and sends the notification. If user is not online, silently returns false.
 *
 * @param {object} connectedClients - Map of userId -> socket (from index.js)
 * @param {number|string} userId - Target user's ID
 * @param {string} action - Notify action type
 * @param {object} dataObj - Notification payload
 * @returns {boolean} true if sent, false if user not online
 *
 * @example
 *  Notifications.sendNotifyToUser(connectedClients, 1001, 'mailNew', { count: 3 });
 */
function sendNotifyToUser(connectedClients, userId, action, dataObj) {
    var socket = connectedClients[userId];
    if (!socket || !socket.connected) {
        return false;
    }

    return sendNotify(socket, action, dataObj);
}

/**
 * Broadcast a push notification to ALL connected users.
 *
 * Iterates over all connected clients and sends the notification
 * to each one. Useful for server-wide announcements and events.
 *
 * @param {object} connectedClients - Map of userId -> socket
 * @param {string} action - Notify action type
 * @param {object} dataObj - Notification payload
 * @returns {number} Number of users the notification was sent to
 *
 * @example
 *  var sent = Notifications.broadcastNotify(connectedClients, 'broadcast', {
 *      text: 'Server maintenance in 5 minutes'
 *  });
 *  console.log('Broadcast sent to ' + sent + ' users');
 */
function broadcastNotify(connectedClients, action, dataObj) {
    var sentCount = 0;
    var userIds = Object.keys(connectedClients);

    for (var i = 0; i < userIds.length; i++) {
        var userId = userIds[i];
        if (sendNotifyToUser(connectedClients, userId, action, dataObj)) {
            sentCount++;
        }
    }

    return sentCount;
}

/**
 * Kick a user with a notification message.
 *
 * Sends a "Notify" event with action="Kickout" so the client
 * shows the proper "Account logged in elsewhere" dialog.
 *
 * Client handler (line 77186):
 *   if("Kickout" == o.action) {
 *       e.mainClient.destroy(), e.chatClient.destroy(),
 *       ts.runScene("Login"),
 *       ts.normalErrorMsg(...)  // shows dialog
 *       return
 *   }
 *
 * FIX #3: Removed socket.emit('kicked', reason) because the client
 * has NO listener for "kicked" event. It was dead code.
 * The client handles kickout ENTIRELY through the Notify mechanism.
 *
 * @param {object} socket - Socket to kick
 * @param {string} [reason='Logged in from another device'] - Kick reason
 */
function kickUser(socket, reason) {
    if (!socket || !socket.connected) {
        return;
    }

    reason = reason || 'Logged in from another device';

    // FIX #3: Only use Notify with Kickout action (client handles everything here)
    // Client: if("Kickout" == o.action) { destroy sockets, go to Login scene }
    sendNotify(socket, NOTIFY_ACTION.KICKOUT, { reason: reason });

    // Small delay to ensure Notify arrives before disconnect
    setTimeout(function () {
        if (socket.connected) {
            socket.disconnect(true);
        }
    }, 100);
}

/**
 * Send a payFinish notification to a user.
 *
 * Client handler (case "payFinish"):
 *   Refreshes diamond/gold balance from server data.
 *   Shows success animation if applicable.
 *
 * @param {object} connectedClients - Map of userId -> socket
 * @param {number|string} userId - Target user
 * @param {object} paymentData - Payment result data (orderId, diamonds, etc.)
 * @returns {boolean} true if sent
 */
function sendPayFinish(connectedClients, userId, paymentData) {
    return sendNotifyToUser(connectedClients, userId, NOTIFY_ACTION.PAY_FINISH, paymentData);
}

/**
 * Send a maintenance warning to all users.
 *
 * @param {object} connectedClients - Map of userId -> socket
 * @param {number} minutesUntilMaintenance - Minutes before shutdown
 * @returns {number} Number of users notified
 */
function sendMaintenanceWarning(connectedClients, minutesUntilMaintenance) {
    return broadcastNotify(connectedClients, NOTIFY_ACTION.MAINTENANCE, {
        minutes: minutesUntilMaintenance,
        message: 'Server will undergo maintenance in ' + minutesUntilMaintenance + ' minutes'
    });
}

module.exports = {
    sendNotify: sendNotify,
    sendNotifyToUser: sendNotifyToUser,
    broadcastNotify: broadcastNotify,
    kickUser: kickUser,
    sendPayFinish: sendPayFinish,
    sendMaintenanceWarning: sendMaintenanceWarning,
    NOTIFY_ACTION: NOTIFY_ACTION
};
