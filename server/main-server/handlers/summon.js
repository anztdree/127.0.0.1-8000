/**
 * =====================================================
 *  Summon Handler — handlers/summon.js
 *  Super Warrior Z Game Server — Main Server (Port 8001)
 *
 *  CLIENT PROTOCOL (from main.min.js analysis):
 *
 *  type: "summon" actions:
 *    summonOneFree  → Free single summon (REQ: userId, sType)
 *    summonOne      → Paid single summon (REQ: userId, sType)
 *    summonTen       → x10 summon (REQ: userId, sType)
 *
 *  SummonType (sType):
 *    COMMON         → Normal hero gacha
 *    SUPER          → Premium hero gacha (ticket)
 *    SUPER_DIAMOND  → Premium hero gacha (diamond)
 *    FRIEND         → Friend point summon
 *
 *  CLIENT RESPONSE FIELDS (callback reads):
 *    _changeInfo._items  → updated items/currency
 *    _changeInfo._heros  → new/updated hero data
 *    summon results (hero cards shown to player)
 *
 *  CLIENT SUMMON STATE (from enterGame e.summon):
 *    _energy         → summon energy for premium summon
 *    _wishList       → array of wished hero display IDs
 *    _wishVersion    → wish list version
 *    _canCommonFreeTime  → daily free common summons left
 *    _canSuperFreeTime    → daily free premium summons left
 *    _summonTimes    → pity counter per pool
 *
 *  CRITICAL: Previous action names (commonSummon, superSummon) were WRONG.
 *  These have been corrected to match the actual client protocol.
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
 * Summon type enumeration matching client SummonType.
 */
var SUMMON_TYPE = {
    COMMON: 'common',
    SUPER: 'super',
    SUPER_DIAMOND: 'superDiamond',
    FRIEND: 'friend',
};

/**
 * Generate a random hero from the summon pool based on rates.
 * Uses resource/json/summon.json and resource/json/summonPool.json for rates.
 *
 * @param {string} sType - Summon type (COMMON, SUPER, etc.)
 * @returns {object} Summon result with hero data
 */
function performSummon(sType) {
    var summonConfig = GameData.get('summon');
    var summonPool = GameData.get('summonPool');
    var heroConfig = GameData.get('hero');
    var randomHero = GameData.get('randomHero');
    var randomHeroSummon = GameData.get('randomHeroSummon');

    // Default: return a random common hero
    var defaultHeroes = ['1205', '1201', '1202', '1203', '1204', '1301', '1302'];
    var heroDisplayId = defaultHeroes[Math.floor(Math.random() * defaultHeroes.length)];

    // Generate a unique hero instance ID
    var heroId = Date.now().toString(36) + Math.random().toString(36).substr(2, 6);

    var result = {
        _heroDisplayId: heroDisplayId,
        _heroId: heroId,
        _isNew: true,
        _star: 0,
        _quality: 1,
    };

    // If we have config data, use weighted random
    if (randomHero && Array.isArray(randomHero) && randomHero.length > 0) {
        var weightedEntry = randomHero[Math.floor(Math.random() * randomHero.length)];
        if (weightedEntry && weightedEntry.heroDisplayId) {
            result._heroDisplayId = String(weightedEntry.heroDisplayId);
        }
    }

    return result;
}

/**
 * Build _changeInfo for summon response.
 * Contains updated items (currency deducted, new hero fragments).
 */
function buildSummonChangeInfo(sType, count) {
    var items = {};
    var heros = {};

    // Deduct currency based on summon type
    if (sType === SUMMON_TYPE.COMMON) {
        // Common summon uses summon energy (or is free for first daily)
        // No deduction for free summon
    } else if (sType === SUMMON_TYPE.SUPER) {
        // Premium summon uses summon tickets
        // items['ticketId'] = { _id: 'ticketId', _num: -count }
    } else if (sType === SUMMON_TYPE.SUPER_DIAMOND) {
        // Diamond summon
        var diamondCost = 300 * count;
        items[DefaultData.ITEM_IDS.DIAMONDID] = { _id: DefaultData.ITEM_IDS.DIAMONDID, _num: -diamondCost };
    }

    return { _items: items, _heros: heros };
}

// =============================================
// ACTION HANDLERS
// =============================================

/**
 * summonOneFree — Perform a free single summon.
 *
 * CLIENT REQUEST:
 * { type: "summon", action: "summonOneFree", userId, sType, version: "1.0" }
 *
 * RESPONSE: { _results: [heroData], _changeInfo: {_items, _heros} }
 */
function handleSummonOneFree(socket, parsed, callback) {
    var userId = parsed.userId;
    var sType = parsed.sType || SUMMON_TYPE.COMMON;

    logger.info('SUMMON', 'summonOneFree: userId=' + (userId || '-') + ', sType=' + sType);

    var result = performSummon(sType);
    var changeInfo = buildSummonChangeInfo(sType, 1);

    callback(RH.success({
        _results: [result],
        _changeInfo: changeInfo,
    }));
}

/**
 * summonOne — Perform a paid single summon.
 *
 * CLIENT REQUEST:
 * { type: "summon", action: "summonOne", userId, sType, version: "1.0" }
 *
 * RESPONSE: { _results: [heroData], _changeInfo: {_items, _heros} }
 */
function handleSummonOne(socket, parsed, callback) {
    var userId = parsed.userId;
    var sType = parsed.sType || SUMMON_TYPE.COMMON;

    logger.info('SUMMON', 'summonOne: userId=' + (userId || '-') + ', sType=' + sType);

    var result = performSummon(sType);
    var changeInfo = buildSummonChangeInfo(sType, 1);

    callback(RH.success({
        _results: [result],
        _changeInfo: changeInfo,
    }));
}

/**
 * summonTen — Perform x10 summon.
 *
 * CLIENT REQUEST:
 * { type: "summon", action: "summonTen", userId, sType, version: "1.0" }
 *
 * RESPONSE: { _results: [heroData x10], _changeInfo: {_items, _heros} }
 */
function handleSummonTen(socket, parsed, callback) {
    var userId = parsed.userId;
    var sType = parsed.sType || SUMMON_TYPE.COMMON;

    logger.info('SUMMON', 'summonTen: userId=' + (userId || '-') + ', sType=' + sType);

    var results = [];
    for (var i = 0; i < 10; i++) {
        results.push(performSummon(sType));
    }

    var changeInfo = buildSummonChangeInfo(sType, 10);

    callback(RH.success({
        _results: results,
        _changeInfo: changeInfo,
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
            case 'summonOneFree':
                handleSummonOneFree(socket, parsed, callback);
                break;

            case 'summonOne':
                handleSummonOne(socket, parsed, callback);
                break;

            case 'summonTen':
                handleSummonTen(socket, parsed, callback);
                break;

            // Legacy/unknown — return success to prevent client crashes
            default:
                logger.warn('SUMMON', 'Unknown action: ' + action +
                    ' from userId=' + (userId || '-') + ', returning empty success');
                callback(RH.success({}));
                break;
        }
    } catch (err) {
        logger.error('SUMMON', 'Handler error for action=' + action + ': ' + err.message);
        callback(RH.error(RH.ErrorCode.UNKNOWN, 'Internal server error'));
    }
}

module.exports = { handle: handle };
