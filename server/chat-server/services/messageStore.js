/**
 * =====================================================
 *  Message Store — Super Warrior Z Chat Server
 * =====================================================
 *
 *  Manages in-memory message history per room.
 *
 *  Client expects: _record = [msg1, msg2, ...] from joinRoom & getRecord
 *  Client limit:  60 messages per kind (line 77271: ts.chatData[t].length > 60 → splice)
 *  Server limit:  60 messages per room (matching client limit)
 *
 *  Messages are stored in memory only (ephemeral).
 *  On server restart, all history is lost — this matches
 *  the original official server behavior (chat is transient).
 *
 *  Future enhancement: optional DB persistence via models/chatLog.js
 * =====================================================
 */

'use strict';

var logger = require('../../shared/utils/logger');
var LIMITS = require('../utils/chatConstants').LIMITS;

/**
 * Create a new MessageStore instance.
 *
 * @param {object} [options]
 * @param {number} [options.maxPerRoom] - Max messages per room (default: LIMITS.MAX_MESSAGES_PER_ROOM)
 * @returns {object} MessageStore with store/get/filter/etc methods
 */
function createMessageStore(options) {
    var maxPerRoom = (options && options.maxPerRoom) || LIMITS.MAX_MESSAGES_PER_ROOM;

    /**
     * Message history per room.
     * Key: roomId (number)
     * Value: Array<message objects>
     *
     * @type {Object.<number, Array<object>>}
     */
    var store = {};

    return {
        /**
         * Store a message in room history.
         * Automatically trims to maxPerRoom (FIFO — oldest removed first).
         *
         * @param {number} roomId
         * @param {object} message - Chat message object
         * @returns {number} Current message count in room after storing
         */
        store: function(roomId, message) {
            if (!store[roomId]) {
                store[roomId] = [];
            }

            store[roomId].push(message);

            // Enforce max limit (FIFO trim)
            if (store[roomId].length > maxPerRoom) {
                var excess = store[roomId].length - maxPerRoom;
                store[roomId].splice(0, excess);
            }

            return store[roomId].length;
        },

        /**
         * Get all messages for a room.
         *
         * @param {number} roomId
         * @returns {Array<object>} Copy of messages array (empty if room doesn't exist)
         */
        getMessages: function(roomId) {
            if (!store[roomId]) return [];
            // Return a copy to prevent external mutation
            return store[roomId].slice();
        },

        /**
         * Get messages filtered by start time.
         * Used by getRecord action which accepts startTime parameter.
         *
         * CLIENT CODE (line 58328):
         *   startTime: t.teamDungeonInfoStartTime
         *
         * @param {number} roomId
         * @param {number} [startTime=0] - Unix timestamp (ms), return messages >= this time
         * @returns {Array<object>} Filtered messages
         */
        getMessagesSince: function(roomId, startTime) {
            var all = store[roomId];
            if (!all) return [];

            if (!startTime || startTime <= 0) {
                return all.slice();
            }

            var filtered = [];
            for (var i = 0; i < all.length; i++) {
                if (all[i]._time >= startTime) {
                    filtered.push(all[i]);
                }
            }

            return filtered;
        },

        /**
         * Get the count of messages in a room.
         *
         * @param {number} roomId
         * @returns {number}
         */
        getMessageCount: function(roomId) {
            if (!store[roomId]) return 0;
            return store[roomId].length;
        },

        /**
         * Clear all messages for a specific room.
         *
         * @param {number} roomId
         * @returns {boolean} true if room existed and was cleared
         */
        clearRoom: function(roomId) {
            if (store[roomId]) {
                delete store[roomId];
                return true;
            }
            return false;
        },

        /**
         * Get statistics for monitoring/health endpoint.
         *
         * @returns {object} Store stats
         */
        getStats: function() {
            var roomIds = Object.keys(store);
            var totalMessages = 0;

            for (var i = 0; i < roomIds.length; i++) {
                totalMessages += store[roomIds[i]].length;
            }

            return {
                totalRooms: roomIds.length,
                totalMessages: totalMessages,
                maxPerRoom: maxPerRoom,
            };
        },

        /**
         * Reset all stored messages. Used for shutdown/testing.
         */
        reset: function() {
            store = {};
        },
    };
}

module.exports = { createMessageStore: createMessageStore };
