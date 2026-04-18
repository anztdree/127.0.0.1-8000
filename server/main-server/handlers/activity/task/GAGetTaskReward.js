'use strict';

/**
 * =====================================================
 *  activity/task/GAGetTaskReward.js
 *  Super Warrior Z Game Server — Main Server
 *
 *  ACTION: GAGetTaskReward
 *  DESC: CLAIM Growth Adventure (GA) task reward
 *  TYPE: WRITE
 *
 *  CLIENT REQUEST:
 *    { type:"activity", action:"GAGetTaskReward", actId, userId, taskId }
 *
 *  CLIENT SOURCE: ActivitySetReward.GAdventureReward() (line ~79577)
 *
 *  RESPONSE (Universal):
 *    { _changeInfo: { _items: {...} },
 *      _addHeroes: {...}, _addSigns: {...},
 *      _addWeapons: {...}, _addStones: {...}, _addGenkis: {...} }
 *
 *  STATUS: TODO
 * =====================================================
 */

var RH = require('../../../../shared/responseHelper');
var logger = require('../../../../shared/utils/logger');

function handle(socket, parsed, callback) {
    var userId = parsed.userId;
    logger.info('ACTIVITY', 'GAGetTaskReward' + ' userId=' + userId);

    // TODO: Implement business logic

    callback(RH.success({}));
}

module.exports = { handle: handle };
