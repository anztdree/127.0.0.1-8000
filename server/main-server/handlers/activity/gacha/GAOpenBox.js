'use strict';

/**
 * =====================================================
 *  activity/gacha/GAOpenBox.js
 *  Super Warrior Z Game Server — Main Server
 *
 *  ACTION: GAOpenBox
 *  DESC: Open GA mystery box
 *  TYPE: WRITE
 *
 *  CLIENT REQUEST:
 *    { type:"activity", action:"GAOpenBox", userId, actId, version }
 *
 *  CLIENT SOURCE: openBoxBtnTap() (line 92808)
 *
 *  STATUS: TODO
 * =====================================================
 */

var RH = require('../../../../shared/responseHelper');
var logger = require('../../../../shared/utils/logger');

function handle(socket, parsed, callback) {
    var userId = parsed.userId;
    logger.info('ACTIVITY', 'GAOpenBox' + ' userId=' + userId);

    // TODO: Implement business logic

    callback(RH.success({}));
}

module.exports = { handle: handle };
