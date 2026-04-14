/**
 * =====================================================
 *  HeroImage Handler — handlers/heroImage.js
 *  Super Warrior Z Game Server — Main Server (Port 8001)
 *
 *  Hero Handbook / Hero Appraise (图鉴/评价) System
 *
 *  Fungsi: Sistem koleksi hero (handbook) dan social rating/komentar hero.
 *  Player bisa melihat hero yang sudah dimiliki, memberi rating & komentar,
 *  serta like/unlike komentar player lain.
 *
 *  ⚠️  NAMA MENYESATKAN:
 *     "heroImage" BUKAN handler untuk download gambar hero!
 *     "Image" di sini merujuk ke "图鉴" (Illustrated Handbook/Codex).
 *     Handler ini mengelola:
 *       - Hero Handbook (koleksi hero yang sudah didapat)
 *       - Hero Appraise (rating & komentar social)
 *
 *  Client Reference:
 *    - HeroImageInfo: { id, maxLevel, selfComments[] }
 *    - HeroCommentModel: { id, detail, score, time, likeUsers[], userId,
 *                          nickName, headImage, level, serverId }
 *    - HeroAppraiseNeedCount = jumlah komentar per request (paginated)
 *
 *  Data Flow:
 *    enterGame → user_data.heroImageVersion, heroBookVersion
 *    Tab "Handbook" → readHeroVersion (update version, clear red dot)
 *    Tab "Handbook" → getAll (load hero collection)
 *    Open "Appraise" → getComments (load comments for hero)
 *    Submit comment → addComment (save comment + score)
 *    Like/Unlike → likeComment / unlikeComment
 *
 *  Actions:
 *    getAll          — Get hero handbook collection (called on enterGame)
 *    getComments     — Get hero appraise comments (paginated)
 *    addComment      — Submit hero appraise comment
 *    likeComment     — Like a comment
 *    unlikeComment   — Unlike a comment
 *    readHeroVersion — Update heroImageVersion (clear red dot)
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
 * Handle heroImage request dari client.
 *
 * @param {Object} socket - Socket.IO socket instance
 * @param {Object} parsed - Parsed request: { type, action, userId, ...params }
 * @param {Function} callback - Response callback: callback(responseObj)
 */
