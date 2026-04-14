'use strict';

var RH = require('../../shared/responseHelper');
var logger = require('../../shared/utils/logger');

/**
 * Time Bonus Handler
 *
 * Client protocol — type: "timeBonus"
 *   triggerLackOfGoldBonus (READ)  — params: userId
 *                                     response: { _openType: 0 }
 *   buyBonus              (WRITE) — params: userId, bonusId, price, times, version
 *                                     response: { prePayRet: { errorCode: 0, data: {} } }
 */

function handle(socket, parsed, callback) {
    var action = parsed.action;
    var userId = parsed.userId;

    switch (action) {

        // ── triggerLackOfGoldBonus (READ) ──────────────────────────
        // Check whether the gold-deficiency bonus popup should show.
        // Client expects: { _openType: 0 }
        case 'triggerLackOfGoldBonus': {
            logger.info('TIMEBONUS', 'triggerLackOfGoldBonus userId=' + (userId || '-'));

            // TODO: Determine bonus eligibility for this user
            callback(RH.success({
                _openType: 0
            }));
            break;
        }

        // ── buyBonus (WRITE) ────────────────────────────────────────
        // Purchase a time-limited bonus offer.
        // Client expects: { prePayRet: { errorCode: 0, data: {} } }
        case 'buyBonus': {
            var bonusId = parsed.bonusId;
            var price   = parsed.price;
            var times   = parsed.times;
            var version = parsed.version;

            logger.info('TIMEBONUS', 'buyBonus userId=' + (userId || '-')
                + ' bonusId=' + (bonusId || '-')
                + ' price=' + (price || '-')
                + ' times=' + (times || '-')
                + ' version=' + (version || '-'));

            // TODO: Validate version, verify price/times, process payment, grant bonus
            callback(RH.success({
                prePayRet: {
                    errorCode: 0,
                    data: {}
                }
            }));
            break;
        }

        // ── Unknown action ──────────────────────────────────────────
        default:
            logger.warn('TIMEBONUS', 'Unknown action: ' + action + ' userId=' + (userId || '-'));
            callback(RH.success({}));
            break;
    }
}

module.exports = { handle: handle };
