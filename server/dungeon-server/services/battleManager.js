/**
 * =====================================================
 *  Battle Manager — Super Warrior Z Dungeon Server
 * =====================================================
 *
 *  Tracks active team dungeon battles.
 *  Client calculates battles — server only records & validates.
 *
 *  Battle lifecycle:
 *    startBattle → record start → checkBattleResult → validate → complete
 *
 *  Battle object:
 *    {
 *      battleId: string,
 *      teamId: string,
 *      state: "active" | "completed",
 *      startedAt: number,
 *      completedAt: number,
 *      leftTeam: [...],
 *      rightTeam: [...],
 *      leftSuperSkill: [...],
 *      rightSuperSkill: [...],
 *      recordData: [...],
 *    }
 * =====================================================
 */

'use strict';

var logger = require('../../shared/utils/logger');
var LIMITS = require('../utils/dungeonConstants').LIMITS;

/**
 * Create a new BattleManager instance.
 *
 * @returns {object}
 */
function createBattleManager() {
    var battles = {};
    var battleCounter = 0;

    return {
        /**
         * Generate a unique battle ID.
         * @returns {string}
         */
        generateBattleId: function() {
            battleCounter++;
            return 'td_battle_' + Date.now() + '_' + battleCounter;
        },

        /**
         * Start a new battle.
         *
         * @param {string} teamId
         * @returns {object} Battle object
         */
        startBattle: function(teamId) {
            var battleId = this.generateBattleId();
            var battle = {
                battleId: battleId,
                teamId: teamId,
                state: 'active',
                startedAt: Date.now(),
                completedAt: 0,
                leftTeam: [],
                rightTeam: [],
                leftSuperSkill: [],
                rightSuperSkill: [],
                recordData: [],
            };

            battles[battleId] = battle;
            logger.info('DUNGEON', 'battleManager: Started battle ' + battleId + ' for team ' + teamId);
            return battle;
        },

        /**
         * Complete a battle with results.
         *
         * @param {string} battleId
         * @param {object} result - { recordData, leftTeam, rightTeam, ... }
         * @returns {boolean}
         */
        completeBattle: function(battleId, result) {
            var battle = battles[battleId];
            if (!battle || battle.state !== 'active') return false;

            battle.state = 'completed';
            battle.completedAt = Date.now();
            if (result) {
                if (result.recordData) battle.recordData = result.recordData;
                if (result.leftTeam) battle.leftTeam = result.leftTeam;
                if (result.rightTeam) battle.rightTeam = result.rightTeam;
                if (result.leftSuperSkill) battle.leftSuperSkill = result.leftSuperSkill;
                if (result.rightSuperSkill) battle.rightSuperSkill = result.rightSuperSkill;
            }

            logger.info('DUNGEON', 'battleManager: Completed battle ' + battleId);
            return true;
        },

        /**
         * Get a battle record.
         *
         * @param {string} battleId
         * @returns {object|null} Deep-cloned battle or null
         */
        getBattle: function(battleId) {
            var b = battles[battleId];
            if (!b) return null;
            return JSON.parse(JSON.stringify(b));
        },

        /**
         * Get active battle for a team.
         *
         * @param {string} teamId
         * @returns {object|null}
         */
        getActiveBattleForTeam: function(teamId) {
            for (var id in battles) {
                if (battles.hasOwnProperty(id)) {
                    if (battles[id].teamId === teamId && battles[id].state === 'active') {
                        return battles[id];
                    }
                }
            }
            return null;
        },

        /**
         * Cleanup old completed battles.
         *
         * @returns {number} Cleaned count
         */
        cleanup: function() {
            var now = Date.now();
            var cleaned = 0;

            for (var id in battles) {
                if (battles.hasOwnProperty(id)) {
                    var b = battles[id];
                    if (b.state === 'completed' && now - b.completedAt > LIMITS.BATTLE_TIMEOUT_MS) {
                        delete battles[id];
                        cleaned++;
                    }
                }
            }

            return cleaned;
        },

        /**
         * Get stats.
         *
         * @returns {object}
         */
        getStats: function() {
            var total = Object.keys(battles).length;
            var active = 0;
            for (var id in battles) {
                if (battles.hasOwnProperty(id) && battles[id].state === 'active') active++;
            }
            return { totalBattles: total, activeBattles: active };
        },

        reset: function() {
            battles = {};
        },
    };
}

module.exports = { createBattleManager: createBattleManager };
