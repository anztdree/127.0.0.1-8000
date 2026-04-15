/**
 * =====================================================
 *  Team Manager — Super Warrior Z Dungeon Server
 * =====================================================
 *
 *  Manages team dungeon rooms: create, join, leave, positions,
 *  battle state, apply list, auto-join conditions.
 *
 *  Data flow:
 *    Client connects → clientConnect (register in team) →
 *    changePos / refreshApplyList / startBattle / agree →
 *    Server pushes Notify events (TDMemberJoin, TDStartBattle, etc.)
 *
 *  Team object structure:
 *    {
 *      teamId: string,
 *      dungeonId: number,
 *      owner: userId,
 *      members: [{ userId, socket, pos, role, isRobot, joinedAt }],
 *      state: TEAM_STATE,
 *      autoJoin: number,
 *      condition: object,
 *      applyList: [userId],
 *      createdAt: number,
 *      lastActivityAt: number,
 *    }
 * =====================================================
 */

'use strict';

var logger = require('../../shared/utils/logger');
var TEAM_STATE = require('../utils/dungeonConstants').TEAM_STATE;
var NOTIFY_ACTION = require('../utils/dungeonConstants').NOTIFY_ACTION;
var LIMITS = require('../utils/dungeonConstants').LIMITS;

/**
 * Create a new TeamManager instance.
 *
 * @returns {object} TeamManager
 */
