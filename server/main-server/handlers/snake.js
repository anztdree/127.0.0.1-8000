/**
 * =====================================================
 *  Snake Handler — handlers/snake.js
 *  Super Warrior Z Game Server — Main Server
 *
 *  CLIENT PROTOCOL (type: "snake"):
 *
 *  READ actions:
 *    getSnakeInfo   → Retrieve snake game data model
 *    getEnemyInfo   → Retrieve enemy info for a level
 *
 *  WRITE actions:
 *    startBattle    → Start a snake game battle stage
 *    recoverHero    → Recover a hero after battle
 *    reset          → Reset snake game progress
 *    awardBox       → Open a reward box
 *    sweep          → Quick sweep cleared stage
 *    getAllBoxReward → Claim all pending box rewards
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
 * getSnakeInfo — Retrieve snake game data model.
 *
 * CLIENT REQUEST:
 * { type: "snake", action: "getSnakeInfo", userId, version }
 *
 * RESPONSE: full snake data model
 */
function handleGetSnakeInfo(socket, parsed, callback) {
    var userId = parsed.userId;
    var version = parsed.version;

    logger.info('SNAKE', 'getSnakeInfo: userId=' + (userId || '-') +
        ' version=' + (version || '-'));

    // TODO: Load user snake data from database
    callback(RH.success({}));
}

/**
 * getEnemyInfo — Retrieve enemy info for a specific snake level.
 *
 * CLIENT REQUEST:
 * { type: "snake", action: "getEnemyInfo", userId, lessId, version }
 *
 * RESPONSE: enemy configuration data for the level
 */
function handleGetEnemyInfo(socket, parsed, callback) {
    var userId = parsed.userId;
    var lessId = parsed.lessId;
    var version = parsed.version;

    logger.info('SNAKE', 'getEnemyInfo: userId=' + (userId || '-') +
        ' lessId=' + (lessId || '-') +
        ' version=' + (version || '-'));

    // TODO: Load enemy configuration for the specified level
    callback(RH.success({}));
}

/**
 * startBattle — Start a snake game battle stage.
 *
 * CLIENT REQUEST:
 * { type: "snake", action: "startBattle", userId, version, team, super, battleField }
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

    logger.info('SNAKE', 'startBattle: userId=' + (userId || '-') +
        ' version=' + (version || '-') +
        ' battleField=' + (battleField || '-') +
        ' teamCount=' + (Array.isArray(team) ? team.length : 0) +
        ' superCount=' + (Array.isArray(super_) ? super_.length : 0));

    // TODO: Generate battle via battleService, build enemy team from level config
    var responseData = {
        _battleId: 'battle_' + Date.now() + '_' + Math.random().toString(16).substring(2, 10),
        _rightTeam: [],
        _rightSuper: [],
    };

    callback(RH.success(responseData));
}

/**
 * recoverHero — Recover a hero after battle.
 *
 * CLIENT REQUEST:
 * { type: "snake", action: "recoverHero", userId, ... }
 *
 * RESPONSE: standard success
 */
function handleRecoverHero(socket, parsed, callback) {
    var userId = parsed.userId;

    logger.info('SNAKE', 'recoverHero: userId=' + (userId || '-'));

    // TODO: Validate hero recovery, deduct resources if needed
    callback(RH.success({}));
}

/**
 * reset — Reset snake game progress.
 *
 * CLIENT REQUEST:
 * { type: "snake", action: "reset", userId, version }
 *
 * RESPONSE: empty object {} — client then calls getSnakeInfo to refresh
 */
function handleReset(socket, parsed, callback) {
    var userId = parsed.userId;
    var version = parsed.version;

    logger.info('SNAKE', 'reset: userId=' + (userId || '-') +
        ' version=' + (version || '-'));

    // TODO: Reset user snake progress in database
    callback(RH.success({}));
}

/**
 * awardBox — Open a specific reward box.
 *
 * CLIENT REQUEST:
 * { type: "snake", action: "awardBox", userId, boxId, version }
 *
 * RESPONSE:
 *   _changeInfo → {_items: {itemId: {_id, _num}}}
 */
function handleAwardBox(socket, parsed, callback) {
    var userId = parsed.userId;
    var boxId = parsed.boxId;
    var version = parsed.version;

    logger.info('SNAKE', 'awardBox: userId=' + (userId || '-') +
        ' boxId=' + (boxId || '-') +
        ' version=' + (version || '-'));

    // TODO: Validate box ownership, grant rewards
    var responseData = {
        _changeInfo: {
            _items: {},
        },
    };

    callback(RH.success(responseData));
}

/**
 * sweep — Quick sweep a cleared snake game stage.
 *
 * CLIENT REQUEST:
 * { type: "snake", action: "sweep", userId, ... }
 *
 * RESPONSE: sweep results including rewards
 */
function handleSweep(socket, parsed, callback) {
    var userId = parsed.userId;

    logger.info('SNAKE', 'sweep: userId=' + (userId || '-'));

    // TODO: Validate sweep eligibility, calculate sweep rewards
    callback(RH.success({}));
}

/**
 * getAllBoxReward — Claim all pending box rewards.
 *
 * CLIENT REQUEST:
 * { type: "snake", action: "getAllBoxReward", userId }
 *
 * RESPONSE:
 *   _changeInfo → {_items: {itemId: {_id, _num}}}
 */
function handleGetAllBoxReward(socket, parsed, callback) {
    var userId = parsed.userId;

    logger.info('SNAKE', 'getAllBoxReward: userId=' + (userId || '-'));

    // TODO: Collect all unclaimed box rewards, grant to user
    var responseData = {
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
            case 'getSnakeInfo':
                handleGetSnakeInfo(socket, parsed, callback);
                break;

            case 'getEnemyInfo':
                handleGetEnemyInfo(socket, parsed, callback);
                break;

            case 'startBattle':
                handleStartBattle(socket, parsed, callback);
                break;

            case 'recoverHero':
                handleRecoverHero(socket, parsed, callback);
                break;

            case 'reset':
                handleReset(socket, parsed, callback);
                break;

            case 'awardBox':
                handleAwardBox(socket, parsed, callback);
                break;

            case 'sweep':
                handleSweep(socket, parsed, callback);
                break;

            case 'getAllBoxReward':
                handleGetAllBoxReward(socket, parsed, callback);
                break;

            default:
                logger.warn('SNAKE', 'Unknown action: ' + action +
                    ' from userId=' + (userId || '-') + ', returning empty success');
                callback(RH.success({}));
                break;
        }
    } catch (err) {
        logger.error('SNAKE', 'Handler error for action=' + action + ': ' + err.message);
        callback(RH.error(RH.ErrorCode.UNKNOWN, 'Internal server error'));
    }
}

module.exports = { handle: handle };
