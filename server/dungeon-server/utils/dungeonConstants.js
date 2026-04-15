/**
 * =====================================================
 *  Dungeon Constants — Super Warrior Z Dungeon Server
 * =====================================================
 *
 *  100% derived from client code analysis (main.min.js).
 *
 *  DUNGEON_TYPE (line 59058):
 *    0 = NULL, 1 = EXP, 2 = EVOLVE, 3 = ENERGY, 4 = EQUIP,
 *    5 = SINGA, 6 = SINGB, 7 = METAL, 8 = Z_STONE
 *
 *  Team dungeon actions via Socket.IO (type: "teamDungeonTeam"):
 *    clientConnect, refreshApplyList, changePos, startBattle,
 *    changeAutoJoinCondition, queryUserTeam, agree
 *
 *  Team dungeon HTTP endpoints (teamServerHttpUrl):
 *    queryTodayMap, queryRobot, queryHistoryMap,
 *    queryTeamRecord, queryBattleRecord
 *
 *  Notify push events (dungeon-server → client):
 *    TDMemberJoin, TDMemberQuit, TDStartBattle,
 *    TDChangePos, TDNewApply
 * =====================================================
 */

'use strict';

// =============================================
// 1. DUNGEON_TYPE — Solo dungeon types
//    Client source: main.min.js line 59058
// =============================================

var DUNGEON_TYPE = Object.freeze({
    DT_NULL:   0,
    EXP:       1,
    EVOLVE:    2,
    ENERGY:    3,
    EQUIP:     4,
    SINGA:     5,
    SINGB:     6,
    METAL:     7,
    Z_STONE:   8,
});

// =============================================
// 2. TEAM_STATE — Team room states
// =============================================

var TEAM_STATE = Object.freeze({
    CREATED:     'created',
    WAITING:     'waiting',
    READY:       'ready',
    IN_PROGRESS: 'in_progress',
    COMPLETED:   'completed',
    DISBANDED:   'disbanded',
});

// =============================================
// 3. TEAM_ROLE — Team member roles
// =============================================

var TEAM_ROLE = Object.freeze({
    ATTACKER:  'attacker',
    SUPPORTER: 'supporter',
    TREASURE:  'treasure',
});

// =============================================
// 4. NOTIFY ACTIONS — Server→Client push events
//    Client source: main.min.js lines 142892, 145129, 145145
//    Received via: dungeonClient.listenNotify → node.dungeonNotify(n)
//    Format: { ret:"SUCCESS", data: JSON.stringify({action: "TDMemberJoin", ...}) }
// =============================================

var NOTIFY_ACTION = Object.freeze({
    MEMBER_JOIN:    'TDMemberJoin',
    MEMBER_QUIT:    'TDMemberQuit',
    START_BATTLE:   'TDStartBattle',
    CHANGE_POS:     'TDChangePos',
    NEW_APPLY:      'TDNewApply',
});

// =============================================
// 5. SOCKET ACTIONS — Client→Server via handler.process
//    Client source: main.min.js processHandlerWithDungeon
//    All use: { type:"teamDungeonTeam", action, userId, teamId, version:"1.0" }
// =============================================

var SOCKET_ACTION = Object.freeze({
    CLIENT_CONNECT:           'clientConnect',
    REFRESH_APPLY_LIST:       'refreshApplyList',
    CHANGE_POS:               'changePos',
    START_BATTLE:             'startBattle',
    CHANGE_AUTO_JOIN_COND:    'changeAutoJoinCondition',
    QUERY_USER_TEAM:          'queryUserTeam',
    AGREE:                    'agree',
});

// =============================================
// 6. HTTP ACTIONS — Client→Server via HTTP GET
//    Client source: main.min.js ts.httpReqHandler()
//    URL format: teamServerHttpUrl + "/?" + query params
//    All use: { type:"teamDungeonTeam", action, ...params }
// =============================================

var HTTP_ACTION = Object.freeze({
    QUERY_TODAY_MAP:      'queryTodayMap',
    QUERY_ROBOT:          'queryRobot',
    QUERY_HISTORY_MAP:    'queryHistoryMap',
    QUERY_TEAM_RECORD:    'queryTeamRecord',
    QUERY_BATTLE_RECORD:  'queryBattleRecord',
});

// =============================================
// 7. LIMITS & CONFIG
// =============================================

var LIMITS = Object.freeze({
    /** Max members per team dungeon room (from rooms/teamDungeon.js MAX_ROOM_MEMBERS) */
    MAX_TEAM_MEMBERS: 3,

    /** Room timeout in ms (from rooms/teamDungeon.js ROOM_TIMEOUT_MS) */
    ROOM_TIMEOUT_MS: 10 * 60 * 1000,

    /** Battle timeout in ms */
    BATTLE_TIMEOUT_MS: 30 * 60 * 1000,

    /** Verify handshake timeout (ms) */
    VERIFY_TIMEOUT: 15000,

    /** Max verify attempts before disconnect */
    VERIFY_MAX_ATTEMPTS: 3,

    /** Auto-join condition options */
    AUTO_JOIN_NONE: 0,
    AUTO_JOIN_ANY: 1,
    AUTO_JOIN_FRIEND: 2,
});

// =============================================
// 8. BATTLEFIELD TYPES
//    Client source: main.min.js line 45143 (TXT_GAMEFIELD)
//    Used to identify battle type in battle records
// =============================================

var BATTLEFIELD = Object.freeze({
    EXP_DUNGEON:      'expDungeon',
    EVOLVE_DUNGEON:   'evolveDungeon',
    METAL_DUNGEON:    'metalDungeon',
    ZSTONE_DUNGEON:   'zStoneDungeon',
    EQUIP_DUNGEON:    'equipDungeon',
    SIGN_DUNGEON:     'signDungeon',
    TEMPLE_TEST:      'templeTest',
    MINE:             'mine',
    SNAKE_DUNGEON:    'snakeDungeon',
    TIME_TRAVEL:      'timeTravel',
    TRAINING:         'training',
    ARENA:            'arena',
    KARIN_TOWER:      'karinTower',
    GUILD_LOOT:       'guildLoot',
    CELL_GAME:        'cellGame',
    MAHA_ADVENTURE:   'mahaAdventure',
    BOSS_ATTACK:      'bossAttack',
    BOSS_SNATCH:      'bossSnatch',
    GUILD_BOSS:       'guildBoss',
    LESSON:           'lesson',
    FRIEND_BATTLE:    'friendBattle',
    EXPEDITION:       'expedition',
    GLOBAL_WAR:       'globalWar',
    DRAGON_BALL_WAR:  'dragonBallWar',
    MERGE_SERVER_BOSS:'mergeServerBoss',
    TIME_TRAIN:       'timeTrain',
    TEAM_DUNGEON:     'teamDungeon',
    TOP_BATTLE:       'topBattle',
    GRAVITY_TEST:     'gravityTest',
});

module.exports = {
    DUNGEON_TYPE: DUNGEON_TYPE,
    TEAM_STATE: TEAM_STATE,
    TEAM_ROLE: TEAM_ROLE,
    NOTIFY_ACTION: NOTIFY_ACTION,
    SOCKET_ACTION: SOCKET_ACTION,
    HTTP_ACTION: HTTP_ACTION,
    LIMITS: LIMITS,
    BATTLEFIELD: BATTLEFIELD,
};
