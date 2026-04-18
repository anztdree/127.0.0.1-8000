'use strict';

/**
 * =====================================================
 *  activity/task/getLanternBlessTaskReward.js
 *  Super Warrior Z Game Server — Main Server
 *
 *  ACTION: getLanternBlessTaskReward
 *  DESC: CLAIM lantern bless task reward
 *  TYPE: WRITE
 *
 *  CLIENT REQUEST:
 *    { type:"activity", action:"getLanternBlessTaskReward", actId, userId, taskId }
 *
 *  CLIENT SOURCE: ActivitySetReward.LanternBlessReward() (line ~79577)
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
    logger.info('ACTIVITY', 'getLanternBlessTaskReward' + ' userId=' + userId);

    // TODO: Implement business logic

    callback(RH.success({}));
}

module.exports = { handle: handle };
