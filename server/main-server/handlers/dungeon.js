/**
 * =====================================================
 *  Dungeon Handler — handlers/dungeon.js
 *  Super Warrior Z Game Server — Main Server (Port 8001)
 *
 *  CLIENT PROTOCOL (from main.min.js analysis):
 *
 *  DungeonType values:
 *    1 = EXP (experience dungeon)
 *    2 = EVOLVE (evolution dungeon)
 *    3 = ENERGY (energy dungeon)
 *    4 = EQUIP (equipment dungeon)
 *    5 = SINGA (snake dungeon A)
 *    6 = SINGB (snake dungeon B)
 *    7 = METAL (metal dungeon)
 *    8 = Z_STONE (Z-stone dungeon)
 *
 *  type: "dungeon" actions:
 *    checkBattleResult  → Submit dungeon battle result
 *    sweep              → Quick sweep cleared stage
 *    buy                → Purchase extra dungeon attempts
 *    getRecord          → Get dungeon clear records
 *
 *  CLIENT STATE (from enterGame e.dungeon._dungeons):
 *    { dungeonType: { type, lastLevel, curMaxLevel, times } }
 *
 *  Usage:
 *    handler.handle(socket, parsedRequest, callback)
 * =====================================================
 */

'use strict';

var RH = require('../../shared/responseHelper');
var DB = require('../../database/connection');
var GameData = require('../../shared/gameData/loader');
var logger = require('../../shared/utils/logger');

/**
 * Dungeon type enumeration matching client.
 */
var DUNGEON_TYPE = {
    EXP: 1,
    EVOLVE: 2,
    ENERGY: 3,
    EQUIP: 4,
    SINGA: 5,
    SINGB: 6,
    METAL: 7,
    Z_STONE: 8,
};

/**
 * Get dungeon config for a specific type and level.
 * Reads from resource/json/equipDungeon.json, expDungeon.json, etc.
 */
function getDungeonConfig(dungeonType, level) {
    var configFiles = {
        1: 'expDungeon',
        2: 'evolveDungeon',
        3: 'energyDungeon',
        4: 'equipDungeon',
        5: 'snakeDungeon',
        7: 'metalDungeon',
        8: 'zStoneDungeon',
    };
    var configName = configFiles[dungeonType];
    if (!configName) return null;

    var config = GameData.get(configName);
    if (!config) return null;

    // Config is usually an array indexed by level
    if (Array.isArray(config)) {
        return config[level - 1] || null;
    }
    return config[level] || null;
}

// =============================================
// ACTION HANDLERS
// =============================================

/**
 * checkBattleResult — Submit dungeon battle result.
 *
 * CLIENT REQUEST:
 * {
 *   type: "dungeon",
 *   action: "checkBattleResult",
 *   userId: string,
 *   dungeonType: number (1=exp, 4=equip, etc.),
 *   dungeonLevel: number,
 *   battleId: string,
 *   version: "1.0",
 *   super: [superSkillId, ...],
 *   checkResult: number (0=WIN, non-zero=LOSE),
 *   battleField: number
 * }
 *
 * CLIENT RESPONSE FIELDS:
 *   t._battleResult  → 0=WIN, non-zero=LOSE
 *   t._lastLevel    → last cleared level for this dungeon type
 *   t._curMaxLevel  → current max unlocked level
 *   t._haveTimes    → remaining daily attempts
 *   t._buyTimes     → purchased extra attempts
 *   t._changeInfo   → {_items: {itemId: {_id, _num}}}
 */
function handleCheckBattleResult(socket, parsed, callback) {
    var userId = parsed.userId;
    var dungeonType = parsed.dungeonType;
    var dungeonLevel = parsed.dungeonLevel;
    var battleId = parsed.battleId;
    var checkResult = parsed.checkResult;

    var won = (checkResult === 0 || checkResult === '0');

    logger.info('DUNGEON', 'checkBattleResult: userId=' + (userId || '-') +
        ', type=' + dungeonType + ', level=' + dungeonLevel +
        ', won=' + won);

    // TODO: Load user data, update dungeon progress, calculate rewards
    var responseData = {
        _battleResult: won ? 0 : 1,
        _lastLevel: dungeonLevel,
        _curMaxLevel: dungeonLevel,
        _haveTimes: 0,
        _buyTimes: 0,
        _changeInfo: {
            _items: {},
        },
    };

    callback(RH.success(responseData));
}

/**
 * sweep — Quick sweep a cleared dungeon stage.
 *
 * CLIENT REQUEST:
 * { type: "dungeon", action: "sweep", userId, dungeonType, dungeonLevel, version: "1.0" }
 *
 * RESPONSE: sweep rewards
 */
function handleSweep(socket, parsed, callback) {
    var userId = parsed.userId;
    var dungeonType = parsed.dungeonType;
    var dungeonLevel = parsed.dungeonLevel;

    logger.info('DUNGEON', 'sweep: userId=' + (userId || '-') +
        ', type=' + dungeonType + ', level=' + dungeonLevel);

    callback(RH.success({
        _changeInfo: {
            _items: {},
        },
    }));
}

/**
 * buy — Purchase extra dungeon attempts.
 *
 * CLIENT REQUEST:
 * { type: "dungeon", action: "buy", userId, dungeonType, count, version: "1.0" }
 *
 * RESPONSE: updated times, deducted currency
 */
function handleBuy(socket, parsed, callback) {
    var userId = parsed.userId;
    var dungeonType = parsed.dungeonType;
    var count = parsed.count || 1;

    logger.info('DUNGEON', 'buy: userId=' + (userId || '-') +
        ', type=' + dungeonType + ', count=' + count);

    callback(RH.success({
        _changeInfo: {
            _items: {},
        },
    }));
}

/**
 * getRecord — Get dungeon clear records.
 *
 * CLIENT REQUEST:
 * { type: "dungeon", action: "getRecord", userId, version: "1.0" }
 *
 * RESPONSE: dungeon records
 */
function handleGetRecord(socket, parsed, callback) {
    var userId = parsed.userId;

    logger.info('DUNGEON', 'getRecord: userId=' + (userId || '-'));

    callback(RH.success({
        _dungeons: {},
    }));
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
            case 'checkBattleResult':
                handleCheckBattleResult(socket, parsed, callback);
                break;

            case 'sweep':
                handleSweep(socket, parsed, callback);
                break;

            case 'buy':
                handleBuy(socket, parsed, callback);
                break;

            case 'getRecord':
                handleGetRecord(socket, parsed, callback);
                break;

            default:
                logger.warn('DUNGEON', 'Unknown action: ' + action +
                    ' from userId=' + (userId || '-') + ', returning empty success');
                callback(RH.success({}));
                break;
        }
    } catch (err) {
        logger.error('DUNGEON', 'Handler error for action=' + action + ': ' + err.message);
        callback(RH.error(RH.ErrorCode.UNKNOWN, 'Internal server error'));
    }
}

module.exports = { handle: handle };
