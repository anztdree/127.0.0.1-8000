'use strict';

/**
 * =====================================================
 *  activity/task/beStrongActiveActReward.js
 *  Super Warrior Z Game Server — Main Server
 *
 *  ACTION: beStrongActiveActReward
 *  DESC: CLAIM be-strong activity active task reward
 *  TYPE: WRITE
 *
 *  CLIENT REQUEST:
 *    { type:"activity", action:"beStrongActiveActReward", actId, userId, day, itemId, pick, all }
 *
 *  CLIENT SOURCE: ActivitySetReward.strongActivity() (line ~79577)
 *
 *  NOTE: Also dispatches TSEventType.StrongPersonActivity with full response
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
    logger.info('ACTIVITY', 'beStrongActiveActReward' + ' userId=' + userId);

    // TODO: Implement business logic

    callback(RH.success({}));
}

module.exports = { handle: handle };
