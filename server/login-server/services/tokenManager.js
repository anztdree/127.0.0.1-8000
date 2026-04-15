/**
 * Login Server - Token Manager
 * 
 * 100% derived from client code analysis.
 * 
 * Client flow:
 *   loginGame response → {loginToken, ...} → stored as ts.loginInfo.userInfo.loginToken
 *   SaveHistory response → {loginToken, ...} → REFRESHES ts.loginInfo.userInfo.loginToken
 *   enterGame (main-server) → sends loginToken → validated against login_tokens DB table
 * 
 * Token lifecycle:
 *   1. Created on loginGame → INSERT INTO login_tokens
 *   2. Refreshed on SaveHistory → INSERT INTO login_tokens (new token)
 *   3. Consumed on enterGame → UPDATE login_tokens SET used=1
 *   4. Expired after 24 hours
 * 
 * Format: "{userId}_{timestamp}_{random8chars}"
 */

const { query } = require('../../database/connection');
const { info, warn, error: logError } = require('../../shared/utils/logger');
const { TOKEN } = require('../utils/loginConstants');

const TokenManager = {
    /**
     * Generate a new login token
     * @param {string} userId
     * @returns {string} Token string
     */
    generate(userId) {
        const timestamp = Date.now();
        const random = Math.random().toString(36).substring(2, 2 + TOKEN.tokenLength);
        return `${userId}_${timestamp}_${random}`;
    },

    /**
     * Save token to database for main-server enterGame validation
     * 
     * enterGame on main-server checks login_tokens table:
     *   SELECT * FROM login_tokens WHERE token = ? AND used = 0 AND expires_at > NOW()
     * 
     * @param {string} userId
     * @param {string} token
     * @param {number} serverId - Server ID user is logging into (default: 1)
     * @returns {boolean} Success
     */
    async save(userId, token, serverId = 1) {
        const now = Date.now();
        const expiresAt = now + TOKEN.expiryMs;

        try {
            await query(
                `INSERT INTO login_tokens (user_id, token, server_id, created_at, expires_at, used)
                 VALUES (?, ?, ?, ?, ?, 0)`,
                [userId, token, serverId, now, expiresAt]
            );
            info('TokenManager', `Token saved for user: ${userId}`);
            return true;
        } catch (err) {
            logError('TokenManager', `Failed to save token: ${err.message}`);
            return false;
        }
    },

    /**
     * Validate and consume a token (used by main-server enterGame)
     * Not used by login-server directly, but included for completeness.
     * 
     * @param {string} token
     * @returns {object|null} Token record or null if invalid
     */
    async validate(token) {
        try {
            const rows = await query(
                `SELECT * FROM login_tokens WHERE token = ? AND used = 0 AND expires_at > ?`,
                [token, Date.now()]
            );
            if (rows.length === 0) return null;

            // Mark as used
            await query(
                `UPDATE login_tokens SET used = 1 WHERE token = ?`,
                [token]
            );
            return rows[0];
        } catch (err) {
            logError('TokenManager', `Token validation failed: ${err.message}`);
            return null;
        }
    },
};

module.exports = TokenManager;
