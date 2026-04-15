/**
 * =====================================================
 *  User Manager — Super Warrior Z Chat Server
 * =====================================================
 *
 *  Tracks connected chat users, their socket info, and ban status.
 *
 *  Two mappings maintained:
 *    socketUsers[socketId]  → { userId, serverId, nickName, ... }
 *    connectedUsers[userId] → { socket, userInfo, forbiddenChat, rooms }
 *
 *  Ban system (from main-server Notify action "updateForbiddenChat"):
 *    forbiddenChat = { userId: finishTime }
 *    finishTime = 0 → permanent ban
 *    finishTime > 0 → temporary ban until that timestamp
 *
 *  Client enforces ban via BroadcastSingleton.getBlacklistPlayerInfo()
 *  which filters messages from banned users. Server also enforces
 *  by blocking sendMsg with error 36001.
 *
 *  NOTE: Ban data comes from main-server push notifications.
 *  Chat-server does NOT independently manage bans — it receives
 *  ban info and enforces it locally.
 * =====================================================
 */

'use strict';

var DB = require('../../database/connection');
var logger = require('../../shared/utils/logger');

/**
 * Create a new UserManager instance.
 *
 * @returns {object} UserManager with login/logout/ban methods
 */
function createUserManager() {
    /**
     * socket → user info mapping.
     * Key: socket.id (string)
     * Value: { userId, serverId, nickName, headImage, oriServerId, headBox, headEffect }
     *
     * @type {Object.<string, object>}
     */
    var socketUsers = {};

    /**
     * userId → connection info mapping.
     * Key: userId (string)
     * Value: { socket, userInfo, forbiddenChat, rooms }
     *
     * @type {Object.<string, object>}
     */
    var connectedUsers = {};

    return {
        /**
         * Register a user after chat login.
         * Loads user info from DB, stores in memory mappings.
         *
         * @param {string} socketId - Socket.IO socket ID
         * @param {object} socket - Socket.IO socket reference
         * @param {string} userId - User ID
         * @param {number} [serverId=1] - Server ID
         * @returns {Promise<object>} User info object
         */
        login: async function(socketId, socket, userId, serverId) {
            var sid = serverId || 1;
            var userInfo = { userId: userId, serverId: sid };

            // Try to load user info from database
            try {
                var rows = await DB.query(
                    'SELECT user_id, nick_name, head_image, ori_server_id FROM users WHERE user_id = ?',
                    [userId]
                );

                if (rows.length > 0) {
                    userInfo.nickName = rows[0].nick_name || userId;
                    userInfo.headImage = rows[0].head_image || '';
                    userInfo.oriServerId = rows[0].ori_server_id || sid;
                } else {
                    userInfo.nickName = userId;
                    userInfo.headImage = '';
                    userInfo.oriServerId = sid;
                }
            } catch (dbErr) {
                logger.warn('CHAT', 'userManager.login: DB lookup failed for ' + userId + ': ' + dbErr.message);
                userInfo.nickName = userId;
                userInfo.headImage = '';
                userInfo.oriServerId = sid;
            }

            // Default fields that may not come from DB
            userInfo.headBox = userInfo.headBox || 0;
            userInfo.headEffect = userInfo.headEffect || 0;

            // Store in both mappings
            socketUsers[socketId] = userInfo;

            connectedUsers[userId] = {
                socket: socket,
                userInfo: userInfo,
                forbiddenChat: null,
                rooms: new Set(),
            };

            logger.info('CHAT', 'userManager.login: userId=' + userId + ' nick=' + userInfo.nickName);
            return userInfo;
        },

        /**
         * Unregister a user on disconnect.
         * Cleans up both mappings.
         *
         * @param {string} socketId - Socket.IO socket ID
         * @returns {{userId: string|null, roomsLeft: Array<number>}}
         */
        logout: function(socketId) {
            var userInfo = socketUsers[socketId];
            if (!userInfo) {
                return { userId: null, roomsLeft: [] };
            }

            var userId = userInfo.userId;
            var roomsLeft = [];

            // Only remove connectedUsers if this is the same socket
            if (connectedUsers[userId] && connectedUsers[userId].socket.id === socketId) {
                if (connectedUsers[userId].rooms) {
                    roomsLeft = Array.from(connectedUsers[userId].rooms);
                }
                delete connectedUsers[userId];
            }

            delete socketUsers[socketId];

            return { userId: userId, roomsLeft: roomsLeft };
        },

        /**
         * Get user info by socket ID.
         *
         * @param {string} socketId
         * @returns {object|null} User info or null
         */
        getBySocketId: function(socketId) {
            return socketUsers[socketId] || null;
        },

        /**
         * Get user info by userId.
         *
         * @param {string} userId
         * @returns {object|null} Connected user entry or null
         */
        getByUserId: function(userId) {
            return connectedUsers[userId] || null;
        },

        /**
         * Get the socket for a specific userId.
         * Used for direct private messaging if needed.
         *
         * @param {string} userId
         * @returns {object|null} Socket or null if not connected
         */
        getSocketByUserId: function(userId) {
            var entry = connectedUsers[userId];
            if (!entry) return null;
            return entry.socket || null;
        },

        /**
         * Update ban data for users.
         * Called when main-server pushes "updateForbiddenChat" notification.
         *
         * CLIENT CODE (line 58626, setUserBidden):
         *   forbiddenChat = { userId: finishTime }
         *   finishTime = 0 → permanent ban
         *   finishTime > 0 → temporary until timestamp
         *
         * @param {object} banData
         * @param {Array<string>} banData.users - Array of userId strings
         * @param {object} banData.finishTime - { userId: timestamp }
         */
        updateBanData: function(banData) {
            if (!banData || !banData.users) return;

            var users = banData.users;
            var finishTimes = banData.finishTime || {};

            for (var i = 0; i < users.length; i++) {
                var uid = users[i];
                var entry = connectedUsers[uid];
                if (entry) {
                    entry.forbiddenChat = {
                        finishTime: finishTimes[uid] || 0,
                    };
                    logger.info('CHAT', 'userManager.updateBan: userId=' + uid +
                        ' finishTime=' + (finishTimes[uid] || 0));
                }
            }
        },

        /**
         * Check if a user is currently chat-banned.
         *
         * @param {string} userId
         * @returns {boolean} true if banned
         */
        isBanned: function(userId) {
            var entry = connectedUsers[userId];
            if (!entry) return false;

            var banInfo = entry.forbiddenChat;
            if (!banInfo || !banInfo.finishTime) return false;

            var finishTime = banInfo.finishTime;

            // 0 = permanent ban
            if (finishTime === 0) return true;

            // Check if ban has expired
            if (finishTime > Date.now()) return true;

            // Ban expired — clean up
            entry.forbiddenChat = null;
            return false;
        },

        /**
         * Track that a user has joined a room.
         *
         * @param {string} userId
         * @param {number} roomId
         */
        addRoom: function(userId, roomId) {
            var entry = connectedUsers[userId];
            if (entry && entry.rooms) {
                entry.rooms.add(roomId);
            }
        },

        /**
         * Track that a user has left a room.
         *
         * @param {string} userId
         * @param {number} roomId
         */
        removeRoom: function(userId, roomId) {
            var entry = connectedUsers[userId];
            if (entry && entry.rooms) {
                entry.rooms.delete(roomId);
            }
        },

        /**
         * Get statistics for monitoring/health endpoint.
         *
         * @returns {object}
         */
        getStats: function() {
            return {
                connectedUsers: Object.keys(connectedUsers).length,
                trackedSockets: Object.keys(socketUsers).length,
            };
        },

        /**
         * Get all connected user IDs.
         *
         * @returns {Array<string>}
         */
        getConnectedUserIds: function() {
            return Object.keys(connectedUsers);
        },

        /**
         * Reset all user tracking. Used for shutdown/testing.
         */
        reset: function() {
            socketUsers = {};
            connectedUsers = {};
        },
    };
}

module.exports = { createUserManager: createUserManager };
