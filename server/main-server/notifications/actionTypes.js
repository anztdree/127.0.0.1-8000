/**
 * =====================================================
 *  actionTypes.js — Notify Action Type Constants
 *  Super Warrior Z Game Server — Main Server
 *
 *  100% derived from client code analysis (main.min.js).
 *
 *  Client listens for server-push via "Notify" event (line 77182):
 *    socket.on("Notify", function(t) {
 *        if ("SUCCESS" == t.ret) {
 *            var o = JSON.parse(t.data);
 *            if ("Kickout" == o.action) { ... return }
 *            ts.notifyData(o);  // dispatches by o.action
 *        }
 *    })
 *
 *  CRITICAL FIX #2 & #4: All action strings MUST match client EXACTLY.
 *  Client uses STRICT string comparison — case-sensitive, no fuzzy match.
 *
 *  Source: ts.notifyData(o) dispatcher (line 77032-77090)
 *  Source: line 77186 kickout check ("Kickout" with capital K)
 * =====================================================
 */

'use strict';

/**
 * Notify action type enumeration.
 * All string values MUST match client code exactly.
 *
 * @enum {string}
 */
var NOTIFY_ACTION = {
    // =============================================
    // CORE — Verified from client code
    // =============================================

    /**
     * KICKOUT — Client (line 77186): if("Kickout" == o.action)
     * CRITICAL: Capital "K" — client uses exact string match.
     * Triggers: destroy sockets, go to Login scene, show error dialog
     */
    KICKOUT: 'Kickout',

    /** PAY_FINISH — Client: if("payFinish" == n) */
    PAY_FINISH: 'payFinish',

    /** TIME_BONUS — Client: if("timeBonus" == n) */
    TIME_BONUS: 'timeBonus',

    /** HERO_BACKPACK_FULL — Client: if("heroBackpackFull" == n) */
    HERO_BACKPACK_FULL: 'heroBackpackFull',

    /** BROADCAST — Client: if("broadcast" == n) */
    BROADCAST: 'broadcast',

    /** ONLINE_BULLETIN — Client: if("onlineBulletin" == n) */
    ONLINE_BULLETIN: 'onlineBulletin',

    /** SCHEDULE_MODEL_REFRESH — Client: if("scheduleModelRefresh" == n)
     *  Sends scheduleInfo model to refresh AllRefreshCount counters */
    SCHEDULE_MODEL_REFRESH: 'scheduleModelRefresh',

    /** MONTH_CARD — Client: if("monthCard" == n) */
    MONTH_CARD: 'monthCard',

    /** VIP_LEVEL — Client: if("vipLevel" == n) */
    VIP_LEVEL: 'vipLevel',

    /** NOTIFY_SUMMON — Client: if("notifySummon" == n) */
    NOTIFY_SUMMON: 'notifySummon',

    // =============================================
    // GUILD
    // =============================================

    /** GUILD_AGREE — Client: if("guildAgree" == n) || if("beKickedOutGuild" == n) */
    GUILD_AGREE: 'guildAgree',

    /** GUILD_BE_KICKED — Client: if("beKickedOutGuild" == n) */
    GUILD_BE_KICKED: 'beKickedOutGuild',

    // =============================================
    // GLOBAL WAR
    // =============================================

    /** WAR_STAGE_CHANGE — Client: if("warStageChange" == n) */
    WAR_STAGE_CHANGE: 'warStageChange',

    /** WAR_RANK_CHANGE — Client: if("warRankChange" == n) */
    WAR_RANK_CHANGE: 'warRankChange',

    /** WAR_AUTO_SIGN — Client: if("warAutoSign" == n) */
    WAR_AUTO_SIGN: 'warAutoSign',

    // =============================================
    // BALL WAR
    // =============================================

    /** BALL_WAR_STATE_CHANGE — Client: if("ballWarStateChange" == n) */
    BALL_WAR_STATE_CHANGE: 'ballWarStateChange',

    /** BALL_WAR_POINT_RANK — Client: if("ballWarPointRankChange" == n) */
    BALL_WAR_POINT_RANK: 'ballWarPointRankChange',

    /** BALL_SIGN_UP — Client: if("ballSignUp" == n) */
    BALL_SIGN_UP: 'ballSignUp',

    // =============================================
    // USER / SOCIAL
    // =============================================

    /** USER_MESSAGE — Client: if("userMessage" == n) */
    USER_MESSAGE: 'userMessage',

    /** MAIN_TASK_CHANGE — Client: if("mainTaskChange" == n) */
    MAIN_TASK_CHANGE: 'mainTaskChange',

    /** RED_DOT_DATA_CHANGE — Client: if("redDotDataChange" == n) */
    RED_DOT_DATA_CHANGE: 'redDotDataChange',

    // =============================================
    // ARENA
    // =============================================

    /** ARENA_RECORD — Client: if("areanRecord" == n)
     *  NOTE: "arean" is a TYPO in the client code — must match exactly! */
    ARENA_RECORD: 'areanRecord',

    // =============================================
    // BATTLE MEDAL
    // =============================================

    /** BATTLE_MEDAL_REFRESH — Client: if("battleMedalRefresh" == n) */
    BATTLE_MEDAL_REFRESH: 'battleMedalRefresh',

    /** BATTLE_MEDAL_TASK_CHANGE — Client: if("battleMedalTaskChange" == n) */
    BATTLE_MEDAL_TASK_CHANGE: 'battleMedalTaskChange',

    // =============================================
    // ITEM
    // =============================================

    /** ITEM_CHANGE — Client: if("itemChange" == n) */
    ITEM_CHANGE: 'itemChange',

    // =============================================
    // TEAM DUNGEON
    // =============================================

    /** JOIN_TEAM_SUCCESS — Client: if("joinTeamSuccess" == n) */
    JOIN_TEAM_SUCCESS: 'joinTeamSuccess',

    /** TEAM_DUNGEON_FINISH — Client: if("teamDungeonFinish" == n) */
    TEAM_DUNGEON_FINISH: 'teamDungeonFinish',

    /** TEAM_DUNGEON_TASK_CHANGE — Client: if("teamDungeonTaskChange" == n) */
    TEAM_DUNGEON_TASK_CHANGE: 'teamDungeonTaskChange',

    /** TEAM_DUNGEON_EXPIRE — Client: if("teamDungeonExpire" == n) */
    TEAM_DUNGEON_EXPIRE: 'teamDungeonExpire',

    // =============================================
    // TEAM DUNGEON (additional — from client notifyData)
    // =============================================

    /** TEAM_DUNGEON_BROADCAST — Client: if("teamDungeonBroadcast" == n)
     *  Sends kill broadcast messages for team dungeon runs */
    TEAM_DUNGEON_BROADCAST: 'teamDungeonBroadcast',

    /** TEAM_DUNGEON_HIDE_CHANGE — Client: if("teamDungeonHideChange" == n)
     *  Toggles dungeon visibility (e.g., hide from list) */
    TEAM_DUNGEON_HIDE_CHANGE: 'teamDungeonHideChange',

    /** TEAM_DUNGEON_CLOSE_TIME_CHANGE — Client: if("teamDungeonCloseTimeChange" == n)
     *  Updates the countdown timer for dungeon close */
    TEAM_DUNGEON_CLOSE_TIME_CHANGE: 'teamDungeonCloseTimeChange',

    // =============================================
    // BALL WAR (additional)
    // =============================================

    /** BALL_WAR_BROADCAST — Client: if("ballWarBroadcast" == n)
     *  Broadcasts messages during Dragon Ball War event */
    BALL_WAR_BROADCAST: 'ballWarBroadcast',

    // =============================================
    // FRIEND / MAIL
    // =============================================

    /** FG_ADD_MSG — Client: if("FGAddMsg" == n)
     *  New friend mail message received */
    FG_ADD_MSG: 'FGAddMsg',

    /** FG_NEW_APPLY — Client: if("FGNewApply" == n)
     *  New friend request/application received */
    FG_NEW_APPLY: 'FGNewApply',

    /** FG_ADD_CHAT_MSG — Client: if("FGAddChatMsg" == n)
     *  Friend chat message or guild invite notification */
    FG_ADD_CHAT_MSG: 'FGAddChatMsg',

    // =============================================
    // QUESTIONNAIRE
    // =============================================

    /** ADD_QUESTIONNAIRE — Client: if("addQuestionnaire" == n)
     *  Server pushes a questionnaire/survey prompt */
    ADD_QUESTIONNAIRE: 'addQuestionnaire',

    // =============================================
    // TOP BATTLE (additional)
    // =============================================

    /** TOP_BATTLE_BE_ATTACKED — Client: if("topBattleBeAttack" == n)
     *  Player was attacked in Top Battle (defence triggered) */
    TOP_BATTLE_BE_ATTACKED: 'topBattleBeAttack',

    /** TOP_BATTLE_STAGE_CHANGE — Client: if("topBattleStageChange" == n)
     *  Top Battle tournament stage changed (e.g., 64->16->4->final) */
    TOP_BATTLE_STAGE_CHANGE: 'topBattleStageChange',

    // =============================================
    // SYSTEM / ADMIN
    // =============================================

    /** UPDATE_FORBIDDEN_CHAT — Client: if("updateForbiddenChat" == n)
     *  User chat restriction status updated (muted/unmuted) */
    UPDATE_FORBIDDEN_CHAT: 'updateForbiddenChat',

    /** TIME_TRIAL_RESET — Client: if("timeTrialReset" == n)
     *  Space/Time Trial timer reset (new challenge available) */
    TIME_TRIAL_RESET: 'timeTrialReset',

    /** RESONANCE_UNLOCK_SPECIAL — Client: if("resonanceUnlockSpecial" == e.action)
     *  Hero quality resonance special unlock triggered */
    RESONANCE_UNLOCK_SPECIAL: 'resonanceUnlockSpecial',

    // =============================================
    // MAINTENANCE (server-initiated, not in client notifyData but useful)
    // =============================================

    /** MAINTENANCE — Sent during server shutdown warning */
    MAINTENANCE: 'maintenance',
};

module.exports = NOTIFY_ACTION;
