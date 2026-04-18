'use strict';

/**
 * =====================================================
 *  activity/task/getGrowActivityReward.js
 *  Super Warrior Z Game Server — Main Server
 *
 *  ACTION: getGrowActivityReward
 *  DESC: CLAIM grow activity reward
 *  TYPE: WRITE
 *
 *  CLIENT REQUEST:
 *    { type:"activity", action:"getGrowActivityReward", actId, userId, pageType, pick, taskId }
 *
 *  CLIENT SOURCE: ActivitySetReward.getGrowActivityReward() (line ~79577)
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
    logger.info('ACTIVITY', 'getGrowActivityReward' + ' userId=' + userId);

    // TODO: Implement business logic

    callback(RH.success({}));
}

module.exports = { handle: handle };
