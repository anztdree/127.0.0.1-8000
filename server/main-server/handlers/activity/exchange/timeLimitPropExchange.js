'use strict';

/**
 * =====================================================
 *  activity/exchange/timeLimitPropExchange.js
 *  Super Warrior Z Game Server — Main Server
 *
 *  ACTION: timeLimitPropExchange
 *  DESC: Exchange time-limited prop
 *  TYPE: WRITE
 *
 *  CLIENT REQUEST:
 *    { type:"activity", action:"timeLimitPropExchange", userId, actId, exchangeType, itemId, displayId }
 *
 *  CLIENT SOURCE: exchange btn tap (line 97950)
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
    logger.info('ACTIVITY', 'timeLimitPropExchange' + ' userId=' + userId);

    // TODO: Implement business logic

    callback(RH.success({}));
}

module.exports = { handle: handle };