function createTeamManager() {
    /**
     * Active teams.
     * Key: teamId (string)
     * Value: team object
     * @type {Object.<string, object>}
     */
    var teams = {};

    /**
     * User → team mapping (for quick lookup).
     * Key: userId (string)
     * Value: teamId (string)
     * @type {Object.<string, string>}
     */
    var userTeamMap = {};

    /**
     * Socket → userId mapping.
     * Key: socketId (string)
     * Value: userId (string)
     * @type {Object.<string, string>}
     */
    var socketUserMap = {};

    var teamCounter = 0;

    return {
        /**
         * Generate a unique team ID.
         * @returns {string}
         */
        generateTeamId: function() {
            teamCounter++;
            return 'team_' + Date.now() + '_' + teamCounter;
        },

        /**
         * Register a user+socket pair (from clientConnect).
         *
         * @param {string} socketId
         * @param {string} userId
         */
        registerSocket: function(socketId, userId) {
            socketUserMap[socketId] = userId;
        },

        /**
         * Unregister a socket (on disconnect).
         *
         * @param {string} socketId
         * @returns {{userId: string|null, teamId: string|null}}
         */
        unregisterSocket: function(socketId) {
            var userId = socketUserMap[socketId];
            delete socketUserMap[socketId];

            if (userId) {
                var teamId = userTeamMap[userId];
                return { userId: userId, teamId: teamId || null };
            }
            return { userId: null, teamId: null };
        },

        /**
         * Get userId by socketId.
         * @param {string} socketId
         * @returns {string|null}
         */
        getUserIdBySocket: function(socketId) {
            return socketUserMap[socketId] || null;
        },

        /**
         * Create a new team.
         *
         * @param {string} userId
         * @param {object} socket
         * @param {number} dungeonId
         * @returns {object} Created team
         */
        createTeam: function(userId, socket, dungeonId, explicitTeamId) {
            var teamId = explicitTeamId || this.generateTeamId();
            var team = {
                teamId: teamId,
                dungeonId: dungeonId,
                owner: userId,
                members: [{
                    userId: userId,
                    socket: socket,
                    pos: 0,
                    role: 'attacker',
                    isRobot: false,
                    joinedAt: Date.now(),
                }],
                state: TEAM_STATE.WAITING,
                autoJoin: LIMITS.AUTO_JOIN_NONE,
                condition: {},
                applyList: [],
                createdAt: Date.now(),
                lastActivityAt: Date.now(),
            };

            teams[teamId] = team;
            userTeamMap[userId] = teamId;

            logger.info('DUNGEON', 'teamManager: Created team ' + teamId +
                ' owner=' + userId + ' dungeon=' + dungeonId);
            return team;
        },

        /**
         * Get a team by ID.
         * @param {string} teamId
         * @returns {object|null}
         */
        getTeam: function(teamId) {
            return teams[teamId] || null;
        },

        /**
         * Get the team a user is in.
         * @param {string} userId
         * @returns {object|null}
         */
        getUserTeam: function(userId) {
            var teamId = userTeamMap[userId];
            if (!teamId) return null;
            return teams[teamId] || null;
        },

        /**
         * Add a member to a team.
         *
         * @param {string} teamId
         * @param {string} userId
         * @param {object} socket
         * @param {boolean} isRobot
         * @returns {boolean} true if added successfully
         */
        addMember: function(teamId, userId, socket, isRobot) {
            var team = teams[teamId];
            if (!team) return false;
            if (team.members.length >= LIMITS.MAX_TEAM_MEMBERS) return false;

            var existing = team.members.find(function(m) { return m.userId === userId; });
            if (existing) return false;

            team.members.push({
                userId: userId,
                socket: socket,
                pos: team.members.length,
                role: 'supporter',
                isRobot: !!isRobot,
                joinedAt: Date.now(),
            });

            userTeamMap[userId] = teamId;
            team.lastActivityAt = Date.now();

            logger.info('DUNGEON', 'teamManager: Member joined team ' + teamId +
                ' userId=' + userId + ' isRobot=' + !!isRobot);
            return true;
        },

        /**
         * Remove a member from a team.
         *
         * @param {string} teamId
         * @param {string} userId
         * @returns {object|null} Removed member info or null
         */
        removeMember: function(teamId, userId) {
            var team = teams[teamId];
            if (!team) return null;

            var idx = -1;
            for (var i = 0; i < team.members.length; i++) {
                if (team.members[i].userId === userId) {
                    idx = i;
                    break;
                }
            }

            if (idx === -1) return null;

            var removed = team.members.splice(idx, 1)[0];
            delete userTeamMap[userId];
            team.lastActivityAt = Date.now();

            // Re-index positions
            for (var j = 0; j < team.members.length; j++) {
                team.members[j].pos = j;
            }

            // Disband if owner left or empty
            if (userId === team.owner || team.members.length === 0) {
                team.state = TEAM_STATE.DISBANDED;
                this.disbandTeam(teamId);
            }

            logger.info('DUNGEON', 'teamManager: Member left team ' + teamId + ' userId=' + userId);
            return removed;
        },

        /**
         * Change member positions (posMap).
         *
         * @param {string} teamId
         * @param {object} posMap - { userId: newPos, ... }
         * @returns {boolean}
         */
        changePositions: function(teamId, posMap) {
            var team = teams[teamId];
            if (!team) return false;

            for (var userId in posMap) {
                if (posMap.hasOwnProperty(userId)) {
                    for (var i = 0; i < team.members.length; i++) {
                        if (team.members[i].userId === userId) {
                            team.members[i].pos = posMap[userId];
                            break;
                        }
                    }
                }
            }

            team.lastActivityAt = Date.now();
            return true;
        },

        /**
         * Start a battle for a team.
         *
         * @param {string} teamId
         * @returns {boolean}
         */
        startBattle: function(teamId) {
            var team = teams[teamId];
            if (!team) return false;

            team.state = TEAM_STATE.IN_PROGRESS;
            team.lastActivityAt = Date.now();

            logger.info('DUNGEON', 'teamManager: Battle started for team ' + teamId);
            return true;
        },

        /**
         * Complete a battle for a team.
         *
         * @param {string} teamId
         * @returns {boolean}
         */
        completeBattle: function(teamId) {
            var team = teams[teamId];
            if (!team) return false;

            team.state = TEAM_STATE.COMPLETED;
            team.lastActivityAt = Date.now();
            return true;
        },

        /**
         * Add to apply list.
         *
         * @param {string} teamId
         * @param {string} userId
         * @returns {boolean}
         */
        addApply: function(teamId, userId) {
            var team = teams[teamId];
            if (!team) return false;
            if (team.applyList.indexOf(userId) !== -1) return false;

            team.applyList.push(userId);
            team.lastActivityAt = Date.now();
            return true;
        },

        /**
         * Remove from apply list (when accepted or rejected).
         *
         * @param {string} teamId
         * @param {string} userId
         * @returns {boolean}
         */
        removeApply: function(teamId, userId) {
            var team = teams[teamId];
            if (!team) return false;

            var idx = team.applyList.indexOf(userId);
            if (idx === -1) return false;

            team.applyList.splice(idx, 1);
            return true;
        },

        /**
         * Set auto-join condition for a team.
         *
         * @param {string} teamId
         * @param {number} autoJoin
         * @param {object} condition
         * @returns {boolean}
         */
        setAutoJoin: function(teamId, autoJoin, condition) {
            var team = teams[teamId];
            if (!team) return false;

            team.autoJoin = autoJoin;
            team.condition = condition || {};
            return true;
        },

        /**
         * Disband a team and clean up all references.
         *
         * @param {string} teamId
         */
        disbandTeam: function(teamId) {
            var team = teams[teamId];
            if (!team) return;

            for (var i = 0; i < team.members.length; i++) {
                delete userTeamMap[team.members[i].userId];
            }

            delete teams[teamId];
            logger.info('DUNGEON', 'teamManager: Disbanded team ' + teamId);
        },

        /**
         * Get team info for client response (excluding socket refs).
         *
         * @param {string} teamId
         * @returns {object|null} Sanitized team info
         */
        getTeamInfo: function(teamId) {
            var team = teams[teamId];
            if (!team) return null;

            // Build users object keyed by userId
            // Client expects: i.users[o.userId] = o  (main.min.js L145136)
            // Each entry must have: userId, pos, type, isRobot, joinTime
            // Source: L144855 e.users[userId].joinTime, L144859 r.type
            var users = {};
            for (var i = 0; i < team.members.length; i++) {
                var m = team.members[i];
                users[m.userId] = {
                    userId: m.userId,
                    pos: m.pos,
                    type: m.isRobot ? 1 : 0,  // 0 = player, 1 = robot (L144859: r.type)
                    isRobot: m.isRobot,
                    joinTime: m.joinedAt,       // L144855: e.users[userId].joinTime
                };
            }

            // Client expects these fields (main.min.js L144843, L147665-147671):
            //   o._teamInfo.captain    → owner userId
            //   o._teamInfo.users       → {userId: {userId, pos, type, isRobot, joinTime}, ...}
            //   o._teamInfo.memberCount → number
            //   o._teamInfo.id          → teamId string
            //   o._teamInfo.dungeonId   → dungeon type id
            //   o._teamInfo.closeTime   → team expiry timestamp (L147671)
            //   o._teamInfo.displayId   → short team display ID (L147671)
            //   o._teamInfo.autoJoinCondition → condition object (L147671)
            var closeTime = team.createdAt + LIMITS.ROOM_TIMEOUT_MS;
            // displayId: extract numeric portion from teamId (e.g. team_1234_1 → 1234)
            var displayId = team.teamId.replace(/[^0-9]/g, '').substring(0, 8);

            return {
                id: team.teamId,
                captain: team.owner,
                users: users,
                memberCount: team.members.length,
                dungeonId: team.dungeonId,
                closeTime: closeTime,
                displayId: displayId,
                autoJoin: team.autoJoin,
                autoJoinCondition: team.condition,
                state: team.state,
                applyCount: team.applyList.length,
                createdAt: team.createdAt,
                lastActivityAt: team.lastActivityAt,
            };
        },

        /**
         * Get members info for client (without socket refs).
         *
         * Returns OBJECT keyed by userId, NOT array.
         * Client L144859: i.deserialize(t[a]) where t = _usersInfo, a = userId
         * So _usersInfo must be {userId: {serialized_user_data}, ...}
         *
         * For non-robot members, the value is a serialized ZkTeamUser-like object
         * that the client passes to i.deserialize(). Must include _userId, _nickName, _headImage.
         * For robot members, the client uses todayRobots[userId] instead (L144859).
         *
         * @param {string} teamId
         * @returns {Object.<string, object>} userId → user info object
         */
        getMembersInfo: function(teamId) {
            var team = teams[teamId];
            if (!team) return {};

            var result = {};
            for (var i = 0; i < team.members.length; i++) {
                var m = team.members[i];
                // For non-robot members, provide basic user info for deserialize()
                // For robot members, client uses todayRobots from queryRobot response
                if (!m.isRobot) {
                    result[m.userId] = {
                        _userId: m.userId,
                        _nickName: '',
                        _headImage: '',
                        _isRobot: 0,
                    };
                }
            }
            return result;
        },

        /**
         * Get all team members with socket references (for broadcasting).
         *
         * @param {string} teamId
         * @returns {Array<object>}
         */
        getTeamMembers: function(teamId) {
            var team = teams[teamId];
            if (!team) return [];
            return team.members.slice();
        },

        /**
         * Get statistics.
         *
         * @returns {object}
         */
        getStats: function() {
            var teamIds = Object.keys(teams);
            var totalMembers = 0;
            var stateCounts = {};

            for (var i = 0; i < teamIds.length; i++) {
                var t = teams[teamIds[i]];
                totalMembers += t.members.length;
                stateCounts[t.state] = (stateCounts[t.state] || 0) + 1;
            }

            return {
                totalTeams: teamIds.length,
                totalMembers: totalMembers,
                stateCounts: stateCounts,
                trackedUsers: Object.keys(userTeamMap).length,
            };
        },

        /**
         * Cleanup expired teams. Called periodically.
         *
         * @returns {number} Cleaned count
         */
        cleanupExpired: function() {
            var now = Date.now();
            var cleaned = 0;
            var teamIds = Object.keys(teams);

            for (var i = 0; i < teamIds.length; i++) {
                var t = teams[teamIds[i]];
                if (t.state !== TEAM_STATE.IN_PROGRESS &&
                    now - t.lastActivityAt > LIMITS.ROOM_TIMEOUT_MS) {
                    this.disbandTeam(teamIds[i]);
                    cleaned++;
                }
            }

            return cleaned;
        },

        /**
         * Reset everything (shutdown/testing).
         */
        reset: function() {
            teams = {};
            userTeamMap = {};
            socketUserMap = {};
        },
    };
}

module.exports = { createTeamManager: createTeamManager };
