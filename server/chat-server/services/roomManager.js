/**
 * =====================================================
 *  Room Manager — Super Warrior Z Chat Server
 * =====================================================
 *
 *  Manages chat room lifecycle: create, join, leave, destroy.
 *  Tracks which sockets are in which rooms.
 *
 *  Room ID mapping (from client + main-server registChat):
 *    World:           roomId = serverId * 100 + 1  (default: 101)
 *    Guild:           roomId = serverId * 100 + 2  (default: 102)
 *    Team Dungeon:    roomId = serverId * 100 + 3  (default: 103)
 *    Team:            roomId = serverId * 100 + 4  (default: 104)
 *
 *  Legacy compatibility: if serverId=1 and old-style IDs (1,2,3,4)
 *  are used, both are supported transparently.
 *
 *  In-memory only — rooms are ephemeral by design.
 * =====================================================
 */

'use strict';

var logger = require('../../shared/utils/logger');

/**
 * Create a new RoomManager instance.
 *
 * @returns {object} RoomManager with join/leave/getAll/etc methods
 */
function createRoomManager() {
    /**
     * Room membership storage.
     * Key: roomId (number)
     * Value: Set<socketId> — active socket IDs in the room
     *
     * @type {Object.<number, Set<string>>}
     */
    var rooms = {};

    /**
     * Socket → roomId reverse mapping for fast cleanup.
     * Key: socketId (string)
     * Value: Set<roomId> — rooms this socket has joined
     *
     * @type {Object.<string, Set<number>>}
     */
    var socketRooms = {};

    return {
        /**
         * Add a socket to a room.
         *
         * @param {number} roomId
         * @param {string} socketId
         * @returns {boolean} true if newly joined, false if already in room
         */
        join: function(roomId, socketId) {
            // Init room if not exists
            if (!rooms[roomId]) {
                rooms[roomId] = new Set();
            }

            // Track socket → room mapping
            if (!socketRooms[socketId]) {
                socketRooms[socketId] = new Set();
            }

            var isNew = !rooms[roomId].has(socketId);
            rooms[roomId].add(socketId);
            socketRooms[socketId].add(roomId);

            return isNew;
        },

        /**
         * Remove a socket from a specific room.
         *
         * @param {number} roomId
         * @param {string} socketId
         * @returns {boolean} true if was in room, false if wasn't
         */
        leave: function(roomId, socketId) {
            var wasInRoom = false;

            if (rooms[roomId]) {
                wasInRoom = rooms[roomId].delete(socketId);
                // Clean up empty rooms
                if (rooms[roomId].size === 0) {
                    delete rooms[roomId];
                }
            }

            if (socketRooms[socketId]) {
                socketRooms[socketId].delete(roomId);
                if (socketRooms[socketId].size === 0) {
                    delete socketRooms[socketId];
                }
            }

            return wasInRoom;
        },

        /**
         * Remove a socket from ALL rooms it has joined.
         * Used on disconnect.
         *
         * @param {string} socketId
         * @returns {number} Number of rooms left
         */
        leaveAll: function(socketId) {
            var roomIds = socketRooms[socketId];
            if (!roomIds) return 0;

            var count = roomIds.size;
            roomIds.forEach(function(roomId) {
                if (rooms[roomId]) {
                    rooms[roomId].delete(socketId);
                    if (rooms[roomId].size === 0) {
                        delete rooms[roomId];
                    }
                }
            });

            delete socketRooms[socketId];
            return count;
        },

        /**
         * Get all socket IDs in a specific room.
         *
         * @param {number} roomId
         * @returns {Array<string>} Array of socket IDs (empty if room doesn't exist)
         */
        getRoomMembers: function(roomId) {
            if (!rooms[roomId]) return [];
            return Array.from(rooms[roomId]);
        },

        /**
         * Get all room IDs that a socket has joined.
         *
         * @param {string} socketId
         * @returns {Array<number>} Array of room IDs
         */
        getSocketRooms: function(socketId) {
            if (!socketRooms[socketId]) return [];
            return Array.from(socketRooms[socketId]);
        },

        /**
         * Check if a socket is in a specific room.
         *
         * @param {number} roomId
         * @param {string} socketId
         * @returns {boolean}
         */
        isInRoom: function(roomId, socketId) {
            if (!rooms[roomId]) return false;
            return rooms[roomId].has(socketId);
        },

        /**
         * Get the number of members in a room.
         *
         * @param {number} roomId
         * @returns {number}
         */
        getMemberCount: function(roomId) {
            if (!rooms[roomId]) return 0;
            return rooms[roomId].size;
        },

        /**
         * Get all active room IDs.
         *
         * @returns {Array<number>}
         */
        getActiveRoomIds: function() {
            return Object.keys(rooms).map(Number);
        },

        /**
         * Get the total number of active rooms.
         *
         * @returns {number}
         */
        getActiveRoomCount: function() {
            return Object.keys(rooms).length;
        },

        /**
         * Get statistics for monitoring/health endpoint.
         *
         * @returns {object} Room stats
         */
        getStats: function() {
            var roomIds = Object.keys(rooms);
            var totalMembers = 0;
            var roomDetails = [];

            for (var i = 0; i < roomIds.length; i++) {
                var rid = roomIds[i];
                var count = rooms[rid].size;
                totalMembers += count;
                roomDetails.push({ roomId: Number(rid), members: count });
            }

            return {
                totalRooms: roomIds.length,
                totalMembers: totalMembers,
                rooms: roomDetails,
            };
        },

        /**
         * Reset all rooms. Used for shutdown/testing.
         */
        reset: function() {
            rooms = {};
            socketRooms = {};
        },
    };
}

module.exports = { createRoomManager: createRoomManager };
