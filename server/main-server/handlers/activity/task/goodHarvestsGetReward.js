'use strict';

/**
 * =====================================================
 *  activity/task/goodHarvestsGetReward.js
 *  Super Warrior Z Game Server — Main Server
 *
 *  ACTION: goodHarvestsGetReward
 *  DESC: CLAIM good harvests activity task reward
 *  TYPE: WRITE
 *
 *  CLIENT REQUEST:
 *    { type:"activity", action:"goodHarvestsGetReward", userId, actId, version }
 *
 *  CLIENT SOURCE: allGetBtnTap() (line 93135)
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
    logger.info('ACTIVITY', 'goodHarvestsGetReward' + ' userId=' + userId);

    // TODO: Implement business logic

    callback(RH.success({}));
}

module.exports = { handle: handle };
