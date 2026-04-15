/**
 * =====================================================
 *  Chat Constants — Super Warrior Z Chat Server
 * =====================================================
 *
 *  100% derived from client code analysis (main.min.js).
 *
 *  MESSAGE_KIND (line 79292):
 *    0 = MK_NULL, 1 = SYSTEM, 2 = WORLD, 3 = GUILD,
 *    4 = PRIVATE, 5 = WORLD_TEAM, 6 = TEAM
 *
 *  SYSTEM_MESSAGE_TYPE (line 58313):
 *    Enum for broadcast ticker templates from noticeContent.json
 *
 *  CHAT_ERROR (client-defined):
 *    36001 = chat forbidden/muted
 *
 *  Room config, limits, and timing — all matching client expectations.
 * =====================================================
 */

'use strict';

// =============================================
// 1. MESSAGE_KIND — Chat room/message types
//    Client source: main.min.js line 79292
// =============================================

var MESSAGE_KIND = Object.freeze({
    MK_NULL:      0,   // unused / null
    SYSTEM:       1,   // system messages (server-generated only)
    WORLD:        2,   // world/global chat
    GUILD:        3,   // guild chat
    PRIVATE:      4,   // private whisper (not used via chat-server)
    WORLD_TEAM:   5,   // team dungeon world broadcast
    TEAM:         6,   // team/party chat
});

// =============================================
// 2. SYSTEM_MESSAGE_TYPE — Broadcast ticker IDs
//    Client source: main.min.js line 58313
//    Templates loaded from resource/json/noticeContent.json
//    Used as _type field in chat messages for broadcast display.
//
//    CT_NULL = 0 (normal chat, no template)
//    HERO_BC_SUMMON = 1 (hero summon broadcast)
//    ... etc.
// =============================================

var SYSTEM_MESSAGE_TYPE = Object.freeze({
    CT_NULL:                   0,
    HERO_BC_SUMMON:            1,
    HERO_BC_WISH:              2,
    VIP_LEVEL:                 3,
    MONTH_SMALL:               4,
    MONTH_BIG:                 5,
    LIFE_LONG:                 6,
    ARENA_CHANGE:              7,
    FIRST_RECHARGE:            8,
    HERO_BC_ACTIVITY:          9,
    HERO_BC_PIECE:             10,
    HERO_BC_EXCHANGE:          11,
    HERO_BC_SHOP:              12,
    HERO_BC_ACT_POOL:          13,
    HERO_BC_VIP_REWARD:        14,
    LUCKY_EQUIP_PURPLE:        15,
    LUCKY_EQUIP_ORANGE:        16,
    IMPRINT_UP_GREEN:          17,
    IMPRINT_UP_BLUE:           18,
    IMPRINT_UP_PURPLE:         19,
    IMPRINT_UP_ORANGE:         20,
    ACT_2004_HERO:             21,
    ACT_2004_DRAGON_BALL:      22,
    ACT_5006_UP:               23,
    ACT_5005:                  24,
    ACT_3013:                  25,
    ACTIVITY_TURN_TABLE:       32,
    ACTIVITY_KARIN_RICH:       55,
    ACTIVITY_LUCKY_REEL:       56,
    ACT_LANTERN_LIGHT:         58,
    ACT_LANTERN_LIGHT_BIG:     59,
    ACT_GADVENTURE:            60,
    ACT_LUCKY_WHEEL_PURPLE:    90,
    ACT_LUCKY_WHEEL_ORANGE:    91,
});

/** Team dungeon broadcast ID — used as msgType for team dungeon world broadcasts */
var TeamDungeonBroadcastID = 50;

// =============================================
// 3. CHAT ERROR CODES
//    Client source: main.min.js line 52874
//    36001 triggers BarTypeTips "chat forbidden"
// =============================================

var CHAT_ERROR = Object.freeze({
    FORBIDDEN: 36001,     // chat forbidden / muted
});

// =============================================
// 4. ROOM CONFIGURATION
//    Default room IDs (matching main-server registChat)
//    For multi-server: serverId * 100 + roomType
// =============================================

var ROOM_TYPE = Object.freeze({
    WORLD:           1,
    GUILD:           2,
    TEAM_DUNGEON:    3,
    TEAM:            4,
});

/**
 * Generate room ID based on serverId and room type.
 * Default serverId=1 → 1,2,3,4 (backward compatible)
 *
 * @param {number} roomType - ROOM_TYPE enum
 * @param {number} [serverId=1] - Server ID
 * @returns {number}
 */
function getRoomId(roomType, serverId) {
    var sid = serverId || 1;
    return sid * 100 + roomType;
}

// =============================================
// 5. LIMITS & TIMING
// =============================================

var LIMITS = Object.freeze({
    /** Max messages stored per room (client also limits to 60, line 77271) */
    MAX_MESSAGES_PER_ROOM: 60,

    /** Max message content length (characters) */
    MAX_CONTENT_LENGTH: 200,

    /** Max messages per user per room per minute (rate limiting) */
    RATE_LIMIT_MESSAGES: 30,

    /** Rate limit window in seconds */
    RATE_LIMIT_WINDOW: 60,

    /** Max message history returned by getRecord */
    MAX_RECORD_SIZE: 60,

    /** Verify handshake timeout (ms) */
    VERIFY_TIMEOUT: 15000,

    /** Max verify attempts before disconnect */
    VERIFY_MAX_ATTEMPTS: 3,
});

// =============================================
// 6. EXPORTS
// =============================================

module.exports = {
    MESSAGE_KIND: MESSAGE_KIND,
    SYSTEM_MESSAGE_TYPE: SYSTEM_MESSAGE_TYPE,
    TeamDungeonBroadcastID: TeamDungeonBroadcastID,
    CHAT_ERROR: CHAT_ERROR,
    ROOM_TYPE: ROOM_TYPE,
    getRoomId: getRoomId,
    LIMITS: LIMITS,
};
