/**
 * =====================================================
 *  BuryPoint Handler — handlers/buryPoint.js
 *  Super Warrior Z Game Server — Main Server (Port 8001)
 *
 *  埋点 (Màidiǎn) — Analytics/Telemetry Tracking Handler
 *
 *  Fungsi: Mencatat event milestone player selama tutorial/guide.
 *  Client memanggil handler ini untuk tracking progress, BUKAN
 *  untuk gameplay logic. Tidak ada reward, tidak ada state change.
 *
 *  Client Reference (main.min.js):
 *    GuideInfoManager.prototype.guideBuriedPoint = function(point, passLesson) {
 *        ts.processHandler({
 *            type: "buryPoint",
 *            action: "guideBattle",
 *            userId: userId,
 *            point: point,          // "load" | "battle" | "home"
 *            passLesson: passLesson, // lesson/tutorial ID
 *            version: "1.0"
 *        }, successCb, errorCb)
 *    }
 *
 *  4 Call Sites di Client:
 *    1. "load"  — Setelah game data selesai loading (game startup)
 *    2. "battle" — Setelah menyelesaikan lesson battle (tutorial battle)
 *    3. "home"  — Setelah navigasi kembali ke home dari chapter
 *    4. "home"  — Path navigasi home alternatif
 *
 *  Valid Point Constants (client-side):
 *    GuideLoad_Point   = "load"   — Game loaded
 *    GuideBattle_Point = "battle" — Tutorial battle completed
 *    GuideHome_Point   = "home"   — Returned to home
 *
 *  Protokol:
 *    REQ: { type:"buryPoint", action:"guideBattle", userId, point, passLesson }
 *    RES: { ret: 0, data: "{}", compress: false, serverTime, server0Time }
 *
 *  Kenapa TIDAK pakai userDataService:
 *    - Handler ini murni analytics/logging
 *    - Tidak mengubah state game player
 *    - Tidak memberikan reward
 *    - Hanya mencatat event ke server log
 *    - Client mengharapkan response kosong RH.success({})
 *
 *  Usage:
 *    handler.handle(socket, parsedRequest, callback)
 * =====================================================
 */

'use strict';

var RH = require('../../shared/responseHelper');
var logger = require('../../shared/utils/logger');

/**
 * Valid point types yang dikirim client.
 * @type {Array<string>}
 */
var VALID_POINTS = ['load', 'battle', 'home'];

/**
 * Handle buryPoint request dari client.
 *
 * Flow:
 *   1. Parse action dari request
 *   2. Untuk action "guideBattle" — log analytics event
 *   3. Return success dengan data kosong
 *
 * @param {Object} socket - Socket.IO socket instance
 * @param {Object} parsed - Parsed request: { type, action, userId, point, passLesson, ... }
 * @param {Function} callback - Response callback: callback(responseObj)
 */
function handle(socket, parsed, callback) {
    var action = parsed.action;
    var userId = parsed.userId;

    switch (action) {

        // =============================================
        // ACTION: guideBattle
        // =============================================
        // Analytics tracking event untuk tutorial progress.
        //
        // Client call sites:
        //   1. guideBuriedPoint("load", lessonId)   — setelah game load
        //   2. guideBuriedPoint("battle", lessonId)  — setelah battle selesai
        //   3. guideBuriedPoint("home", lessonId)    — setelah kembali ke home
        //
        // REQ params:
        //   point      — string: "load" | "battle" | "home"
        //   passLesson — number: ID lesson/tutorial yang sedang aktif
        //   version    — string: "1.0" (protocol version, bisa diabaikan)
        //
        // RES:
        //   {} — data kosong, client hanya butuh ret: 0
        //
        // Server behavior:
        //   - Log event ke console (untuk analytics monitoring)
        //   - Tidak mengubah user data
        //   - Tidak memberikan reward
        //   - Selalu return success
        // =============================================
        case 'guideBattle': {
            var point = parsed.point;
            var passLesson = parsed.passLesson;

            // Validate point type
            if (!point || VALID_POINTS.indexOf(point) === -1) {
                logger.warn('BURYPOINT',
                    'Invalid point type: "' + point + '" userId=' + (userId || '-') +
                    ' passLesson=' + (passLesson || '-'));
                // Tetap return success — jangan block player karena analytics error
                callback(RH.success({}));
                return;
            }

            // Log analytics event
            logger.info('BURYPOINT',
                'action=' + action +
                ' userId=' + (userId || '-') +
                ' point=' + point +
                ' passLesson=' + (passLesson || '-'));

            // Return empty success — client expects no data back
            callback(RH.success({}));
            break;
        }

        // =============================================
        // DEFAULT: Unknown action
        // =============================================
        // Return INVALID_COMMAND error untuk action yang tidak dikenal.
        // Client akan menampilkan error dialog.
        // =============================================
        default:
            logger.warn('BURYPOINT',
                'Unknown action: ' + action +
                ' userId=' + (userId || '-'));
            callback(RH.error(RH.ErrorCode.INVALID_COMMAND,
                'Unknown action: ' + action));
            break;
    }
}

module.exports = { handle: handle };
