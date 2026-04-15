/**
 * Login Server - Constants
 * 
 * 100% derived from client code analysis.
 * 
 * Default password: "game_origin" (line 88641: e.password || (e.password = "game_origin"))
 * Version: always "1.0" (client: version: "1.0")
 * SDK channel: "ppgame" (config.sdkChannel)
 * App ID: "288" (config.appId)
 * Token expiry: 24 hours (server-side policy)
 */

// ============================================
// Default values from client code
// ============================================
const DEFAULTS = {
    password: 'game_origin',          // Line 88641
    version: '1.0',                   // Client always sends version: "1.0"
    sdkChannel: 'ppgame',             // config.sdkChannel
    appId: '288',                     // config.appId
};

// ============================================
// Token configuration
// ============================================
const TOKEN = {
    expiryMs: 24 * 60 * 60 * 1000,   // 24 hours
    tokenLength: 8,                   // Random portion length
};

// ============================================
// Rate limiting
// ============================================
const RATE_LIMIT = {
    maxAttempts: 5,                   // Max login attempts
    windowMs: 60 * 1000,             // Per 60 seconds
    banDurationMs: 5 * 60 * 1000,    // 5 min ban after exceeding
};

// ============================================
// Login announcement notice config
// ============================================
const ANNOUNCE = {
    enabled: false,                   // Set true to enable notices from noticeContent.json
    filePath: '../../resource/json/noticeContent.json',
};

module.exports = { DEFAULTS, TOKEN, RATE_LIMIT, ANNOUNCE };
