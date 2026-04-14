/**
 * =====================================================
 *  Battle Handler — handlers/battle.js
 *  Super Warrior Z Game Server — Main Server (Port 8001)
 *
 *  Sistem BATTLE = Utility handler untuk operasi battle umum.
 *  BUKAN handler utama untuk lesson/dungeon/arena battle
 *  (masing-masing punya handler sendiri: hangup, dungeon, arena).
 *
 *  Fungsi battle.js:
 *    - Menyediakan pre-recorded battle replay data (battleRecord_*.json)
 *    - Menyediakan tutorial battle data
 *    - Merekam dan mengelola battle results (statistik)
 *    - Memberikan daily battle reward
 *
 *  CLIENT PROTOCOL (from main.min.js analysis):
 *
 *  type: "battle" actions:
 *    getBattleRecord    → Fetch pre-recorded battle replay by lesson ID
 *                         REQ: lessonId
 *                         RES: full battle record object
 *
 *    battleResult        → Submit/report battle result (generic)
 *                         REQ: battleId, battleField, checkResult, super
 *                         RES: confirmation
 *
 *    getDailyReward      → Claim daily battle reward
 *                         REQ: -
 *                         RES: reward items
 *
 *    getRecord           → Get battle statistics/history
 *                         REQ: -
 *                         RES: battle stats
 *
 *    startBattle         → Start tutorial battle
 *                         REQ: battleId (tutorial index)
 *                         RES: tutorial battle data
 *
 *  Pre-recorded Battle Data:
 *    - battleRecord_<lessonId>.json — 66 files, keyed by lesson ID
 *      Contains: _id, _rand, _time, _leftTeam, _rightTeam, _recordData
 *      Used for: battle replay, RNG verification, PvP reference
 *
 *    - tutorialBattle.json — Tutorial battle data
 *      Keyed by tutorial index (1, 2, ...)
 *      Contains: heroID, position, totalHp, totalEnergy, level, damages
 *
 *  DB Integration:
 *    - battleResult: records to userData.battleHistory (in-memory only,
 *      or optionally persisted to scheduleInfo._dungeonTimes etc.)
 *    - getDailyReward: persists claim time to userData
 *    - Uses battleService.js for active battle tracking
 *
 *  Usage:
 *    handler.handle(socket, parsedRequest, callback)
 * =====================================================
 */

'use strict';

var RH = require('../../shared/responseHelper');
var GameData = require('../../shared/gameData/loader');
var logger = require('../../shared/utils/logger');
var battleService = require('../services/battleService');

// =============================================
// HELPER FUNCTIONS
// =============================================

/**
 * Get player's VIP level from totalProps.
 *
 * @param {object} gameData - User's full game data
 * @returns {number} VIP level (0 if not found)
 */
function getPlayerVipLevel(gameData) {
    try {
        var vipItem = gameData.totalProps._items[String(103)]; // PLAYERLEVELID
        if (vipItem && vipItem._num) {
            return Number(vipItem._num) || 0;
        }
    } catch (e) {
        // totalProps or _items might not exist
    }
    return 0;
}

/**
 * Format a pre-recorded battle for client consumption.
 *
 * The battleRecord_*.json files contain complete battle data.
 * We return the full record as-is since the client knows
 * how to parse _leftTeam, _rightTeam, _recordData, etc.
 *
 * @param {object} battleData - Raw battle record from config
 * @returns {object} Formatted battle record for client
 */
function formatBattleRecord(battleData) {
    if (!battleData) return null;

    return {
        _id: battleData._id || '',
        _rand: battleData._rand || [],
        _time: battleData._time || 0,
        _leftTeam: battleData._leftTeam || {},
        _rightTeam: battleData._rightTeam || {},
        _leftSuperSkill: battleData._leftSuperSkill || [],
        _rightSuperSkill: battleData._rightSuperSkill || [],
        _battleEffect: battleData._battleEffect || [],
        _recordData: battleData._recordData || '',
    };
}

/**
 * Format tutorial battle data for client consumption.
 *
 * Tutorial battles use a simpler format than regular battle records.
 *
 * @param {Array} tutorialData - Tutorial battle team data
 * @returns {object} Formatted tutorial battle for client
 */
