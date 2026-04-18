'use strict';

/**
 * =====================================================
 *  activity/gacha/weaponCastGetReward.js
 *  Super Warrior Z Game Server — Main Server
 *
 *  ACTION: weaponCastGetReward
 *  DESC: Weapon cast accumulated reward
 *  TYPE: WRITE
 *
 *  CLIENT REQUEST:
 *    { type:"activity", action:"weaponCastGetReward", actId, userId, taskId }
 *
 *  CLIENT SOURCE: ActivitySetReward.equipCastReward() (line ~79577)
 *
 *  STATUS: TODO
 * =====================================================
 */

var RH = require('../../../../shared/responseHelper');
var logger = require('../../../../shared/utils/logger');

function handle(socket, parsed, callback) {
    var userId = parsed.userId;
    logger.info('ACTIVITY', 'weaponCastGetReward' + ' userId=' + userId);

    // TODO: Implement business logic

    callback(RH.success({}));
}

module.exports = { handle: handle };
