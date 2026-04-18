'use strict';

/**
 * =====================================================
 *  activity/task/buggyGetTaskReward.js
 *  Super Warrior Z Game Server — Main Server
 *
 *  ACTION: buggyGetTaskReward
 *  DESC: CLAIM buggy treasure activity task reward
 *  TYPE: WRITE
 *
 *  CLIENT REQUEST:
 *    { type:"activity", action:"buggyGetTaskReward", actId, userId, taskId }
 *
 *  CLIENT SOURCE: ActivitySetReward.BuggyTreasureReward() (line ~79577)
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
    logger.info('ACTIVITY', 'buggyGetTaskReward' + ' userId=' + userId);

    // TODO: Implement business logic

    callback(RH.success({}));
}

module.exports = { handle: handle };
