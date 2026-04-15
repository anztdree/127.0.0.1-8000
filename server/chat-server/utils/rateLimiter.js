/**
 * =====================================================
 *  Rate Limiter — Super Warrior Z Chat Server
 * =====================================================
 *
 *  Per-user message rate limiting to prevent chat spam.
 *  Uses a sliding window counter per userId.
 *
 *  Config from chatConstants.js LIMITS:
 *    RATE_LIMIT_MESSAGES = 30 messages
 *    RATE_LIMIT_WINDOW   = 60 seconds
 *
 *  Each user gets 30 messages per 60-second window.
 *  If exceeded, all subsequent sendMsg requests
 *  are silently dropped until the window resets.
 * =====================================================
 */

'use strict';

var LIMITS = require('./chatConstants').LIMITS;

/**
 * Create a new rate limiter instance.
 *
 * @param {object} [options]
 * @param {number} [options.maxMessages] - Max messages per window (default: LIMITS.RATE_LIMIT_MESSAGES)
 * @param {number} [options.windowMs] - Window duration in ms (default: LIMITS.RATE_LIMIT_WINDOW * 1000)
 * @returns {object} Rate limiter with check() and reset() methods
 */
function createRateLimiter(options) {
    var maxMessages = (options && options.maxMessages) || LIMITS.RATE_LIMIT_MESSAGES;
    var windowMs = (options && options.windowMs) || (LIMITS.RATE_LIMIT_WINDOW * 1000);

    /**
     * Per-user tracking.
     * Key: userId (string)
     * Value: { count: number, windowStart: number }
     *
     * @type {Object.<string, {count: number, windowStart: number}>}
     */
    var users = {};

    return {
        /**
         * Check if a user is allowed to send a message.
         * If allowed, increments the counter. If not, returns false.
         *
         * @param {string} userId
         * @returns {boolean} true if allowed, false if rate limited
         */
        check: function(userId) {
            var now = Date.now();

            if (!users[userId]) {
                // First message from this user in the window
                users[userId] = { count: 1, windowStart: now };
                return true;
            }

            var entry = users[userId];

            // Check if window has expired
            if (now - entry.windowStart >= windowMs) {
                // Reset window
                entry.count = 1;
                entry.windowStart = now;
                return true;
            }

            // Within current window — check limit
            if (entry.count >= maxMessages) {
                // Rate limited
                return false;
            }

            // Allowed — increment counter
            entry.count++;
            return true;
        },

        /**
         * Get remaining messages for a user in the current window.
         *
         * @param {string} userId
         * @returns {number} Remaining messages (0 if rate limited)
         */
        getRemaining: function(userId) {
            var now = Date.now();
            var entry = users[userId];
            if (!entry) return maxMessages;
            if (now - entry.windowStart >= windowMs) return maxMessages;
            return Math.max(0, maxMessages - entry.count);
        },

        /**
         * Reset rate limit for a specific user.
         *
         * @param {string} userId
         */
        reset: function(userId) {
            delete users[userId];
        },

        /**
         * Reset all rate limits (for shutdown/cleanup).
         */
        resetAll: function() {
            users = {};
        },

        /**
         * Get the number of tracked users.
         * Useful for monitoring/stats.
         *
         * @returns {number}
         */
        trackedCount: function() {
            return Object.keys(users).length;
        },

        /**
         * Clean up expired entries to prevent memory leaks.
         * Should be called periodically (e.g., every 5 minutes).
         *
         * @returns {number} Number of entries cleaned
         */
        cleanup: function() {
            var now = Date.now();
            var cleaned = 0;
            for (var userId in users) {
                if (users.hasOwnProperty(userId)) {
                    if (now - users[userId].windowStart >= windowMs * 2) {
                        delete users[userId];
                        cleaned++;
                    }
                }
            }
            return cleaned;
        },
    };
}

module.exports = { createRateLimiter: createRateLimiter };
