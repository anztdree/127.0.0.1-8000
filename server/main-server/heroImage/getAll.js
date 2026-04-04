/**
 * ============================================================
 * HEROIMAGEGETALL.JS - Mock Handler for heroImage.getAll
 * ============================================================
 * 
 * Purpose: Returns all hero image/visual data the player has unlocked
 * Called during login to know which hero portraits and display data to show
 * Each hero entry tracks the max level reached (for portrait quality)
 * 
 * HAR Reference: s398-zd.pksilo.com_2026_04_01_01_08_04.har
 * 
 * Flow (from game code main.min.js):
 *   1. Game calls: ts.processHandler({type:"heroImage",action:"getAll",userId,version:"1.0"})
 *   2. Response contains _heros object keyed by heroDisplayId
 *   3. Each hero has: _id (displayId), _maxLevel (highest level reached), _selfComments []
 *   4. Used for displaying hero portraits in UI with correct quality tier
 * 
 * HAR Data:
 *   Request:  {"type":"heroImage","action":"getAll","userId":"f443c70a-...","version":"1.0"}
 *   Response: {"type":"heroImage","action":"getAll","userId":"f443c70a-...","version":"1.0",
 *              "_heros":{"1205":{"_id":1205,"_maxLevel":3,"_selfComments":[]}}}
 *   Response wrapper: {ret:0, compress:false, serverTime:..., server0Time:14400000, data:"..."}
 * 
 * Note: Only hero 1205 (Wukong) for new player at level 3 (starting hero)
 * 
 * Author: Local SDK Bridge
 * Version: 1.0.0
 * ============================================================
 */

(function(window) {
    'use strict';

    var LOG = {
        prefix: '🖼️ [HERO-IMAGE]',
        _log: function(level, icon, message, data) {
            var timestamp = new Date().toISOString().substr(11, 12);
            var styles = {
                success: 'color: #22c55e; font-weight: bold;',
                info: 'color: #6b7280;',
                warn: 'color: #f59e0b; font-weight: bold;',
                error: 'color: #ef4444; font-weight: bold;'
            };
            var style = styles[level] || styles.info;
            var format = '%c' + this.prefix + ' ' + icon + ' [' + timestamp + '] ' + message;
            if (data !== undefined) {
                console.log(format + ' %o', style, data);
            } else {
                console.log(format, style);
            }
        },
        success: function(msg, data) { this._log('success', '✅', msg, data); },
        info: function(msg, data) { this._log('info', 'ℹ️', msg, data); },
        warn: function(msg, data) { this._log('warn', '⚠️', msg, data); },
        error: function(msg, data) { this._log('error', '❌', msg, data); }
    };

    /**
     * Handler for heroImage.getAll
     * Registered via window.MAIN_SERVER_HANDLERS
     * 
     * HAR Response Structure:
     *   _heros: {
     *     "<heroDisplayId>": {
     *       _id: <heroDisplayId>,
     *       _maxLevel: <max level reached with this hero>,
     *       _selfComments: []   // player comments on this hero
     *     }
     *   }
     * 
     * For new player: only hero 1205 (Wukong) at starting level 3
     */
    function handleHeroImageGetAll(request, playerData) {
        LOG.info('Handling heroImage.getAll');
        LOG.info('UserId: ' + request.userId);

        // HAR: New player has hero 1205 (Wukong) at level 3 (starting level)
        // _maxLevel = 3 means the portrait shows the quality tier for level 3
        // _selfComments = [] means no comments yet
        var responseData = {
            type: 'heroImage',
            action: 'getAll',
            userId: request.userId,
            version: request.version || '1.0',
            _heros: {
                '1205': {
                    _id: 1205,
                    _maxLevel: 3,
                    _selfComments: []
                }
            }
        };

        var heroCount = Object.keys(responseData._heros).length;
        LOG.success('getAll → ' + heroCount + ' hero image(s)');
        LOG.info('Heroes: ' + Object.keys(responseData._heros).join(', '));

        return responseData;
    }

    // ========================================================
    // REGISTER HANDLER
    // ========================================================
    function register() {
        if (typeof window === 'undefined') {
            console.error('[HERO-IMAGE] window not available');
            return;
        }

        window.MAIN_SERVER_HANDLERS = window.MAIN_SERVER_HANDLERS || {};
        window.MAIN_SERVER_HANDLERS['heroImage.getAll'] = handleHeroImageGetAll;

        LOG.success('Handler registered: heroImage.getAll');
    }

    // Auto-register
    if (typeof window !== 'undefined') {
        register();
    } else {
        var _check = setInterval(function() {
            if (typeof window !== 'undefined') {
                clearInterval(_check);
                register();
            }
        }, 50);
        setTimeout(function() { clearInterval(_check); }, 10000);
    }

})(window);
