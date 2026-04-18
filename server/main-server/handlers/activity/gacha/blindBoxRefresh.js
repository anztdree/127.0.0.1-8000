'use strict';

/**
 * =====================================================
 *  activity/gacha/blindBoxRefresh.js
 *  Super Warrior Z Game Server — Main Server
 *
 *  ACTION: blindBoxRefresh
 *  DESC: Refresh blind box pool
 *  TYPE: WRITE
 *
 *  CLIENT REQUEST:
 *    { type:"activity", action:"blindBoxRefresh", actId, userId }
 *
 *  CLIENT SOURCE: refreshBtnTap() (line 89577)
 *
 *  STATUS: TODO
 * =====================================================
 */

var RH = require('../../../../shared/responseHelper');
var logger = require('../../../../shared/utils/logger');

function handle(socket, parsed, callback) {
    var userId = parsed.userId;
    logger.info('ACTIVITY', 'blindBoxRefresh' + ' userId=' + userId);

    // TODO: Implement business logic

    callback(RH.success({}));
}

module.exports = { handle: handle };
