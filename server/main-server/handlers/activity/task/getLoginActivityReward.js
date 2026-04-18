'use strict';

/**
 * =====================================================
 *  activity/task/getLoginActivityReward.js
 *  Super Warrior Z Game Server — Main Server
 *
 *  ACTION: getLoginActivityReward
 *  DESC: CLAIM login activity daily reward
 *  TYPE: WRITE
 *
 *  CLIENT REQUEST:
 *    { type:"activity", action:"getLoginActivityReward", actId, userId, day, pick }
 *
 *  CLIENT SOURCE: ActivitySetReward.getLoginActivityReward() (line ~79577)
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
    logger.info('ACTIVITY', 'getLoginActivityReward' + ' userId=' + userId);

    // TODO: Implement business logic

    callback(RH.success({}));
}

module.exports = { handle: handle };
