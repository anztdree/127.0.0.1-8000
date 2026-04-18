'use strict';

/**
 * =====================================================
 *  activity/gacha/luckyWheelLottery.js
 *  Super Warrior Z Game Server — Main Server
 *
 *  ACTION: luckyWheelLottery
 *  DESC: Lucky wheel spin
 *  TYPE: WRITE
 *
 *  CLIENT REQUEST:
 *    { type:"activity", action:"luckyWheelLottery", actId, userId }
 *
 *  CLIENT SOURCE: LuckyWheel panel (line 90986)
 *
 *  STATUS: TODO
 * =====================================================
 */

var RH = require('../../../../shared/responseHelper');
var logger = require('../../../../shared/utils/logger');

function handle(socket, parsed, callback) {
    var userId = parsed.userId;
    logger.info('ACTIVITY', 'luckyWheelLottery' + ' userId=' + userId);

    // TODO: Implement business logic

    callback(RH.success({}));
}

module.exports = { handle: handle };