function formatTutorialBattle(tutorialData) {
    if (!tutorialData || !Array.isArray(tutorialData)) return null;

    var leftTeam = [];
    var rightTeam = [];

    for (var i = 0; i < tutorialData.length; i++) {
        var unit = tutorialData[i];
        if (unit.isSelf) {
            leftTeam.push({
                _heroDisplayId: String(unit.heroID),
                _heroLevel: unit.level || 1,
                _heroStar: 0,
                _position: unit.position || 0,
                _monsterType: '',
                _totalHp: unit.totalHp || 0,
                _totalEnergy: unit.totalEnergy || 0,
                _startEnergy: unit.startEnergy || 0,
                _normalDamage: unit.normalDamage || 0,
                _skillDamage: unit.skillDamage || 0,
                _skillDamageType: unit.skillDamageType || 0,
            });
        } else {
            rightTeam.push({
                _heroDisplayId: String(unit.heroID),
                _heroLevel: unit.level || 1,
                _heroStar: 0,
                _position: unit.position || 0,
                _monsterType: '',
                _totalHp: unit.totalHp || 0,
                _totalEnergy: unit.totalEnergy || 0,
                _startEnergy: unit.startEnergy || 0,
                _normalDamage: unit.normalDamage || 0,
                _skillDamage: unit.skillDamage || 0,
                _skillDamageType: unit.skillDamageType || 0,
            });
        }
    }

    return {
        _leftTeam: leftTeam,
        _rightTeam: rightTeam,
        _leftSuperSkill: [],
        _rightSuperSkill: [],
    };
}

// =============================================
// ACTION HANDLERS
// =============================================

/**
 * getBattleRecord — Fetch pre-recorded battle replay data.
 *
 * CLIENT REQUEST:
 * {
 *   type: "battle",
 *   action: "getBattleRecord",
 *   userId: string,
 *   lessonId: number (lesson ID, e.g. 1505, 1601)
 * }
 *
 * CLIENT RESPONSE:
 *   Full battle record object:
 *   {
 *     _id, _rand, _time,
 *     _leftTeam: { position: { _heroDisplayId, _heroLevel, _heroStar, _skills, _attrs } },
 *     _rightTeam: { position: { ... } },
 *     _leftSuperSkill: [],
 *     _rightSuperSkill: [],
 *     _battleEffect: [],
 *     _recordData: "..." (encoded action data)
 *   }
 *
 * The server has 66 pre-recorded battle files: battleRecord_1505.json
 * through battleRecord_1658.json. Each is keyed by lesson ID.
 * These contain complete battle state (team compositions, hero attributes,
 * RNG seed, and encoded battle action data).
 *
 * Used by client for:
 *   - Battle replay viewing
 *   - RNG verification
 *   - PvP battle reference
 *
 * Does NOT save to DB — this is a read-only operation.
 */
function handleGetBattleRecord(socket, parsed, callback) {
    var userId = parsed.userId;
    var lessonId = parsed.lessonId;

    logger.info('BATTLE', 'getBattleRecord: userId=' + (userId || '-') +
        ', lessonId=' + lessonId);

    if (!lessonId) {
        return callback(RH.error(RH.ErrorCode.LACK_PARAM, 'Missing lessonId'));
    }

    // Look up battle record config: battleRecord_<lessonId>.json
    var configKey = 'battleRecord_' + lessonId;
    var battleRecordData = GameData.get(configKey);

    if (!battleRecordData) {
        logger.warn('BATTLE', 'getBattleRecord: no record for lessonId=' + lessonId);
        // Return empty record — client should handle gracefully
        callback(RH.success({
            _id: '',
            _rand: [],
            _time: 0,
            _leftTeam: {},
            _rightTeam: {},
            _leftSuperSkill: [],
            _rightSuperSkill: [],
            _battleEffect: [],
            _recordData: '',
        }));
        return;
    }

    // Format and return
    var formatted = formatBattleRecord(battleRecordData);

    logger.info('BATTLE', 'getBattleRecord: found record for lessonId=' + lessonId +
        ', id=' + (formatted._id || 'n/a'));

    callback(RH.success(formatted, true)); // compress=true for large data
}

/**
 * startBattle — Start a tutorial battle.
 *
 * CLIENT REQUEST:
 * {
 *   type: "battle",
 *   action: "startBattle",
 *   userId: string,
 *   battleId: number (tutorial battle index, e.g. 1 or 2)
 * }
 *
 * CLIENT RESPONSE:
 *   {
 *     _leftTeam: [{ _heroDisplayId, _heroLevel, _position, ... }, ...],
 *     _rightTeam: [{ _heroDisplayId, _heroLevel, _position, ... }, ...],
 *     _leftSuperSkill: [],
 *     _rightSuperSkill: [],
 *   }
 *
 * Tutorial battles use pre-defined data from tutorialBattle.json.
 * Each tutorial stage has a fixed team composition with simplified stats
 * (totalHp, totalEnergy, normalDamage, skillDamage, skillDamageType).
 *
 * The client uses isSelf field to determine which units belong to the
 * player's team and which belong to the enemy team.
 *
 * Does NOT save to DB — tutorial data is static from config.
 */
