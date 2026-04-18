'use strict';

/**
 * =====================================================
 *  activity/gacha/turnTable.js
 *  Super Warrior Z Game Server — Main Server
 *
 *  ACTION: turnTable
 *  DESC: Turn table spin
 *  TYPE: WRITE
 *
 *  CLIENT REQUEST:
 *    { type:"activity", action:"turnTable", actId, userId, times, version }
 *
 *  CLIENT SOURCE: askServerTurn() (line 96244)
 *  CUSTOM RESPONSE: _rdIds[], _uact._rewardRecords[]
 *
 *  STATUS: TODO
 * =====================================================
 */

var RH = require('../../../../shared/responseHelper');
var logger = require('../../../../shared/utils/logger');

function handle(socket, parsed, callback) {
    var userId = parsed.userId;
    logger.info('ACTIVITY', 'turnTable' + ' userId=' + userId);

    // TODO: Implement business logic

    callback(RH.success({}));
}

module.exports = { handle: handle };
