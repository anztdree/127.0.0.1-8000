/**
 * ============================================================
 * BRIDGE.JS v4.0.0 - DragonBall Z: Super Warrior (超级战士Z)
 * Standalone HTML5 Bridge Engine
 * ============================================================
 *
 * Purpose: Override egret.ExternalInterface.call and
 * egret.ExternalInterface.addCallback to route all game calls
 * to the SDK implementations exposed via window.LOCAL_SDK.
 *
 * ARCHITECTURE v4.0:
 *   29 clearly numbered sections, each with documented purpose.
 *   - Professional debug logger with compact/verbose modes
 *     (matches sdk.js v4.0 LOG style, synced via __SDK_DEBUG__)
 *   - Cleaner startGame handler with delivery summary
 *   - Error 1001 ResourceManager monitoring
 *   - Silent performance tracking with gameReady report
 *   - Enhanced game function patching with MutationObserver
 *   - Bridge Ready summary on initialization
 *   - Startup summary on gameReady signal
 *
 * CRITICAL GAME FLOW:
 *   1. sdk.js loads (in <head>), defines window.LOCAL_SDK
 *   2. Egret engine loads (egret.min.js, egret.web.min.js)
 *   3. bridge.js loads (via manifest.json), overrides ExternalInterface
 *   4. index.html calls ExternalInterface.call("startGame")
 *   5. bridge responds with LOCAL_SDK.getStartGameData() JSON
 *   6. index.html parses JSON, sets window vars, calls runEgret()
 *   7. Game loads, calls ExternalInterface.call for SDK features
 *
 * Load Order: #3 - AFTER egret.web.min.js (via manifest.json)
 *
 * Author: Local SDK Bridge
 * Version: 4.0.0
 * ============================================================
 */

