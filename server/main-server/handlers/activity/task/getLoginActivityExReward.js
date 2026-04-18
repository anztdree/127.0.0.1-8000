'use strict';

/**
 * =====================================================
 *  activity/task/getLoginActivityExReward.js
 *  Super Warrior Z Game Server — Main Server
 *
 *  ACTION: getLoginActivityExReward
 *  DESC: CLAIM login activity extended/bonus reward
 *  TYPE: WRITE
 *
 *  CLIENT REQUEST:
 *    { type:"activity", action:"getLoginActivityExReward", actId, userId, day }
 *
 *  CLIENT SOURCE: login extra reward click (line 91297)
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
    logger.info('ACTIVITY', 'getLoginActivityExReward' + ' userId=' + userId);

    // TODO: Implement business logic

    callback(RH.success({}));
}

module.exports = { handle: handle };
