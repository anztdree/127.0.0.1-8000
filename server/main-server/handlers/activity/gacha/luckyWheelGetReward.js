'use strict';

/**
 * =====================================================
 *  activity/gacha/luckyWheelGetReward.js
 *  Super Warrior Z Game Server — Main Server
 *
 *  ACTION: luckyWheelGetReward
 *  DESC: Lucky wheel accumulated reward
 *  TYPE: WRITE
 *
 *  CLIENT REQUEST:
 *    { type:"activity", action:"luckyWheelGetReward", actId, userId, taskId }
 *
 *  CLIENT SOURCE: ActivitySetReward.LuckyWheelReward() (line ~79577)
 *
 *  STATUS: TODO
 * =====================================================
 */

var RH = require('../../../../shared/responseHelper');
var logger = require('../../../../shared/utils/logger');

function handle(socket, parsed, callback) {
    var userId = parsed.userId;
    logger.info('ACTIVITY', 'luckyWheelGetReward' + ' userId=' + userId);

    // TODO: Implement business logic

    callback(RH.success({}));
}

module.exports = { handle: handle };
