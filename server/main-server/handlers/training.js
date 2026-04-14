/**
 * =====================================================
 *  Training Handler — handlers/training.js
 *  Super Warrior Z Game Server — Main Server
 *
 *  CLIENT PROTOCOL (type: "training"):
 *
 *  READ actions:
 *    getLog → Retrieve training log data
 *
 *  WRITE actions:
 *    startBattle       → Start a training battle
 *    checkBattleResult → Submit training battle result
 *    answer            → Answer a training question
 *    runAway           → Flee from current training battle
 *    move              → Advance to next training node
 *    buyTimes          → Purchase extra training attempts
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
 * getLog — Retrieve training log data.
 *
 * CLIENT REQUEST:
 * { type: "training", action: "getLog", userId, version }
 *
 * RESPONSE: training log data model
 */
function handleGetLog(socket, parsed, callback) {
    var userId = parsed.userId;
    var version = parsed.version;

    logger.info('TRAINING', 'getLog: userId=' + (userId || '-') +
        ' version=' + (version || '-'));

    // TODO: Load user training log from database
    callback(RH.success({}));
}

/**
 * startBattle — Start a training battle.
 *
 * CLIENT REQUEST:
 * { type: "training", action: "startBattle", userId, version, team, super, battleField }
 *
 * RESPONSE:
 *   _battleId   → unique battle identifier string
 *   _rightTeam  → enemy team lineup array
 *   _rightSuper → enemy super skill lineup array
 */
function handleStartBattle(socket, parsed, callback) {
    var userId = parsed.userId;
    var version = parsed.version;
    var team = parsed.team;
    var super_ = parsed.super;
    var battleField = parsed.battleField;

    logger.info('TRAINING', 'startBattle: userId=' + (userId || '-') +
        ' version=' + (version || '-') +
        ' battleField=' + (battleField || '-') +
        ' teamCount=' + (Array.isArray(team) ? team.length : 0) +
        ' superCount=' + (Array.isArray(super_) ? super_.length : 0));

    // TODO: Generate battle via battleService, build enemy team from training node config
    var responseData = {
        _battleId: 'battle_' + Date.now() + '_' + Math.random().toString(16).substring(2, 10),
        _rightTeam: [],
        _rightSuper: [],
    };

    callback(RH.success(responseData));
}

/**
 * checkBattleResult — Submit training battle result.
 *
 * CLIENT REQUEST:
 * { type: "training", action: "checkBattleResult", userId, battleId, version, super, checkResult, battleField, runaway }
 *
 * RESPONSE:
 *   _model       → updated training data model
 *   _battleResult → 0=WIN, 1=LOSE
 *   _changeInfo  → {_items: {itemId: {_id, _num}}}
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

    logger.info('TRAINING', 'checkBattleResult: userId=' + (userId || '-') +
        ' battleId=' + (battleId || '-') +
        ' version=' + (version || '-') +
        ' battleField=' + (battleField || '-') +
        ' checkResult=' + (checkResult || '-') +
        ' runaway=' + (runaway || '-') +
        ' won=' + won);

    // TODO: Verify battle via battleService, apply rewards, update training progress
    var responseData = {
        _model: {},
        _battleResult: won ? 0 : 1,
        _changeInfo: {
            _items: {},
        },
    };

    callback(RH.success(responseData));
}

/**
 * answer — Answer a training question.
 *
 * CLIENT REQUEST:
 * { type: "training", action: "answer", userId, choose, version }
 *
 * RESPONSE:
 *   _right      → boolean indicating if answer was correct
 *   _changeInfo → {_items: {itemId: {_id, _num}}}
 */
function handleAnswer(socket, parsed, callback) {
    var userId = parsed.userId;
    var choose = parsed.choose;
    var version = parsed.version;

    logger.info('TRAINING', 'answer: userId=' + (userId || '-') +
        ' choose=' + (choose || '-') +
        ' version=' + (version || '-'));

    // TODO: Validate answer choice, calculate correctness, grant rewards
    var responseData = {
        _right: false,
        _changeInfo: {
            _items: {},
        },
    };

    callback(RH.success(responseData));
}

/**
 * runAway — Flee from current training battle.
 *
 * CLIENT REQUEST:
 * { type: "training", action: "runAway", userId, version }
 *
 * RESPONSE: empty object {}
 */
function handleRunAway(socket, parsed, callback) {
    var userId = parsed.userId;
    var version = parsed.version;

    logger.info('TRAINING', 'runAway: userId=' + (userId || '-') +
        ' version=' + (version || '-'));

    // TODO: Cancel active battle, reset training node state
    callback(RH.success({}));
}

/**
 * move — Advance to the next training node.
 *
 * CLIENT REQUEST:
 * { type: "training", action: "move", userId, version }
 *
 * RESPONSE: updated training model data
 */
function handleMove(socket, parsed, callback) {
    var userId = parsed.userId;
    var version = parsed.version;

    logger.info('TRAINING', 'move: userId=' + (userId || '-') +
        ' version=' + (version || '-'));

    // TODO: Advance training progress, return updated model
    callback(RH.success({}));
}

/**
 * buyTimes — Purchase extra training attempts.
 *
 * CLIENT REQUEST:
 * { type: "training", action: "buyTimes", userId, version }
 *
 * RESPONSE:
 *   _trainingBuyCount → updated buy count
 *   _changeInfo       → {_items: {itemId: {_id, _num}}} (deducted currency)
 */
function handleBuyTimes(socket, parsed, callback) {
    var userId = parsed.userId;
    var version = parsed.version;

    logger.info('TRAINING', 'buyTimes: userId=' + (userId || '-') +
        ' version=' + (version || '-'));

    // TODO: Deduct currency, increment training buy count
    var responseData = {
        _trainingBuyCount: 0,
        _changeInfo: {
            _items: {},
        },
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
            case 'getLog':
                handleGetLog(socket, parsed, callback);
                break;

            case 'startBattle':
                handleStartBattle(socket, parsed, callback);
                break;

            case 'checkBattleResult':
                handleCheckBattleResult(socket, parsed, callback);
                break;

            case 'answer':
                handleAnswer(socket, parsed, callback);
                break;

            case 'runAway':
                handleRunAway(socket, parsed, callback);
                break;

            case 'move':
                handleMove(socket, parsed, callback);
                break;

            case 'buyTimes':
                handleBuyTimes(socket, parsed, callback);
                break;

            default:
                logger.warn('TRAINING', 'Unknown action: ' + action +
                    ' from userId=' + (userId || '-') + ', returning empty success');
                callback(RH.success({}));
                break;
        }
    } catch (err) {
        logger.error('TRAINING', 'Handler error for action=' + action + ': ' + err.message);
        callback(RH.error(RH.ErrorCode.UNKNOWN, 'Internal server error'));
    }
}

module.exports = { handle: handle };
