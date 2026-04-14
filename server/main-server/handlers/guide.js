/**
 * =====================================================
 *  Guide Handler — handlers/guide.js
 *  Super Warrior Z Game Server — Main Server (Port 8001)
 *
 *  Tutorial / New Player Guide Progress Handler
 *
 *  Menangani penyimpanan progress tutorial player ke database.
 *  Client mengirim type:"guide" HANYA saat menyelesaikan tutorial
 *  step yang memiliki isSave=true di tutorial.json config.
 *
 *  ⚠️  KOREKSI dari versi lama:
 *     Komentar lama menyebut "Client TIDAK pernah mengirim type: guide"
 *     — ini SALAH. Client MENGIRIM type:"guide" via method
 *     GuideInfoManager.sendGuideSted(stepId) untuk menyimpan
 *     progress tutorial yang memiliki isSave=true.
 *
 *  Client Reference (main.min.js line 79579):
 *    GuideInfoManager.prototype.sendGuideSted = function(stepId) {
 *        var tutorialConfig = ReadJsonSingleton.getInstance().tutorial;
 *        var config = tutorialConfig[stepId];
 *        if (!config) return;  // skip invalid step
 *
 *        // 1. Save locally first
 *        this.setGuideStep(config.tutorialLine, stepId);
 *
 *        // 2. If isSave=true, persist to server
 *        if (config.isSave) {
 *            var userId = UserInfoSingleton.getInstance().userId;
 *            ts.processHandler({
 *                type: "guide",
 *                action: "saveGuide",
 *                userId: userId,
 *                guideType: config.tutorialLine,  // GUIDE_TYPE enum (2-51)
 *                step: stepId,                    // tutorial step ID (2101-50104)
 *                version: "1.0"
 *            }, function(e) {
 *                Logger.serverDebugLog("成功！！！")  // "Success!"
 *            }, function(e) {
 *                Logger.serverDebugLog("失败！！！")  // "Failed!"
 *            })
 *        }
 *    }
 *
 *  Client does NOT process the response data — only checks ret: 0.
 *  Server must persist guide progress to user_data.guide for the
 *  data to be restored on next login (via enterGame → setGuideInfo).
 *
 *  Guide Data Structure (user_data.guide):
 *    {
 *        _id: userId,        // string/number — player ID
 *        _steps: {           // object — map of tutorialLine → currentStepId
 *            "2": 2717,      // MAIN guide completed (step 2717 = MainGuideEndID)
 *            "3": 3102,      // TASK guide completed
 *            "4": 4301,      // ARENA guide completed
 *            "18": 18105,    // QIGONG guide completed
 *            ...             // more guide lines as player progresses
 *        }
 *    }
 *
 *  Tutorial Config (tutorial.json):
 *    - 254 entries total
 *    - 60 entries have isSave=true (save points)
 *    - Each has: id, name, tutorialLine, nextID, isSave, etc.
 *    - tutorialLine maps to GUIDE_TYPE enum (2=MAIN, 3=TASK, 4=ARENA, etc.)
 *
 *  GUIDE_TYPE Enum (from client):
 *    2=MAIN, 3=TASK, 4=ARENA, 5=SOURCE_DUNGEON, 6=TEMPLE_TEST,
 *    7=EQUIP_DUNGEON, 8=GUILD, 9=SNAKE, 10=STRONG_ENEMY, 11=KARIN,
 *    12=DRAGON, 13=ENTRUST, 14=MAHA, 15=SIGN, 16=CELL_GAME,
 *    18=QIGONG, 19=WEAPON, 20=EARRING, 21=HEROWAKEUP,
 *    22=HERODEBRISCOMPOUND, 23=SMITHY, 24=TheWildAdventure,
 *    25=TimeTravel, 26=SnakeBeanResurgence, 27=AltarDecompose,
 *    28=Training, 29=BossFight, 30=Psych, 31=Expedition,
 *    32=ExpeditionEvent, 33=Inherit, 34=TeamTraining, 35=Appraise,
 *    36=SoulShop, 37=weaponCircle, 38=TeamDungeon, 39=SignAdd,
 *    40=EquipGem, 41=HeroLink, 42=TopBattle, 43=LimitEvolve,
 *    44=SpaceTrial, 45=GravityTrial, 46=RedEquipUpgrade,
 *    47=SummonList, 48=GuildSign, 49=GuildTech,
 *    50=GuildHeroLinkUpper, 51=SmallGameBack
 *
 *  Special Guide IDs:
 *    GuideStartID       = 2101  (Main guide start)
 *    MainGuideEndID     = 2717  (Main guide completion)
 *    TaskGuideStartID   = 3101
 *    TaskGuideEndID     = 3102  (Task guide completion — triggers SDK reports)
 *
 *  Actions:
 *    saveGuide      — Save tutorial progress step (CALLED BY CLIENT)
 *    getGuideData   — Get current guide progress (NOT called by client, fallback)
 *    getGuideReward — Claim guide completion reward (NOT called by client, fallback)
 *    complete       — Mark guide as complete (NOT called by client, fallback)
 *
 *  Usage:
 *    handler.handle(socket, parsedRequest, callback)
 * =====================================================
 */

'use strict';

var RH = require('../../shared/responseHelper');
var logger = require('../../shared/utils/logger');
var userDataService = require('../services/userDataService');
var GameData = require('../../shared/gameData/loader');

/**
 * Handle guide request dari client.
 *
 * @param {Object} socket - Socket.IO socket instance
 * @param {Object} parsed - Parsed request: { type, action, userId, guideType, step, ... }
 * @param {Function} callback - Response callback: callback(responseObj)
 */
