'use strict';

/**
 * =====================================================
 *  activity/gacha/turnTableGetReward.js
 *  Super Warrior Z Game Server — Main Server
 *
 *  ACTION: turnTableGetReward
 *  DESC: Turn table accumulated reward
 *  TYPE: WRITE
 *
 *  CLIENT REQUEST:
 *    { type:"activity", action:"turnTableGetReward", actId, userId, taskId, pick }
 *
 *  CLIENT SOURCE: ActivitySetReward.turnTableReward() (line ~79577)
 *
 *  STATUS: TODO
 * =====================================================
 */

var RH = require('../../../../shared/responseHelper');
var logger = require('../../../../shared/utils/logger');

function handle(socket, parsed, callback) {
    var userId = parsed.userId;
    logger.info('ACTIVITY', 'turnTableGetReward' + ' userId=' + userId);

    // TODO: Implement business logic

    callback(RH.success({}));
}

module.exports = { handle: handle };
