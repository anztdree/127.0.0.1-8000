/**
 * =====================================================
 *  Expedition Handler — handlers/expedition.js
 *  Super Warrior Z Game Server — Main Server
 *
 *  CLIENT PROTOCOL (type: "expedition"):
 *
 *  READ actions:
 *    clickExpedition → Enter expedition view (sets visited flag)
 *
 *  WRITE actions:
 *    startBattle       → Start an expedition battle
 *    checkBattleResult → Submit expedition battle result
 *
 *  Usage:
 *    handler.handle(socket, parsedRequest, callback)
 * =====================================================
 */

'use strict';

var RH = require('../../shared/responseHelper');
var logger = require('../../shared/utils/logger');

// =============================================
// ACTION HANDLERS
// =============================================

/**
 * clickExpedition — Enter expedition view and set visited flag.
 *
 * CLIENT REQUEST:
 * { type: "expedition", action: "clickExpedition", userId, version }
 *
 * RESPONSE: empty object {}
 */
function handleClickExpedition(socket, parsed, callback) {
    var userId = parsed.userId;
    var version = parsed.version;

    logger.info('EXPEDITION', 'clickExpedition: userId=' + (userId || '-') +
        ' version=' + (version || '-'));

    // TODO: Set expedition visited flag for user
    callback(RH.success({}));
}

/**
 * checkBattleResult — Submit expedition battle result.
 *
 * CLIENT REQUEST:
 * { type: "expedition", action: "checkBattleResult", userId, battleId, version, super, checkResult, battleField, runaway }
 *
 * RESPONSE:
 *   _battleResult → 0=WIN, 1=LOSE
 *   _passLesson   → lesson/lessonId that was passed
 *   _changeInfo   → {_items: {itemId: {_id, _num}}}
 */
function handleCheckBattleResult(socket, parsed, callback) {
    var userId = parsed.userId;
    var battleId = parsed.battleId;
    var version = parsed.version;
    var super_ = parsed.super;
    var checkResult = parsed.checkResult;
    var battleField = parsed.battleField;
    var runaway = parsed.runaway;

    var won = (checkResult === 0 || checkResult === '0');

    logger.info('EXPEDITION', 'checkBattleResult: userId=' + (userId || '-') +
        ' battleId=' + (battleId || '-') +
        ' version=' + (version || '-') +
        ' battleField=' + (battleField || '-') +
        ' checkResult=' + (checkResult || '-') +
        ' runaway=' + (runaway || '-') +
        ' won=' + won);

    // TODO: Verify battle via battleService, apply rewards, advance expedition progress
    var responseData = {
        _battleResult: won ? 0 : 1,
        _passLesson: 0,
        _changeInfo: {
            _items: {},
        },
    };

    callback(RH.success(responseData));
}

/**
 * startBattle — Start an expedition battle.
 *
 * CLIENT REQUEST:
 * { type: "expedition", action: "startBattle", userId, difficulty, version, team, super, battleField }
 *
 * RESPONSE:
 *   _battleId   → unique battle identifier string
 *   _rightTeam  → enemy team lineup array
 *   _rightSuper → enemy super skill lineup array
 */
function handleStartBattle(socket, parsed, callback) {
    var userId = parsed.userId;
    var difficulty = parsed.difficulty;
    var version = parsed.version;
    var team = parsed.team;
    var super_ = parsed.super;
    var battleField = parsed.battleField;

    logger.info('EXPEDITION', 'startBattle: userId=' + (userId || '-') +
        ' difficulty=' + (difficulty || '-') +
        ' version=' + (version || '-') +
        ' battleField=' + (battleField || '-') +
        ' teamCount=' + (Array.isArray(team) ? team.length : 0) +
        ' superCount=' + (Array.isArray(super_) ? super_.length : 0));

    // TODO: Generate battle via battleService, build enemy team from difficulty config
    var responseData = {
        _battleId: 'battle_' + Date.now() + '_' + Math.random().toString(16).substring(2, 10),
        _rightTeam: [],
        _rightSuper: [],
    };

    callback(RH.success(responseData));
}

// =============================================
// MAIN ROUTER
// =============================================

function handle(socket, parsed, callback) {
    var action = parsed.action;
    var userId = parsed.userId;

    if (!action) {
        return callback(RH.error(RH.ErrorCode.LACK_PARAM, 'Missing action'));
    }

    try {
        switch (action) {
            case 'clickExpedition':
                handleClickExpedition(socket, parsed, callback);
                break;

            case 'checkBattleResult':
                handleCheckBattleResult(socket, parsed, callback);
                break;

            case 'startBattle':
                handleStartBattle(socket, parsed, callback);
                break;

            default:
                logger.warn('EXPEDITION', 'Unknown action: ' + action +
                    ' from userId=' + (userId || '-') + ', returning empty success');
                callback(RH.success({}));
                break;
        }
    } catch (err) {
        logger.error('EXPEDITION', 'Handler error for action=' + action + ': ' + err.message);
        callback(RH.error(RH.ErrorCode.UNKNOWN, 'Internal server error'));
    }
}

module.exports = { handle: handle };
