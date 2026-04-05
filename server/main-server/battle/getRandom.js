/**
 * ============================================================
 * GETRANDOM.JS - Mock Handler for battle.getRandom
 * ============================================================
 *
 * Purpose: Generate batch random numbers for battle engine
 * Used by BattleLogic.createBatchRandom(count, callback)
 *
 * HAR Reference: s398-zd.pksilo.com_2026_04_01_22_14_53.har
 *   - 12 entries, compressed: true
 *   - count range: 100 (fixed in HAR)
 *
 * HAR FACTS (Kamus):
 *   Request:  {type:"battle", action:"getRandom", userId, battleId, count, version}
 *   Response: echo all 6 request fields + computed:
 *     _rand: array of `count` random floats (0.0 ~ 1.0)
 *   Example _rand[0]: 0.040502380897842416
 *
 * main.min.js FACTS (Hakim):
 *   - Call site: BattleLogic.createBatchRandom(count, callback)
 *     ts.processHandler({type:"battle",action:"getRandom",
 *       userId, battleId, count:e, version:"1.0"},
 *       function(e) { t(e._rand) })
 *   - Response callback: function(e) { t(e._rand) }
 *   - HANYA baca 1 field: e._rand (array of float)
 *   - _rand dikirim ke BattleLogic sebagai seed random untuk battle simulation
 *
 * Version: 1.0.0
 * ============================================================
 */

(function(window) {
    'use strict';

    var LOG = {
        prefix: '[BATTLE]',
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
        success: function(msg, data) { this._log('success', 'OK', msg, data); },
        info: function(msg, data) { this._log('info', 'i', msg, data); },
        warn: function(msg, data) { this._log('warn', '!!', msg, data); },
        error: function(msg, data) { this._log('error', 'ERR', msg, data); }
    };

    /**
     * Generate array of random floats (0.0 ~ 1.0)
     * @param {number} count - number of random values to generate
     * @returns {number[]} array of random floats
     */
    function generateRandomArray(count) {
        var arr = [];
        for (var i = 0; i < count; i++) {
            arr.push(Math.random());
        }
        return arr;
    }

    /**
     * Handler for battle.getRandom
     *
     * Echo pattern: semua request fields di-echo + tambahkan _rand
     * Hakim hanya baca: e._rand
     */
    function handleGetRandom(request) {
        var count = request.count;

        LOG.info('getRandom count=' + count + ' battleId=' + (request.battleId || '').substring(0, 8) + '...');

        // Generate random array
        var rand = generateRandomArray(count);

        // Build response — echo loop + _rand
        var responseData = {};
        for (var key in request) {
            responseData[key] = request[key];
        }
        responseData._rand = rand;

        LOG.success('getRandom → ' + count + ' random floats generated');

        return responseData;
    }

    // ========================================================
    // REGISTER
    // ========================================================
    function register() {
        if (typeof window === 'undefined') {
            return;
        }

        window.MAIN_SERVER_HANDLERS = window.MAIN_SERVER_HANDLERS || {};
        window.MAIN_SERVER_HANDLERS['battle.getRandom'] = handleGetRandom;

        LOG.success('registered: battle.getRandom');
    }

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
