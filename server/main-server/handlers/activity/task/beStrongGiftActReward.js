'use strict';

/**
 * =====================================================
 *  activity/task/beStrongGiftActReward.js
 *  Super Warrior Z Game Server — Main Server
 *
 *  ACTION: beStrongGiftActReward
 *  DESC: CLAIM be-strong gift activity task reward
 *  TYPE: WRITE
 *
 *  CLIENT REQUEST:
 *    { type:"activity", action:"beStrongGiftActReward", actId, userId, day, itemId, pick, all }
 *
 *  CLIENT SOURCE: ActivitySetReward.strongGift() (line ~79577)
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
    logger.info('ACTIVITY', 'beStrongGiftActReward' + ' userId=' + userId);

    // TODO: Implement business logic

    callback(RH.success({}));
}

module.exports = { handle: handle };
