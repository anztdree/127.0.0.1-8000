'use strict';

var RH = require('../../shared/responseHelper');
var logger = require('../../shared/utils/logger');

/**
 * Check-in Handler
 *
 * Client protocol — type: "checkin"
 *   checkin (WRITE) — params: userId, day, version
 *                      response: { _changeInfo: { _items: { itemId: { _id, _num } } } }
 */

function handle(socket, parsed, callback) {
    var action = parsed.action;
    var userId = parsed.userId;

    switch (action) {

        // ── checkin (WRITE) ────────────────────────────────────────
        // Perform daily check-in for a specific day.
        // Client expects: { _changeInfo: { _items: { itemId: { _id, _num } } } }
        case 'checkin': {
            var day     = parsed.day;       // check-in day number
            var version = parsed.version;

            logger.info('CHECKIN', 'checkin userId=' + (userId || '-')
                + ' day=' + (day || '-')
                + ' version=' + (version || '-'));

            // TODO: Validate version, verify day is valid & not already claimed, grant rewards
            callback(RH.success({
                _changeInfo: {
                    _items: {}
                }
            }));
            break;
        }

        // ── Unknown action ──────────────────────────────────────────
        default:
            logger.warn('CHECKIN', 'Unknown action: ' + action + ' userId=' + (userId || '-'));
            callback(RH.success({}));
            break;
    }
}

module.exports = { handle: handle };
