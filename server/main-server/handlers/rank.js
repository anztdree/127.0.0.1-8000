'use strict';

var RH = require('../../shared/responseHelper');
var logger = require('../../shared/utils/logger');

/**
 * Rank Handler
 *
 * Client protocol — type: "rank"
 *   getRank (READ)  — params: userId, rankType, version
 *                      response: rank data object
 *   like    (WRITE) — params: userId, rankType
 *                      response: { _changeInfo: { _items: {...} } }
 */

function handle(socket, parsed, callback) {
    var action = parsed.action;
    var userId = parsed.userId;

    switch (action) {

        // ── getRank (READ) ─────────────────────────────────────────
        // Retrieve leaderboard data for a given rank type.
        // Client expects: rank data object
        case 'getRank': {
            var rankType = parsed.rankType;
            var version  = parsed.version;

            logger.info('RANK', 'getRank userId=' + (userId || '-')
                + ' rankType=' + (rankType || '-')
                + ' version=' + (version || '-'));

            // TODO: Load ranking data for rankType, include self rank
            callback(RH.success({}));
            break;
        }

        // ── like (WRITE) ───────────────────────────────────────────
        // Like / endorse another player on the leaderboard.
        // Client expects: { _changeInfo: { _items: {...} } }
        case 'like': {
            var rankType = parsed.rankType;

            logger.info('RANK', 'like userId=' + (userId || '-')
                + ' rankType=' + (rankType || '-'));

            // TODO: Process the like action, return any item rewards
            callback(RH.success({
                _changeInfo: {
                    _items: {}
                }
            }));
            break;
        }

        // ── Unknown action ──────────────────────────────────────────
        default:
            logger.warn('RANK', 'Unknown action: ' + action + ' userId=' + (userId || '-'));
            callback(RH.success({}));
            break;
    }
}

module.exports = { handle: handle };
