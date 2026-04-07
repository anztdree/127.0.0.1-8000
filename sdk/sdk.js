/**
 * ============================================================
 * SDK.JS v4.0.0 - DragonBall Z: Super Warrior (超级战士Z)
 * Standalone HTML5 SDK Engine
 * ============================================================
 *
 * Purpose: Complete standalone SDK implementation for the Egret
 * engine game running without a native wrapper. Provides ALL
 * window functions and properties the game expects via TSBrowser
 * and direct window.* access.
 *
 * ARCHITECTURE v4.0:
 *   18 well-defined sections, each with clear responsibility.
 *   - Professional debug logger with compact/verbose modes
 *   - Storage engine with dbz_sdk_ namespace
 *   - All window functions defined BEFORE IIFE closes (loaded in <head>)
 *   - getQueryStringByName with URL → saved → SDK config fallback chain
 *   - LOCAL_SDK public API for bridge.js and debug console
 *   - Analytics (30 ReportDataType), FB Pixel, Google Ads, Twitter Pixel
 *   - Payment, GiftBag, Contact, UserCenter, Account, Social engines
 *   - UI overlay system with Dragon Ball theming
 *
 * CRITICAL GAME FLOW:
 *   1. sdk.js loads (in <head>), defines all window.* functions
 *   2. Game calls getQueryStringByName("language") → gets saved/URL lang
 *   3. bridge.js overrides egret.ExternalInterface.call/addCallback
 *   4. index.html calls ExternalInterface.call("startGame")
 *   5. bridge responds with LOCAL_SDK.getStartGameData() JSON
 *   6. index.html parses JSON, sets window vars, calls runEgret()
 *   7. Game loads and calls various window.* functions
 *
 * Load Order: #1 - FIRST in <head>, BEFORE everything else
 *
 * Author: Local SDK Bridge
 * Version: 4.0.0
 * ============================================================
 */

