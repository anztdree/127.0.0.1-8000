/**
 * =====================================================
 *  Robot Service — Super Warrior Z Dungeon Server
 * =====================================================
 *
 *  Manages robot/AI players for team dungeons.
 *  Client loads robot data from teamDungeonRobot.json.
 *
 *  Robot info structure:
 *    { _userId, _nickName, _headImage, _power, _heroes: [...] }
 * =====================================================
 */

'use strict';

var GameData = require('../../server/shared/gameData/loader');
var logger = require('../../shared/utils/logger');

/**
 * Create a new RobotService instance.
 *
 * @returns {object}
 */
function createRobotService() {
    var robotData = null;
    var loaded = false;

    return {
        /**
         * Load robot data from config.
         */
        load: function() {
            try {
                robotData = GameData.get('teamDungeonRobot');
                loaded = true;
                logger.info('DUNGEON', 'robotService: Loaded ' +
                    (robotData ? Object.keys(robotData).length : 0) + ' robot entries');
            } catch (err) {
                logger.warn('DUNGEON', 'robotService: Failed to load robot data: ' + err.message);
                robotData = {};
                loaded = true;
            }
        },

        /**
         * Get all robots for client query.
         *
         * @returns {object} Robot data or empty object
         */
        getRobots: function() {
            return robotData || {};
        },

        /**
         * Get a specific robot by userId.
         *
         * @param {string} userId
         * @returns {object|null}
         */
        getRobot: function(userId) {
            if (!robotData) return null;
            return robotData[userId] || null;
        },

        /**
         * Check if loaded.
         * @returns {boolean}
         */
        isLoaded: function() {
            return loaded;
        },
    };
}

module.exports = { createRobotService: createRobotService };
