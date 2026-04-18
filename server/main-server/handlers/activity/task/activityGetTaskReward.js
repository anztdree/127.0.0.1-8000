'use strict';

/**
 * =====================================================
 *  activity/task/activityGetTaskReward.js
 *  Super Warrior Z Game Server — Main Server
 *
 *  ACTION: activityGetTaskReward
 *  DESC: DEFAULT/FALLBACK generic task reward claim
 *  TYPE: WRITE
 *
 *  CLIENT REQUEST:
 *    { type:"activity", action:"activityGetTaskReward", actId, userId, taskId, pick, actType }
 *
 *  CLIENT SOURCE: ActivitySetReward.commonGetReward() (line ~79577)
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
    logger.info('ACTIVITY', 'activityGetTaskReward' + ' userId=' + userId);

    // TODO: Implement business logic

    callback(RH.success({}));
}

module.exports = { handle: handle };
