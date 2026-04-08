/**
 * ============================================================
 * BRIDGE.JS - DragonBall HTML5 Standalone Bridge v3.0
 * ============================================================
 * 
 * PRINSIP: Bridge menangani SEMUA egret.ExternalInterface.call()
 * yang dilakukan oleh index.html. Tidak memodifikasi file game.
 * 
 * ExternalInterface calls dari index.html:
 * - startGame        -> Kirim data SDK ke game (PALING KRITIS)
 * - refresh           -> Reload halaman / switch user
 * - changeView        -> View change notification
 * - pei               -> Payment
 * - giveLike          -> Facebook share
 * - contact           -> Customer service
 * - switchAccount     -> Switch account
 * - fbGiveLive        -> Facebook like
 * - userCenter        -> User center
 * - gifBag            -> Gift bag
 * - report2Third      -> Analytics report
 * - changeLanguage    -> Language change (HARUS simpan ke localStorage!)
 * - openURL           -> Open URL (HARUS pakai native window.open!)
 * 
 * Load Order: AFTER egret.web.min.js (via manifest.json)
 * 
 * BUG FIXES v3.0:
 * - changeLanguage handler SEKARANG menyimpan bahasa via LOCAL_SDK.saveLanguage()
 * - refresh + "switch usr" SEKARANG reset user via LOCAL_SDK.resetUser()
 * - openURL SEKARANG pakai _nativeWindowOpen dari LOCAL_SDK (anti infinite loop)
 * - switchAccount handler SEKARANG reset user sebelum reload
 * 
 * Version: 3.0.0
 * ============================================================
 */

