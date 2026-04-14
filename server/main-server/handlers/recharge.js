'use strict';

var RH = require('../../shared/responseHelper');
var logger = require('../../shared/utils/logger');

/**
 * Recharge Handler
 *
 * Client protocol — type: "recharge"
 *   recharge (WRITE) — params: userId, goodsId, version
 *                       response: { prePayRet: { errorCode: 0, data: {} } }
 */

function handle(socket, parsed, callback) {
    var action = parsed.action;
    var userId = parsed.userId;

    switch (action) {

        // ── recharge (WRITE) ───────────────────────────────────────
        // Process a payment / recharge for a specific goods item.
        // Client expects: { prePayRet: { errorCode: 0, data: {} } }
        case 'recharge': {
            var goodsId = parsed.goodsId;
            var version = parsed.version;

            logger.info('RECHARGE', 'recharge userId=' + (userId || '-')
                + ' goodsId=' + (goodsId || '-')
                + ' version=' + (version || '-'));

            // TODO: Validate version, look up goodsId, initiate payment flow
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
            logger.warn('RECHARGE', 'Unknown action: ' + action + ' userId=' + (userId || '-'));
            callback(RH.success({}));
            break;
    }
}

module.exports = { handle: handle };
