'use strict';

/**
 * =====================================================
 *  activity/gacha/weaponCastLottery.js
 *  Super Warrior Z Game Server — Main Server
 *
 *  ACTION: weaponCastLottery
 *  DESC: Weapon cast draw
 *  TYPE: WRITE
 *
 *  CLIENT REQUEST:
 *    { type:"activity", action:"weaponCastLottery", userId, actId }
 *
 *  CLIENT SOURCE: castMachineTap() (line 90060)
 *  CUSTOM RESPONSE: _castMachine, _userTask, _itemIndex
 *
 *  STATUS: TODO
 * =====================================================
 */

var RH = require('../../../../shared/responseHelper');
var logger = require('../../../../shared/utils/logger');

function handle(socket, parsed, callback) {
    var userId = parsed.userId;
    logger.info('ACTIVITY', 'weaponCastLottery' + ' userId=' + userId);

    // TODO: Implement business logic

    callback(RH.success({}));
}

module.exports = { handle: handle };
