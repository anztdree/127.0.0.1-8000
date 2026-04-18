'use strict';

/**
 * =====================================================
 *  activity/task/friendBattleActReward.js
 *  Super Warrior Z Game Server — Main Server
 *
 *  ACTION: friendBattleActReward
 *  DESC: CLAIM friend battle activity task reward
 *  TYPE: WRITE
 *
 *  CLIENT REQUEST:
 *    { type:"activity", action:"friendBattleActReward", actId, userId, pick, itemId }
 *
 *  CLIENT SOURCE: ActivitySetReward.friendBattleReward() (line ~79577)
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
    logger.info('ACTIVITY', 'friendBattleActReward' + ' userId=' + userId);

    // TODO: Implement business logic

    callback(RH.success({}));
}

module.exports = { handle: handle };