(function() {
    'use strict';

    // ========================================================
    // 1. LOGGER
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
        _log: function(level, icon, message, data) {
            var ts = new Date().toISOString().substr(11, 12);
            var style = this.styles[level] || this.styles.info;
            var fmt = '%c' + this.prefix + ' %c[' + ts + '] ' + icon + ' ' + message;
            if (data !== undefined) {
                console.log(fmt, this.styles.title, style, data);
            } else {
                console.log(fmt, this.styles.title, style);
            }
        },
        title: function(message) {
            var line = '\u2550'.repeat(60);
            console.log('%c' + this.prefix + '%c ' + line, this.styles.title, this.styles.separator);
            console.log('%c' + this.prefix + '%c ' + message, this.styles.title, this.styles.title);
            console.log('%c' + this.prefix + '%c ' + line, this.styles.title, this.styles.separator);
        },
        success: function(msg, data) { this._log('success', '\u2705', msg, data); },
        info: function(msg, data) { this._log('info', '\u2139\uFE0F', msg, data); },
        warn: function(msg, data) { this._log('warn', '\u26A0\uFE0F', msg, data); },
        error: function(msg, data) { this._log('error', '\u274C', msg, data); },
        data: function(msg, data) { this._log('data', '\uD83D\uDCE6', msg, data); },
        call: function(name, msg) { this._log('info', '\uD83D\uDCDE', name + '("' + msg + '")'); },
        callback: function(name, data) {
            this._log('success', '\uD83D\uDD14', 'Callback: ' + name);
            if (data !== undefined) this._log('data', '\uD83D\uDCE4', data);
        },
        separator: function() {
            console.log('%c' + this.prefix + '%c ' + '\u2500'.repeat(60), this.styles.title, this.styles.separator);
        }
    };

    // ========================================================
    // 2. STATE
    // ========================================================
    var _callbacks = {};
    var _pendingCalls = {};
    var _state = {
        initialized: false,
        startGameTriggered: false,
        callbackCount: 0,
        callCount: 0
    };

    // ========================================================
    // 3. CHECK EGRET
    // ========================================================
    if (typeof egret === 'undefined') {
        console.error('\uD83C\uDFAE [BRIDGE] FATAL: egret object not found!');
        return;
    }
    if (!egret.ExternalInterface) {
        console.error('\uD83C\uDFAE [BRIDGE] FATAL: egret.ExternalInterface not found!');
        return;
    }

    LOG.title('Bridge v3.0 Initializing...');

    // ========================================================
    // 4. OVERRIDE addCallback
    // ========================================================
    egret.ExternalInterface.addCallback = function(name, callback) {
        _state.callbackCount++;
        
        LOG.info('addCallback("' + name + '") [ID:' + _state.callbackCount + ']');
        
        if (typeof callback !== 'function') {
            LOG.error('Callback is not a function: ' + typeof callback);
            return;
        }
        
        _callbacks[name] = {
            fn: callback,
            id: _state.callbackCount,
            registeredAt: new Date().toISOString()
        };
        
        LOG.success('Registered: "' + name + '" [Total: ' + Object.keys(_callbacks).length + ']');
        
        // Cek pending call
        if (_pendingCalls[name]) {
            LOG.info('Pending call found for "' + name + '", triggering...');
            _triggerCallback(name, _pendingCalls[name].message);
            delete _pendingCalls[name];
        }
    };

    // ========================================================
    // 5. TRIGGER CALLBACK HELPER
    // ========================================================
    function _triggerCallback(name, message) {
        var cb = _callbacks[name];
        if (!cb || typeof cb.fn !== 'function') {
            LOG.error('No valid callback for: "' + name + '"');
            return false;
        }
        try {
            LOG.callback(name, message);
            cb.fn(message);
            return true;
        } catch (e) {
            LOG.error('Error in callback "' + name + '":', e);
            console.error(e);
            return false;
        }
    }

    // ========================================================
    // 6. GET SDK DATA HELPER
    // ========================================================
    function _getSDKData() {
        if (typeof window.LOCAL_SDK === 'undefined') {
            LOG.error('window.LOCAL_SDK not found!');
            return null;
        }
        if (typeof window.LOCAL_SDK.getStartGameData !== 'function') {
            LOG.error('LOCAL_SDK.getStartGameData is not a function!');
            return null;
        }
        return window.LOCAL_SDK.getStartGameData();
    }

    // ========================================================
    // 7. GET NATIVE WINDOW OPEN (anti infinite loop)
    // ========================================================
    // CRITICAL: index.html meng-overwrite window.open dengan:
    //   var open = function(url) { ExternalInterface.call("openURL", url); }
    // Kalau bridge memanggil window.open() → ExternalInterface.call("openURL")
    // → bridge handler openURL → window.open() → LOOP INFINITE!
    // Solution: Pakai _nativeWindowOpen yang disimpan sdk.js
    function _getNativeOpen() {
        if (typeof window.LOCAL_SDK !== 'undefined' && window.LOCAL_SDK._nativeWindowOpen) {
            return window.LOCAL_SDK._nativeWindowOpen;
        }
        LOG.warn('LOCAL_SDK._nativeWindowOpen not available, falling back to window.open');
        return window.open;
    }

    // ========================================================
    // 8. OVERRIDE call - MAIN HANDLER
    // ========================================================
    egret.ExternalInterface.call = function(name, message) {
        _state.callCount++;
        var callId = _state.callCount;
        
        LOG.title('Call #' + callId + ': ' + name);
        LOG.call(name, message);
        
        switch (name) {
            
            // ================================================
            // startGame - PALING KRITIS
            // ================================================
            case 'startGame':
                _handleStartGame();
                break;
                
            // ================================================
            // refresh - Reload / Switch User
            // ================================================
            case 'refresh':
                _handleRefresh(message);
                break;
                
            // ================================================
            // changeView - View notification
            // ================================================
            case 'changeView':
                LOG.info('changeView: ' + message);
                break;
                
            // ================================================
            // pei - Payment
            // ================================================
            case 'pei':
                LOG.info('Payment (pei) called');
                try { LOG.data('Data:', JSON.parse(message)); } catch (e) {}
                LOG.warn('Standalone mode - Payment bypassed');
                break;
                
            // ================================================
            // giveLike - Facebook Share
            // ================================================
            case 'giveLike':
                LOG.info('giveLike (Share) called');
                try { LOG.data('Data:', JSON.parse(message)); } catch (e) {}
                LOG.warn('Standalone mode - Share bypassed');
                break;
                
            // ================================================
            // contact - Customer Service
            // ================================================
            case 'contact':
                LOG.info('contact (Customer Service) called');
                break;
                
            // ================================================
            // switchAccount - Switch Account
            // ================================================
            case 'switchAccount':
                LOG.info('switchAccount called');
                _handleSwitchAccount();
                break;
                
            // ================================================
            // fbGiveLive - Facebook Like
            // ================================================
            case 'fbGiveLive':
                LOG.info('fbGiveLive (FB Like) called');
                break;
                
            // ================================================
            // userCenter - User Center
            // ================================================
            case 'userCenter':
                LOG.info('userCenter called');
                break;
                
            // ================================================
            // gifBag - Gift Bag
            // ================================================
            case 'gifBag':
                LOG.info('gifBag (Gift) called');
                break;
                
            // ================================================
            // report2Third - Analytics
            // ================================================
            case 'report2Third':
                LOG.info('report2Third (Analytics) called');
                try { LOG.data('Data:', JSON.parse(message)); } catch (e) {}
                break;
                
            // ================================================
            // changeLanguage - Language Change
            // ================================================
            // BUG FIX v3.0: SEKARANG menyimpan bahasa ke localStorage!
            // 
            // Flow: index.html changeLanguage(lang) memanggil:
            //   1. ExternalInterface.call("changeLanguage", lang)  ← kita tangkap di sini
            //   2. window.location.reload()                        ← langsung reload
            // 
            // Masalah: Versi index.html TIDAK menyimpan bahasa ke localStorage.
            // Jadi bridge HARUS menyimpannya sebelum reload terjadi.
            // ========================================================
            case 'changeLanguage':
                LOG.info('changeLanguage: ' + message);
                if (message && typeof window.LOCAL_SDK !== 'undefined' && window.LOCAL_SDK.saveLanguage) {
                    window.LOCAL_SDK.saveLanguage(message);
                    LOG.success('Language saved via bridge: ' + message);
                } else {
                    LOG.warn('Cannot save language - LOCAL_SDK.saveLanguage not available');
                }
                break;
                
            // ================================================
            // openURL - Open URL
            // ================================================
            // BUG FIX v3.0: SEKARANG pakai _nativeWindowOpen!
            // 
            // index.html overwrite window.open:
            //   var open = function(url) { ExternalInterface.call("openURL", url); }
            // Kalau kita pakai window.open di sini → LOOP INFINITE!
            // ========================================================
            case 'openURL':
                LOG.info('openURL: ' + message);
                if (message) {
                    var nativeOpen = _getNativeOpen();
                    try {
                        nativeOpen.call(window, message, '_blank');
                        LOG.success('URL opened with native window.open');
                    } catch (e) {
                        LOG.error('Failed to open URL:', e);
                    }
                }
                break;
                
            // ================================================
            // Unknown
            // ================================================
            default:
                LOG.warn('Unknown call: "' + name + '" message: "' + message + '"');
        }
        
        LOG.separator();
    };

    // ========================================================
    // 9. HANDLER: startGame
    // ========================================================
    function _handleStartGame() {
        LOG.info('startGame - Game requesting SDK data...');
        
        if (_state.startGameTriggered) {
            LOG.warn('startGame already triggered! Skipping.');
            return;
        }
        _state.startGameTriggered = true;
        
        var doStartGame = function() {
            var data = _getSDKData();
            if (!data) {
                LOG.error('Failed to get SDK data!');
                return;
            }
            
            LOG.data('SDK Data:', data);
            
            setTimeout(function() {
                LOG.title('Triggering startGame Callback');
                var json = JSON.stringify(data);
                var success = _triggerCallback('startGame', json);
                if (success) {
                    LOG.success('Game should start now!');
                } else {
                    LOG.error('startGame callback failed!');
                }
            }, 100);
        };
        
        if (_callbacks['startGame']) {
            LOG.info('Callback already registered');
            doStartGame();
        } else {
            LOG.info('Callback not yet registered, waiting...');
            _pendingCalls['startGame'] = { message: '', timestamp: new Date().toISOString() };
            
            var interval = setInterval(function() {
                if (_callbacks['startGame']) {
                    clearInterval(interval);
                    delete _pendingCalls['startGame'];
                    LOG.info('Callback registered, triggering...');
                    doStartGame();
                }
            }, 50);
            
            setTimeout(function() {
                if (_pendingCalls['startGame']) {
                    clearInterval(interval);
                    LOG.error('Timeout (5s) waiting for startGame callback!');
                }
            }, 5000);
        }
    }

    // ========================================================
    // 10. HANDLER: refresh
    // ========================================================
    // BUG FIX v3.0: "switch usr" SEKARANG reset user data!
    // 
    // Flow: index.html switchUser() memanggil:
    //   ExternalInterface.call("refresh", "switch usr")
    // 
    // Masalah: Versi lama bridge hanya reload tanpa reset userData.
    // localStorage tetap ada → sdk.js load user lama → TIDAK berganti user!
    // ========================================================
    function _handleRefresh(message) {
        LOG.info('refresh: "' + message + '"');
        
        if (message === 'switch usr') {
            // Switch user - HARUS reset user data di localStorage!
            LOG.info('Action: Switch user');
            _handleSwitchAccount();
        } else {
            // Normal refresh (message = 'refresh' atau 'reload game')
            LOG.info('Action: Page reload');
            if (_callbacks['refresh']) {
                _triggerCallback('refresh', message);
            } else {
                setTimeout(function() { window.location.reload(); }, 100);
            }
        }
    }

    // ========================================================
    // 11. HANDLER: switchAccount
    // ========================================================
    // BUG FIX v3.0: SEKARANG reset user data sebelum reload!
    // 
    // Tanpa reset, localStorage masih berisi user lama.
    // sdk.js akan load user lama → TIDAK ada efek switch account!
    // ========================================================
    function _handleSwitchAccount() {
        LOG.info('Action: Switch account - resetting user data');
        
        // Reset user data di localStorage via LOCAL_SDK
        if (typeof window.LOCAL_SDK !== 'undefined' && typeof window.LOCAL_SDK.resetUser === 'function') {
            window.LOCAL_SDK.resetUser();
            LOG.success('User data cleared via LOCAL_SDK.resetUser()');
        } else {
            // Fallback: langsung hapus localStorage
            // FIXED: Gunakan LOCAL_SDK.STORAGE_KEY bukan hardcoded string,
            // agar tetap sinkron jika STORAGE_KEY berubah di sdk.js
            try {
                var sdkStorageKey = (typeof window.LOCAL_SDK !== 'undefined' && window.LOCAL_SDK.STORAGE_KEY) 
                    ? window.LOCAL_SDK.STORAGE_KEY 
                    : 'dragonball_local_sdk';
                localStorage.removeItem(sdkStorageKey);
                LOG.success('User data cleared directly from localStorage');
            } catch (e) {
                LOG.error('Failed to clear user data:', e);
            }
        }
        
        // Reload setelah user data direset
        setTimeout(function() { window.location.reload(); }, 100);
    }

    // ========================================================
    // 12. INIT DONE
    // ========================================================
    _state.initialized = true;
    
    LOG.title('Bridge v3.0 Initialized!');
    LOG.success('Overridden: egret.ExternalInterface.call, addCallback');
    LOG.info('Handlers: startGame, refresh, changeView, pei, giveLike,');
    LOG.info('          contact, switchAccount, fbGiveLive, userCenter,');
    LOG.info('          gifBag, report2Third, changeLanguage [SAVES LANG!],');
    LOG.info('          openURL [USES NATIVE OPEN!]');
    LOG.info('');
    LOG.info('Bug fixes from v2.0:');
    LOG.info('  - changeLanguage now saves language to localStorage');
    LOG.info('  - refresh "switch usr" now resets user data');
    LOG.info('  - switchAccount now resets user data');
    LOG.info('  - openURL now uses native window.open (anti infinite loop)');
    LOG.info('');
    LOG.info('Ready!');

    // ========================================================
    // 13. DEBUG
    // ========================================================
    window.BRIDGE_DEBUG = {
        state: _state,
        callbacks: _callbacks,
        pendingCalls: _pendingCalls,
        triggerCallback: _triggerCallback,
        getSDKData: _getSDKData,
        logState: function() {
            console.log('%c\uD83C\uDFAE [BRIDGE] State:', 'font-weight:bold;color:#667eea;', {
                initialized: _state.initialized,
                startGameTriggered: _state.startGameTriggered,
                callCount: _state.callCount,
                callbackCount: _state.callbackCount,
                callbacks: Object.keys(_callbacks),
                pendingCalls: Object.keys(_pendingCalls)
            });
        }
    };

})();