function handle(socket, parsed, callback) {
    var action = parsed.action;
    var userId = parsed.userId;

    switch (action) {

        // =============================================
        // ACTION: getAll
        // =============================================
        // Get hero handbook collection — hero yang sudah dimiliki player.
        // Dipanggil saat enterGame (load game data).
        //
        // Client call: HerosManager.setAlreadyGainHeroID(response)
        // Client expects: { _heros: [ { _id, _maxLevel, _selfComments[] }, ... ] }
        //
        // Client deserialization:
        //   for (var n in e._heros) {
        //       var o = e._heros[n]._id;
        //       var a = new HeroImageInfo;
        //       a.id = o;
        //       a.maxLevel = e._heros[n]._maxLevel;
        //       a.selfComments = [];
        //       // ... copy selfComments
        //       alreadyGainHeroIDList[o] = a;
        //   }
        //
        // REQ params: userId
        //
        // RES:
        //   { _heros: { "heroDisplayId": { _id, _maxLevel, _selfComments } } }
        // =============================================
        case 'getAll': {
            logger.info('HEROIMAGE', 'getAll userId=' + (userId || '-'));

            if (!userId) {
                callback(RH.success({ _heros: {} }));
                return;
            }

            userDataService.loadUserData(userId)
                .then(function (gameData) {
                    if (!gameData) {
                        callback(RH.success({ _heros: {} }));
                        return;
                    }

                    // Build hero handbook from player's hero list
                    // user_data stores heroes as an object keyed by heroId
                    var heroList = gameData.heroList || {};
                    var herosResponse = {};

                    for (var heroId in heroList) {
                        var hero = heroList[heroId];
                        if (hero && hero.heroDisplayId) {
                            var displayId = String(hero.heroDisplayId);
                            herosResponse[displayId] = {
                                _id: displayId,
                                _maxLevel: hero.level || 1,
                                _selfComments: []
                            };
                        }
                    }

                    logger.info('HEROIMAGE',
                        'getAll userId=' + userId +
                        ' heroCount=' + Object.keys(herosResponse).length);

                    callback(RH.success({ _heros: herosResponse }));
                })
                .catch(function (err) {
                    logger.error('HEROIMAGE',
                        'getAll error: userId=' + userId +
                        ' err=' + err.message);
                    callback(RH.success({ _heros: {} }));
                });

            break;
        }

        // =============================================
        // ACTION: getComments
        // =============================================
        // Get hero appraise comments (paginated).
        //
        // Client call: HerosManager.setHeroCommentModel(response)
        //   → deserializes response._comments[] into HeroCommentModel[]
        //   → uses response._avgScore for display
        //
        // Client deserialization:
        //   for (var n = 0; n < e._comments.length; n++) {
        //       var o = new HeroCommentModel;
        //       o.deserialize(e._comments[n]);
        //       heroCommentModelList.push(o);
        //   }
        //
        // REQ params:
        //   heroDisplayId — number: hero display ID
        //   start         — number: pagination offset
        //   needCount     — number: jumlah item per page
        //
        // RES:
        //   { _avgScore: number, _comments: [ HeroCommentModel, ... ] }
        //   HeroCommentModel: { _id, _detail, _score, _time, _likeUsers[],
        //                       _userId, _nickName, _headImage, _level, _serverId }
        //
        // NOTE: Comments require a separate DB table (hero_comments).
        //       Returns empty list until comment system is fully implemented.
        // =============================================
        case 'getComments': {
            var heroDisplayId = parsed.heroDisplayId;
            var start = parsed.start || 0;
            var needCount = parsed.needCount || 15;

            logger.info('HEROIMAGE',
                'getComments userId=' + (userId || '-') +
                ' heroDisplayId=' + heroDisplayId +
                ' start=' + start +
                ' needCount=' + needCount);

            // Return empty comments — full comment system needs hero_comments DB table
            callback(RH.success({
                _avgScore: 0,
                _comments: []
            }));

            break;
        }

        // =============================================
        // ACTION: addComment
        // =============================================
        // Submit hero appraise comment with score.
        //
        // Client sends after player types comment + selects star rating.
        // On success: deserializes response._comment into HeroCommentModel
        //             and adds to local list.
        //
        // REQ params:
        //   heroDisplayId — number: hero display ID
        //   detail        — string: comment text (filtered by client for profanity)
        //   score         — number: star rating (1-5)
        //
        // RES:
        //   { _comment: HeroCommentModel }
        //   HeroCommentModel: { _id, _detail, _score, _time, _likeUsers[],
        //                       _userId, _nickName, _headImage, _level, _serverId }
        //
        // NOTE: Requires hero_comments DB table for full implementation.
        //       Returns empty comment as acknowledgment.
        // =============================================
        case 'addComment': {
            var addHeroDisplayId = parsed.heroDisplayId;
            var detail = parsed.detail;
            var score = parsed.score;

            logger.info('HEROIMAGE',
                'addComment userId=' + (userId || '-') +
                ' heroDisplayId=' + addHeroDisplayId +
                ' score=' + score +
                ' detail=' + (detail || '').substring(0, 50));

            // Return empty comment acknowledgment
            // Full implementation needs: insert into hero_comments table,
            // then return the new comment with server-generated _id and _time
            callback(RH.success({
                _comment: {
                    _id: String(Date.now()),
                    _detail: detail || '',
                    _score: score || 0,
                    _time: Date.now(),
                    _likeUsers: [],
                    _userId: String(userId || 0),
                    _nickName: '',
                    _headImage: '',
                    _level: 1,
                    _serverId: 1
                }
            }));

            break;
        }

        // =============================================
        // ACTION: likeComment
        // =============================================
        // Like a hero appraise comment.
        // On success: client pushes userId into heroModel.likeUsers[]
        //
        // REQ params:
        //   heroDisplayId — number: hero display ID
        //   cid           — string/number: comment ID
        //
        // RES:
        //   {} — empty success (client updates locally)
        // =============================================
        case 'likeComment': {
            var likeHeroDisplayId = parsed.heroDisplayId;
            var cid = parsed.cid;

            logger.info('HEROIMAGE',
                'likeComment userId=' + (userId || '-') +
                ' heroDisplayId=' + likeHeroDisplayId +
                ' cid=' + cid);

            callback(RH.success({}));
            break;
        }

        // =============================================
        // ACTION: unlikeComment
        // =============================================
        // Unlike a hero appraise comment.
        // On success: client removes userId from heroModel.likeUsers[]
        //
        // REQ params:
        //   heroDisplayId — number: hero display ID
        //   cid           — string/number: comment ID
        //
        // RES:
        //   {} — empty success (client updates locally)
        // =============================================
        case 'unlikeComment': {
            var unlikeHeroDisplayId = parsed.heroDisplayId;
            var unlikeCid = parsed.cid;

            logger.info('HEROIMAGE',
                'unlikeComment userId=' + (userId || '-') +
                ' heroDisplayId=' + unlikeHeroDisplayId +
                ' cid=' + unlikeCid);

            callback(RH.success({}));
            break;
        }

        // =============================================
        // ACTION: readHeroVersion
        // =============================================
        // Update heroImageVersion to match heroBookVersion.
        // Dipanggil saat player membuka tab "Handbook" di hero panel.
        // Clears the red dot notification on handbook tab.
        //
        // Client flow:
        //   if (userInfo.heroImageVersion < myData.heroBookVersion) {
        //       processHandler({ type:"heroImage", action:"readHeroVersion", ... })
    //
        //       // On success: update local version, clear red dot
        //       userInfo.heroImageVersion = myData.heroBookVersion;
        //   }
        //
        // REQ params: userId
        //
        // RES:
        //   {} — empty success
        //
        // Server behavior:
        //   Save heroImageVersion = heroBookVersion to user_data
        // =============================================
        case 'readHeroVersion': {
            logger.info('HEROIMAGE',
                'readHeroVersion userId=' + (userId || '-'));

            if (!userId) {
                callback(RH.success({}));
                return;
            }

            userDataService.loadUserData(userId)
                .then(function (gameData) {
                    if (!gameData) {
                        callback(RH.success({}));
                        return;
                    }

                    // Update heroImageVersion to current server value
                    // heroBookVersion is computed from hero collection (isNewVersion field)
                    // For now, set it to current timestamp to indicate "read"
                    gameData.heroImageVersion = Date.now();

                    return userDataService.saveUserData(userId, gameData);
                })
                .then(function () {
                    callback(RH.success({}));
                })
                .catch(function (err) {
                    logger.error('HEROIMAGE',
                        'readHeroVersion error: userId=' + userId +
                        ' err=' + err.message);
                    callback(RH.success({}));
                });

            break;
        }

        // =============================================
        // DEFAULT: Unknown action
        // =============================================
        default:
            logger.warn('HEROIMAGE',
                'Unknown action: ' + action +
                ' userId=' + (userId || '-'));
            callback(RH.error(RH.ErrorCode.INVALID_COMMAND,
                'Unknown action: ' + action));
            break;
    }
}

module.exports = { handle: handle };