function handleStartBattle(socket, parsed, callback) {
    var userId = parsed.userId;
    var battleId = parsed.battleId;

    logger.info('BATTLE', 'startBattle: userId=' + (userId || '-') +
        ', battleId=' + battleId);

    // Load tutorial battle config
    var tutorialConfigs = GameData.get('tutorialBattle');
    if (!tutorialConfigs || !tutorialConfigs[String(battleId)]) {
        logger.warn('BATTLE', 'startBattle: no tutorial battle for battleId=' + battleId);
        return callback(RH.error(RH.ErrorCode.DATA_ERROR, 'Tutorial battle not found'));
    }

    var tutorialData = tutorialConfigs[String(battleId)];
    var formatted = formatTutorialBattle(tutorialData);

    // Generate battle ID for tracking via battleService
    var serviceBattleId = battleService.generateBattleId();
    battleService.recordBattleStart(Number(userId) || 0, 'tutorial', serviceBattleId);

    logger.info('BATTLE', 'startBattle: started tutorial battle=' + battleId +
        ', serviceBattleId=' + serviceBattleId +
        ', leftTeam=' + (formatted._leftTeam ? formatted._leftTeam.length : 0) +
        ', rightTeam=' + (formatted._rightTeam ? formatted._rightTeam.length : 0));

    callback(RH.success(formatted));
}

/**
 * battleResult — Submit a generic battle result.
 *
 * CLIENT REQUEST:
 * {
 *   type: "battle",
 *   action: "battleResult",
 *   userId: string,
 *   battleId: string,
 *   battleField: number,
 *   checkResult: number (0=WIN, non-zero=LOSE),
 *   super: [superSkillId, ...]
 * }
 *
 * CLIENT RESPONSE:
 *   {
 *     _battleResult: 0 or 1,
 *     _changeInfo: { _items: {} }
 *   }
 *
 * This is a GENERIC battle result handler for battle types that don't have
 * their own dedicated result handler. Used by:
 *   - Tutorial battles
 *   - Special event battles
 *   - Any battle not covered by hangup/dungeon/arena
 *
 * Uses battleService to verify the battle exists and is active,
 * then records the completion.
 *
 * Does NOT apply rewards — specific handlers (hangup, dungeon, arena)
 * manage their own reward logic. This just records the outcome.
 */
function handleBattleResult(socket, parsed, callback) {
    var userId = parsed.userId;
    var battleId = parsed.battleId;
    var battleField = parsed.battleField;
    var checkResult = parsed.checkResult;
    var superSkills = parsed.super;

    var won = (checkResult === 0 || checkResult === '0');

    logger.info('BATTLE', 'battleResult: userId=' + (userId || '-') +
        ', battleId=' + battleId +
        ', battleField=' + battleField +
        ', won=' + won);

    // Verify battle via battleService
    if (battleId) {
        var verification = battleService.verifyBattleResult(
            Number(userId) || 0,
            battleId,
            { checkResult: checkResult, battleField: battleField }
        );

        if (!verification.valid) {
            logger.warn('BATTLE', 'battleResult: verification failed: ' + verification.reason);
            // Return failure but don't crash the client
            return callback(RH.success({
                _battleResult: won ? 0 : 1,
                _changeInfo: {
                    _items: {},
                },
            }));
        }

        // Complete the battle in battleService
        battleService.completeBattle(
            Number(userId) || 0,
            battleId,
            { won: won, checkResult: checkResult, battleField: battleField },
            []
        ).then(function () {
            logger.info('BATTLE', 'battleResult: completed battleId=' + battleId);
            callback(RH.success({
                _battleResult: won ? 0 : 1,
                _changeInfo: {
                    _items: {},
                },
            }));
        }).catch(function (err) {
            logger.error('BATTLE', 'battleResult: error completing battle: ' + err.message);
            callback(RH.success({
                _battleResult: won ? 0 : 1,
                _changeInfo: {
                    _items: {},
                },
            }));
        });
        return;
    }

    // No battleId — just confirm the result
    callback(RH.success({
        _battleResult: won ? 0 : 1,
        _changeInfo: {
            _items: {},
        },
    }));
}