function handle(socket, parsed, callback) {
    var action = parsed.action;
    var userId = parsed.userId;

    switch (action) {

        // =============================================
        // ACTION: saveGuide
        // =============================================
        // Simpan progress tutorial step ke database.
        //
        // Client call site: GuideInfoManager.sendGuideSted(stepId)
        // Dipanggil HANYA jika tutorial config entry memiliki isSave=true.
        // Ada 60 save points dari 254 total tutorial entries.
        //
        // REQ params:
        //   guideType — number: tutorial line type (GUIDE_TYPE enum: 2-51)
        //   step      — number: tutorial step ID (e.g., 2101-50104)
        //   version   — string: "1.0" (protocol version, ignored)
        //
        // Server behavior:
        //   1. Load user_data from DB (via userDataService)
        //   2. Initialize guide object if null
        //   3. Update guide._steps[guideType] = step
        //   4. Save user_data back to DB
        //   5. Return success (client does NOT process response data)
        //
        // RES:
        //   {} — empty data, client only checks ret: 0
        // =============================================
        case 'saveGuide': {
            var guideType = parsed.guideType;
            var step = parsed.step;

            // Validate required params
            if (!guideType || !step || !userId) {
                logger.warn('GUIDE',
                    'saveGuide missing params: userId=' + (userId || '-') +
                    ' guideType=' + (guideType || '-') +
                    ' step=' + (step || '-'));
                // Still return success — don't block player for guide errors
                callback(RH.success({}));
                return;
            }

            logger.info('GUIDE',
                'saveGuide userId=' + userId +
                ' guideType=' + guideType +
                ' step=' + step);

            // Persist guide progress to database
            userDataService.loadUserData(userId)
                .then(function (gameData) {
                    if (!gameData) {
                        logger.error('GUIDE', 'saveGuide: user not found userId=' + userId);
                        callback(RH.success({}));
                        return;
                    }

                    // Initialize guide structure if null
                    if (!gameData.guide) {
                        gameData.guide = {
                            _id: String(userId),
                            _steps: {}
                        };
                    }

                    // Ensure _steps exists
                    if (!gameData.guide._steps) {
                        gameData.guide._steps = {};
                    }

                    // Update the guide step for this tutorial line
                    // guideType is a number (GUIDE_TYPE enum), client stores as string key
                    var guideTypeKey = String(guideType);
                    var oldStep = gameData.guide._steps[guideTypeKey];
                    gameData.guide._steps[guideTypeKey] = step;

                    // Log progress change
                    if (oldStep && oldStep !== step) {
                        logger.info('GUIDE',
                            'Guide progress updated: userId=' + userId +
                            ' line=' + guideType +
                            ' step ' + oldStep + ' → ' + step);
                    } else if (!oldStep) {
                        logger.info('GUIDE',
                            'New guide line started: userId=' + userId +
                            ' line=' + guideType +
                            ' step=' + step);
                    }

                    // Save to database
                    return userDataService.saveUserData(userId, gameData);
                })
                .then(function () {
                    // Return empty success — client only checks ret: 0
                    callback(RH.success({}));
                })
                .catch(function (err) {
                    logger.error('GUIDE',
                        'saveGuide error: userId=' + userId +
                        ' guideType=' + guideType +
                        ' step=' + step +
                        ' err=' + err.message);
                    // Still return success — don't block player for DB errors
                    callback(RH.success({}));
                });

            break;
        }

        // =============================================
        // ACTION: getGuideData
        // =============================================
        // Get current guide progress. NOT called by client in normal flow.
        // Guide data is sent as part of enterGame response (user_data.guide).
        // This action exists as fallback / debug tool.
        //
        // REQ params: none (uses userId)
        //
        // RES:
        //   { _id, _steps } — current guide progress object
        // =============================================
        case 'getGuideData': {
            if (!userId) {
                callback(RH.success({}));
                return;
            }

            userDataService.loadUserData(userId)
                .then(function (gameData) {
                    if (!gameData) {
                        callback(RH.success({ _id: String(userId), _steps: {} }));
                        return;
                    }

                    // Return guide data (or empty structure if null)
                    var guideData = gameData.guide || {
                        _id: String(userId),
                        _steps: {}
                    };

                    // Ensure _steps exists
                    if (!guideData._steps) {
                        guideData._steps = {};
                    }

                    callback(RH.success(guideData));
                })
                .catch(function (err) {
                    logger.error('GUIDE',
                        'getGuideData error: userId=' + userId +
                        ' err=' + err.message);
                    callback(RH.success({ _id: String(userId), _steps: {} }));
                });

            break;
        }

        // =============================================
        // ACTION: getGuideReward
        // =============================================
        // Claim guide completion reward. NOT called by client in normal flow.
        // Exists as fallback to prevent client crash if ever called.
        //
        // RES:
        //   { _changeInfo: { _items: {} } } — empty items (no rewards)
        // =============================================
        case 'getGuideReward': {
            logger.info('GUIDE',
                'getGuideReward userId=' + (userId || '-'));
            callback(RH.success({ _changeInfo: { _items: {} } }));
            break;
        }

        // =============================================
        // ACTION: complete
        // =============================================
        // Mark guide as complete. NOT called by client in normal flow.
        // Exists as fallback.
        // =============================================
        case 'complete': {
            logger.info('GUIDE',
                'complete userId=' + (userId || '-'));
            callback(RH.success({}));
            break;
        }

        // =============================================
        // DEFAULT: Unknown action
        // =============================================
        default:
            logger.warn('GUIDE',
                'Unknown action: ' + action +
                ' userId=' + (userId || '-'));
            callback(RH.error(RH.ErrorCode.INVALID_COMMAND,
                'Unknown action: ' + action));
            break;
    }
}

module.exports = { handle: handle };