(function(window) {
    'use strict';

    // ============================================================
    // SECTION 1: PROFESSIONAL DEBUG LOGGER
    // ============================================================
    // Toggle: window.__SDK_DEBUG__ = true (verbose)
    //        window.__SDK_DEBUG__ = false (compact, errors only)
    //
    // Compact mode (default, __SDK_DEBUG__ falsy):
    //   - Only shows error and warn messages
    //   - Suppresses info, success, data, call, ui messages
    //
    // Verbose mode (__SDK_DEBUG__ = true):
    //   - Shows all messages with color-coded severity
    //   - Groups console output by category
    //   - Includes timestamps in HH:MM:SS.mmm format
    //   - Shows detailed data objects

    var LOG = {
        _debugMode: false,
        _compactMode: true,
        _logCounts: { error: 0, warn: 0, info: 0, success: 0, data: 0, call: 0, ui: 0 },

        _styles: {
            title: 'background:linear-gradient(90deg,#059669 0%,#10b981 100%);color:#fff;padding:2px 8px;border-radius:4px;font-weight:bold;',
            error: 'color:#ef4444;font-weight:bold;',
            warn: 'color:#f59e0b;font-weight:bold;',
            info: 'color:#6b7280;',
            success: 'color:#10b981;font-weight:bold;',
            data: 'color:#8b5cf6;',
            call: 'color:#0ea5e9;font-weight:bold;',
            ui: 'color:#ec4899;font-weight:bold;',
            separator: 'color:#4b5563;'
        },

        // HH:MM:SS.mmm timestamp format
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

        _updateMode: function() {
            this._debugMode = !!window.__SDK_DEBUG__;
            this._compactMode = !this._debugMode;
        },

        _log: function(level, icon, message, data) {
            // Always count
            this._logCounts[level] = (this._logCounts[level] || 0) + 1;
            this._updateMode();

            // In compact mode, only show errors and warnings
            if (this._compactMode && level !== 'error' && level !== 'warn') {
                return;
            }

            var ts = this._timestamp();
            var style = this._styles[level] || this._styles.info;
            var prefix = '\uD83D\uDCE6 [SDK]';
            var fmt = '%c' + prefix + ' %c[' + ts + '] ' + icon + ' ' + message;

            if (data !== undefined && this._debugMode) {
                console.log(fmt, this._styles.title, style, data);
            } else {
                console.log(fmt, this._styles.title, style);
            }
        },

        title: function(message) {
            this._updateMode();
            if (this._compactMode) return;
            var line = '\u2500'.repeat(60);
            var prefix = '\uD83D\uDCE6 [SDK]';
            console.log('%c' + prefix + '%c ' + line, this._styles.title, this._styles.separator);
            console.log('%c' + prefix + '%c ' + message, this._styles.title, this._styles.title);
            console.log('%c' + prefix + '%c ' + line, this._styles.title, this._styles.separator);
        },

        success: function(message, data) { this._log('success', '\u2705', message, data); },
        info: function(message, data) { this._log('info', '\u2139\uFE0F', message, data); },
        warn: function(message, data) { this._log('warn', '\u26A0\uFE0F', message, data); },
        error: function(message, data) { this._log('error', '\u274C', message, data); },
        data: function(message, data) { this._log('data', '\uD83D\uDCCA', message, data); },
        call: function(message, data) { this._log('call', '\uD83D\uDCDE', message, data); },
        ui: function(message, data) { this._log('ui', '\uD83D\uDD39', message, data); },

        // Get log counts for diagnostics
        getCounts: function() {
            return {
                error: this._logCounts.error,
                warn: this._logCounts.warn,
                info: this._logCounts.info,
                success: this._logCounts.success,
                data: this._logCounts.data,
                call: this._logCounts.call,
                ui: this._logCounts.ui
            };
        }
    };


    // ============================================================
    // SECTION 2: STORAGE ENGINE
    // ============================================================
    // Persistent localStorage with dbz_sdk_ prefix namespace.
    // JSON serialize/deserialize all values automatically.
    // In-memory cache for frequently accessed keys.
    //
    // Key mapping:
    //   Storage.get('language')   → localStorage['dbz_sdk_language']
    //   Storage.get('user')       → localStorage['dbz_sdk_user']
    //   Storage.get('analytics_events') → localStorage['dbz_sdk_analytics_events']
    //
    // NOTE: bridge.js writes language as:
    //   localStorage.setItem('dbz_sdk_language', JSON.stringify(langCode))
    // This matches our Storage._key('language') → 'dbz_sdk_language'

    var STORAGE_PREFIX = 'dbz_sdk_';

    var Storage = {
        _cache: {},

        _key: function(key) {
            return STORAGE_PREFIX + key;
        },

        get: function(key, defaultValue) {
            if (this._cache.hasOwnProperty(key)) {
                return this._cache[key];
            }
            try {
                var raw = localStorage.getItem(this._key(key));
                if (raw !== null) {
                    var val = JSON.parse(raw);
                    this._cache[key] = val;
                    return val;
                }
            } catch (e) {
                LOG.warn('Storage.get("' + key + '") parse error: ' + e.message);
            }
            return defaultValue !== undefined ? defaultValue : null;
        },

        set: function(key, value) {
            this._cache[key] = value;
            try {
                localStorage.setItem(this._key(key), JSON.stringify(value));
            } catch (e) {
                LOG.warn('Storage.set("' + key + '") failed: ' + e.message);
            }
        },

        remove: function(key) {
            delete this._cache[key];
            try {
                localStorage.removeItem(this._key(key));
            } catch (e) {}
        },

        push: function(key, item) {
            var arr = this.get(key, []);
            if (!Array.isArray(arr)) arr = [];
            arr.push(item);
            this.set(key, arr);
            return arr;
        },

        clear: function() {
            this._cache = {};
            try {
                var keysToRemove = [];
                for (var i = 0; i < localStorage.length; i++) {
                    var k = localStorage.key(i);
                    if (k && k.indexOf(STORAGE_PREFIX) === 0) {
                        keysToRemove.push(k);
                    }
                }
                for (var j = 0; j < keysToRemove.length; j++) {
                    localStorage.removeItem(keysToRemove[j]);
                }
            } catch (e) {}
        },

        keys: function() {
            var result = [];
            try {
                for (var i = 0; i < localStorage.length; i++) {
                    var k = localStorage.key(i);
                    if (k && k.indexOf(STORAGE_PREFIX) === 0) {
                        result.push(k.substring(STORAGE_PREFIX.length));
                    }
                }
            } catch (e) {}
            return result;
        }
    };


    // ============================================================
    // SECTION 3: CRITICAL WINDOW FUNCTION DEFINITIONS
    // ============================================================
    // These MUST be defined on window IMMEDIATELY because the game
    // calls them BEFORE startGame callback completes.
    //
    // The game's TSBrowser object works like this:
    //   TSBrowser.checkWindowFunction(name)  → checks window[name] exists && typeof === 'function'
    //   TSBrowser.executeFunction(name,...)   → calls window[name].apply(window, args)
    //   TSBrowser.getVariantValue(name)      → returns window[name]
    //
    // CRITICAL: getQueryStringByName("language") is called FIRST
    // to determine language, with fallback to window.debugLanguage.

    window.getQueryStringByName = function(name) {
        // Priority 1: URL query parameter (?name=value)
        try {
            var urlParams = new URLSearchParams(window.location.search);
            var val = urlParams.get(name);
            if (val !== null) {
                LOG.info('getQueryStringByName("' + name + '") → URL param: ' + val);
                return val;
            }
        } catch (e) {
            // Fallback regex for older browsers
            try {
                var match = window.location.search.match(new RegExp('[?&]' + name + '=([^&#]+)'));
                if (match && match[1]) {
                    var decoded = decodeURIComponent(match[1].replace(/\+/g, ' '));
                    LOG.info('getQueryStringByName("' + name + '") → URL param (regex): ' + decoded);
                    return decoded;
                }
            } catch (e2) {}
        }

        // Priority 2: SDK-stored values for specific params
        if (name === 'language') {
            var savedLang = Storage.get('language', null);
            if (savedLang && typeof savedLang === 'string' && savedLang.length >= 2) {
                LOG.info('getQueryStringByName("language") → saved: ' + savedLang);
                return savedLang;
            }
            // Return current SDK config language as last resort
            if (typeof SDK_CONFIG !== 'undefined' && SDK_CONFIG.language) {
                LOG.info('getQueryStringByName("language") → SDK config: ' + SDK_CONFIG.language);
                return SDK_CONFIG.language;
            }
            return 'en';
        }

        if (name === 'userid') {
            return userData ? userData.userId : null;
        }

        if (name === 'token') {
            return userData ? userData.token : null;
        }

        if (name === 'battleAudio') {
            if (typeof SDK_CONFIG !== 'undefined' && SDK_CONFIG.clientParams) {
                return SDK_CONFIG.clientParams.battleAudio ? 'true' : 'false';
            }
            return 'true';
        }

        if (name === 'pluginMiniGame') {
            return null;
        }

        // Priority 3: null (not found)
        return null;
    };

    // Facebook Pixel (fbq) - standard interface
    window.fbq = function() {
        var args = Array.prototype.slice.call(arguments);
        var action = args[0] || '';
        var eventName = args[1] || '';
        var params = args[2] || {};

        if (action === 'init') {
            // FB Pixel init with pixel ID
            FBPixel.pixelId = eventName;
            LOG.info('fbq init: ' + eventName);
            Storage.set('fb_pixel_id', eventName);
        } else {
            FBPixel.track(action, eventName, params);
        }
    };

    // Google Ads (gtag) - standard interface
    window.gtag = function() {
        var args = Array.prototype.slice.call(arguments);
        var type = args[0] || '';
        var eventName = args[1] || '';
        var params = args[2] || {};

        if (type === 'config') {
            LOG.info('gtag config: ' + eventName);
            Storage.set('gtag_config_id', eventName);
        } else if (type === 'js') {
            LOG.info('gtag js loaded');
        } else {
            GoogleAds.event(type, eventName, params);
        }
    };

    // PP Analytics - PointRocket reporting
    window.reportLogToPP = function(event, data) {
        LOG.call('reportLogToPP() \u2192 ' + event);
        var ppEvent = {
            event: event,
            data: data || {},
            userId: userData ? userData.userId : 'unknown',
            sessionId: _sessionId,
            timestamp: new Date().toISOString(),
            channel: SDK_CONFIG.thirdChannel,
            language: SDK_CONFIG.language,
            level: userData ? userData.level : 0,
            serverId: userData ? userData.serverId : 's1'
        };
        Storage.push('pp_analytics', ppEvent);
        Analytics.trackPP(event, data);
    };

    // Custom Event - generic event reporting
    window.sendCustomEvent = function(eventName, data) {
        LOG.call('sendCustomEvent() \u2192 ' + eventName);
        var customEvent = {
            eventName: eventName,
            data: data || {},
            userId: userData ? userData.userId : 'unknown',
            timestamp: new Date().toISOString(),
            sessionId: _sessionId
        };
        Storage.push('custom_events', customEvent);
        Analytics.trackCustom('CustomEvent_' + eventName, data);
    };

    // Account Login Callback - stores exit/back function
    window.accountLoginCallback = function(fn) {
        if (typeof fn === 'function') {
            window._exitGameCallback = fn;
            LOG.info('Exit callback registered via accountLoginCallback()');
        } else {
            LOG.warn('accountLoginCallback received non-function: ' + typeof fn);
        }
    };

    // Report: Create Role (350 SDK channel)
    window.report2Sdk350CreateRole = function(data) {
        LOG.call('report2Sdk350CreateRole()');
        if (data) {
            if (typeof data === 'string') {
                try { data = JSON.parse(data); } catch (e) {}
            }
            Analytics.track(ReportDataType.CreateRole, data);
            FBPixel.track('track', 'CompleteRegistration', data);
            GoogleAds.event('event', 'conversion', { send_to: 'AW-727890639/fHr2CNfov6UBEM_1itsC' });

            var payload350 = {
                eventType: 'create_role',
                userId: userData ? userData.userId : 'unknown',
                data: data,
                timestamp: new Date().toISOString()
            };
            Storage.push('sdk350_create_role', payload350);
        }
    };

    // Report: Login User (350 SDK channel)
    window.report2Sdk350LoginUser = function(data) {
        LOG.call('report2Sdk350LoginUser()');
        if (data) {
            if (typeof data === 'string') {
                try { data = JSON.parse(data); } catch (e) {}
            }
            Analytics.track(ReportDataType.EnterGame, data);

            var payload350 = {
                eventType: 'enter_server',
                userId: userData ? userData.userId : 'unknown',
                role_level: data.role_level || data.level || (userData ? userData.level : 1),
                vip: data.vip || (userData ? userData.vipLevel : 0),
                data: data,
                timestamp: new Date().toISOString()
            };
            Storage.push('sdk350_login_user', payload350);
        }
    };

    // Report: Create Role (CP API)
    window.reportToCpapiCreaterole = function(data) {
        LOG.call('reportToCpapiCreaterole()');
        if (data) {
            if (typeof data === 'string') {
                try { data = JSON.parse(data); } catch (e) {}
            }
            Analytics.track(ReportDataType.CreateRole, data);
            FBPixel.track('track', 'CharacterCreated', data);

            var cpPayload = {
                action: 'createRole',
                userId: userData ? userData.userId : 'unknown',
                roleId: data.roleId || (userData ? userData.roleId : ''),
                roleName: data.roleName || (userData ? userData.roleName : ''),
                serverId: data.serverId || (userData ? userData.serverId : ''),
                serverName: data.serverName || (userData ? userData.serverName : ''),
                level: data.level || (userData ? userData.level : 1),
                timestamp: new Date().toISOString(),
                channel: SDK_CONFIG.thirdChannel
            };
            Storage.push('cpapi_role_reports', cpPayload);
        }
    };

    // initSDKDe - SDK initialization with appId key
    window.initSDKDe = function(key) {
        LOG.call('initSDKDe()');
        if (key) {
            LOG.data('Key (first 16 chars):', key.substring(0, 16) + '...');
        }

        var initRecord = {
            key: key || null,
            isExpectedKey: key === SDK_CONFIG.appId,
            timestamp: new Date().toISOString(),
            userId: userData ? userData.userId : 'unknown'
        };
        Storage.set('sdk_init_record', initRecord);
        Storage.set('sdk_initialized', true);

        Analytics.trackCustom('SDKInit', {
            hasKey: !!key,
            isCorrectKey: key === SDK_CONFIG.appId,
            keyLength: key ? key.length : 0
        });

        return key === SDK_CONFIG.appId;
    };


    // ============================================================
    // SECTION 4: SDK CONFIGURATION
    // ============================================================
    // Central configuration that mirrors real SDK responses.
    // Delivered to index.html via bridge.js → startGame callback.
    // Updated dynamically when language changes.

    var _initialLang = (function() {
        // Language resolution: URL → saved → default 'en'
        try {
            var p = new URLSearchParams(window.location.search);
            var l = p.get('language');
            if (l && l.length >= 2) {
                Storage.set('language', l);
                return l;
            }
        } catch (e) {}
        var saved = Storage.get('language', null);
        if (saved && typeof saved === 'string' && saved.length >= 2) return saved;
        return 'en';
    })();

    var SDK_CONFIG = {
        language: _initialLang,
        thirdChannel: _initialLang,
        loginServer: 'http://127.0.0.1:8000',
        version: '2026-02-02193700',
        versionConfig: '{}',
        sdkType: 'PP',
        appId: '68355760639752706329835728782448',

        thirdParams: {
            osType: 'android',
            sdkType: 'PP',
            sdk: 'local',
            nickname: 'Player',
            userid: '',
            data: {
                sdk: 'local',
                nickname: 'Player',
                userid: '',
                securityCode: '',
                loginToken: ''
            }
        },

        clientParams: {
            hideList: [],
            gameIcon: '',
            supportLang: [
                { lang: 'cn',   languageName: '\u7B80\u4F53\u4E2D\u6587' },
                { lang: 'en',   languageName: 'English' },
                { lang: 'tw',   languageName: '\u7E41\u9AD4\u4E2D\u6587' },
                { lang: 'kr',   languageName: '\uD55C\uAD6D\uC5B4' },
                { lang: 'de',   languageName: 'Deutsch' },
                { lang: 'fr',   languageName: 'Fran\u00E7ais' },
                { lang: 'vi',   languageName: 'Ti\u1EBFng Vi\u1EC7t' },
                { lang: 'pt',   languageName: 'Portugu\u00EAs' },
                { lang: 'enme', languageName: 'English ME' }
            ],
            battleAudio: true,
            showUserCenterSdk: true,
            showContact: true,
            switchAccount: true,
            sdkNativeChannel: _initialLang,
            showCurChannel: _initialLang,
            show18Login: false,
            show18Home: false
        }
    };


    // ============================================================
    // SECTION 5: ANALYTICS ENGINE
    // ============================================================
    // Comprehensive event tracking with 30 ReportDataType values
    // used by the game. All events stored locally in localStorage.

    var ReportDataType = {
        CreateRole: 0,
        EnterGame: 1,
        EnterGameFalse: 2,
        LevelUp: 3,
        ChangeName: 4,
        ChangeServer: 5,
        EndGuide: 6,
        GetFirstRecharge: 7,
        GetVipLevelReward: 8,
        firstViewRechargePanel: 9,
        SecondDaySign: 10,
        UserVipLevelUP: 11,
        blackStoneLessonFinish: 12,
        blackStoneLoginCount4: 13,
        blackStoneLoginCount6: 14,
        LevelAchieved: 15,
        LevelAchieved2: 16,
        LevelAchieved4: 17,
        LevelAchieved6: 18,
        LevelAchieved20: 19,
        LevelAchieved25: 20,
        LevelAchieved30: 21,
        LevelAchieved35: 22,
        LevelAchieved40: 23,
        LevelAchievedv2: 24,
        LevelAchievedv6: 25,
        userLevelAchieved3: 26,
        userLevelAchieved6: 27,
        userLevelAchieved18: 28,
        userevelAchieved28: 29
    };

    var DataTypeNames = [
        'CreateRole', 'EnterGame', 'EnterGameFalse', 'LevelUp', 'ChangeName',
        'ChangeServer', 'EndGuide', 'GetFirstRecharge', 'GetVipLevelReward',
        'firstViewRechargePanel', 'SecondDaySign', 'UserVipLevelUP',
        'blackStoneLessonFinish', 'blackStoneLoginCount4', 'blackStoneLoginCount6',
        'LevelAchieved', 'LevelAchieved2', 'LevelAchieved4', 'LevelAchieved6',
        'LevelAchieved20', 'LevelAchieved25', 'LevelAchieved30', 'LevelAchieved35',
        'LevelAchieved40', 'LevelAchievedv2', 'LevelAchievedv6',
        'userLevelAchieved3', 'userLevelAchieved6', 'userLevelAchieved18',
        'userevelAchieved28'
    ];

    var Analytics = {
        MAX_EVENTS: 500,

        track: function(type, data) {
            var typeName;
            if (typeof type === 'string') {
                typeName = type;
            } else if (typeof type === 'number' && DataTypeNames[type]) {
                typeName = DataTypeNames[type];
            } else {
                typeName = 'Unknown_' + type;
            }

            var event = {
                id: Date.now() + '_' + Math.random().toString(36).substr(2, 6),
                type: typeName,
                dataType: typeof type === 'number' ? type : -1,
                data: data || {},
                timestamp: new Date().toISOString(),
                userId: userData ? userData.userId : 'unknown',
                sessionId: _sessionId
            };

            var events = Storage.get('analytics_events', []);
            if (!Array.isArray(events)) events = [];
            events.push(event);

            if (events.length > this.MAX_EVENTS) {
                events = events.slice(events.length - this.MAX_EVENTS);
            }
            Storage.set('analytics_events', events);

            // Update counters
            var counters = Storage.get('analytics_counters', {});
            counters[typeName] = (counters[typeName] || 0) + 1;
            counters['total'] = (counters['total'] || 0) + 1;
            Storage.set('analytics_counters', counters);

            LOG.success('Analytics: ' + typeName);
            return event;
        },

        trackPP: function(eventName, data) {
            return this.track('PP_' + eventName, data);
        },

        trackCustom: function(eventName, data) {
            return this.track('Custom_' + eventName, data);
        },

        getEvents: function(typeFilter) {
            var events = Storage.get('analytics_events', []);
            if (typeFilter) {
                return events.filter(function(e) { return e.type === typeFilter; });
            }
            return events;
        },

        getCounters: function() {
            return Storage.get('analytics_counters', {});
        },

        getSummary: function() {
            var counters = this.getCounters();
            var events = Storage.get('analytics_events', []);
            var sessions = Storage.get('analytics_sessions', []);
            return {
                totalEvents: counters['total'] || 0,
                eventTypeCounts: counters,
                recentEvents: events.slice(-10),
                totalSessions: sessions.length,
                firstEvent: events.length > 0 ? events[0].timestamp : null,
                lastEvent: events.length > 0 ? events[events.length - 1].timestamp : null
            };
        },

        recordSession: function() {
            var sessions = Storage.get('analytics_sessions', []);
            sessions.push({
                id: _sessionId,
                userId: userData ? userData.userId : 'unknown',
                startTime: new Date().toISOString(),
                language: SDK_CONFIG.language,
                channel: SDK_CONFIG.thirdChannel
            });
            if (sessions.length > 50) sessions = sessions.slice(-50);
            Storage.set('analytics_sessions', sessions);
        }
    };


    // ============================================================
    // SECTION 6: FACEBOOK PIXEL ENGINE
    // ============================================================
    // Simulates FB Pixel event tracking. Events stored locally
    // with metadata matching real FB Pixel payload structure.

    var FBPixel = {
        pixelId: 'LOCAL_PIXEL_STANDALONE',

        track: function(action, eventName, params) {
            var event = {
                pixelId: this.pixelId,
                action: action || 'track',
                eventName: eventName,
                params: params || {},
                timestamp: new Date().toISOString(),
                userId: userData ? userData.userId : null,
                sessionId: _sessionId,
                event_id: 'fb_' + Date.now() + '_' + Math.random().toString(36).substr(2, 8)
            };

            Storage.push('fb_pixel_events', event);
            LOG.success('fbq("' + action + '", "' + eventName + '")');
            Analytics.track('FB_' + eventName, { action: action, params: params });
            return event;
        },

        getHistory: function() {
            return Storage.get('fb_pixel_events', []);
        },

        getEventCount: function(eventName) {
            var events = Storage.get('fb_pixel_events', []);
            if (!eventName) return events.length;
            return events.filter(function(e) { return e.eventName === eventName; }).length;
        }
    };


    // ============================================================
    // SECTION 7: GOOGLE ADS ENGINE
    // ============================================================
    // Simulates Google Ads conversion tracking. Maps known
    // conversion labels to human-readable event names.

    var GoogleAds = {
        conversionLabels: {
            'AW-727890639/fHr2CNfov6UBEM_1itsC': 'CreateRole',
            'AW-727890639/8tfJCPPO5akBEM_1itsC': 'Stage10204',
            'AW-727890639/jg2yCMq27qkBEM_1itsC': 'Stage10308',
            'AW-727890639/DtgTCLj73qUBEM_1itsC': 'TutorialComplete',
            'AW-727890639/4OGsCJXT5akBEM_1itsC': 'FirstRecharge'
        },

        event: function(type, eventName, params) {
            var conversionLabel = 'unknown';
            if (params && params.send_to) {
                conversionLabel = this.conversionLabels[params.send_to] || params.send_to;
            }

            var event = {
                type: type || 'event',
                eventName: eventName || '',
                params: params || {},
                conversionLabel: conversionLabel,
                timestamp: new Date().toISOString(),
                userId: userData ? userData.userId : null,
                sessionId: _sessionId
            };

            Storage.push('gtag_events', event);
            LOG.success('gtag("' + type + '", "' + eventName + '") [' + conversionLabel + ']');
            Analytics.track('GTag_' + (conversionLabel || eventName), { params: params });
            return event;
        },

        getHistory: function() {
            return Storage.get('gtag_events', []);
        }
    };


    // ============================================================
    // SECTION 8: TWITTER PIXEL ENGINE
    // ============================================================
    // Intercepts pushes to window.dotq array via Proxy.
    // Each event is enriched with timestamp and user context.

    var TwitterPixel = {
        events: [],

        push: function(eventObj) {
            if (!eventObj) return;

            var enriched = {
                pixelId: eventObj.pixel_id || null,
                eventType: eventObj.event || null,
                data: eventObj,
                timestamp: new Date().toISOString(),
                userId: userData ? userData.userId : null,
                sessionId: _sessionId
            };

            this.events.push(enriched);
            Storage.push('twitter_pixel_events', enriched);
            LOG.success('dotq.push()', { pixel_id: eventObj.pixel_id, event: eventObj.event });
            Analytics.track('Twitter_' + (eventObj.event || 'unknown'), eventObj);
            return enriched;
        },

        getHistory: function() {
            return Storage.get('twitter_pixel_events', []);
        }
    };


    // ============================================================
    // SECTION 9: USER MANAGEMENT
    // ============================================================
    // User data persistence, session management, and language
    // loading with URL parameter priority chain.

    function _generateSessionId() {
        return 'sess_' + Date.now().toString(36) + '_' + Math.random().toString(36).substr(2, 8);
    }

    var _sessionId = Storage.get('current_session_id', null);
    if (!_sessionId) {
        _sessionId = _generateSessionId();
        Storage.set('current_session_id', _sessionId);
    }

    function _generateUserId() {
        return 'u_' + Date.now().toString(36) + Math.random().toString(36).substring(2, 10);
    }

    function _generateToken() {
        return 'local_' + Date.now().toString(36) + '_' + Math.random().toString(36).substring(2, 15);
    }

    function _loadOrCreateUserData() {
        var stored = Storage.get('user', null);
        if (stored && stored.userId && stored.token) {
            LOG.info('Loaded existing user: ' + stored.userId);
            return stored;
        }

        var newUserData = {
            userId: _generateUserId(),
            nickname: 'Player_' + Math.floor(Math.random() * 9999),
            token: _generateToken(),
            createdAt: new Date().toISOString(),
            lastLoginAt: new Date().toISOString(),
            loginCount: 1,
            totalPlayTime: 0,
            level: 1,
            vipLevel: 0,
            serverId: 's1',
            serverName: 'Server 1',
            roleId: 'r_' + Math.random().toString(36).substr(2, 8),
            roleName: 'Hero',
            currency: { gold: 10000, diamond: 500, stamina: 120 }
        };

        Storage.set('user', newUserData);
        LOG.success('Created new user: ' + newUserData.userId);
        return newUserData;
    }

    // Load user data (forward declaration safe due to function hoisting)
    var userData = _loadOrCreateUserData();

    // Update login count on each page load
    userData.lastLoginAt = new Date().toISOString();
    userData.loginCount = (userData.loginCount || 0) + 1;
    Storage.set('user', userData);

    // Sync SDK config with user data
    function _syncConfigWithUser() {
        SDK_CONFIG.thirdParams.nickname = userData.nickname;
        SDK_CONFIG.thirdParams.userid = userData.userId;
        SDK_CONFIG.thirdParams.data.nickname = userData.nickname;
        SDK_CONFIG.thirdParams.data.userid = userData.userId;
        SDK_CONFIG.thirdParams.data.securityCode = userData.token;
        SDK_CONFIG.thirdParams.data.loginToken = userData.token;
    }
    _syncConfigWithUser();


    // ============================================================
    // SECTION 10: UI OVERLAY SYSTEM
    // ============================================================
    // Reusable modal/overlay framework. Dragon Ball-themed with
    // dark gradients, red accents, and smooth animations.

    var UI = {
        _overlayCount: 0,
        _activeOverlay: null,

        _injectStyles: function() {
            if (document.getElementById('dbz-sdk-ui-styles')) return;
            var css = document.createElement('style');
            css.id = 'dbz-sdk-ui-styles';
            css.textContent = [
                '.dbz-sdk-overlay{position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.75);z-index:99999;display:flex;align-items:center;justify-content:center;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;animation:dbz-sdk-fadeIn .2s ease;-webkit-user-select:none;user-select:none}',
                '@keyframes dbz-sdk-fadeIn{from{opacity:0}to{opacity:1}}',
                '@keyframes dbz-sdk-slideUp{from{transform:translateY(30px);opacity:0}to{transform:translateY(0);opacity:1}}',
                '@keyframes dbz-sdk-spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}',
                '.dbz-sdk-modal{background:linear-gradient(145deg,#1a1a2e 0%,#16213e 50%,#0f3460 100%);border:2px solid #e94560;border-radius:16px;width:90%;max-width:400px;max-height:85vh;overflow-y:auto;color:#eee;animation:dbz-sdk-slideUp .3s ease;box-shadow:0 20px 60px rgba(0,0,0,.5),0 0 30px rgba(233,69,96,.2)}',
                '.dbz-sdk-header{background:linear-gradient(90deg,#e94560,#c23152);padding:14px 18px;border-radius:14px 14px 0 0;font-size:16px;font-weight:700;color:#fff;display:flex;align-items:center;justify-content:space-between;text-shadow:1px 1px 3px rgba(0,0,0,.3)}',
                '.dbz-sdk-close{background:rgba(255,255,255,.2);border:none;color:#fff;width:30px;height:30px;border-radius:50%;cursor:pointer;font-size:18px;display:flex;align-items:center;justify-content:center;transition:background .2s}',
                '.dbz-sdk-close:hover{background:rgba(255,255,255,.4)}',
                '.dbz-sdk-body{padding:16px 18px}',
                '.dbz-sdk-footer{padding:12px 18px;border-top:1px solid rgba(255,255,255,.1);display:flex;gap:10px;justify-content:flex-end}',
                '.dbz-sdk-btn{padding:10px 24px;border-radius:8px;border:none;font-size:14px;font-weight:600;cursor:pointer;transition:all .2s;color:#fff}',
                '.dbz-sdk-btn:active{transform:scale(.95)}',
                '.dbz-sdk-btn-primary{background:linear-gradient(135deg,#e94560,#c23152)}',
                '.dbz-sdk-btn-success{background:linear-gradient(135deg,#10b981,#059669)}',
                '.dbz-sdk-btn-warning{background:linear-gradient(135deg,#f59e0b,#d97706)}',
                '.dbz-sdk-btn-cancel{background:rgba(255,255,255,.15);color:#aaa}',
                '.dbz-sdk-row{display:flex;justify-content:space-between;align-items:center;padding:10px 0;border-bottom:1px solid rgba(255,255,255,.06)}',
                '.dbz-sdk-row:last-child{border-bottom:none}',
                '.dbz-sdk-label{color:#888;font-size:13px}',
                '.dbz-sdk-value{color:#fff;font-size:13px;font-weight:500;text-align:right;max-width:60%;word-break:break-all}',
                '.dbz-sdk-info{background:rgba(233,69,96,.1);border:1px solid rgba(233,69,96,.3);border-radius:8px;padding:12px;margin:10px 0;font-size:13px;color:#f0a0b0;line-height:1.5}',
                '.dbz-sdk-success{background:rgba(16,185,129,.1);border:1px solid rgba(16,185,129,.3);border-radius:8px;padding:12px;margin:10px 0;font-size:13px;color:#6ee7b7;line-height:1.5;text-align:center}',
                '.dbz-sdk-textarea{width:100%;min-height:80px;padding:10px;background:rgba(0,0,0,.3);border:1px solid rgba(255,255,255,.15);border-radius:8px;color:#eee;font-size:13px;resize:vertical;font-family:inherit}',
                '.dbz-sdk-textarea:focus{outline:none;border-color:#e94560}',
                '.dbz-sdk-input{width:100%;padding:8px 10px;background:rgba(0,0,0,.3);border:1px solid rgba(255,255,255,.15);border-radius:8px;color:#eee;font-size:13px;font-family:inherit}',
                '.dbz-sdk-input:focus{outline:none;border-color:#e94560}',
                '.dbz-sdk-spinner{display:inline-block;width:24px;height:24px;border:3px solid rgba(255,255,255,.2);border-top-color:#e94560;border-radius:50%;animation:dbz-sdk-spin .8s linear infinite}',
                '.dbz-sdk-gift-item{background:rgba(255,255,255,.05);border:1px solid rgba(255,255,255,.1);border-radius:10px;padding:12px;margin-bottom:8px;display:flex;align-items:center;gap:12px;transition:background .2s}',
                '.dbz-sdk-gift-icon{width:48px;height:48px;border-radius:10px;background:linear-gradient(135deg,#f59e0b,#d97706);display:flex;align-items:center;justify-content:center;font-size:24px;flex-shrink:0}',
                '.dbz-sdk-gift-info{flex:1}',
                '.dbz-sdk-gift-name{font-size:14px;font-weight:600;color:#fff}',
                '.dbz-sdk-gift-desc{font-size:12px;color:#888;margin-top:2px}',
                '.dbz-sdk-gift-btn{padding:6px 14px;border-radius:6px;border:none;background:linear-gradient(135deg,#e94560,#c23152);color:#fff;font-size:12px;font-weight:600;cursor:pointer;white-space:nowrap}',
                '.dbz-sdk-gift-btn:disabled{background:rgba(255,255,255,.1);color:#666;cursor:default}',
                '.dbz-sdk-faq-q{background:rgba(233,69,96,.1);padding:10px 12px;border-radius:8px;font-size:13px;font-weight:600;color:#f0a0b0;cursor:pointer;margin-bottom:6px}',
                '.dbz-sdk-faq-a{padding:10px 12px;font-size:12px;color:#aaa;line-height:1.6;display:none}',
                '.dbz-sdk-faq-a.open{display:block}',
                '.dbz-sdk-scroll::-webkit-scrollbar{width:4px}',
                '.dbz-sdk-scroll::-webkit-scrollbar-thumb{background:rgba(255,255,255,.2);border-radius:2px}',
                '.dbz-sdk-tab-bar{display:flex;border-bottom:1px solid rgba(255,255,255,.1)}',
                '.dbz-sdk-tab{flex:1;padding:10px;text-align:center;font-size:13px;color:#888;cursor:pointer;border-bottom:2px solid transparent;transition:all .2s}',
                '.dbz-sdk-tab.active{color:#e94560;border-bottom-color:#e94560}',
                '.dbz-sdk-tab-content{display:none}',
                '.dbz-sdk-tab-content.active{display:block}'
            ].join('\n');
            (document.head || document.documentElement).appendChild(css);
        },

        create: function(title, bodyHtml, buttons, options) {
            this._injectStyles();
            this.close();

            var opts = options || {};
            var overlay = document.createElement('div');
            overlay.className = 'dbz-sdk-overlay';
            overlay.id = 'dbz-sdk-overlay-' + (++this._overlayCount);

            var modal = document.createElement('div');
            modal.className = 'dbz-sdk-modal';
            if (opts.width) modal.style.maxWidth = opts.width;

            var header = document.createElement('div');
            header.className = 'dbz-sdk-header';
            header.innerHTML = '<span>' + this._esc(title) + '</span>';
            var closeBtn = document.createElement('button');
            closeBtn.className = 'dbz-sdk-close';
            closeBtn.textContent = '\u00D7';
            closeBtn.onclick = function() { UI.close(); };
            header.appendChild(closeBtn);

            var body = document.createElement('div');
            body.className = 'dbz-sdk-body dbz-sdk-scroll';
            body.innerHTML = bodyHtml;

            modal.appendChild(header);
            modal.appendChild(body);

            if (buttons && buttons.length > 0) {
                var footer = document.createElement('div');
                footer.className = 'dbz-sdk-footer';
                for (var i = 0; i < buttons.length; i++) {
                    (function(btn) {
                        var el = document.createElement('button');
                        el.className = 'dbz-sdk-btn ' + (btn.class || 'dbz-sdk-btn-primary');
                        el.textContent = btn.text;
                        el.onclick = function() {
                            if (btn.onClick) btn.onClick(overlay, body);
                            if (btn.close !== false) UI.close();
                        };
                        footer.appendChild(el);
                    })(buttons[i]);
                }
                modal.appendChild(footer);
            }

            overlay.appendChild(modal);
            document.body.appendChild(overlay);
            this._activeOverlay = overlay;

            overlay.addEventListener('click', function(e) {
                if (e.target === overlay) UI.close();
            });

            LOG.ui('Overlay opened: ' + title);
            return { overlay: overlay, body: body, modal: modal };
        },

        close: function() {
            if (this._activeOverlay) {
                try {
                    this._activeOverlay.parentNode.removeChild(this._activeOverlay);
                } catch (e) {}
                this._activeOverlay = null;
            }
        },

        updateBody: function(html) {
            if (this._activeOverlay) {
                var body = this._activeOverlay.querySelector('.dbz-sdk-body');
                if (body) body.innerHTML = html;
            }
        },

        _esc: function(str) {
            var div = document.createElement('div');
            div.textContent = str;
            return div.innerHTML;
        }
    };


    // ============================================================
    // SECTION 11: PAYMENT ENGINE
    // ============================================================
    // Full payment simulation with Dragon Ball-themed overlay.
    // Processes paySdk data, shows item details, simulates
    // transaction with 95% success rate.

    var PaymentEngine = {
        transactions: Storage.get('payment_transactions', []),

        process: function(payData) {
            LOG.call('PaymentEngine.process()');

            if (!payData) {
                LOG.error('No payment data provided');
                return;
            }

            payData.userId = userData.userId;
            payData.roleId = payData.roleId || userData.roleId;
            payData.roleName = payData.roleName || userData.roleName;
            payData.roleLevel = payData.roleLevel || userData.level;
            payData.serverName = payData.serverName || userData.serverName;
            payData.timestamp = new Date().toISOString();
            payData.txId = 'TXN_' + Date.now() + '_' + Math.random().toString(36).substr(2, 6);

            Analytics.track(ReportDataType.firstViewRechargePanel, { goodsId: payData.goodsId, goodsName: payData.goodsName });
            FBPixel.track('track', 'AddToCart', { content_name: payData.goodsName, value: payData.amount, currency: payData.currency });

            this._showPaymentUI(payData);
        },

        _showPaymentUI: function(payData) {
            var amount = payData.amount || payData.money || 0;
            var goodsName = payData.goodsName || payData.goodsId || 'Unknown Item';
            var serverName = payData.serverName || userData.serverName || '-';
            var roleName = payData.roleName || userData.roleName || '-';
            var currency = payData.currency || 'USD';

            var html = '';
            html += '<div class="dbz-sdk-info">\u26A0\uFE0F Standalone Mode - Payment Simulation</div>';
            html += '<div class="dbz-sdk-row"><span class="dbz-sdk-label">Item</span><span class="dbz-sdk-value">' + UI._esc(goodsName) + '</span></div>';
            html += '<div class="dbz-sdk-row"><span class="dbz-sdk-label">Price</span><span class="dbz-sdk-value" style="color:#f59e0b;font-size:18px;font-weight:700;">' + amount + ' ' + currency + '</span></div>';
            html += '<div class="dbz-sdk-row"><span class="dbz-sdk-label">Server</span><span class="dbz-sdk-value">' + UI._esc(serverName) + '</span></div>';
            html += '<div class="dbz-sdk-row"><span class="dbz-sdk-label">Character</span><span class="dbz-sdk-value">' + UI._esc(roleName) + '</span></div>';
            html += '<div class="dbz-sdk-row"><span class="dbz-sdk-label">Order ID</span><span class="dbz-sdk-value" style="font-size:11px;">' + payData.txId + '</span></div>';
            html += '<div id="dbz-pay-status"></div>';

            var ref = this;

            UI.create('\uD83D\uDCB3 Payment', html, [
                { text: 'Cancel', class: 'dbz-sdk-btn-cancel', close: true },
                { text: '\u2705 Confirm Pay', class: 'dbz-sdk-btn-success', close: false, onClick: function(overlay, body) {
                    ref._doPayment(payData, body);
                }}
            ]);
        },

        _doPayment: function(payData, bodyEl) {
            var ref = this;
            var statusEl = bodyEl.querySelector('#dbz-pay-status');
            if (statusEl) {
                statusEl.innerHTML = '<div style="text-align:center;padding:16px;"><span class="dbz-sdk-spinner"></span><br><span style="margin-top:10px;display:block;color:#aaa;font-size:13px;">Processing payment...</span></div>';
            }

            var delay = 1500 + Math.random() * 1500;
            setTimeout(function() {
                var success = Math.random() < 0.95;
                var transaction = {
                    txId: payData.txId,
                    goodsId: payData.goodsId,
                    goodsName: payData.goodsName,
                    amount: payData.amount || payData.money,
                    currency: payData.currency || 'USD',
                    serverName: payData.serverName,
                    roleName: payData.roleName,
                    roleId: payData.roleId,
                    status: success ? 'success' : 'failed',
                    reason: success ? null : 'Network timeout',
                    timestamp: new Date().toISOString(),
                    userId: userData.userId
                };

                ref.transactions.push(transaction);
                if (ref.transactions.length > 100) ref.transactions = ref.transactions.slice(-100);
                Storage.set('payment_transactions', ref.transactions);

                if (success) {
                    Analytics.track(ReportDataType.GetFirstRecharge, transaction);
                    FBPixel.track('track', 'Purchase', { content_name: payData.goodsName, value: payData.amount, currency: payData.currency });
                    if (statusEl) {
                        statusEl.innerHTML = '<div class="dbz-sdk-success">\u2705 Payment Successful!<br><span style="font-size:12px;color:#6ee7b7;margin-top:4px;display:block;">Order: ' + transaction.txId + '</span></div>';
                    }
                    LOG.success('Payment SUCCESS: ' + transaction.txId);
                    setTimeout(function() { UI.close(); }, 1500);
                } else {
                    Analytics.track('PaymentFailed', transaction);
                    if (statusEl) {
                        statusEl.innerHTML = '<div class="dbz-sdk-info">\u274C Payment Failed<br><span style="font-size:12px;">Reason: Network timeout. Please try again.</span></div>';
                    }
                    LOG.warn('Payment FAILED: ' + transaction.txId);
                }
            }, delay);
        },

        getHistory: function() { return this.transactions; },

        getTotalSpent: function() {
            var total = 0;
            for (var i = 0; i < this.transactions.length; i++) {
                if (this.transactions[i].status === 'success') {
                    total += (this.transactions[i].amount || 0);
                }
            }
            return total;
        }
    };


    // ============================================================
    // SECTION 12: GIFT BAG ENGINE
    // ============================================================
    // Gift bag system with predefined items. Supports cooldowns
    // and persistent claim tracking in localStorage.

    var GiftBagEngine = {
        _gifts: [
            { id: 'daily_login', name: 'Daily Login Reward', desc: 'Login reward for today', icon: '\uD83C\uDF1F', reward: { gold: 5000, diamond: 100 }, cooldown: 86400000 },
            { id: 'starter_pack', name: 'Starter Pack', desc: 'Welcome gift for new players', icon: '\uD83C\uDF81', reward: { gold: 10000, diamond: 300, stamina: 60 } },
            { id: 'vip_bonus', name: 'VIP Bonus Gift', desc: 'Bonus rewards for VIP players', icon: '\u265B\uFE0F', reward: { gold: 20000, diamond: 500 } },
            { id: 'energy_refill', name: 'Energy Refill', desc: 'Refill your stamina to full', icon: '\u26A1', reward: { stamina: 120 }, cooldown: 28800000 },
            { id: 'dragon_ball_1', name: 'Dragon Ball x1', desc: 'Collect all 7 to summon Shenron!', icon: '\uD83D\uDD34', reward: { gold: 1000 } },
            { id: 'dragon_ball_2', name: 'Dragon Ball x2', desc: 'Two-star Dragon Ball found!', icon: '\uD83D\uDD35', reward: { gold: 2000, diamond: 50 } },
            { id: 'scroll_power', name: 'Power Scroll', desc: 'Boost your power level!', icon: '\uD83D\uDCDC', reward: { gold: 5000, diamond: 150 } },
            { id: 'senzu_bean', name: 'Senzu Bean Pack', desc: 'Heal and restore energy', icon: '\uD83C\uDF31', reward: { stamina: 60, gold: 3000 } }
        ],

        _getClaimed: function() { return Storage.get('gift_claims', {}); },

        _findGift: function(giftId) {
            for (var i = 0; i < this._gifts.length; i++) {
                if (this._gifts[i].id === giftId) return this._gifts[i];
            }
            return null;
        },

        canClaim: function(giftId) {
            var gift = this._findGift(giftId);
            if (!gift) return false;
            var claimed = this._getClaimed();
            if (!claimed[giftId]) return true;
            if (gift.cooldown) {
                return (Date.now() - claimed[giftId]) >= gift.cooldown;
            }
            return false;
        },

        claim: function(giftId) {
            var gift = this._findGift(giftId);
            if (!gift) return { success: false, error: 'Gift not found' };
            if (!this.canClaim(giftId)) return { success: false, error: 'Already claimed or on cooldown' };

            if (gift.reward) {
                if (!userData.currency) userData.currency = { gold: 0, diamond: 0, stamina: 0 };
                if (gift.reward.gold) userData.currency.gold = (userData.currency.gold || 0) + gift.reward.gold;
                if (gift.reward.diamond) userData.currency.diamond = (userData.currency.diamond || 0) + gift.reward.diamond;
                if (gift.reward.stamina) userData.currency.stamina = (userData.currency.stamina || 0) + gift.reward.stamina;
                Storage.set('user', userData);
            }

            var claimed = this._getClaimed();
            claimed[giftId] = Date.now();
            Storage.set('gift_claims', claimed);

            var claimRecord = { giftId: giftId, giftName: gift.name, reward: gift.reward, timestamp: new Date().toISOString(), userId: userData.userId };
            Storage.push('gift_claim_history', claimRecord);
            Analytics.trackCustom('GiftClaim', { giftId: giftId, giftName: gift.name });
            LOG.success('Gift claimed: ' + gift.name);
            return { success: true, gift: gift, reward: gift.reward };
        },

        showUI: function() {
            var claimed = this._getClaimed();
            var now = Date.now();
            var ref = this;
            var html = '<div class="dbz-sdk-info">\uD83C\uDF81 Claim your rewards below!</div>';

            for (var i = 0; i < this._gifts.length; i++) {
                var g = this._gifts[i];
                var can = ref.canClaim(g.id);
                var cooldownText = '';
                if (claimed[g.id] && g.cooldown) {
                    var remaining = g.cooldown - (now - claimed[g.id]);
                    if (remaining > 0) {
                        var mins = Math.floor(remaining / 60000);
                        var hrs = Math.floor(mins / 60);
                        cooldownText = hrs > 0 ? hrs + 'h ' + (mins % 60) + 'm' : mins + 'm';
                    }
                }
                var rewardParts = [];
                if (g.reward) {
                    if (g.reward.gold) rewardParts.push(g.reward.gold + ' Gold');
                    if (g.reward.diamond) rewardParts.push(g.reward.diamond + ' Diamond');
                    if (g.reward.stamina) rewardParts.push(g.reward.stamina + ' Stamina');
                }

                html += '<div class="dbz-sdk-gift-item">';
                html += '  <div class="dbz-sdk-gift-icon">' + g.icon + '</div>';
                html += '  <div class="dbz-sdk-gift-info">';
                html += '    <div class="dbz-sdk-gift-name">' + UI._esc(g.name) + '</div>';
                html += '    <div class="dbz-sdk-gift-desc">' + UI._esc(g.desc) + (rewardParts.length > 0 ? ' (' + rewardParts.join(', ') + ')' : '') + '</div>';
                html += '  </div>';
                if (can) {
                    html += '  <button class="dbz-sdk-gift-btn" data-gift-id="' + g.id + '">Claim</button>';
                } else if (cooldownText) {
                    html += '  <button class="dbz-sdk-gift-btn" disabled>' + cooldownText + '</button>';
                } else {
                    html += '  <button class="dbz-sdk-gift-btn" disabled>Claimed</button>';
                }
                html += '</div>';
            }

            UI.create('\uD83C\uDF81 Gift Bag', html, [], { width: '420px' });

            setTimeout(function() {
                var btns = document.querySelectorAll('.dbz-sdk-gift-btn[data-gift-id]');
                for (var i = 0; i < btns.length; i++) {
                    btns[i].addEventListener('click', function() {
                        var gid = this.getAttribute('data-gift-id');
                        var result = ref.claim(gid);
                        if (result.success) { UI.close(); ref.showUI(); }
                    });
                }
            }, 100);
        },

        getClaimHistory: function() { return Storage.get('gift_claim_history', []); }
    };


    // ============================================================
    // SECTION 13: CONTACT CENTER ENGINE
    // ============================================================
    // FAQ database and feedback form. All feedback stored locally.

    var ContactCenter = {
        faq: [
            { q: 'How do I recharge/purchase items?', a: 'Tap the Shop icon on the main screen to browse available items and recharge options.' },
            { q: 'How do I change my language?', a: 'Go to Settings > Language to select your preferred language. The game supports English, Chinese, Korean, and more.' },
            { q: 'How do I switch accounts?', a: 'Tap your profile icon, then select "Switch Account" from the menu. Your progress will be saved.' },
            { q: 'My game is lagging, what should I do?', a: 'Close background apps, clear cache in settings, and ensure a stable internet connection.' },
            { q: 'How do I get more Dragon Stones?', a: 'Complete daily missions, participate in events, clear stages, and check the gift bag for free rewards.' },
            { q: 'How do I join a Guild?', a: 'Unlock the Guild feature at level 20, then search for a guild or create your own.' },
            { q: 'I lost my account, how do I recover it?', a: 'Contact support with your User ID and any purchase receipts.' },
            { q: 'How do I report a bug?', a: 'Use this contact form to describe the issue. Include your User ID, device model, and reproduction steps.' }
        ],

        showUI: function() {
            var ref = this;
            var html = '<div class="dbz-sdk-tab-bar">';
            html += '<div class="dbz-sdk-tab active" data-tab="faq">FAQ</div>';
            html += '<div class="dbz-sdk-tab" data-tab="feedback">Feedback</div>';
            html += '</div>';

            html += '<div class="dbz-sdk-tab-content active" id="dbz-tab-faq">';
            for (var i = 0; i < this.faq.length; i++) {
                html += '<div class="dbz-sdk-faq-q" data-faq="' + i + '">\u2753 ' + UI._esc(this.faq[i].q) + '</div>';
                html += '<div class="dbz-sdk-faq-a" id="dbz-faq-' + i + '">' + UI._esc(this.faq[i].a) + '</div>';
            }
            html += '</div>';

            html += '<div class="dbz-sdk-tab-content" id="dbz-tab-feedback">';
            html += '<div class="dbz-sdk-info">Your feedback helps us improve the game!</div>';
            html += '<div style="margin-bottom:10px;"><input class="dbz-sdk-input" id="dbz-feedback-subject" placeholder="Subject (optional)"></div>';
            html += '<textarea class="dbz-sdk-textarea" id="dbz-feedback-msg" placeholder="Describe your issue or suggestion..."></textarea>';
            html += '<div id="dbz-feedback-status" style="margin-top:10px;"></div>';
            html += '</div>';

            UI.create('\uD83D\uDCDE Contact Center', html, [
                { text: 'Close', class: 'dbz-sdk-btn-cancel', close: true },
                { text: '\u2709\uFE0F Send', class: 'dbz-sdk-btn-primary', close: false, onClick: function() { ref._submitFeedback(); } }
            ], { width: '420px' });

            setTimeout(function() {
                var tabs = document.querySelectorAll('.dbz-sdk-tab');
                for (var i = 0; i < tabs.length; i++) {
                    tabs[i].addEventListener('click', function() {
                        var tabName = this.getAttribute('data-tab');
                        var allTabs = document.querySelectorAll('.dbz-sdk-tab');
                        var allContent = document.querySelectorAll('.dbz-sdk-tab-content');
                        for (var j = 0; j < allTabs.length; j++) allTabs[j].classList.remove('active');
                        for (var k = 0; k < allContent.length; k++) allContent[k].classList.remove('active');
                        this.classList.add('active');
                        var content = document.getElementById('dbz-tab-' + tabName);
                        if (content) content.classList.add('active');
                    });
                }

                var faqItems = document.querySelectorAll('.dbz-sdk-faq-q');
                for (var j = 0; j < faqItems.length; j++) {
                    faqItems[j].addEventListener('click', function() {
                        var idx = this.getAttribute('data-faq');
                        var answer = document.getElementById('dbz-faq-' + idx);
                        if (answer) answer.classList.toggle('open');
                    });
                }
            }, 100);
        },

        _submitFeedback: function() {
            var subjectEl = document.getElementById('dbz-feedback-subject');
            var msgEl = document.getElementById('dbz-feedback-msg');
            var statusEl = document.getElementById('dbz-feedback-status');
            var msg = msgEl ? msgEl.value.trim() : '';
            var subject = subjectEl ? subjectEl.value.trim() : '';

            if (!msg) {
                if (statusEl) statusEl.innerHTML = '<div class="dbz-sdk-info">Please enter your feedback message.</div>';
                return;
            }

            var feedback = { id: 'fb_' + Date.now(), userId: userData.userId, subject: subject, message: msg, timestamp: new Date().toISOString(), status: 'received' };
            Storage.push('contact_feedback', feedback);
            Analytics.trackCustom('ContactFeedback', { subject: subject });

            if (statusEl) statusEl.innerHTML = '<div class="dbz-sdk-success">\u2705 Thank you! Your feedback has been submitted.<br><span style="font-size:11px;">Ticket ID: ' + feedback.id + '</span></div>';
            if (msgEl) msgEl.value = '';
            if (subjectEl) subjectEl.value = '';
            LOG.success('Feedback submitted: ' + feedback.id);
        },

        getFeedbackHistory: function() { return Storage.get('contact_feedback', []); }
    };


    // ============================================================
    // SECTION 14: USER CENTER ENGINE
    // ============================================================
    // Profile display, game stats, and settings management.

    var UserCenterEngine = {
        showUI: function() {
            var lastLogin = userData.lastLoginAt ? new Date(userData.lastLoginAt).toLocaleString() : 'Unknown';
            var created = userData.createdAt ? new Date(userData.createdAt).toLocaleString() : 'Unknown';
            var summary = Analytics.getSummary();
            var payments = PaymentEngine.getHistory();
            var successPayments = payments.filter(function(t) { return t.status === 'success'; });

            var html = '<div class="dbz-sdk-tab-bar">';
            html += '<div class="dbz-sdk-tab active" data-tab="account">Account</div>';
            html += '<div class="dbz-sdk-tab" data-tab="stats">Statistics</div>';
            html += '<div class="dbz-sdk-tab" data-tab="settings">Settings</div>';
            html += '</div>';

            // Account Tab
            html += '<div class="dbz-sdk-tab-content active" id="dbz-tab-account">';
            html += '<div class="dbz-sdk-row"><span class="dbz-sdk-label">User ID</span><span class="dbz-sdk-value" style="font-size:11px;">' + userData.userId + '</span></div>';
            html += '<div class="dbz-sdk-row"><span class="dbz-sdk-label">Nickname</span><span class="dbz-sdk-value">' + UI._esc(userData.nickname) + '</span></div>';
            html += '<div class="dbz-sdk-row"><span class="dbz-sdk-label">Server</span><span class="dbz-sdk-value">' + UI._esc(userData.serverName || '-') + '</span></div>';
            html += '<div class="dbz-sdk-row"><span class="dbz-sdk-label">Level</span><span class="dbz-sdk-value">' + (userData.level || 1) + '</span></div>';
            html += '<div class="dbz-sdk-row"><span class="dbz-sdk-label">VIP</span><span class="dbz-sdk-value">' + (userData.vipLevel || 0) + '</span></div>';
            html += '<div class="dbz-sdk-row"><span class="dbz-sdk-label">Language</span><span class="dbz-sdk-value">' + SDK_CONFIG.language + '</span></div>';
            html += '<div class="dbz-sdk-row"><span class="dbz-sdk-label">Channel</span><span class="dbz-sdk-value">' + SDK_CONFIG.thirdChannel + '</span></div>';
            html += '<div class="dbz-sdk-row"><span class="dbz-sdk-label">Login Count</span><span class="dbz-sdk-value">' + (userData.loginCount || 1) + '</span></div>';
            html += '<div class="dbz-sdk-row"><span class="dbz-sdk-label">Last Login</span><span class="dbz-sdk-value" style="font-size:11px;">' + lastLogin + '</span></div>';
            html += '</div>';

            // Stats Tab
            html += '<div class="dbz-sdk-tab-content" id="dbz-tab-stats">';
            html += '<div class="dbz-sdk-row"><span class="dbz-sdk-label">Events Tracked</span><span class="dbz-sdk-value">' + (summary.totalEvents || 0) + '</span></div>';
            html += '<div class="dbz-sdk-row"><span class="dbz-sdk-label">Sessions</span><span class="dbz-sdk-value">' + (summary.totalSessions || 1) + '</span></div>';
            html += '<div class="dbz-sdk-row"><span class="dbz-sdk-label">FB Events</span><span class="dbz-sdk-value">' + FBPixel.getEventCount() + '</span></div>';
            html += '<div class="dbz-sdk-row"><span class="dbz-sdk-label">Payments</span><span class="dbz-sdk-value">' + successPayments.length + '/' + payments.length + '</span></div>';
            html += '<div class="dbz-sdk-row"><span class="dbz-sdk-label">Total Spent</span><span class="dbz-sdk-value" style="color:#f59e0b;">$' + PaymentEngine.getTotalSpent().toFixed(2) + '</span></div>';
            html += '<div class="dbz-sdk-row"><span class="dbz-sdk-label">Gifts Claimed</span><span class="dbz-sdk-value">' + GiftBagEngine.getClaimHistory().length + '</span></div>';
            html += '</div>';

            // Settings Tab
            html += '<div class="dbz-sdk-tab-content" id="dbz-tab-settings">';
            html += '<div style="margin-bottom:14px;">';
            html += '<div style="color:#888;font-size:12px;margin-bottom:6px;">Change Nickname</div>';
            html += '<div style="display:flex;gap:8px;"><input class="dbz-sdk-input" id="dbz-nickname-input" value="' + UI._esc(userData.nickname) + '" style="flex:1;">';
            html += '<button class="dbz-sdk-gift-btn" id="dbz-nickname-save">Save</button></div>';
            html += '<div id="dbz-nickname-status" style="font-size:12px;margin-top:4px;"></div>';
            html += '</div>';
            html += '<div style="margin-bottom:14px;">';
            html += '<div style="color:#888;font-size:12px;margin-bottom:6px;">Battle Audio</div>';
            html += '<label style="display:flex;align-items:center;gap:8px;cursor:pointer;color:#ccc;font-size:13px;">';
            html += '<input type="checkbox" id="dbz-battle-audio" ' + (SDK_CONFIG.clientParams.battleAudio ? 'checked' : '') + ' style="width:18px;height:18px;"> Enable battle audio';
            html += '</label></div>';
            html += '<div style="margin-bottom:10px;"><div style="color:#888;font-size:12px;">Gold</div><div style="color:#f59e0b;font-size:18px;font-weight:700;">' + (userData.currency ? userData.currency.gold : 0) + '</div></div>';
            html += '<div style="margin-bottom:10px;"><div style="color:#888;font-size:12px;">Diamonds</div><div style="color:#60a5fa;font-size:18px;font-weight:700;">' + (userData.currency ? userData.currency.diamond : 0) + '</div></div>';
            html += '<div style="margin-bottom:10px;"><div style="color:#888;font-size:12px;">Stamina</div><div style="color:#10b981;font-size:18px;font-weight:700;">' + (userData.currency ? userData.currency.stamina : 0) + '</div></div>';
            html += '</div>';

            UI.create('\uD83D\uDC64 User Center', html, [
                { text: 'Copy User ID', class: 'dbz-sdk-btn-cancel', close: false, onClick: function() {
                    if (navigator.clipboard) navigator.clipboard.writeText(userData.userId);
                    LOG.success('User ID copied to clipboard');
                }},
                { text: 'Close', class: 'dbz-sdk-btn-primary', close: true }
            ], { width: '420px' });

            // Bind tabs and controls
            setTimeout(function() {
                var tabs = document.querySelectorAll('.dbz-sdk-tab');
                for (var i = 0; i < tabs.length; i++) {
                    tabs[i].addEventListener('click', function() {
                        var tabName = this.getAttribute('data-tab');
                        var allTabs = document.querySelectorAll('.dbz-sdk-tab');
                        var allContent = document.querySelectorAll('.dbz-sdk-tab-content');
                        for (var j = 0; j < allTabs.length; j++) allTabs[j].classList.remove('active');
                        for (var k = 0; k < allContent.length; k++) allContent[k].classList.remove('active');
                        this.classList.add('active');
                        var content = document.getElementById('dbz-tab-' + tabName);
                        if (content) content.classList.add('active');
                    });
                }

                var saveBtn = document.getElementById('dbz-nickname-save');
                if (saveBtn) {
                    saveBtn.addEventListener('click', function() {
                        var input = document.getElementById('dbz-nickname-input');
                        var status = document.getElementById('dbz-nickname-status');
                        if (input && input.value.trim()) {
                            userData.nickname = input.value.trim();
                            _syncConfigWithUser();
                            Storage.set('user', userData);
                            if (status) status.innerHTML = '<span style="color:#10b981;">Saved!</span>';
                            Analytics.trackCustom('NicknameChange', { nickname: userData.nickname });
                        }
                    });
                }

                var audioCheck = document.getElementById('dbz-battle-audio');
                if (audioCheck) {
                    audioCheck.addEventListener('change', function() {
                        SDK_CONFIG.clientParams.battleAudio = this.checked;
                        window.battleAudio = this.checked;
                        Analytics.trackCustom('SettingChange', { key: 'battleAudio', value: this.checked });
                    });
                }
            }, 100);
        }
    };


    // ============================================================
    // SECTION 15: ACCOUNT MANAGER
    // ============================================================
    // Account switching with confirmation UI. Generates new
    // user identity and reloads the game.

    var AccountManager = {
        switchUser: function() {
            var ref = this;
            var html = '';
            html += '<div class="dbz-sdk-info">\u26A0\uFE0F Switching accounts will reload the game with a new identity.</div>';
            html += '<div class="dbz-sdk-row"><span class="dbz-sdk-label">Current User</span><span class="dbz-sdk-value" style="font-size:12px;">' + userData.userId + '</span></div>';
            html += '<div class="dbz-sdk-row"><span class="dbz-sdk-label">Nickname</span><span class="dbz-sdk-value">' + UI._esc(userData.nickname) + '</span></div>';
            html += '<div class="dbz-sdk-row"><span class="dbz-sdk-label">Login Count</span><span class="dbz-sdk-value">' + userData.loginCount + '</span></div>';

            UI.create('\uD83D\uDD04 Switch Account', html, [
                { text: 'Cancel', class: 'dbz-sdk-btn-cancel', close: true },
                { text: '\u2705 Switch', class: 'dbz-sdk-btn-warning', close: false, onClick: function() { ref._doSwitch(); }}
            ]);
        },

        _doSwitch: function() {
            Analytics.trackCustom('AccountSwitch', { fromUser: userData.userId });
            Storage.remove('user');
            Storage.remove('gift_claims');

            userData = _loadOrCreateUserData();
            _sessionId = _generateSessionId();
            Storage.set('current_session_id', _sessionId);
            _syncConfigWithUser();

            Analytics.recordSession();
            Analytics.track(ReportDataType.EnterGame, { userId: userData.userId });
            LOG.success('Switched to new user: ' + userData.userId);

            setTimeout(function() { window.location.reload(); }, 500);
        }
    };


    // ============================================================
    // SECTION 16: SOCIAL ENGINE
    // ============================================================
    // Share/like functionality and FB live giveaway registration.

    var SocialEngine = {
        share: function(data) {
            LOG.call('SocialEngine.share()');

            var serverId = data ? data.serverId : '';
            var roleName = data ? data.roleName : userData.roleName;
            var extra = data ? (data.extra || '') : '';

            var shareText = '\uD83D\uDD25 Check out my progress in Dragon Ball Z: Super Warrior!\n';
            shareText += 'Server: ' + (serverId || userData.serverName) + '\n';
            shareText += 'Character: ' + (roleName || 'Hero') + '\n';
            if (extra) shareText += extra + '\n';
            shareText += '#DragonBall #SuperWarriorZ';

            var html = '<div class="dbz-sdk-info">Share your achievement!</div>';
            html += '<textarea class="dbz-sdk-textarea" id="dbz-share-text" style="min-height:100px;">' + UI._esc(shareText) + '</textarea>';
            html += '<div id="dbz-share-status" style="margin-top:10px;"></div>';

            UI.create('\uD83D\uDCAC Share', html, [
                { text: 'Cancel', class: 'dbz-sdk-btn-cancel', close: true },
                { text: '\uD83D\uDCE4 Copy to Clipboard', class: 'dbz-sdk-btn-primary', close: false, onClick: function() {
                    var textarea = document.getElementById('dbz-share-text');
                    var status = document.getElementById('dbz-share-status');
                    if (textarea && textarea.value) {
                        if (navigator.clipboard) {
                            navigator.clipboard.writeText(textarea.value).then(function() {
                                if (status) status.innerHTML = '<div class="dbz-sdk-success">\u2705 Copied!</div>';
                            });
                        } else {
                            textarea.select();
                            document.execCommand('copy');
                            if (status) status.innerHTML = '<div class="dbz-sdk-success">\u2705 Copied!</div>';
                        }
                    }
                }}
            ]);

            FBPixel.track('track', 'Share');
            Analytics.trackCustom('SocialShare', { serverId: serverId, roleName: roleName });
        },

        giveLive: function() {
            var html = '<div class="dbz-sdk-info">\uD83D\uDC4D Facebook Live Giveaway!</div>';
            html += '<div class="dbz-sdk-success">\u2728 Giveaway registered!<br><span style="font-size:12px;">You will receive your reward during the next live stream.</span></div>';

            UI.create('\uD83D\uDC4D FB Live Giveaway', html, [
                { text: 'OK', class: 'dbz-sdk-btn-primary', close: true }
            ]);

            Analytics.trackCustom('FBLiveGiveaway', {});
            FBPixel.track('track', 'Clickbutton');
        }
    };


    // ============================================================
    // SECTION 17: WINDOW PROPERTIES
    // ============================================================
    // All window properties read by the game via TSBrowser.getVariantValue().
    // Some are overwritten by index.html Script 1 after startGame callback.

    // Channel & OS
    window.sdkChannel = SDK_CONFIG.thirdChannel;
    window.sdkNativeChannel = SDK_CONFIG.clientParams.sdkNativeChannel;
    window.osType = SDK_CONFIG.thirdParams.osType;
    window.version = SDK_CONFIG.version;
    window.debugLanguage = SDK_CONFIG.language;

    // UI Flags
    window.supportLang = SDK_CONFIG.clientParams.supportLang;
    window.showContact = SDK_CONFIG.clientParams.showContact;
    window.showCurChannel = SDK_CONFIG.clientParams.showCurChannel;
    window.show18Home = SDK_CONFIG.clientParams.show18Home;
    window.show18Login = SDK_CONFIG.clientParams.show18Login;
    window.showSixteenImg = false;
    window.showUserCenterSdk = SDK_CONFIG.clientParams.showUserCenterSdk;
    window.switchAccount = SDK_CONFIG.clientParams.switchAccount;
    window.gameIcon = SDK_CONFIG.clientParams.gameIcon;
    window.hideList = SDK_CONFIG.clientParams.hideList;
    window.hideShop = false;
    window.battleAudio = SDK_CONFIG.clientParams.battleAudio;

    // Login Screen
    window.loginpictype = 0;
    window.loginpic = '';

    // Debug & Caching
    window.clientver = '';
    window.clientserver = '';
    window.debugUrl = '';
    window.mergeui = false;
    window.issdkVer2 = false;
    window.clientVersion = SDK_CONFIG.version;

    // Server
    window.serverList = null;
    window.hiddenServersRange = null;
    window.replaceServerName = null;

    // Privacy
    window.privacyUrl = '';

    // Twitter Pixel Queue (Proxy to intercept pushes)
    if (typeof Proxy !== 'undefined') {
        window.dotq = new Proxy([], {
            set: function(target, prop, value) { target[prop] = value; return true; },
            get: function(target, prop) {
                if (prop === 'push') {
                    return function() {
                        for (var i = 0; i < arguments.length; i++) {
                            TwitterPixel.push(arguments[i]);
                            Array.prototype.push.call(target, arguments[i]);
                        }
                        return target.length;
                    };
                }
                return target[prop];
            }
        });
    } else {
        window.dotq = [];
    }

    // Utility
    window.maskLayerClear = function() {
        var masks = document.querySelectorAll('.dbz-sdk-mask-overlay');
        for (var i = 0; i < masks.length; i++) {
            masks[i].parentNode.removeChild(masks[i]);
        }
    };

    window.JSONParseClass = {
        parse: function(str) {
            try { return JSON.parse(str); } catch (e) { return null; }
        }
    };

    // SDK Wrapper Functions (also defined in index.html Script 2)
    // We define them on window as fallback. Index.html will overwrite
    // them, but bridge.js intercepts ExternalInterface calls.

    window.checkSDK = function() {
        LOG.call('checkSDK() \u2192 true');
        if (typeof egret !== 'undefined' && egret.ExternalInterface) {
            egret.ExternalInterface.call("changeView", "change view");
        }
        return true;
    };

    window.checkFromNative = function() {
        LOG.call('checkFromNative() \u2192 true');
        return true;
    };

    window.getSdkLoginInfo = function() {
        LOG.call('getSdkLoginInfo()');
        var info = {
            errorCode: 0,
            loginToken: userData.token,
            userId: userData.userId,
            nickName: userData.nickname,
            nickname: userData.nickname,
            sdk: SDK_CONFIG.thirdParams.sdk,
            security: userData.token
        };
        LOG.data('Login Info:', info);
        return info;
    };

    window.paySdk = function(data) {
        LOG.call('paySdk()');
        if (data) {
            data.power = data.money;
            if (data.h5payParam) data.serverName = data.serverId;
            PaymentEngine.process(data);
        }
    };

    window.switchUser = function() {
        LOG.call('switchUser()');
        AccountManager.switchUser();
    };

    window.giveLikeSdk = function(data) {
        LOG.call('giveLikeSdk()');
        SocialEngine.share(data);
    };

    window.contactSdk = function() {
        LOG.call('contactSdk()');
        ContactCenter.showUI();
    };

    window.switchAccountSdk = function() {
        LOG.call('switchAccountSdk()');
        AccountManager.switchUser();
    };

    window.fbGiveLiveSdk = function() {
        LOG.call('fbGiveLiveSdk()');
        SocialEngine.giveLive();
    };

    window.userCenterSdk = function() {
        LOG.call('userCenterSdk()');
        UserCenterEngine.showUI();
    };

    window.gifBagSdk = function() {
        LOG.call('gifBagSdk()');
        GiftBagEngine.showUI();
    };

    window.report2Sdk = function(data) {
        LOG.call('report2Sdk()');
        if (data) {
            data.powerNum = data.moneyNum;
            Analytics.track('Report2Sdk', data);
            Storage.push('report2sdk_history', { data: data, timestamp: new Date().toISOString() });
            if (typeof egret !== 'undefined' && egret.ExternalInterface) {
                egret.ExternalInterface.call("report2Third", JSON.stringify(data));
            }
        }
    };

    window.gameChapterFinish = function(lessonId) {
        LOG.call('gameChapterFinish(' + lessonId + ')');
        var data = { dataType: 12, level: lessonId };
        Analytics.track(ReportDataType.blackStoneLessonFinish, data);
        if (lessonId === 10204) {
            FBPixel.track('track', 'Stage204cleared');
            GoogleAds.event('event', 'conversion', { send_to: 'AW-727890639/8tfJCPPO5akBEM_1itsC' });
        } else if (lessonId === 10308) {
            FBPixel.track('track', 'Stage308cleared');
            GoogleAds.event('event', 'conversion', { send_to: 'AW-727890639/jg2yCMq27qkBEM_1itsC' });
        }
        if (typeof egret !== 'undefined' && egret.ExternalInterface) {
            egret.ExternalInterface.call("report2Third", JSON.stringify(data));
        }
    };

    window.openShopPage = function() {
        LOG.call('openShopPage()');
        Analytics.trackCustom('OpenShopPage', { dataType: 13 });
        if (typeof egret !== 'undefined' && egret.ExternalInterface) {
            egret.ExternalInterface.call("report2Third", JSON.stringify({ dataType: 13 }));
        }
    };

    window.gameLevelUp = function(level) {
        LOG.call('gameLevelUp(' + level + ')');
        var data = { dataType: 11, level: level };
        Analytics.track(ReportDataType.LevelUp, data);
        userData.level = level;
        Storage.set('user', userData);

        // Check milestone levels
        if (level >= 2)  Analytics.track(ReportDataType.LevelAchieved2, { level: level });
        if (level >= 3)  Analytics.track(ReportDataType.userLevelAchieved3, { level: level });
        if (level >= 4)  Analytics.track(ReportDataType.LevelAchieved4, { level: level });
        if (level >= 6)  { Analytics.track(ReportDataType.LevelAchieved6, { level: level }); Analytics.track(ReportDataType.userLevelAchieved6, { level: level }); }
        if (level >= 18) Analytics.track(ReportDataType.userLevelAchieved18, { level: level });
        if (level >= 20) Analytics.track(ReportDataType.LevelAchieved20, { level: level });
        if (level >= 25) Analytics.track(ReportDataType.LevelAchieved25, { level: level });
        if (level >= 28) Analytics.track(ReportDataType.userevelAchieved28, { level: level });
        if (level >= 30) Analytics.track(ReportDataType.LevelAchieved30, { level: level });
        if (level >= 35) Analytics.track(ReportDataType.LevelAchieved35, { level: level });
        if (level >= 40) Analytics.track(ReportDataType.LevelAchieved40, { level: level });

        if (typeof egret !== 'undefined' && egret.ExternalInterface) {
            egret.ExternalInterface.call("report2Third", JSON.stringify(data));
        }
    };

    window.tutorialFinish = function() {
        LOG.call('tutorialFinish()');
        Analytics.track(ReportDataType.EndGuide, { dataType: 14 });
        FBPixel.track('track', 'TutorialEnds');
        FBPixel.track('track', 'Lead');
        GoogleAds.event('event', 'conversion', { send_to: 'AW-727890639/DtgTCLj73qUBEM_1itsC' });
        if (typeof egret !== 'undefined' && egret.ExternalInterface) {
            egret.ExternalInterface.call("report2Third", JSON.stringify({ dataType: 14 }));
        }
    };

    window.reload = function() {
        LOG.call('reload()');
        Analytics.trackCustom('ManualReload', {});
        if (typeof egret !== 'undefined' && egret.ExternalInterface) {
            egret.ExternalInterface.call("refresh", "reload game");
        } else {
            window.location.reload();
        }
    };

    window.changeLanguage = function(lang) {
        LOG.call('changeLanguage(' + lang + ')');
        if (!lang || lang.length < 2) { LOG.error('Invalid language: ' + lang); return; }

        // Validate language
        var valid = false;
        for (var i = 0; i < SDK_CONFIG.clientParams.supportLang.length; i++) {
            if (SDK_CONFIG.clientParams.supportLang[i].lang === lang) { valid = true; break; }
        }

        // Update ALL language-related fields
        SDK_CONFIG.language = lang;
        SDK_CONFIG.thirdChannel = lang;
        SDK_CONFIG.clientParams.sdkNativeChannel = lang;
        SDK_CONFIG.clientParams.showCurChannel = lang;
        window.sdkChannel = lang;
        window.sdkNativeChannel = lang;
        window.showCurChannel = lang;
        window.debugLanguage = lang;

        Storage.set('language', lang);
        Analytics.trackCustom('LanguageChange', { language: lang });
        LOG.success('Language changed to: ' + lang);

        if (typeof egret !== 'undefined' && egret.ExternalInterface) {
            egret.ExternalInterface.call("changeLanguage", lang);
        }

        // Only reload if bridge hasn't already initiated one
        if (!window._sdkLanguageChanging) {
            window.location.reload();
        }
    };

    window.openURL = function(url) {
        LOG.call('openURL(' + (url || '') + ')');
        if (url) {
            Analytics.trackCustom('OpenURL', { url: url });
            try {
                var a = document.createElement('a');
                a.href = url; a.target = '_blank'; a.rel = 'noopener noreferrer';
                document.body.appendChild(a); a.click(); a.parentNode.removeChild(a);
            } catch (e) {}
        }
    };

    window.open = function(url, target) {
        LOG.call('open(' + (url || '') + ')');
        if (url) {
            Analytics.trackCustom('OpenWindow', { url: url });
            try {
                var a = document.createElement('a');
                a.href = url; a.target = target || '_blank'; a.rel = 'noopener noreferrer';
                document.body.appendChild(a); a.click(); a.parentNode.removeChild(a);
            } catch (e) {}
        }
    };

    // Game-only functions (no index.html counterpart)

    window.getAppId = function() {
        return 'local_standalone';
    };

    window.getLoginServer = function() {
        return SDK_CONFIG.loginServer;
    };

    window.report2Third = function(data) {
        LOG.call('report2Third()');
        if (data) {
            if (typeof data === 'string') { try { data = JSON.parse(data); } catch (e) {} }
            Analytics.track('Report2Third', data);
            Storage.push('report2third_history', { data: data, timestamp: new Date().toISOString() });
        }
    };

    window.reportToBSH5Createrole = function(data) {
        LOG.call('reportToBSH5Createrole()');
        if (data) {
            if (typeof data === 'string') { try { data = JSON.parse(data); } catch (e) {} }
            Analytics.track('ReportBSH5Createrole', data);
            FBPixel.track('track', 'CharacterCreated', data);
        }
    };

    window.reportToFbq = function(event) {
        LOG.call('reportToFbq()');
        if (event) {
            if (typeof event === 'string') { try { event = JSON.parse(event); } catch (e) {} }
            FBPixel.track(event.actionName || event.action || 'track', event.eventName || event.event || 'Unknown', event.params || event.data || {});
        }
    };

    window.reportChatMsg = function(msg) {
        if (msg) {
            if (typeof msg === 'string') { try { msg = JSON.parse(msg); } catch (e) {} }
            Storage.push('chat_messages', { userId: userData.userId, message: msg, timestamp: new Date().toISOString(), sessionId: _sessionId });
        }
    };

    window.gameReady = function() {
        LOG.call('gameReady()');
        Analytics.track(ReportDataType.EnterGame, { userId: userData.userId });
        Analytics.track(ReportDataType.EnterGameFalse, { success: true });
        FBPixel.track('track', 'GameStarted');
        GoogleAds.event('config', 'AW-727890639');
        Storage.set('game_ready_time', new Date().toISOString());
        Storage.set('last_session_state', 'ready');
        LOG.success('Game reported as READY');
    };

    window.urlEncode = function(str) {
        return typeof str === 'string' ? encodeURIComponent(str) : '';
    };

    window.getHideAbove = function() {
        return Storage.get('hide_above_threshold', 0);
    };

    window.changeVipLink = function(url) {
        if (url) {
            Storage.set('vip_link', url);
            Analytics.trackCustom('ChangeVipLink', { url: url });
        }
    };

    window.loadJsonFunc = function(path) {
        if (typeof RES !== 'undefined' && RES.getRes) return RES.getRes(path);
        return null;
    };

    window.refreshPage = function() {
        if (typeof egret !== 'undefined' && egret.ExternalInterface) {
            egret.ExternalInterface.call("refresh", "refresh");
        }
    };

    // Report wrapper functions (unified tracking layer)

    window.ReportFaceBookSdkInfo = function(action, eventName) {
        FBPixel.track(action, eventName);
    };

    window.ReportBsH5FaceBookSdkInfo = function(action, eventName, data) {
        FBPixel.track(action, eventName, data);
    };

    window.ReportGoogleSdkInfo = function(conversionLabel) {
        GoogleAds.event('event', 'conversion', { send_to: conversionLabel });
    };

    window.ReportSdkInfoXX = function(reportDataType) {
        Analytics.track(reportDataType, { source: 'ReportSdkInfoXX' });
    };

    window.ReportToSdkCommon = function(reportDataType) {
        Analytics.track(reportDataType, { source: 'ReportToSdkCommon' });
    };

    window.ReportSdkInfo350 = function(eventType) {
        Analytics.track('Sdk350_' + eventType, { eventType: eventType });
    };

    window.ReportToCpapiCreaterole = function() {
        window.reportToCpapiCreaterole({
            userId: userData.userId,
            roleId: userData.roleId,
            roleName: userData.roleName,
            serverId: userData.serverId,
            serverName: userData.serverName
        });
    };

    window.ReportToBSH5Createrole = function() {
        window.reportToBSH5Createrole({ userId: userData.userId, roleId: userData.roleId, roleName: userData.roleName, serverId: userData.serverId });
    };

    window.ReportYaHooSdkInfo = function(event) {
        Analytics.trackCustom('Yahoo_' + event, {});
    };

    // PWA install prompt
    var _deferredPrompt = null;
    window.addEventListener('beforeinstallprompt', function(e) {
        e.preventDefault();
        _deferredPrompt = e;
    });

    window.pwaBtnClick = function() {
        if (_deferredPrompt) {
            _deferredPrompt.prompt();
            _deferredPrompt.userChoice.then(function(result) {
                Analytics.trackCustom('PWAInstallChoice', { outcome: result.outcome });
                _deferredPrompt = null;
            });
        }
    };


    // ============================================================
    // SECTION 18: window.LOCAL_SDK PUBLIC API
    // ============================================================
    // Complete public API exposed for bridge.js and debug console.
    // bridge.js accesses these to route ExternalInterface calls
    // to the real engine implementations.

    window.LOCAL_SDK = {
        // Configuration reference
        config: SDK_CONFIG,

        // Current user data reference (live, updates reflect immediately)
        user: userData,

        // Engine references
        analytics: Analytics,
        fbPixel: FBPixel,
        googleAds: GoogleAds,
        twitterPixel: TwitterPixel,
        payment: PaymentEngine,
        giftBag: GiftBagEngine,
        contact: ContactCenter,
        userCenter: UserCenterEngine,
        account: AccountManager,
        social: SocialEngine,
        storage: Storage,

        /**
         * getStartGameData() - Returns the complete JSON object that
         * bridge.js delivers to index.html via startGame callback.
         * This is the single most important function in the SDK.
         */
        getStartGameData: function() {
            // Build clientParams with current user/language state
            var clientParams = {
                hideList: [],
                gameIcon: '',
                supportLang: SDK_CONFIG.clientParams.supportLang,
                battleAudio: SDK_CONFIG.clientParams.battleAudio,
                showUserCenterSdk: true,
                showContact: true,
                switchAccount: true,
                sdkNativeChannel: SDK_CONFIG.language,
                showCurChannel: SDK_CONFIG.language,
                show18Login: false,
                show18Home: false
            };

            var thirdParamsData = {
                osType: 'android',
                sdkType: 'PP',
                sdk: 'local',
                nickname: userData.nickname,
                userid: userData.userId,
                data: {
                    sdk: 'local',
                    nickname: userData.nickname,
                    userid: userData.userId,
                    securityCode: userData.token,
                    loginToken: userData.token
                }
            };

            return {
                loginServer: SDK_CONFIG.loginServer,
                thirdParams: JSON.stringify(thirdParamsData),
                clientParams: JSON.stringify(clientParams),
                version: SDK_CONFIG.version,
                versionConfig: SDK_CONFIG.versionConfig,
                language: SDK_CONFIG.language,
                thirdChannel: SDK_CONFIG.language
            };
        },

        /**
         * initSDKDe(key) - SDK initialization with appId verification.
         * Returns true if the provided key matches the expected appId.
         */
        initSDKDe: function(key) {
            var isValid = (key === SDK_CONFIG.appId);
            if (window.__SDK_DEBUG__) {
                LOG.data('Analytics: initSDKDe()', {
                    hasKey: !!key,
                    isCorrectKey: isValid,
                    keyLength: key ? key.length : 0
                });
            }
            Analytics.trackCustom('SDKInit', {
                hasKey: !!key,
                isCorrectKey: isValid,
                keyLength: key ? key.length : 0
            });
            return isValid;
        },

        /**
         * resetUser() - Clear user data and generate new identity.
         * Does NOT reload - caller must handle reload.
         */
        resetUser: function() {
            Storage.remove('user');
            Storage.remove('language');
            Storage.remove('current_session_id');
            _sessionId = _generateSessionId();
            Storage.set('current_session_id', _sessionId);
            userData = _loadOrCreateUserData();
            _syncConfigWithUser();
            LOG.success('User reset. New ID: ' + userData.userId);
        },

        /**
         * setLanguage(lang) - Change language and persist.
         * Does NOT reload by default (bridge handles that).
         */
        setLanguage: function(lang) {
            SDK_CONFIG.language = lang;
            SDK_CONFIG.thirdChannel = lang;
            SDK_CONFIG.clientParams.sdkNativeChannel = lang;
            SDK_CONFIG.clientParams.showCurChannel = lang;
            window.sdkChannel = lang;
            window.sdkNativeChannel = lang;
            window.showCurChannel = lang;
            window.debugLanguage = lang;
            Storage.set('language', lang);
            LOG.success('Language set to: ' + lang);
        },

        /**
         * showConfig() - Debug: display current SDK configuration.
         */
        showConfig: function() {
            console.group('%c[SDK] Configuration', 'color:#10b981;font-weight:bold;font-size:14px;');
            console.log('Language:', SDK_CONFIG.language);
            console.log('Channel:', SDK_CONFIG.thirdChannel);
            console.log('Login Server:', SDK_CONFIG.loginServer);
            console.log('Version:', SDK_CONFIG.version);
            console.log('User ID:', userData.userId);
            console.log('Nickname:', userData.nickname);
            console.log('Session:', _sessionId);
            console.log('Debug Mode:', !!window.__SDK_DEBUG__);
            console.groupEnd();
        },

        /**
         * showFunctions() - Debug: list all SDK window functions.
         */
        showFunctions: function() {
            var fns = [
                'getQueryStringByName', 'fbq', 'gtag', 'reportLogToPP',
                'sendCustomEvent', 'accountLoginCallback', 'initSDKDe',
                'report2Sdk350CreateRole', 'report2Sdk350LoginUser',
                'reportToCpapiCreaterole', 'checkSDK', 'checkFromNative',
                'getSdkLoginInfo', 'paySdk', 'switchUser', 'giveLikeSdk',
                'contactSdk', 'switchAccountSdk', 'fbGiveLiveSdk',
                'userCenterSdk', 'gifBagSdk', 'report2Sdk',
                'gameChapterFinish', 'openShopPage', 'gameLevelUp',
                'tutorialFinish', 'reload', 'changeLanguage', 'openURL',
                'open', 'gameReady', 'refreshPage', 'loadJsonFunc'
            ];
            console.group('%c[SDK] Window Functions (' + fns.length + ')', 'color:#0ea5e9;font-weight:bold;');
            for (var i = 0; i < fns.length; i++) {
                var fn = window[fns[i]];
                var status = typeof fn === 'function' ? '\u2705' : '\u274C';
                console.log(status + ' ' + fns[i] + '()');
            }
            console.groupEnd();
        },

        /**
         * showProperties() - Debug: list all SDK window properties.
         */
        showProperties: function() {
            var props = [
                'sdkChannel', 'debugLanguage', 'debug', 'clientver',
                'version', 'versionConfig', 'reportBattlleLog',
                'Log_Clean', 'CacheNum', 'gameIcon', 'battleAudio',
                'supportLang', 'showContact', 'showUserCenterSdk',
                'switchAccount', 'osType', 'sdkNativeChannel', 'showCurChannel'
            ];
            console.group('%c[SDK] Window Properties (' + props.length + ')', 'color:#8b5cf6;font-weight:bold;');
            for (var i = 0; i < props.length; i++) {
                var val = window[props[i]];
                var type = val === null ? 'null' : typeof val;
                var display = val;
                if (Array.isArray(val)) display = '[' + val.length + ' items]';
                else if (type === 'object' && val !== null) display = '{...}';
                console.log('\u25CF ' + props[i] + ' (' + type + '):', display);
            }
            console.groupEnd();
        }
    };

    // Ensure initSDKDe on window also routes to LOCAL_SDK
    window.initSDKDe = function(key) {
        if (window.LOCAL_SDK) {
            return window.LOCAL_SDK.initSDKDe(key);
        }
        return false;
    };

    // ============================================================
    // INITIALIZATION COMPLETE
    // ============================================================
    // Record session and log boot summary.

    Analytics.recordSession();
    LOG.title('SDK v4.0.0 Loaded');
    LOG.info('Language: ' + SDK_CONFIG.language);
    LOG.info('User: ' + userData.userId);
    LOG.info('Session: ' + _sessionId);
    LOG.info('Debug: ' + (window.__SDK_DEBUG__ ? 'verbose' : 'compact'));
    LOG.info('Window functions: 35+ defined');
    LOG.info('Engines: Analytics, FBPixel, GoogleAds, TwitterPixel, Payment, GiftBag, Contact, UserCenter, Account, Social');


})(window);
