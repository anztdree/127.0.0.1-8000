/**
 * ============================================================
 * BRIDGE.JS - DragonBall HTML5 Standalone Bridge v3.0.0
 * ============================================================
 * 
 * Purpose: Override egret.ExternalInterface untuk komunikasi
 * antara game dan SDK lokal tanpa native wrapper.
 * 
 * Load Order: #2 - AFTER egret.web.min.js, BEFORE game scripts
 * 
 * IMPORTANT: The game does NOT call egret.ExternalInterface directly.
 * Instead, index.html's second script block defines functions that
 * wrap egret.ExternalInterface.call(). Bridge.js intercepts those calls.
 * main.min.js uses TSBrowser.executeFunction() which calls window[func].
 * 
 * Changelog v3.0.0:
 *   + Matched with SDK v3.0.0
 *   + startGameCompleted state tracking
 *   + Safe JSON parse helper
 *   + All ExternalInterface call types handled
 *   + Proper pending call resolution with safety timeout
 * 
 * Author: Local SDK Bridge
 * Version: 3.0.0
 * ============================================================
 */

(function() {
    'use strict';

    // ========================================================
    // 1. STYLISH LOGGER
    // ========================================================
    var LOG = {
        prefix: '\uD83C\uDFAE [BRIDGE]',
        styles: {
            title: 'background: linear-gradient(90deg, #667eea 0%, #764ba2 100%); color: white; padding: 2px 8px; border-radius: 4px; font-weight: bold;',
            success: 'color: #10b981; font-weight: bold;',
            info: 'color: #3b82f6;',
            warn: 'color: #f59e0b; font-weight: bold;',
            error: 'color: #ef4444; font-weight: bold;',
            data: 'color: #8b5cf6;',
            separator: 'color: #6b7280;'
        },
        _formatTime: function() {
            return new Date().toISOString().substr(11, 12);
        },
        _log: function(level, icon, message, data) {
            var timestamp = this._formatTime();
            var style = this.styles[level] || this.styles.info;
            var format = '%c' + this.prefix + ' %c[' + timestamp + '] ' + icon + ' ' + message;
            if (data !== undefined) {
                console.log(format, this.styles.title, style, data);
            } else {
                console.log(format, this.styles.title, style);
            }
        },
        title: function(message) {
            var line = '\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550';
            console.log('%c' + this.prefix + '%c ' + line, this.styles.title, this.styles.separator);
            console.log('%c' + this.prefix + '%c ' + message, this.styles.title, this.styles.title);
            console.log('%c' + this.prefix + '%c ' + line, this.styles.title, this.styles.separator);
        },
        success: function(msg, d) { this._log('success', '\u2705', msg, d); },
        info: function(msg, d) { this._log('info', '\u2139\uFE0F', msg, d); },
        warn: function(msg, d) { this._log('warn', '\u26A0\uFE0F', msg, d); },
        error: function(msg, d) { this._log('error', '\u274C', msg, d); },
        data: function(msg, d) { this._log('data', '\uD83D\uDCE6', msg, d); },
        call: function(n, m) { this._log('info', '\uD83D\uDCDE', 'call("' + n + '", "' + (m || '') + '")'); },
        separator: function() {
            console.log('%c' + this.prefix + '%c \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500', this.styles.title, this.styles.separator);
        }
    };

    // ========================================================
    // 2. CALLBACK STORAGE & STATE
    // ========================================================
    var _callbacks = {};
    var _pendingCalls = {};
    var _state = {
        initialized: false,
        startGameTriggered: false,
        startGameCompleted: false,
        callbackCount: 0,
        callCount: 0
    };

    // ========================================================
    // 3. CHECK EGRET AVAILABILITY
    // ========================================================
    if (typeof egret === 'undefined') {
        console.error('[BRIDGE] FATAL: egret object not found! Load bridge.js AFTER egret.web.min.js');
        return;
    }
    if (!egret.ExternalInterface) {
        console.error('[BRIDGE] FATAL: egret.ExternalInterface not found!');
        return;
    }

    // ========================================================
    // 4. STORE ORIGINAL REFERENCES
    // ========================================================
    var _originalCall = egret.ExternalInterface.call;
    var _originalAddCallback = egret.ExternalInterface.addCallback;

    LOG.title('Bridge v3.0.0 Initializing...');

    // ========================================================
    // 5. OVERRIDE addCallback
    // ========================================================
    egret.ExternalInterface.addCallback = function(name, callback) {
        _state.callbackCount++;
        var callbackId = _state.callbackCount;
        LOG.info('addCallback("' + name + '") [ID: ' + callbackId + ']');

        if (typeof callback !== 'function') {
            LOG.error('Callback is not a function!', typeof callback);
            return;
        }

        _callbacks[name] = {
            fn: callback,
            id: callbackId,
            registeredAt: new Date().toISOString()
        };

        LOG.success('Callback registered: "' + name + '" [Total: ' + Object.keys(_callbacks).length + ']');

        // Check if there's a pending call waiting for this callback
        if (_pendingCalls[name]) {
            LOG.info('Found pending call for "' + name + '", triggering now...');
            var pendingData = _pendingCalls[name].message;
            delete _pendingCalls[name];
            setTimeout(function() {
                _triggerCallback(name, pendingData);
            }, 50);
        }
    };

    // ========================================================
    // 6. HELPER: Trigger Callback
    // ========================================================
    function _triggerCallback(name, message) {
        var callbackObj = _callbacks[name];
        if (!callbackObj) {
            LOG.error('No callback registered for: "' + name + '"');
            return false;
        }
        var callback = callbackObj.fn;
        if (typeof callback !== 'function') {
            LOG.error('Callback for "' + name + '" is not a function!');
            return false;
        }
        try {
            LOG.info('Triggering callback: ' + name);
            callback(message);
            return true;
        } catch (e) {
            LOG.error('Error executing callback "' + name + '":', e);
            console.error(e);
            return false;
        }
    }

    // ========================================================
    // 7. HELPER: Get SDK Data
    // ========================================================
    function _getSDKData() {
        if (typeof window.LOCAL_SDK === 'undefined') {
            LOG.error('window.LOCAL_SDK not found!');
            return null;
        }
        if (typeof window.LOCAL_SDK.getStartGameData !== 'function') {
            LOG.error('window.LOCAL_SDK.getStartGameData is not a function!');
            return null;
        }
        return window.LOCAL_SDK.getStartGameData();
    }

    // ========================================================
    // 8. HELPER: Safe JSON parse
    // ========================================================
    function _safeParse(message) {
        if (!message) return null;
        try {
            return JSON.parse(message);
        } catch (e) {
            LOG.error('Failed to parse JSON:', e);
            return null;
        }
    }

    // ========================================================
    // 9. OVERRIDE call - Main Handler
    // ========================================================
    egret.ExternalInterface.call = function(name, message) {
        _state.callCount++;
        LOG.call(name, message);

        switch (name) {

            // ================================================
            // startGame - THE MOST CRITICAL
            // index.html line 159: egret.ExternalInterface.call("startGame", "get Sdk Channel")
            // index.html line 116: egret.ExternalInterface.addCallback("startGame", function(msg){...})
            // The callback parses SDK data and calls egret.runEgret()
            // ================================================
            case 'startGame':
                _handleStartGame(message);
                break;

            // ================================================
            // refresh - Page Reload / User Switch
            // index.html line 113: addCallback("refresh", function(msg){ window.location.reload() })
            // index.html line 102: refreshPage calls ExternalInterface.call("refresh", "refresh")
            // index.html line 194: switchUser calls ExternalInterface.call("refresh", "switch usr")
            // ================================================
            case 'refresh':
                _handleRefresh(message);
                break;

            // ================================================
            // changeView - View Change Notification
            // index.html line 169: checkSDK calls ExternalInterface.call("changeView", "change view")
            // No callback needed - just a notification
            // ================================================
            case 'changeView':
                LOG.info('changeView: "' + message + '"');
                break;

            // ================================================
            // pei - Payment
            // index.html line 192: paySdk calls ExternalInterface.call("pei", JSON.stringify(data))
            // ================================================
            case 'pei':
                _handlePayment(message);
                break;

            // ================================================
            // giveLike - Facebook Share/Like
            // index.html line 199: giveLikeSdk calls ExternalInterface.call("giveLike", ...)
            // ================================================
            case 'giveLike':
                LOG.info('giveLike (Share) - bypassed');
                break;

            // ================================================
            // contact - Customer Service
            // index.html line 203: contactSdk calls ExternalInterface.call("contact", "contact")
            // ================================================
            case 'contact':
                LOG.info('contact (Customer Service) - bypassed');
                break;

            // ================================================
            // switchAccount - Account Switch
            // index.html line 208: switchAccountSdk calls ExternalInterface.call("switchAccount", ...)
            // ================================================
            case 'switchAccount':
                LOG.info('switchAccount called');
                if (typeof window.switchUser === 'function') {
                    window.switchUser();
                }
                break;

            // ================================================
            // fbGiveLive - Facebook Like
            // index.html line 213: fbGiveLiveSdk calls ExternalInterface.call("fbGiveLive", ...)
            // ================================================
            case 'fbGiveLive':
                LOG.info('fbGiveLive - bypassed');
                break;

            // ================================================
            // userCenter - User Center
            // index.html line 218: userCenterSdk calls ExternalInterface.call("userCenter", ...)
            // ================================================
            case 'userCenter':
                LOG.info('userCenter - bypassed');
                break;

            // ================================================
            // gifBag - Gift Bag
            // index.html line 222: gifBagSdk calls ExternalInterface.call("gifBag", ...)
            // ================================================
            case 'gifBag':
                LOG.info('gifBag - bypassed');
                break;

            // ================================================
            // report2Third - Analytics Report
            // index.html line 215: report2Sdk calls ExternalInterface.call("report2Third", ...)
            // ================================================
            case 'report2Third':
                LOG.info('report2Third (Analytics) - logged');
                break;

            // ================================================
            // changeLanguage - Language Change
            // index.html line 268: changeLanguage calls ExternalInterface.call("changeLanguage", lang)
            // ================================================
            case 'changeLanguage':
                LOG.info('changeLanguage: "' + message + '"');
                if (window.LOCAL_SDK && window.LOCAL_SDK.setLanguage) {
                    window.LOCAL_SDK.setLanguage(message);
                }
                if (_callbacks['changeLanguage']) {
                    _triggerCallback('changeLanguage', message);
                }
                break;

            // ================================================
            // openURL - Open External URL
            // index.html line 272: openURL calls ExternalInterface.call("openURL", url)
            // index.html line 276: open calls ExternalInterface.call("openURL", url)
            // ================================================
            case 'openURL':
                if (message) {
                    LOG.info('openURL: "' + message + '"');
                    try { window.open(message, '_blank'); } catch(e) {}
                }
                break;

            // ================================================
            // Unknown Handler
            // ================================================
            default:
                LOG.warn('Unknown call: "' + name + '"');
        }

        LOG.separator();
    };

    // ========================================================
    // 10. HANDLER: startGame
    // ========================================================
    function _handleStartGame(message) {
        LOG.info('startGame called - Game requesting SDK data...');

        if (_state.startGameTriggered) {
            LOG.warn('startGame already triggered! Skipping duplicate.');
            return;
        }
        _state.startGameTriggered = true;

        var startGameData = _getSDKData();
        if (!startGameData) {
            LOG.error('Failed to get startGame data from SDK!');
            return;
        }

        LOG.data('StartGame Data:', startGameData);

        // Verify versionConfig is NOT double-stringified
        if (typeof startGameData.versionConfig === 'string') {
            LOG.error('versionConfig is a STRING! This should be an object. Attempting to fix...');
            try {
                startGameData.versionConfig = JSON.parse(startGameData.versionConfig);
            } catch(e) {
                startGameData.versionConfig = {};
            }
        }

        var responseJson = JSON.stringify(startGameData);

        if (_callbacks['startGame']) {
            // Callback already registered - schedule response
            LOG.info('Callback already registered, scheduling response...');
            setTimeout(function() {
                _triggerCallback('startGame', responseJson);
                _state.startGameCompleted = true;
                LOG.success('Game should start now!');
            }, 50);
        } else {
            // Callback not registered yet - store as pending
            LOG.info('Callback not registered yet, storing as pending...');
            _pendingCalls['startGame'] = {
                message: responseJson,
                timestamp: new Date().toISOString()
            };

            // Safety timeout - wait for callback to register
            var checkInterval = setInterval(function() {
                if (_callbacks['startGame']) {
                    clearInterval(checkInterval);
                    if (_pendingCalls['startGame']) {
                        LOG.info('Callback now registered, triggering...');
                        var data = _pendingCalls['startGame'].message;
                        delete _pendingCalls['startGame'];
                        setTimeout(function() {
                            _triggerCallback('startGame', data);
                            _state.startGameCompleted = true;
                            LOG.success('Game should start now!');
                        }, 50);
                    }
                }
            }, 50);

            // Hard timeout after 10 seconds
            setTimeout(function() {
                clearInterval(checkInterval);
                if (_pendingCalls['startGame']) {
                    delete _pendingCalls['startGame'];
                    LOG.error('Timeout: startGame callback was never registered!');
                }
            }, 10000);
        }
    }

    // ========================================================
    // 11. HANDLER: refresh
    // ========================================================
    function _handleRefresh(message) {
        LOG.info('refresh called: "' + message + '"');

        if (message === 'refresh' || message === 'reload game') {
            // Trigger callback if registered
            if (_callbacks['refresh']) {
                _triggerCallback('refresh', message);
            }
            // Schedule reload (callback might do it first)
            setTimeout(function() {
                window.location.reload();
            }, 200);
        } else if (message === 'switch usr') {
            if (typeof window.switchUser === 'function') {
                window.switchUser();
            } else {
                window.location.reload();
            }
        } else {
            window.location.reload();
        }
    }

    // ========================================================
    // 12. HANDLER: Payment
    // ========================================================
    function _handlePayment(message) {
        LOG.info('pei (Payment) called');
        var paymentData = _safeParse(message);
        if (paymentData) {
            LOG.data('Payment Data:', paymentData);
        }
        LOG.warn('Standalone mode - Payment bypassed');
    }

    // ========================================================
    // 13. MARK INITIALIZED
    // ========================================================
    _state.initialized = true;

    LOG.title('Bridge v3.0.0 Initialized');
    LOG.success('egret.ExternalInterface.call -> Custom handler');
    LOG.success('egret.ExternalInterface.addCallback -> Custom handler');
    LOG.info('Handlers: startGame, refresh, changeView, changeLanguage');
    LOG.info('Handlers: pei, giveLike, contact, switchAccount');
    LOG.info('Handlers: fbGiveLive, userCenter, gifBag, report2Third, openURL');
    LOG.info('Ready!');

    // ========================================================
    // 14. EXPOSE DEBUG INFO
    // ========================================================
    window.BRIDGE_DEBUG = {
        state: _state,
        callbacks: _callbacks,
        pendingCalls: _pendingCalls,
        triggerCallback: _triggerCallback,
        getSDKData: _getSDKData,
        logState: function() {
            console.log('[BRIDGE] State:', {
                initialized: _state.initialized,
                startGameTriggered: _state.startGameTriggered,
                startGameCompleted: _state.startGameCompleted,
                callbackCount: _state.callbackCount,
                callCount: _state.callCount,
                registeredCallbacks: Object.keys(_callbacks),
                pendingCalls: Object.keys(_pendingCalls)
            });
        }
    };

})();
