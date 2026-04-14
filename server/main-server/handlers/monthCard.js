'use strict';

var RH = require('../../shared/responseHelper');
var logger = require('../../shared/utils/logger');

/**
 * Month Card Handler
 *
 * Client protocol — type: "monthCard"
 *   getReward (WRITE) — params: userId, cardType, version
 *                        response: { _changeInfo: { _items: {...} } }
 *   buyCard   (WRITE) — params: userId, cardType, version
 *                        response: { prePayRet: { errorCode: 0, data: {} } }
 */

function handle(socket, parsed, callback) {
    var action = parsed.action;
    var userId = parsed.userId;

    switch (action) {

        // ── getReward (WRITE) ───────────────────────────────────────
        // Claim the daily reward from an active month card.
        // Client expects: { _changeInfo: { _items: {...} } }
        case 'getReward': {
            var cardType = parsed.cardType;
            var version  = parsed.version;

            logger.info('MONTHCARD', 'getReward userId=' + (userId || '-')
                + ' cardType=' + (cardType || '-')
                + ' version=' + (version || '-'));

            // TODO: Validate version, verify card is active & reward not yet claimed today
            callback(RH.success({
                _changeInfo: {
                    _items: {}
                }
            }));
            break;
        }

        // ── buyCard (WRITE) ────────────────────────────────────────
        // Purchase a month card.
        // Client expects: { prePayRet: { errorCode: 0, data: {} } }
        case 'buyCard': {
            var cardType = parsed.cardType;
            var version  = parsed.version;

            logger.info('MONTHCARD', 'buyCard userId=' + (userId || '-')
                + ' cardType=' + (cardType || '-')
                + ' version=' + (version || '-'));

            // TODO: Validate version, process payment, activate card
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
            logger.warn('MONTHCARD', 'Unknown action: ' + action + ' userId=' + (userId || '-'));
            callback(RH.success({}));
            break;
    }
}

module.exports = { handle: handle };
