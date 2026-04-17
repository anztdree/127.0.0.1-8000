'use strict';

/**
 * =====================================================
 *  activity/index.js — Activity Router (subfolder dispatcher)
 *  Super Warrior Z Game Server — Main Server
 *
 *  102 actions routed to 16 category subfolders.
 *  getRank.js REMOVED — client sends type:"rank", not "activity".
 *
 *  ROUTING: FOLDERS map → require('./' + folder + '/' + action)
 *  Each handler exports: { handle: function(socket, parsed, callback) }
 *
 *  RESPONSE PATTERNS:
 *    Universal (90%+): { _changeInfo, _addHeroes, _addSigns, ... }
 *    Custom (7): getActivityBrief, getActivityDetail, normalLuxuryLuck,
 *               GARoll, turnTable, blindBoxOpen, weaponCastLottery
 *
 *  SOURCE: 100% analyzed from main.min.js (175,843 lines)
 * =====================================================
 */

var RH = require('../../../shared/responseHelper');
var logger = require('../../../shared/utils/logger');

/**
 * FOLDERS map — action name → subfolder name
 * Total: 102 actions across 16 categories
 */
var FOLDERS = {
    // ── query (8) ──
    getActivityBrief:          'query',
    getActivityDetail:         'query',
    queryCSRank:               'query',
    queryWeaponCastRecord:     'query',
    queryLanternBlessRecord:   'query',
    queryImprintTmpPower:      'query',
    blindBoxShowRewards:       'query',
    mergeBossInfo:             'query',

    // ── recharge (11) ──
    rechargeGiftReward:        'recharge',
    rechargeDailyReward:       'recharge',
    recharge3DayReward:        'recharge',
    recharge3FinialReward:     'recharge',
    recharge3DayResign:        'recharge',
    recharge7Reward:           'recharge',
    singleRechargeReward:      'recharge',
    cumulativeRechargeReward:  'recharge',
    doubleElevenGetPayReward:  'recharge',
    buyFund:                   'recharge',
    getFundReward:             'recharge',

    // ── task (14) ──
    activityGetTaskReward:     'task',
    getGrowActivityReward:     'task',
    getLoginActivityReward:    'task',
    getLoginActivityExReward:  'task',
    getLanternBlessTaskReward: 'task',
    goodHarvestsGetReward:     'task',
    buggyGetTaskReward:        'task',
    entrustActReward:          'task',
    friendBattleActReward:     'task',
    marketActReward:           'task',
    karinActReward:            'task',
    beStrongActiveActReward:   'task',
    beStrongGiftActReward:     'task',
    GAGetTaskReward:           'task',

    // ── gacha (11) ──
    GARoll:                    'gacha',
    GAOpenBox:                 'gacha',
    luckyWheelLottery:         'gacha',
    luckyWheelGetReward:       'gacha',
    turnTable:                 'gacha',
    turnTableGetReward:        'gacha',
    blindBoxOpen:              'gacha',
    blindBoxRefresh:           'gacha',
    upsetBlindBox:             'gacha',
    weaponCastLottery:         'gacha',
    weaponCastGetReward:       'gacha',

    // ── luck (5) ──
    normalLuck:                'luck',
    luxuryLuck:                'luck',
    luckFeedbackGetBox:        'luck',
    luckFeedbackGetReward:     'luck',
    costFeedback:              'luck',

    // ── shop (15) ──
    shopBuy:                   'shop',
    buyDailyDiscount:          'shop',
    buyTodayDiscount:          'shop',
    buySuperGift:              'shop',
    buyNewServerGift:          'shop',
    buyHeroSuperGift:          'shop',
    diamondShop:               'shop',
    heroHelpBuy:               'shop',
    heroRewardBuyToken:        'shop',
    heroRewardGetReward:       'shop',
    newHeroRewardBuyGoods:     'shop',
    newHeroRewardPropExchange: 'shop',
    beStrongBuyDiscount:       'shop',
    beStrongRefreshDiscount:   'shop',
    bulmaPartyBuyGoods:        'shop',

    // ── hero (6) ──
    heroGiftReward:            'hero',
    heroOrangeReward:          'hero',
    newHeroChallenge:          'hero',
    newHeroChallengeLike:      'hero',
    newHeroChallengeQueryHonorRoll: 'hero',
    newHeroChallengeQueryWinRank:   'hero',

    // ── equip (5) ──
    equipUp:                   'equip',
    luckEquipGetEquip:         'equip',
    luckEquipGetReward:        'equip',
    luckEquipPushEquip:        'equip',
    luckEquipUp:               'equip',

    // ── imprint (5) ──
    imprintExtraction:         'imprint',
    imprintUpGetReward:        'imprint',
    imprintUpStudy:            'imprint',
    refreshImprint:            'imprint',
    handleRefreshImprintResult:'imprint',

    // ── lantern (3) ──
    lanternBless:              'lantern',
    lanternBlessClickTip:      'lantern',
    resetLanternBless:         'lantern',

    // ── boss (3) ──
    attackNienBeast:           'boss',
    mergeBossBuyTimes:         'boss',
    mergeBossStartBattle:      'boss',

    // ── treasure (4) ──
    buggyTreasureNext:         'treasure',
    buggyTreasureRandom:       'treasure',
    karinRich:                 'treasure',
    karinRichTask:             'treasure',

    // ── feast (4) ──
    whisFeastBlessExchange:    'feast',
    whisFeastFoodFeedbackReward: 'feast',
    whisFeastGetRankReward:    'feast',
    whisFeastGivingFood:       'feast',

    // ── exchange (3) ──
    timeLimitPropExchange:     'exchange',
    timeLimitPropReceive:      'exchange',
    merchantExchange:          'exchange',

    // ── farm (2) ──
    gleaning:                  'farm',
    gleaningBuyTicket:         'farm',

    // ── misc (3) ──
    dailyBigGiftReward:        'misc',
    summonGiftReward:          'misc',
    userCertification:         'misc'
};

function handle(socket, parsed, callback) {
    var action = parsed.action;

    var folder = FOLDERS[action];
    if (folder) {
        try {
            var handler = require('./' + folder + '/' + action);
            return handler.handle(socket, parsed, callback);
        } catch (err) {
            logger.error('ACTIVITY', 'Failed to load handler: ' + action + ' → ' + err.message);
            callback(RH.error(RH.ErrorCode.UNKNOWN_ERROR));
            return;
        }
    }

    // Unknown action → fallback success
    logger.warn('ACTIVITY', 'Unknown action: ' + action);
    callback(RH.success({}));
}

module.exports = { handle: handle };