(function() {
    'use strict';

    // ============================================================
    // SECTION 1: PROFESSIONAL DEBUG LOGGER
    // ============================================================
    // Toggle: window.__SDK_DEBUG__ = true (verbose)
    //        window.__SDK_DEBUG__ = false / undefined (compact)
    //
    // Compact mode (default):
    //   - Only shows error, warn, and success messages
    //   - startGame and gameReady always logged (critical path)
    //   - Suppresses info, data, call, ui messages
    //
    // Verbose mode (__SDK_DEBUG__ = true):
    //   - Shows all messages with color-coded severity
    //   - HH:MM:SS.mmm timestamps
    //   - Detailed data objects
    //
    // NOTE: Prefix and style colors match sdk.js LOG but with
    // a distinct blue gradient to differentiate bridge messages.

    var _debug = window.__SDK_DEBUG__ === true;

    var LOG = {
        prefix: '\uD83C\uDFAE [BRIDGE]',

        _styles: {
            title:   'background:linear-gradient(90deg,#667eea 0%,#764ba2 100%);color:#fff;padding:2px 8px;border-radius:4px;font-weight:bold;',
            error:   'color:#ef4444;font-weight:bold;',
            warn:    'color:#f59e0b;font-weight:bold;',
            success: 'color:#10b981;font-weight:bold;',
            info:    'color:#6b7280;',
            data:    'color:#8b5cf6;',
            call:    'color:#0ea5e9;font-weight:bold;',
            ui:      'color:#ec4899;font-weight:bold;',
            separator: 'color:#4b5563;'
        },

        // HH:MM:SS.mmm format (matches sdk.js)
        _timestamp: function() {
            var d = new Date();
            var h = d.getHours().toString();
            var m = d.getMinutes().toString();
            var s = d.getSeconds().toString();
            var ms = d.getMilliseconds().toString();
            if (h.length < 2) h = '0' + h;
            if (m.length < 2) m = '0' + m;
            if (s.length < 2) s = '0' + s;
            while (ms.length < 3) ms = '0' + ms;
            return h + ':' + m + ':' + s + '.' + ms;
        },

        // Standard log: suppressed in compact mode for info/data/call/ui
        _log: function(level, icon, message, data) {
            // In compact mode, only show errors, warnings, and success
            if (!_debug && level !== 'error' && level !== 'warn' && level !== 'success') {
                return;
            }

            var ts = this._timestamp();
            var style = this._styles[level] || this._styles.info;
            var fmt = '%c' + this.prefix + ' %c[' + ts + '] ' + icon + ' ' + message;

            if (data !== undefined && _debug) {
                console.log(fmt, this._styles.title, style, data);
            } else {
                console.log(fmt, this._styles.title, style);
            }
        },

        // Critical log: ALWAYS outputs regardless of debug mode.
        // Used for startGame delivery and gameReady milestones.
        _logCritical: function(level, icon, message, data) {
            var ts = this._timestamp();
            var style = this._styles[level] || this._styles.info;
            var fmt = '%c' + this.prefix + ' %c[' + ts + '] ' + icon + ' ' + message;

            if (data !== undefined) {
                console.log(fmt, this._styles.title, style, data);
            } else {
                console.log(fmt, this._styles.title, style);
            }
        },

        title: function(message) {
            // Titles always show in compact mode
            var line = '\u2500'.repeat(60);
            var ts = this._timestamp();
            console.log('%c' + this.prefix + ' %c[' + ts + '] \u2500\u2500 ' + message + ' \u2500\u2500',
                this._styles.title, this._styles.separator);
        },

        success: function(message, data) { this._log('success', '\u2705', message, data); },
        info:    function(message, data) { this._log('info', '\u2139\uFE0F', message, data); },
        warn:    function(message, data) { this._log('warn', '\u26A0\uFE0F', message, data); },
        error:   function(message, data) { this._log('error', '\u274C', message, data); },
        data:    function(message, data) { this._log('data', '\uD83D\uDCCA', message, data); },

        call: function(name, message) {
            this._log('call', '\uD83D\uDCDE', 'call("' + name + '")', message || undefined);
        },

        callback: function(name, data) {
            this._log('success', '\uD83D\uDD14', 'Callback: ' + name);
            if (data && _debug) {
                console.log('%c' + this.prefix + ' %c\uD83D\uDCE4 Response:',
                    this._styles.title, this._styles.data, data);
            }
        },

        separator: function() {
            if (!_debug) return;
            console.log('%c' + this.prefix + ' %c' + '\u2500'.repeat(58),
                this._styles.title, this._styles.separator);
        }
    };


    // ============================================================
    // SECTION 2: STATE MANAGEMENT
    // ============================================================
    // Tracks bridge state, registered callbacks, pending calls,
    // performance timing, and handler execution times.

    var _callbacks = {};       // name -> { fn, id, registeredAt }
    var _pendingCalls = {};    // name -> { message, timestamp }
    var _checkIntervals = {};  // name -> intervalId

    var _state = {
        initialized: false,
        startGameTriggered: false,
        startGameCompleted: false,
        gameReadyTriggered: false,
        callbackCount: 0,
        callCount: 0,
        startTime: Date.now(),
        startIsoTime: new Date().toISOString()
    };

    // Silent performance tracking: records timing per handler
    var _perfTimers = {};      // name -> { count, totalTime, minTime, maxTime }
    var _perfStartTimes = {};  // temporary: name -> performance.now()


    // ============================================================
    // SECTION 3: VERIFY EGRET ENGINE
    // ============================================================
    if (typeof egret === 'undefined') {
        console.error('%c\u274C [BRIDGE] FATAL: egret not found! Load bridge.js AFTER egret.web.min.js',
            'color:#ef4444;font-weight:bold;font-size:14px;');
        return;
    }
    if (!egret.ExternalInterface) {
        console.error('%c\u274C [BRIDGE] FATAL: egret.ExternalInterface not found!',
            'color:#ef4444;font-weight:bold;font-size:14px;');
        return;
    }


    // ============================================================
    // SECTION 4: STORE ORIGINALS & OVERRIDE
    // ============================================================
    var _originalCall = egret.ExternalInterface.call;
    var _originalAddCallback = egret.ExternalInterface.addCallback;

    LOG._logCritical('success', '\uD83D\uDE80', 'Bridge v4.0.0 initializing...');


    // ============================================================
    // SECTION 5: OVERRIDE addCallback
    // ============================================================
    // Index.html registers these callbacks via addCallback:
    //   "startGame" -> function(msg) { parse JSON, set window vars, run engine }
    //   "refresh"   -> function(msg) { window.location.reload(); }
    //
    // We intercept and store them. The bridge triggers "startGame"
    // callback with data from LOCAL_SDK when the game calls
    // ExternalInterface.call("startGame").
    // ============================================================
    egret.ExternalInterface.addCallback = function(name, callback) {
        _state.callbackCount++;
        LOG.info('\uD83D\uDCCC addCallback("' + name + '") [ID:' + _state.callbackCount + ']');

        if (typeof callback !== 'function') {
            LOG.error('addCallback: callback is not a function! Got: ' + typeof callback);
            return;
        }

        _callbacks[name] = {
            fn: callback,
            id: _state.callbackCount,
            registeredAt: new Date().toISOString()
        };

        LOG.success('Callback registered: "' + name + '" [' + Object.keys(_callbacks).length + ' total]');

        // If there's a pending call for this callback, trigger it now
        if (_pendingCalls[name]) {
            LOG.info('\uD83D\uDD04 Pending call for "' + name + '", triggering...');
            var pendingMessage = _pendingCalls[name].message;
            delete _pendingCalls[name];
            setTimeout(function() {
                _triggerCallback(name, pendingMessage);
            }, 10);
        }
    };


    // ============================================================
    // SECTION 6: HELPER - Trigger Callback
    // ============================================================
    function _triggerCallback(name, message) {
        var cb = _callbacks[name];
        if (!cb || typeof cb.fn !== 'function') {
            LOG.error('No callback registered for: "' + name + '"');
            return false;
        }
        try {
            LOG.callback(name, message);
            var t0 = performance.now();
            cb.fn(message);
            var elapsed = (performance.now() - t0).toFixed(2);
            LOG.info('Callback "' + name + '" executed in ' + elapsed + 'ms');
            return true;
        } catch (e) {
            LOG.error('Error in callback "' + name + '": ' + e.message);
            if (_debug) console.error(e);
            return false;
        }
    }


    // ============================================================
    // SECTION 7: HELPER - Get SDK Data
    // ============================================================
    function _getSDKData() {
        if (typeof window.LOCAL_SDK === 'undefined') {
            LOG.error('window.LOCAL_SDK not available! Is sdk.js loaded?');
            return null;
        }
        if (typeof window.LOCAL_SDK.getStartGameData !== 'function') {
            LOG.error('LOCAL_SDK.getStartGameData is not a function!');
            return null;
        }
        return window.LOCAL_SDK.getStartGameData();
    }

    function _getEngine(name) {
        if (typeof window.LOCAL_SDK !== 'undefined' && window.LOCAL_SDK[name]) {
            return window.LOCAL_SDK[name];
        }
        return null;
    }


    // ============================================================
    // SECTION 8: HELPER - Safe JSON Parse
    // ============================================================
    function _safeParse(str) {
        if (typeof str === 'object' && str !== null) return str;
        if (typeof str !== 'string') return null;
        try { return JSON.parse(str); } catch (e) { return null; }
    }

    function _clearInterval(key) {
        if (_checkIntervals[key]) {
            clearInterval(_checkIntervals[key]);
            delete _checkIntervals[key];
        }
    }

    // Safe localStorage helper
    function _lsGet(key, defaultVal) {
        try {
            var raw = localStorage.getItem(key);
            if (raw !== null) return JSON.parse(raw);
        } catch (e) {}
        return defaultVal !== undefined ? defaultVal : null;
    }

    function _lsSet(key, value) {
        try { localStorage.setItem(key, JSON.stringify(value)); } catch (e) {}
    }


    // ============================================================
    // SECTION 9: HELPER - Performance Tracking
    // ============================================================
    // Silently records per-handler execution times. Reports on
    // gameReady. Individual handler times only shown in debug mode.

    function _perfStart(name) {
        _perfStartTimes[name] = performance.now();
    }

    function _perfEnd(name) {
        if (!_perfStartTimes[name]) return;
        var elapsed = performance.now() - _perfStartTimes[name];
        delete _perfStartTimes[name];

        if (!_perfTimers[name]) {
            _perfTimers[name] = { count: 0, totalTime: 0, minTime: Infinity, maxTime: 0 };
        }
        var t = _perfTimers[name];
        t.count++;
        t.totalTime += elapsed;
        if (elapsed < t.minTime) t.minTime = elapsed;
        if (elapsed > t.maxTime) t.maxTime = elapsed;
    }

    function _perfReport() {
        var keys = Object.keys(_perfTimers);
        if (keys.length === 0) return '';
        var lines = [];
        for (var i = 0; i < keys.length; i++) {
            var t = _perfTimers[keys[i]];
            var avg = (t.totalTime / t.count).toFixed(2);
            lines.push('  ' + keys[i] + ': ' + t.count + ' calls, avg ' + avg + 'ms (min ' + t.minTime.toFixed(1) + ', max ' + t.maxTime.toFixed(1) + ')');
        }
        return lines.join('\n');
    }


    // ============================================================
    // SECTION 10: MAIN ROUTER - Override ExternalInterface.call
    // ============================================================
    // This is the core of the bridge. Every call from the game
    // or index.html passes through here. We route each call to
    // the appropriate handler.
    //
    // Call sources:
    //   A) index.html Script 1 (game init): startGame, refresh
    //   B) index.html Script 2 (SDK wrappers): changeView, pei,
    //      giveLike, contact, switchAccount, fbGiveLive, userCenter,
    //      gifBag, report2Third, report2Sdk, changeLanguage,
    //      openURL, gameReady, reportPayResult
    //   C) Unknown calls from game or extensions
    // ============================================================
    egret.ExternalInterface.call = function(name, message) {
        _state.callCount++;
        _perfStart(name);

        LOG.call(name, message);

        switch (name) {
            case 'startGame':       _handleStartGame(message);       break;
            case 'refresh':         _handleRefresh(message);         break;
            case 'changeView':      _handleChangeView(message);      break;
            case 'pei':             _handlePayment(message);         break;
            case 'giveLike':        _handleGiveLike(message);        break;
            case 'contact':         _handleContact(message);         break;
            case 'switchAccount':   _handleSwitchAccount(message);   break;
            case 'fbGiveLive':      _handleFbGiveLive(message);      break;
            case 'userCenter':      _handleUserCenter(message);      break;
            case 'gifBag':          _handleGiftBag(message);         break;
            case 'report2Third':    _handleReport2Third(message);    break;
            case 'report2Sdk':      _handleReport2Sdk(message);      break;
            case 'changeLanguage':  _handleChangeLanguage(message);  break;
            case 'openURL':         _handleOpenURL(message);         break;
            case 'gameReady':       _handleGameReady(message);       break;
            case 'reportPayResult': _handleReportPayResult(message); break;
            default:                _handleUnknown(name, message);
        }

        _perfEnd(name);
        LOG.separator();
    };


    // ============================================================
    // SECTION 11: HANDLER - startGame (CRITICAL)
    // ============================================================
    // This is the most critical handler. It delivers SDK bootstrap
    // data to the game via the addCallback("startGame") that
    // index.html Script 1 registered.
    //
    // Flow:
    //   1. Game calls ExternalInterface.call("startGame", "get Sdk Channel")
    //   2. Bridge calls LOCAL_SDK.getStartGameData() for fresh config
    //   3. Bridge triggers the stored startGame callback with JSON string
    //   4. Index.html parses JSON, sets window vars, calls runEgret()
    //   5. GAME STARTS
    //
    // Edge cases handled:
    //   - Callback not yet registered (pending queue + poll)
    //   - Duplicate startGame calls (idempotent)
    //   - Timeout if callback never registers (5s)
    //   - LOCAL_SDK not available
    // ============================================================
    function _handleStartGame(message) {
        LOG._logCritical('info', '\uD83C\uDFAE', 'startGame - Game requesting SDK bootstrap data...');

        if (_state.startGameTriggered) {
            LOG.warn('startGame already triggered (idempotent - skip if completed)');
            if (_callbacks['startGame'] && !_state.startGameCompleted) {
                _respondStartGame();
            }
            return;
        }
        _state.startGameTriggered = true;

        if (_callbacks['startGame']) {
            _respondStartGame();
        } else {
            LOG.info('Callback not yet registered, queuing...');
            _pendingCalls['startGame'] = {
                message: message,
                timestamp: new Date().toISOString()
            };

            // Poll for callback registration (50ms intervals)
            var pollKey = 'startGame_poll';
            _checkIntervals[pollKey] = setInterval(function() {
                if (_callbacks['startGame']) {
                    _clearInterval(pollKey);
                    _respondStartGame();
                }
            }, 50);

            // Timeout safety - 5 seconds max wait
            setTimeout(function() {
                _clearInterval(pollKey);
                if (_pendingCalls['startGame']) {
                    LOG.error('\u23F0 Timeout (5s) waiting for startGame callback!');
                    LOG.error('index.html addCallback("startGame") was never called.');
                    LOG.error('Check script loading order: sdk.js -> egret -> bridge.js -> index.html');
                    delete _pendingCalls['startGame'];
                    _state.startGameTriggered = false;
                }
            }, 5000);
        }
    }

    function _respondStartGame() {
        var data = _getSDKData();
        if (!data) {
            LOG.error('Failed to get SDK data from LOCAL_SDK!');
            _state.startGameTriggered = false;
            return;
        }

        // Parse thirdParams and clientParams (they are JSON strings from getStartGameData)
        var thirdParamsObj = null;
        var clientParamsObj = null;
        try { thirdParamsObj = (typeof data.thirdParams === 'string') ? JSON.parse(data.thirdParams) : data.thirdParams; } catch(e) {}
        try { clientParamsObj = (typeof data.clientParams === 'string') ? JSON.parse(data.clientParams) : data.clientParams; } catch(e) {}

        // Get sdk info from LOCAL_SDK.config (not in getStartGameData return)
        var sdkConfig = (window.LOCAL_SDK && window.LOCAL_SDK.config) ? window.LOCAL_SDK.config : null;
        var sdkType = sdkConfig ? sdkConfig.sdkType : 'N/A';
        var appId = sdkConfig ? sdkConfig.appId : 'N/A';

        // Critical delivery summary (always shown)
        LOG._logCritical('success', '\uD83D\uDE80', '\u2501\u2501\u2501\u2501 startGame Delivery \u2501\u2501\u2501\u2501');
        LOG._logCritical('info', '\u2502', 'Server:   ' + data.loginServer);
        LOG._logCritical('info', '\u2502', 'Version:  ' + data.version);
        LOG._logCritical('info', '\u2502', 'Lang:     ' + data.language + '  (channel: ' + data.thirdChannel + ')');
        LOG._logCritical('info', '\u2502', 'SDK Type: ' + sdkType);
        LOG._logCritical('info', '\u2502', 'App ID:   ' + (appId !== 'N/A' && appId.length > 20 ? appId.substring(0, 20) + '...' : appId));
        if (thirdParamsObj) {
            LOG._logCritical('info', '\u2502', 'User:     ' + (thirdParamsObj.nickname || 'N/A') + ' (' + (thirdParamsObj.userid || 'N/A') + ')');
        } else {
            LOG._logCritical('warn', '\u2502', 'User:     FAILED to parse thirdParams!');
        }
        if (clientParamsObj) {
            var langs = clientParamsObj.supportLang || [];
            LOG._logCritical('info', '\u2502', 'Audio:    ' + (clientParamsObj.battleAudio !== false ? 'ON' : 'OFF') + '  |  Switch Account: ' + (clientParamsObj.switchAccount !== false ? 'ON' : 'OFF'));
            LOG._logCritical('info', '\u2502', 'Langs:    ' + langs.length + ' supported (' + langs.map(function(l) { return l.lang; }).join(', ') + ')');
        } else {
            LOG._logCritical('warn', '\u2502', 'Client:   FAILED to parse clientParams!');
        }
        LOG._logCritical('info', '\u2514', '');

        // Track bootstrap analytics event
        var analytics = _getEngine('analytics');
        if (analytics) {
            analytics.track('SDKBootstrap', {
                language: data.language,
                channel: data.thirdChannel,
                version: data.version,
                source: 'bridge_v4'
            });
        }

        setTimeout(function() {
            var json = JSON.stringify(data);
            var jsonSize = json.length;
            var ok = _triggerCallback('startGame', json);
            if (ok) {
                _state.startGameCompleted = true;
                LOG._logCritical('success', '\uD83D\uDE80', 'startGame delivered! (' + jsonSize + ' bytes JSON)');
                LOG._logCritical('info', '\u2705', 'Game engine should now start (egret.runEgret)');
            } else {
                LOG.error('Failed to deliver startGame callback!');
                _state.startGameTriggered = false;
            }
        }, 50);
    }


    // ============================================================
    // SECTION 12: HANDLER - refresh
    // ============================================================
    // Messages: "switch usr", "reload game", "refresh"
    // Source: index.html Script 2 (switchUser, reload, refreshPage)
    // Index.html registers callback: addCallback("refresh", fn) -> reload()
    // ============================================================
    function _handleRefresh(message) {
        LOG.info('\uD83D\uDD04 refresh: "' + (message || '') + '"');

        if (message === 'switch usr') {
            // User switch - use AccountManager if available
            var account = _getEngine('account');
            if (account && account.switchUser) {
                account.switchUser();
            } else {
                _doSwitchUser();
            }
        } else {
            // "refresh", "reload game", or any other message
            var analytics = _getEngine('analytics');
            if (analytics) {
                analytics.trackCustom(message === 'refresh' ? 'PageRefresh' : 'PageReload', {
                    source: message || 'unknown'
                });
            }

            if (_callbacks['refresh']) {
                _triggerCallback('refresh', message);
            } else {
                LOG.info('No refresh callback, direct reload in 300ms...');
                setTimeout(function() { window.location.reload(); }, 300);
            }
        }
    }


    // ============================================================
    // SECTION 13: HANDLER - changeView
    // ============================================================
    // Message: "change view"
    // Source: index.html Script 2 (checkSDK)
    // Real SDK would switch between fullscreen and web view.
    // Standalone: acknowledge but no action needed.
    // ============================================================
    function _handleChangeView(message) {
        LOG.info('\uD83D\uDCCB changeView: "' + (message || '') + '"');

        var analytics = _getEngine('analytics');
        if (analytics) {
            analytics.trackCustom('ChangeView', { view: message });
        }

        if (_callbacks['changeView']) {
            _triggerCallback('changeView', message);
        }
    }


    // ============================================================
    // SECTION 14: HANDLER - pei (Payment)
    // ============================================================
    // Message: JSON.stringify(paymentData)
    // Fields: goodsId, goodsName, amount, currency, serverId,
    //         roleId, roleName, roleLevel, etc.
    // Route to: LOCAL_SDK.payment.process()
    // ============================================================
    function _handlePayment(message) {
        LOG.info('\uD83D\uDCB0 Payment request received');

        var payData = _safeParse(message);
        if (!payData) {
            LOG.error('Failed to parse payment data: ' + (message || 'empty'));
            return;
        }
        if (_debug) LOG.data('Payment Data:', payData);

        // Route to PaymentEngine in sdk.js
        var payment = _getEngine('payment');
        if (payment && payment.process) {
            payment.process(payData);
        } else {
            _fallbackPayment(payData);
        }
    }

    function _fallbackPayment(payData) {
        LOG.warn('PaymentEngine not available, using fallback');

        var analytics = _getEngine('analytics');
        if (analytics) {
            analytics.track('firstViewRechargePanel', payData);
        }

        var attempts = _lsGet('dbz_sdk_payment_fallbacks', []);
        if (!Array.isArray(attempts)) attempts = [];
        attempts.push({
            data: payData,
            status: 'simulated_success',
            timestamp: new Date().toISOString()
        });
        _lsSet('dbz_sdk_payment_fallbacks', attempts);

        LOG.success('Payment simulated (fallback): ' + (payData.goodsName || payData.goodsId || 'unknown'));
    }


    // ============================================================
    // SECTION 15: HANDLER - giveLike (Social Share)
    // ============================================================
    // Message: JSON.stringify({serverId, roleName, extra})
    // Route to: LOCAL_SDK.social.share()
    // ============================================================
    function _handleGiveLike(message) {
        LOG.info('\uD83D\uDC4D Share/Like request');

        var shareData = _safeParse(message);
        if (shareData && _debug) LOG.data('Share Data:', shareData);

        var social = _getEngine('social');
        if (social && social.share) {
            social.share(shareData);
        } else {
            var analytics = _getEngine('analytics');
            if (analytics) analytics.trackCustom('SocialShare', shareData);
            LOG.success('Share event recorded (fallback)');
        }
    }


    // ============================================================
    // SECTION 16: HANDLER - contact (Customer Service)
    // ============================================================
    // Message: "contact"
    // Route to: LOCAL_SDK.contact.showUI()
    // ============================================================
    function _handleContact(message) {
        LOG.info('\uD83D\uDCDE Contact Center request');

        var contact = _getEngine('contact');
        if (contact && contact.showUI) {
            contact.showUI();
        } else {
            LOG.warn('ContactCenter not available');
            var analytics = _getEngine('analytics');
            if (analytics) analytics.trackCustom('ContactOpen', {});
        }
    }


    // ============================================================
    // SECTION 17: HANDLER - switchAccount
    // ============================================================
    // Message: "switchAccount"
    // Route to: LOCAL_SDK.account.switchUser()
    // ============================================================
    function _handleSwitchAccount(message) {
        LOG.info('\uD83D\uDD04 Account Switch request');

        var account = _getEngine('account');
        if (account && account.switchUser) {
            account.switchUser();
        } else {
            _doSwitchUser();
        }
    }

    function _doSwitchUser() {
        LOG.info('Performing direct user switch...');

        if (typeof window.LOCAL_SDK !== 'undefined' && window.LOCAL_SDK.resetUser) {
            window.LOCAL_SDK.resetUser();
        }

        try { localStorage.removeItem('dbz_sdk_current_session_id'); } catch (e) {}

        var analytics = _getEngine('analytics');
        if (analytics) analytics.trackCustom('AccountSwitch', { method: 'direct' });

        setTimeout(function() { window.location.reload(); }, 300);
    }


    // ============================================================
    // SECTION 18: HANDLER - fbGiveLive (FB Live Giveaway)
    // ============================================================
    // Message: "fbGiveLive"
    // Route to: LOCAL_SDK.social.giveLive()
    // ============================================================
    function _handleFbGiveLive(message) {
        LOG.info('\uD83D\uDC4D FB Live Giveaway request');

        var social = _getEngine('social');
        if (social && social.giveLive) {
            social.giveLive();
        } else {
            var analytics = _getEngine('analytics');
            if (analytics) analytics.trackCustom('FBLiveGiveaway', {});
            LOG.success('FB Live Giveaway registered (fallback)');
        }
    }


    // ============================================================
    // SECTION 19: HANDLER - userCenter
    // ============================================================
    // Message: "userCenter"
    // Route to: LOCAL_SDK.userCenter.showUI()
    // ============================================================
    function _handleUserCenter(message) {
        LOG.info('\uD83D\uDC64 User Center request');

        var userCenter = _getEngine('userCenter');
        if (userCenter && userCenter.showUI) {
            userCenter.showUI();
        } else {
            LOG.warn('UserCenterEngine not available');
            var analytics = _getEngine('analytics');
            if (analytics) analytics.trackCustom('UserCenterOpen', {});
        }
    }


    // ============================================================
    // SECTION 20: HANDLER - gifBag (Gift Bag)
    // ============================================================
    // Message: "gifBag"
    // Route to: LOCAL_SDK.giftBag.showUI()
    // ============================================================
    function _handleGiftBag(message) {
        LOG.info('\uD83C\uDF81 Gift Bag request');

        var giftBag = _getEngine('giftBag');
        if (giftBag && giftBag.showUI) {
            giftBag.showUI();
        } else {
            LOG.warn('GiftBagEngine not available');
            var analytics = _getEngine('analytics');
            if (analytics) analytics.trackCustom('GiftBagOpen', {});
        }
    }


    // ============================================================
    // SECTION 21: HANDLER - report2Third (Analytics)
    // ============================================================
    // Message: JSON.stringify({dataType, level, ...})
    // dataType values (from game):
    //   11 = gameLevelUp
    //   12 = gameChapterFinish
    //   13 = openShopPage
    //   14 = tutorialFinish
    // Route to: LOCAL_SDK.analytics + FB Pixel + Google Ads
    // ============================================================
    function _handleReport2Third(message) {
        LOG.info('\uD83D\uDCCA report2Third');

        var data = _safeParse(message);
        if (!data) {
            LOG.warn('No data in report2Third');
            return;
        }
        if (_debug) LOG.data('Report Data:', data);

        var analytics = _getEngine('analytics');
        if (analytics) {
            var dataType = data.dataType;
            if (dataType === 11) {
                // gameLevelUp -> ReportDataType.LevelUp (3)
                analytics.track(3, data);
                if (data.level && window.LOCAL_SDK && window.LOCAL_SDK.user) {
                    window.LOCAL_SDK.user.level = data.level;
                }
            } else if (dataType === 12) {
                // gameChapterFinish -> ReportDataType.blackStoneLessonFinish (12)
                analytics.track(12, data);
                // Check milestone stages for FB/Google tracking
                var fbPixel = _getEngine('fbPixel');
                var googleAds = _getEngine('googleAds');
                if (data.level === 10204 && fbPixel) {
                    fbPixel.track('track', 'Stage204cleared');
                    if (googleAds) googleAds.event('event', 'conversion', { send_to: 'AW-727890639/8tfJCPPO5akBEM_1itsC' });
                } else if (data.level === 10308 && fbPixel) {
                    fbPixel.track('track', 'Stage308cleared');
                    if (googleAds) googleAds.event('event', 'conversion', { send_to: 'AW-727890639/jg2yCMq27qkBEM_1itsC' });
                }
            } else if (dataType === 13) {
                // openShopPage
                analytics.trackCustom('OpenShopPage', data);
            } else if (dataType === 14) {
                // tutorialFinish -> ReportDataType.EndGuide (6)
                analytics.track(6, data);
                var fbPixel2 = _getEngine('fbPixel');
                var googleAds2 = _getEngine('googleAds');
                if (fbPixel2) {
                    fbPixel2.track('track', 'TutorialEnds');
                    fbPixel2.track('track', 'Lead');
                }
                if (googleAds2) {
                    googleAds2.event('event', 'conversion', { send_to: 'AW-727890639/DtgTCLj73qUBEM_1itsC' });
                }
            } else {
                analytics.track('Report2Third_type' + dataType, data);
            }
        }

        // Store in local history
        var history = _lsGet('dbz_sdk_report2third_history', []);
        if (!Array.isArray(history)) history = [];
        history.push({ data: data, timestamp: new Date().toISOString() });
        if (history.length > 200) history = history.slice(-200);
        _lsSet('dbz_sdk_report2third_history', history);
    }


    // ============================================================
    // SECTION 22: HANDLER - report2Sdk (SDK Report)
    // ============================================================
    // Message: JSON.stringify({moneyNum, powerNum, ...})
    // Route to: LOCAL_SDK.analytics
    // ============================================================
    function _handleReport2Sdk(message) {
        LOG.info('\uD83D\uDCC8 report2Sdk');

        var data = _safeParse(message);
        if (!data) {
            LOG.warn('No data in report2Sdk');
            return;
        }
        if (_debug) LOG.data('SDK Report Data:', data);

        var analytics = _getEngine('analytics');
        if (analytics) {
            analytics.track('Report2Sdk', data);
        }

        var history = _lsGet('dbz_sdk_report2sdk_history', []);
        if (!Array.isArray(history)) history = [];
        history.push({ data: data, timestamp: new Date().toISOString() });
        if (history.length > 200) history = history.slice(-200);
        _lsSet('dbz_sdk_report2sdk_history', history);
    }


    // ============================================================
    // SECTION 23: HANDLER - changeLanguage
    // ============================================================
    // Message: language code (e.g., "en", "cn", "tw", "kr")
    // Actions:
    //   1. Validate language code (min 2 chars)
    //   2. Set _sdkLanguageChanging flag (prevent double reload)
    //   3. Update SDK config (language, thirdChannel, clientParams)
    //   4. Update window globals
    //   5. Persist to localStorage (dbz_sdk_language)
    //   6. Track analytics event
    //   7. Clear flag after 2s (in case reload doesn't happen)
    //
    // NOTE: index.html changeLanguage() calls window.location.reload()
    // after this handler returns. The flag prevents sdk.js from
    // also triggering a reload.
    // ============================================================
    function _handleChangeLanguage(langCode) {
        LOG.info('\uD83C\uDF10 changeLanguage: "' + (langCode || '') + '"');

        if (!langCode || langCode.length < 2) {
            LOG.warn('Invalid language code: ' + langCode);
            return;
        }

        // Set flag to prevent double reload
        window._sdkLanguageChanging = true;

        // Update SDK config - ALL language-related fields
        if (typeof window.LOCAL_SDK !== 'undefined' && window.LOCAL_SDK.config) {
            window.LOCAL_SDK.config.language = langCode;
            window.LOCAL_SDK.config.thirdChannel = langCode;
            if (window.LOCAL_SDK.config.clientParams) {
                window.LOCAL_SDK.config.clientParams.sdkNativeChannel = langCode;
                window.LOCAL_SDK.config.clientParams.showCurChannel = langCode;
            }
        }

        // Update window globals immediately (before reload)
        try {
            window.sdkChannel = langCode;
            window.sdkNativeChannel = langCode;
            window.showCurChannel = langCode;
            window.debugLanguage = langCode;
        } catch (e) {}

        // Persist to localStorage (same key as sdk.js Storage engine: dbz_sdk_language)
        try {
            localStorage.setItem('dbz_sdk_language', JSON.stringify(langCode));
        } catch (e) {}

        var analytics = _getEngine('analytics');
        if (analytics) analytics.trackCustom('LanguageChange', { language: langCode, source: 'bridge_v4' });

        LOG.success('Language \u2192 ' + langCode);

        // Clear flag after delay (index.html changeLanguage() calls reload)
        setTimeout(function() { window._sdkLanguageChanging = false; }, 2000);
    }


    // ============================================================
    // SECTION 24: HANDLER - openURL
    // ============================================================
    // Message: URL string
    // Must use anchor element to avoid infinite recursion
    // (index.html Script 2 overrides window.open with
    //  a function that calls ExternalInterface.call("openURL"))
    // ============================================================
    function _handleOpenURL(url) {
        LOG.info('\uD83D\uDD17 openURL: ' + (url || ''));

        if (!url) {
            LOG.warn('No URL provided');
            return;
        }

        var analytics = _getEngine('analytics');
        if (analytics) analytics.trackCustom('OpenURL', { url: url });

        try {
            var a = document.createElement('a');
            a.href = url;
            a.target = '_blank';
            a.rel = 'noopener noreferrer';
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            LOG.success('URL opened: ' + url);
        } catch (e) {
            LOG.error('Failed to open URL: ' + e.message);
        }
    }


    // ============================================================
    // SECTION 25: HANDLER - gameReady
    // ============================================================
    // Source: Game (main.min.js) after full load
    // Actions:
    //   1. Track EnterGame analytics
    //   2. Track FB Pixel GameStarted
    //   3. Track Google Ads config
    //   4. Output startup summary with perf stats
    //   5. Record ready time to localStorage
    // ============================================================
    function _handleGameReady(message) {
        if (_state.gameReadyTriggered) {
            LOG.warn('gameReady already triggered, skipping');
            return;
        }
        _state.gameReadyTriggered = true;

        var bootMs = Date.now() - _state.startTime;
        var bootSec = (bootMs / 1000).toFixed(1);

        // Critical milestone (always shown)
        LOG._logCritical('success', '\uD83C\uDFAE', '=== Game Ready! ===');
        LOG._logCritical('info', '\u23F1', 'Boot time: ' + bootSec + 's (' + bootMs + 'ms)');
        LOG._logCritical('info', '\uD83D\uDCCA', 'Total ExternalInterface calls: ' + _state.callCount);
        LOG._logCritical('info', '\uD83D\uDCCC', 'Registered callbacks: ' + Object.keys(_callbacks).length);

        // Performance report (debug mode only, unless notable)
        var perfReport = _perfReport();
        if (perfReport && _debug) {
            LOG._logCritical('info', '\u26A1', 'Handler performance:\n' + perfReport);
        }

        // Track analytics events
        var analytics = _getEngine('analytics');
        if (analytics) {
            analytics.track(1, { source: 'bridge_v4_gameReady' }); // EnterGame
            analytics.track(2, { success: true });                   // EnterGameFalse (success)
        }

        // FB Pixel
        var fbPixel = _getEngine('fbPixel');
        if (fbPixel) {
            fbPixel.track('track', 'GameStarted');
        }

        // Google Ads
        var googleAds = _getEngine('googleAds');
        if (googleAds) {
            googleAds.event('config', 'AW-727890639');
        }

        // Record ready time
        _lsSet('dbz_sdk_game_ready_time', new Date().toISOString());
        _lsSet('dbz_sdk_boot_time_ms', bootMs);

        // Cleanup: clear all intervals
        for (var key in _checkIntervals) {
            if (_checkIntervals.hasOwnProperty(key)) {
                clearInterval(_checkIntervals[key]);
            }
        }
        _checkIntervals = {};
    }


    // ============================================================
    // SECTION 26: HANDLER - reportPayResult (Payment Result)
    // ============================================================
    // Message: JSON with status field ("success" or other)
    // Tracks to analytics, FB Pixel (Purchase), and stores txns.
    // ============================================================
    function _handleReportPayResult(message) {
        LOG.info('\uD83D\uDCB3 reportPayResult');

        var data = _safeParse(message);
        if (!data) {
            LOG.warn('No data in reportPayResult');
            return;
        }
        if (_debug) LOG.data('Pay Result:', data);

        var analytics = _getEngine('analytics');
        if (analytics) {
            analytics.track(data.status === 'success' ? 7 : 'PaymentFailed', data);
        }

        var fbPixel = _getEngine('fbPixel');
        if (fbPixel && data.status === 'success') {
            fbPixel.track('track', 'Purchase', {
                content_name: data.goodsName || '',
                value: data.amount || 0,
                currency: data.currency || 'USD'
            });
        }

        // Store transaction (ES5 compatible)
        var txns = _lsGet('dbz_sdk_payment_transactions', []);
        if (!Array.isArray(txns)) txns = [];
        var txnRecord = {};
        if (data && typeof data === 'object') {
            var keys = Object.keys(data);
            for (var k = 0; k < keys.length; k++) {
                txnRecord[keys[k]] = data[keys[k]];
            }
        }
        txnRecord.timestamp = new Date().toISOString();
        txnRecord.source = 'reportPayResult';
        txns.push(txnRecord);
        if (txns.length > 100) txns = txns.slice(-100);
        _lsSet('dbz_sdk_payment_transactions', txns);
    }


    // ============================================================
    // SECTION 27: HANDLER - Unknown fallback
    // ============================================================
    // Safe handler for unrecognized ExternalInterface calls.
    // Checks if a callback was registered for the name.
    // Records unknown calls to localStorage for debugging.
    // ============================================================
    function _handleUnknown(name, message) {
        LOG.warn('\u2753 Unknown call: "' + name + '"');
        if (message && _debug) LOG.data('Message:', message);

        if (_callbacks[name]) {
            LOG.info('Found registered callback for "' + name + '", triggering...');
            _triggerCallback(name, message);
        } else {
            LOG.info('No callback registered, safely ignored');

            var unknowns = _lsGet('dbz_sdk_unknown_calls', []);
            if (!Array.isArray(unknowns)) unknowns = [];
            unknowns.push({
                name: name,
                message: (typeof message === 'string') ? message.substring(0, 200) : String(message || ''),
                timestamp: new Date().toISOString()
            });
            if (unknowns.length > 50) unknowns = unknowns.slice(-50);
            _lsSet('dbz_sdk_unknown_calls', unknowns);
        }
    }


    // ============================================================
    // SECTION 28: GAME FUNCTION PATCHING
    // ============================================================
    // After the game loads, the global `ts` object becomes
    // available. We need to patch certain game functions to
    // work in standalone mode without a backend server.
    //
    // PATCH 1: ts.saveLanguage()
    //   Original: calls processHandlerWithLogin -> login server -> fails
    //   Fixed: calls window.changeLanguage directly -> saves + reloads
    //
    // PATCH 2: ts.processHandlerWithLogin()
    //   Intercept SaveLanguage requests, handle locally.
    //   Other requests pass through to original handler.
    //
    // Patches applied via setInterval polling (200ms) with
    // 30-second safety timeout.
    // ============================================================

    var _tsPatchInterval = setInterval(function() {
        if (typeof ts !== 'undefined' && ts.saveLanguage && typeof ts.saveLanguage === 'function') {
            clearInterval(_tsPatchInterval);
            _patchGameFunctions();
        }
    }, 200);

    // Safety timeout
    setTimeout(function() {
        clearInterval(_tsPatchInterval);
    }, 30000);

    function _patchGameFunctions() {
        LOG.info('Patching game functions for standalone mode...');

        // ---- PATCH: ts.saveLanguage ----
        if (typeof ts.saveLanguage === 'function') {
            ts.saveLanguage = function(langCode) {
                LOG.info('\uD83C\uDF10 ts.saveLanguage("' + langCode + '") \u2192 standalone patch');
                if (langCode) ts.language = langCode;
                if (typeof window.changeLanguage === 'function') {
                    window.changeLanguage(langCode);
                } else {
                    LOG.error('window.changeLanguage not available for ts.saveLanguage patch!');
                }
            };
            LOG.success('ts.saveLanguage patched');
        }

        // ---- PATCH: ts.processHandlerWithLogin ----
        if (typeof ts.processHandlerWithLogin === 'function') {
            var _origPHL = ts.processHandlerWithLogin;
            ts.processHandlerWithLogin = function(data, needLogin, successCb, errorCb) {
                if (data && data.action === 'SaveLanguage') {
                    LOG.info('\uD83C\uDF10 processHandlerWithLogin: SaveLanguage intercepted');
                    if (data.language) ts.language = data.language;
                    if (typeof successCb === 'function') {
                        successCb({ language: data.language });
                    }
                    return;
                }
                _origPHL.call(ts, data, needLogin, successCb, errorCb);
            };
            LOG.success('ts.processHandlerWithLogin patched');
        }

        LOG.success('All game patches applied');
    }


    // ============================================================
    // SECTION 29: ERROR MONITORING - Comprehensive
    // ============================================================
    // Monitor ALL console methods (log, warn, error) for game
    // error patterns. The Egret engine uses console.log for
    // Error 1001 (file load failures), not console.error.
    //
    // Detected patterns:
    //   - Error 1001: file load failure (resource missing)
    //   - Error 1002: ResourceManager init failure
    //   - General "Error:" prefix from game engine
    //   - Exception traces from unhandled errors
    //
    // All detected errors stored in _detectedErrors for summary.
    // ============================================================
    var _detectedErrors = [];   // { type, message, timestamp, source }
    var _errorPatterns = [
        { regex: /1001[:\s]/, type: 'E1001', desc: 'Resource file load failure' },
        { regex: /1002[:\s]/, type: 'E1002', desc: 'ResourceManager init failure' },
        { regex: /^Error:\s/i, type: 'ENGINE', desc: 'Game engine error' },
        { regex: /uncaught|unhandled/i, type: 'EXCEPTION', desc: 'Uncaught exception' },
        { regex: /TypeError|ReferenceError|SyntaxError/i, type: 'JS_ERROR', desc: 'JavaScript error' }
    ];

    // Guard: prevent recursion when our own LOG output triggers the intercept
    var _isChecking = false;

    function _checkForError(msg, source) {
        if (_isChecking) return false;
        // Skip our own SDK/BRIDGE log messages (contain our prefixes)
        if (msg.indexOf('[BRIDGE]') !== -1 || msg.indexOf('[SDK]') !== -1) return false;
        _isChecking = true;
        try {
        for (var i = 0; i < _errorPatterns.length; i++) {
            var p = _errorPatterns[i];
            if (p.regex.test(msg)) {
                var entry = {
                    type: p.type,
                    desc: p.desc,
                    message: msg,
                    source: source,
                    timestamp: new Date().toISOString()
                };
                _detectedErrors.push(entry);

                // Always show error detection (visible even in compact mode)
                LOG._logCritical('error', '\u274C', '[' + p.type + '] ' + p.desc);
                LOG._logCritical('error', '   ', msg);

                // For 1001/1002: show actionable help
                if (p.type === 'E1001' || p.type === 'E1002') {
                    var loginServer = (window.LOCAL_SDK && window.LOCAL_SDK.config)
                        ? window.LOCAL_SDK.config.loginServer : 'unknown';
                    LOG._logCritical('warn', '\uD83D\uDCD6', 'Server: ' + loginServer + ' \u2192 check if resource files exist');
                    LOG._logCritical('warn', '\uD83D\uDCD6', 'DevTools > Network tab to inspect failed requests');
                }

                return true;
            }
        }
        return false;
        } finally { _isChecking = false; }
    }

    // Error summary: prints all detected errors grouped by type
    function _printErrorSummary() {
        if (_detectedErrors.length === 0) return;

        // Deduplicate by message
        var seen = {};
        var unique = [];
        for (var i = 0; i < _detectedErrors.length; i++) {
            var key = _detectedErrors[i].type + ':' + _detectedErrors[i].message;
            if (!seen[key]) {
                seen[key] = true;
                unique.push(_detectedErrors[i]);
            }
        }

        console.log(
            '%c\u26A0\uFE0F [BRIDGE] Error Summary: ' + unique.length + ' unique error(s) detected',
            'background:#ef4444;color:#fff;padding:4px 10px;border-radius:4px;font-weight:bold;font-size:13px;'
        );
        for (var j = 0; j < unique.length; j++) {
            var e = unique[j];
            console.log(
                '%c  [' + e.type + '] ' + e.desc + '%c  ' + e.message,
                'color:#fca5a5;font-weight:bold;', 'color:#fecaca;'
            );
        }
    }

    // Intercept console.error
    var _origConsoleError = console.error;
    console.error = function() {
        for (var i = 0; i < arguments.length; i++) {
            var msg = '';
            try { msg = String(arguments[i]); } catch (e) { continue; }
            _checkForError(msg, 'console.error');
        }
        _origConsoleError.apply(console, arguments);
    };

    // Intercept console.log for Egret engine errors (1001 uses console.log)
    var _origConsoleLog = console.log;
    console.log = function() {
        for (var i = 0; i < arguments.length; i++) {
            var msg = '';
            try { msg = String(arguments[i]); } catch (e) { continue; }
            _checkForError(msg, 'console.log');
        }
        _origConsoleLog.apply(console, arguments);
    };

    // Intercept console.warn
    var _origConsoleWarn = console.warn;
    console.warn = function() {
        for (var i = 0; i < arguments.length; i++) {
            var msg = '';
            try { msg = String(arguments[i]); } catch (e) { continue; }
            _checkForError(msg, 'console.warn');
        }
        _origConsoleWarn.apply(console, arguments);
    };

    // Expose error summary for debug console
    window.BRIDGE_ERROR_SUMMARY = function() { _printErrorSummary(); };

    // Auto-print error summary after 5 seconds (gives game time to load)
    setTimeout(function() {
        _printErrorSummary();
        // Also schedule another check at 15s for late errors
        setTimeout(_printErrorSummary, 10000);
    }, 5000);


    // ============================================================
    // BRIDGE READY SUMMARY
    // ============================================================
    _state.initialized = true;

    LOG._logCritical('success', '\u2705', '=== Bridge v4.0.0 Ready ===');
    LOG.info('egret.ExternalInterface.call overridden');
    LOG.info('egret.ExternalInterface.addCallback overridden');
    LOG.info('Error 1001 monitoring active');
    LOG.info('Game function patching scheduled');
    LOG.info('');
    LOG.info('16 active handlers:');
    LOG.info('  \uD83C\uDFAE startGame       - Bootstrap handshake');
    LOG.info('  \uD83D\uDD04 refresh          - Reload / Switch User');
    LOG.info('  \uD83D\uDCCB changeView       - View change notification');
    LOG.info('  \uD83D\uDCB0 pei              - Payment engine');
    LOG.info('  \uD83D\uDC4D giveLike         - Social share');
    LOG.info('  \uD83D\uDCDE contact          - Contact center');
    LOG.info('  \uD83D\uDD04 switchAccount    - Account switching');
    LOG.info('  \uD83D\uDC4D fbGiveLive       - FB Live giveaway');
    LOG.info('  \uD83D\uDC64 userCenter       - User center');
    LOG.info('  \uD83C\uDF81 gifBag           - Gift bag system');
    LOG.info('  \uD83D\uDCCA report2Third     - Analytics reporting');
    LOG.info('  \uD83D\uDCC8 report2Sdk       - SDK reporting');
    LOG.info('  \uD83C\uDF10 changeLanguage   - Language switching');
    LOG.info('  \uD83D\uDD17 openURL          - URL opening');
    LOG.info('  \uD83C\uDFAE gameReady        - Game ready signal');
    LOG.info('  \uD83D\uDCB3 reportPayResult  - Payment result callback');
    LOG.info('');
    LOG.info('Waiting for addCallback("startGame") from index.html...');
    LOG.info('Debug mode: ' + (_debug ? 'VERBOSE' : 'COMPACT') + ' (set window.__SDK_DEBUG__ = true for verbose)');


    // ============================================================
    // DEBUG INTERFACE
    // ============================================================
    // Exposed on window as BRIDGE_DEBUG for console diagnostics.
    // All methods are safe to call at any time.
    // ============================================================
    window.BRIDGE_DEBUG = {
        VERSION: '4.0.0',

        state: function() { return _state; },
        callbacks: function() { return Object.keys(_callbacks); },
        pending: function() { return Object.keys(_pendingCalls); },
        perf: function() { return _perfTimers; },

        logState: function() {
            var unknowns = _lsGet('dbz_sdk_unknown_calls', []);
            var bootMs = _state.gameReadyTriggered
                ? (_lsGet('dbz_sdk_boot_time_ms', 0))
                : (Date.now() - _state.startTime);

            console.log('%c\uD83C\uDFAE [BRIDGE] Full State:', 'font-weight:bold;color:#667eea;', {
                version: '4.0.0',
                initialized: _state.initialized,
                startGameTriggered: _state.startGameTriggered,
                startGameCompleted: _state.startGameCompleted,
                gameReadyTriggered: _state.gameReadyTriggered,
                totalCallbacks: _state.callbackCount,
                totalCalls: _state.callCount,
                uptime: (bootMs / 1000).toFixed(1) + 's',
                registeredCallbacks: Object.keys(_callbacks),
                pendingCalls: Object.keys(_pendingCalls),
                perfTimers: _perfTimers,
                unknownCallsCount: Array.isArray(unknowns) ? unknowns.length : 0
            });
        },

        retryStartGame: function() {
            _state.startGameTriggered = false;
            _state.startGameCompleted = false;
            LOG.info('startGame state reset. Call: egret.ExternalInterface.call("startGame", "retry")');
        },

        listCallbacks: function() {
            var keys = Object.keys(_callbacks);
            console.log('%c\uD83C\uDFAE [BRIDGE] Registered Callbacks (' + keys.length + '):',
                'font-weight:bold;color:#667eea;');
            for (var i = 0; i < keys.length; i++) {
                var cb = _callbacks[keys[i]];
                console.log('  "' + keys[i] + '" [ID:' + cb.id + '] @ ' + cb.registeredAt);
            }
        },

        listUnknownCalls: function() {
            var unknowns = _lsGet('dbz_sdk_unknown_calls', []);
            if (!Array.isArray(unknowns)) unknowns = [];
            console.log('%c\uD83C\uDFAE [BRIDGE] Unknown Calls (' + unknowns.length + '):',
                'font-weight:bold;color:#f59e0b;');
            for (var i = 0; i < unknowns.length; i++) {
                console.warn('  "' + unknowns[i].name + '" @ ' + unknowns[i].timestamp,
                    unknowns[i].message);
            }
        },

        showTiming: function() {
            console.log('%c\uD83C\uDFAE [BRIDGE] Handler Timing:', 'font-weight:bold;color:#667eea;');
            console.log(_perfReport());
        }
    };

})();