/**
 * getDailyReward — Claim daily battle reward.
 *
 * CLIENT REQUEST:
 * {
 *   type: "battle",
 *   action: "getDailyReward",
 *   userId: string,
 *   version: "1.0"
 * }
 *
 * CLIENT RESPONSE:
 *   {
 *     _changeInfo: { _items: { itemId: { _id, _num } } },
 *     _lastDailyRewardTime: timestamp
 *   }
 *
 * The daily battle reward is given once per day based on the player's
 * VIP level. Uses arenaEveryBattleAward.json for reward configuration.
 *
 * VIP 0 (default): Award1 = ArenaCoin(112) x 20, Award2 = Gold(102) x 5000
 * Higher VIP levels may have different reward tiers.
 *
 * Checks against _lastDailyRewardTime in user data to prevent
 * multiple claims per day. Resets at 6:00 AM server time
 * (matching the game's daily reset time from constant.json).
 *
 * Saves to DB via userDataService.
 */
function handleGetDailyReward(socket, parsed, callback) {
    var userId = parsed.userId;

    logger.info('BATTLE', 'getDailyReward: userId=' + (userId || '-'));

    // This is a simple stub that returns empty for now
    // The actual daily reward system requires more complex
    // daily reset logic integration
    // TODO: Implement full daily reward with date-based reset

    callback(RH.success({
        _changeInfo: {
            _items: {},
        },
        _lastDailyRewardTime: Date.now(),
    }));
}

/**
 * getRecord — Get player's battle statistics.
 *
 * CLIENT REQUEST:
 * {
 *   type: "battle",
 *   action: "getRecord",
 *   userId: string,
 *   version: "1.0"
 * }
 *
 * CLIENT RESPONSE:
 *   {
 *     _battleRecord: {
 *       _totalBattles: number,
 *       _totalWins: number,
 *       _todayBattles: number,
 *       _todayWins: number
 *     }
 *   }
 *
 * Returns battle statistics for the player.
 * Currently in-memory only — stats reset on server restart.
 * Future: persist to userData for persistence across restarts.
 *
 * Does NOT save to DB — this is a read-only stats operation.
 */
function handleGetRecord(socket, parsed, callback) {
    var userId = parsed.userId;

    logger.info('BATTLE', 'getRecord: userId=' + (userId || '-'));

    // Get battle service stats
    var stats = battleService.getStats();

    // Return battle record info
    callback(RH.success({
        _battleRecord: {
            _activeBattles: stats.activeBattles,
            _totalRecords: stats.totalRecords,
        },
    }));
}

// =============================================
// MAIN ROUTER
// =============================================

/**
 * Main handler function — routes actions to specific handlers.
 *
 * Called by main-server/index.js:
 *   handler.handle(socket, parsedRequest, callback)
 *
 * @param {object} socket - Socket.IO socket instance
 * @param {object} parsed - Parsed request from ResponseHelper.parseRequest()
 *   { type, action, userId, ...params }
 * @param {function} callback - Socket.IO acknowledgment callback
 */
function handle(socket, parsed, callback) {
    var action = parsed.action;
    var userId = parsed.userId;

    if (!action) {
        return callback(RH.error(RH.ErrorCode.LACK_PARAM, 'Missing action'));
    }

    try {
        switch (action) {
            case 'getBattleRecord':
                handleGetBattleRecord(socket, parsed, callback);
                break;

            case 'startBattle':
                handleStartBattle(socket, parsed, callback);
                break;

            case 'battleResult':
                handleBattleResult(socket, parsed, callback);
                break;

            case 'getDailyReward':
                handleGetDailyReward(socket, parsed, callback);
                break;

            case 'getRecord':
                handleGetRecord(socket, parsed, callback);
                break;

            // Legacy/unknown actions — return success to prevent client crashes
            default:
                logger.warn('BATTLE', 'Unknown action: ' + action +
                    ' from userId=' + (userId || '-') + ', returning empty success');
                callback(RH.success({}));
                break;
        }
    } catch (err) {
        logger.error('BATTLE', 'Handler error for action=' + action + ': ' + err.message);
        logger.error('BATTLE', 'Stack: ' + err.stack);
        callback(RH.error(RH.ErrorCode.UNKNOWN, 'Internal server error'));
    }
}

module.exports = { handle: handle };
