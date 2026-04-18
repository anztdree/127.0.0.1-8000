'use strict';

/**
 * =====================================================
 *  activity/task/karinActReward.js
 *  Super Warrior Z Game Server — Main Server
 *
 *  ACTION: karinActReward
 *  DESC: CLAIM Karin tower activity task reward
 *  TYPE: WRITE
 *
 *  CLIENT REQUEST:
 *    { type:"activity", action:"karinActReward", actId, userId, pick, itemId }
 *
 *  CLIENT SOURCE: ActivitySetReward.jiaLinTaBattleReward() (line ~79577)
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
    logger.info('ACTIVITY', 'karinActReward' + ' userId=' + userId);

    // TODO: Implement business logic

    callback(RH.success({}));
}

module.exports = { handle: handle };
