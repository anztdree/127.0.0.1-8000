'use strict';

/**
 * =====================================================
 *  activity/exchange/timeLimitPropReceive.js
 *  Super Warrior Z Game Server — Main Server
 *
 *  ACTION: timeLimitPropReceive
 *  DESC: Receive/claim time-limited prop reward
 *  TYPE: WRITE
 *
 *  CLIENT REQUEST:
 *    { type:"activity", action:"timeLimitPropReceive", userId, actId, exchangeType }
 *
 *  CLIENT SOURCE: receiveBtnTap() (line 97921)
 *
 *  RESPONSE (Universal):
 *    { _changeInfo: { _items: {...} },
 *      _addHeroes: {...}, _addSigns: {...},
 *      _addWeapons: {...}, _addStones: {...}, _addGenkis: {...} }
 *
 *  STATUS: TODO
 * =====================================================
 */

var RH = require('../../../../shared/responseHelper');
var logger = require('../../../../shared/utils/logger');

function handle(socket, parsed, callback) {
    var userId = parsed.userId;
    logger.info('ACTIVITY', 'timeLimitPropReceive' + ' userId=' + userId);

    // TODO: Implement business logic

    callback(RH.success({}));
}

module.exports = { handle: handle };
