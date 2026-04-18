'use strict';

/**
 * =====================================================
 *  activity/gacha/upsetBlindBox.js
 *  Super Warrior Z Game Server — Main Server
 *
 *  ACTION: upsetBlindBox
 *  DESC: Start blind box game
 *  TYPE: WRITE
 *
 *  CLIENT REQUEST:
 *    { type:"activity", action:"upsetBlindBox", actId, userId }
 *
 *  CLIENT SOURCE: startGameBtnTap() (line 89594)
 *
 *  STATUS: TODO
 * =====================================================
 */

var RH = require('../../../../shared/responseHelper');
var logger = require('../../../../shared/utils/logger');

function handle(socket, parsed, callback) {
    var userId = parsed.userId;
    logger.info('ACTIVITY', 'upsetBlindBox' + ' userId=' + userId);

    // TODO: Implement business logic

    callback(RH.success({}));
}

module.exports = { handle: handle };
