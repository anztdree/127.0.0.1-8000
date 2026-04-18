'use strict';

/**
 * =====================================================
 *  activity/gacha/blindBoxOpen.js
 *  Super Warrior Z Game Server — Main Server
 *
 *  ACTION: blindBoxOpen
 *  DESC: Open/draw a blind box
 *  TYPE: WRITE
 *
 *  CLIENT REQUEST:
 *    { type:"activity", action:"blindBoxOpen", actId, userId, boxId }
 *
 *  CLIENT SOURCE: OpenBoxRequest() (line 89622)
 *  CUSTOM RESPONSE: _uact._openBoxPos[]
 *
 *  STATUS: TODO
 * =====================================================
 */

var RH = require('../../../../shared/responseHelper');
var logger = require('../../../../shared/utils/logger');

function handle(socket, parsed, callback) {
    var userId = parsed.userId;
    logger.info('ACTIVITY', 'blindBoxOpen' + ' userId=' + userId);

    // TODO: Implement business logic

    callback(RH.success({}));
}

module.exports = { handle: handle };
