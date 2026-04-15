/**
 * Login Server - User Manager
 * 
 * 100% derived from client code analysis.
 * 
 * Replaces the old dead-code models/user.js.
 * All database operations for the users table.
 * 
 * Client auto-register flow (loginGame):
 *   No register action exists. If userId not found, server auto-creates.
 *   Evidence: No "registerGame"/"createAccount" in client code.
 *   loginSuccessCallBack checks e.newUser for first-time events.
 * 
 * users table columns:
 *   user_id, password, nick_name, head_image, from_channel, channel_name,
 *   sub_channel, last_login_time, create_time, is_new
 */

const { query } = require('../../database/connection');
const { info, warn } = require('../../shared/utils/logger');
const { DEFAULTS } = require('../utils/loginConstants');

const UserManager = {
    /**
     * Find user by userId
     * @param {string} userId
     * @returns {object|null} User row or null
     */
    async findByUserId(userId) {
        const rows = await query('SELECT * FROM users WHERE user_id = ?', [userId]);
        return rows.length > 0 ? rows[0] : null;
    },

    /**
     * Auto-register new user (called when userId not found during loginGame)
     * 
     * @param {object} data - {userId, password, nickName, headImageUrl, fromChannel, channelName, subChannel}
     * @returns {object} Created user data
     */
    async create(data) {
        const now = Date.now();
        const userId = data.userId;
        const password = data.password || DEFAULTS.password;

        await query(
            `INSERT INTO users (user_id, password, nick_name, head_image, from_channel, channel_name, sub_channel, last_login_time, create_time, is_new)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1)`,
            [
                userId,
                password,
                data.nickName || '',
                data.headImageUrl || '',
                data.fromChannel || '',
                data.channelName || '',
                data.subChannel || '',
                now,
                now,
            ]
        );

        info('UserManager', `Auto-registered new user: ${userId}`);

        return {
            user_id: userId,
            password: password,
            nick_name: data.nickName || '',
            head_image: data.headImageUrl || '',
            from_channel: data.fromChannel || '',
            channel_name: data.channelName || '',
            sub_channel: data.subChannel || '',
            create_time: now,
            last_login_time: now,
            is_new: 1,
        };
    },

    /**
     * Verify user password (plaintext comparison)
     * 
     * Client sends passwords in PLAINTEXT (line 88576-88584).
     * No hashing is applied on the client side.
     * Production servers should hash before storage — this is dev-only.
     * 
     * @param {string} userId
     * @param {string} password
     * @returns {object|null} User data if valid, null if wrong password
     */
    async verify(userId, password) {
        const user = await this.findByUserId(userId);
        if (!user) return null;

        if (user.password !== password) {
            warn('UserManager', `Wrong password for user: ${userId}`);
            return null;
        }

        return user;
    },

    /**
     * Update last login time
     * @param {string} userId
     */
    async updateLoginTime(userId) {
        const now = Date.now();
        await query(
            'UPDATE users SET last_login_time = ? WHERE user_id = ?',
            [now, userId]
        );
    },

    /**
     * Check and consume the isNew flag
     * Returns true if user was new (is_new=1), marks as 0
     * 
     * Client loginSuccessCallBack (line 77433): checks e.newUser
     * 
     * @param {string} userId
     * @returns {boolean} Was this user new?
     */
    async consumeNewFlag(userId) {
        const user = await this.findByUserId(userId);
        if (!user) return false;

        const isNew = user.is_new === 1;
        if (isNew) {
            await query('UPDATE users SET is_new = 0 WHERE user_id = ?', [userId]);
        }
        return isNew;
    },

    /**
     * Save user language preference (from SaveLanguage action)
     * 
     * Client sends: {action:"SaveLanguage", userid, sdk, appid, language}
     * We store in a simple user_languages table if it exists,
     * otherwise log it (non-critical analytics action).
     * 
     * @param {string} userId
     * @param {string} language
     * @param {string} sdk
     * @param {string} appId
     */
    async saveLanguage(userId, language, sdk, appId) {
        try {
            // Try to create table if not exists (graceful)
            await query(`
                CREATE TABLE IF NOT EXISTS user_languages (
                    user_id VARCHAR(64) PRIMARY KEY,
                    language VARCHAR(10) DEFAULT 'en',
                    sdk VARCHAR(32) DEFAULT '',
                    appid VARCHAR(32) DEFAULT '',
                    updated_at BIGINT DEFAULT 0
                )
            `);

            await query(`
                INSERT INTO user_languages (user_id, language, sdk, appid, updated_at)
                VALUES (?, ?, ?, ?, ?)
                ON DUPLICATE KEY UPDATE language = ?, sdk = ?, appid = ?, updated_at = ?
            `, [userId, language, sdk, appId, Date.now(), language, sdk, appId, Date.now()]);

            info('UserManager', `Language saved: ${userId} → ${language}`);
        } catch (err) {
            // Non-critical — don't fail the request
            info('UserManager', `Language save skipped (table may not exist): ${err.message}`);
        }
    },
};

module.exports = UserManager;
