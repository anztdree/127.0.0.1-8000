/**
 * ================================================================
 *  PPGAME SDK — Client Side  (Super Warrior Z / 超级战士Z)
 * ================================================================
 *
 *  SDK ini berperan sebagai PPGAME SDK yang asli.
 *  Dipanggil oleh game via TSBrowser.executeFunction() dan
 *  TSBrowser.getVariantValue() — keduanya membaca dari window[].
 *
 *  CARA PAKAI:
 *    Di index.html, tambahkan SEBELUM script lainnya:
 *    <script src="SDK/sdk.js"></script>
 *
 *    ATAU kalau index.html tidak mau di-edit, inject via nginx:
 *    sub_filter '</head>' '<script src="/SDK/sdk.js"></script></head>';
 *
 *  PENTING:
 *    - sdk.js HARUS load SEBELUM game code (main.min.js)
 *    - sdk.js harus load SEBELUM inline script di index.html baris 189+
 *      supaya window.PPGAME sudah ada saat if(window.PPGAME) dicek
 *    - Order: sdk.js → jszip → inline-boot → inline-sdk-bridge
 *    - Kalau sdk.js load setelah inline-sdk-bridge, bridge tidak aktif
 *      SOLUSI: sdk.js juga override fungsi bridge sendiri (fallback)
 */

(function () {
    "use strict";

    // ============================================================
    //  Konfigurasi
    // ============================================================
    var SDK_VERSION = "2.0.0";
    var SDK_SERVER = window.location.protocol + "//" + window.location.hostname + ":9999";
    var GAME_SERVER = "http://127.0.0.1:8000";
    var APP_ID = "ppgame_custom";

    // ============================================================
    //  Helpers — paling awal supaya semua fungsi bisa pakai
    // ============================================================

    /** Baca dari localStorage, parse JSON, fallback ke defaultVal */
    function _storageGet(key, defaultVal) {
        try {
            var val = localStorage.getItem(key);
            return val !== null ? JSON.parse(val) : defaultVal;
        } catch (e) {
            return defaultVal;
        }
    }

    /** Simpan ke localStorage sebagai JSON */
    function _storageSet(key, val) {
        try {
            localStorage.setItem(key, JSON.stringify(val));
        } catch (e) {
            console.error("[PPGAME] localStorage error:", e);
        }
    }

    /** HTTP POST ke SDK server */
    function _httpPost(path, data, callback, errorCallback) {
        var xhr = new XMLHttpRequest();
        xhr.open("POST", SDK_SERVER + path, true);
        xhr.setRequestHeader("Content-Type", "application/json");
        xhr.timeout = 8000;
        xhr.onreadystatechange = function () {
            if (xhr.readyState === 4) {
                if (xhr.status === 200) {
                    try {
                        callback && callback(JSON.parse(xhr.responseText));
                    } catch (e) {
                        errorCallback && errorCallback(e);
                    }
                } else {
                    errorCallback && errorCallback(xhr.status);
                }
            }
        };
        xhr.ontimeout = function () {
            console.warn("[PPGAME] POST timeout:", path);
            errorCallback && errorCallback("timeout");
        };
        xhr.send(JSON.stringify(data));
    }

    /** HTTP GET ke SDK server */
    function _httpGet(path, callback, errorCallback) {
        var xhr = new XMLHttpRequest();
        xhr.open("GET", SDK_SERVER + path, true);
        xhr.timeout = 8000;
        xhr.onreadystatechange = function () {
            if (xhr.readyState === 4) {
                if (xhr.status === 200) {
                    try {
                        callback && callback(JSON.parse(xhr.responseText));
                    } catch (e) {
                        errorCallback && errorCallback(e);
                    }
                } else {
                    errorCallback && errorCallback(xhr.status);
                }
            }
        };
        xhr.ontimeout = function () {
            console.warn("[PPGAME] GET timeout:", path);
            errorCallback && errorCallback("timeout");
        };
        xhr.send();
    }

    /** Parse URL query string jadi object */
    function _parseUrlParams() {
        var params = {};
        try {
            var search = location.search.substring(1);
            if (!search) return params;
            var pairs = search.split("&");
            for (var i = 0; i < pairs.length; i++) {
                var pair = pairs[i].split("=");
                if (pair.length === 2) {
                    params[decodeURIComponent(pair[0])] = decodeURIComponent(pair[1]);
                }
            }
        } catch (e) {}
        return params;
    }

    /** Generate simple unique ID (tanpa crypto) */
    function _simpleUID() {
        return Date.now().toString(36) + Math.random().toString(36).substring(2, 10);
    }

    // ============================================================
    //  State Management
    // ============================================================
    var _state = _storageGet("ppgame_state", {
        userId: null,
        nickname: null,
        loginToken: null,
        sdk: null,
        serverId: null,
        serverName: null,
        characterId: null,
        characterName: null,
        characterLevel: 1,
        sessionId: null,
        lastLoginTime: null
    });

    function _saveState() {
        _storageSet("ppgame_state", _state);
    }

    function _isLoggedIn() {
        return !!(_state.userId && _state.loginToken);
    }

    function _clearLogin() {
        _state.userId = null;
        _state.nickname = null;
        _state.loginToken = null;
        _state.sdk = null;
        _state.sessionId = null;
        _state.lastLoginTime = null;
        _saveState();
    }

    function _setLogin(info) {
        _state.userId = info.userId;
        _state.nickname = info.nickname || ("Player_" + info.userId.slice(0, 6));
        _state.loginToken = info.loginToken;
        _state.sdk = info.sdk || "custom";
        _state.sessionId = _simpleUID();
        _state.lastLoginTime = Date.now();
        _saveState();
    }

    // ============================================================
    //  Baca URL params untuk auto-login
    // ============================================================
    var _urlParams = _parseUrlParams();
    if (_urlParams.sdk && _urlParams.logintoken && _urlParams.nickname && _urlParams.userid) {
        _setLogin({
            userId: _urlParams.userid,
            nickname: _urlParams.nickname,
            loginToken: _urlParams.logintoken,
            sdk: _urlParams.sdk
        });
        console.log("[PPGAME] Auto-login dari URL params, userId:", _urlParams.userid);
    }

    // ============================================================
    //  window.PPGAME — Object utama yang dicek index.html
    //  if(window.PPGAME) { paySdk = function(a) { PPGAME.createPaymentOrder(a) } ... }
    // ============================================================
    window.PPGAME = {

        /**
         * Buat order pembayaran.
         * Dipanggil oleh index.html: paySdk(a) → PPGAME.createPaymentOrder(a)
         * @param {object} orderData - Data order dari game
         */
        createPaymentOrder: function (orderData) {
            console.log("[PPGAME] createPaymentOrder:", JSON.stringify(orderData));
            _httpPost("/api/payment/create", {
                order: orderData,
                userId: _state.userId,
                serverId: _state.serverId,
                characterId: _state.characterId,
                characterName: _state.characterName
            }, function (res) {
                console.log("[PPGAME] Payment order created:", res);
                if (res && res.orderId) {
                    // Auto-complete payment (sandbox mode)
                    _httpPost("/api/payment/complete", {
                        orderId: res.orderId,
                        userId: _state.userId
                    }, function (res2) {
                        console.log("[PPGAME] Payment completed:", res2);
                    });
                }
            }, function (err) {
                console.error("[PPGAME] Payment error:", err);
            });
        },

        /**
         * Game sudah siap (loading selesai).
         * Dipanggil oleh index.html: gameReady() → PPGAME.gameReady()
         */
        gameReady: function () {
            console.log("[PPGAME] gameReady — game loaded successfully");
            _httpPost("/api/event", {
                event: "game_ready",
                userId: _state.userId,
                data: { version: SDK_VERSION, timestamp: Date.now() }
            });

            // Sembunyikan tombol Guest kalau ada
            var guestBtn = document.getElementById("ppgame-guest-btn");
            if (guestBtn) {
                guestBtn.style.display = "none";
            }
        },

        /**
         * Player masuk ke server game.
         * Dipanggil oleh report2Sdk() saat dataType == 3:
         *   PPGAME.playerEnterServer({characterName, characterId, serverId, serverName})
         */
        playerEnterServer: function (info) {
            console.log("[PPGAME] playerEnterServer:", JSON.stringify(info));
            if (info) {
                _state.serverId = info.serverId;
                _state.serverName = info.serverName;
                _state.characterId = info.characterId;
                _state.characterName = info.characterName;
                _saveState();
            }
            _httpPost("/api/event", {
                event: "enter_server",
                userId: _state.userId,
                data: info || {}
            });
        },

        /**
         * Submit event generic.
         * Dipanggil oleh report2Sdk() saat dataType == 2 (create role),
         * dan oleh tutorialFinish():
         *   PPGAME.submitEvent("game_create_role", {...})
         *   PPGAME.submitEvent("game_tutorial_finish")
         */
        submitEvent: function (eventName, data) {
            console.log("[PPGAME] submitEvent:", eventName);
            _httpPost("/api/event", {
                event: eventName,
                userId: _state.userId,
                data: data || {}
            });
        },

        /**
         * Chapter selesai.
         * Dipanggil oleh: gameChapterFinish(a) → PPGAME.gameChapterFinish(a)
         */
        gameChapterFinish: function (data) {
            console.log("[PPGAME] gameChapterFinish:", JSON.stringify(data));
            _httpPost("/api/event", {
                event: "chapter_finish",
                userId: _state.userId,
                data: data || {}
            });
        },

        /**
         * Buka shop.
         * Dipanggil oleh: openShopPage() → PPGAME.openShopPage()
         */
        openShopPage: function () {
            console.log("[PPGAME] openShopPage");
            _httpPost("/api/event", {
                event: "open_shop",
                userId: _state.userId,
                data: {}
            });
        },

        /**
         * Level naik.
         * Dipanggil oleh: gameLevelUp(a) → PPGAME.gameLevelUp(a)
         */
        gameLevelUp: function (data) {
            console.log("[PPGAME] gameLevelUp:", JSON.stringify(data));
            if (data && data.level) {
                _state.characterLevel = data.level;
                _saveState();
            }
            _httpPost("/api/event", {
                event: "level_up",
                userId: _state.userId,
                data: data || {}
            });
        }
    };

    // ============================================================
    //  FUNGSI BRIDGE — Override index.html functions
    //
    //  index.html mendefinisikan fungsi-fungsi ini di inline script
    //  BAGIAN PALING BAWAH (setelah game boot). Tapi karena sdk.js
    //  load SEBELUM inline script, kita SET dulu. Lalu inline script
    //  menimpa dengan versinya sendiri (yang delegate ke PPGAME).
    //
    //  Namun untuk amannya (kalau load order beda), kita juga
    //  memastikan fungsi ini ada SETELAH DOM ready.
    // ============================================================

    /**
     * checkSDK() — dipanggil game untuk cek apakah SDK aktif.
     * index.html sudah define: return true. Kita pastikan true.
     */
    // (tidak perlu override, index.html sudah return true)

    /**
     * getSdkLoginInfo() — CRITICAL!
     * Dipanggil oleh TSBrowser.executeFunction("getSdkLoginInfo")
     * dan juga oleh index.html.
     *
     * index.html versi asli cuma baca URL params.
     * Kita override supaya juga baca dari localStorage
     * (untuk Guest login yang tidak reload dengan URL params).
     *
     * Return format: { sdk, loginToken, nickName, userId } atau null
     * PERHATIAN: key "nickName" (dengan N besar) — bukan "nickname"
     */
    window.getSdkLoginInfo = function () {
        // 1. Cek URL params dulu (cara asli index.html)
        var params = _parseUrlParams();
        if (params.sdk && params.logintoken && params.nickname && params.userid) {
            var info = {
                sdk: params.sdk,
                loginToken: params.logintoken,
                nickName: params.nickname,
                userId: params.userid
            };
            // Sync ke state
            _setLogin({
                userId: params.userid,
                nickname: params.nickname,
                loginToken: params.logintoken,
                sdk: params.sdk
            });
            console.log("[PPGAME] getSdkLoginInfo → dari URL:", info.userId);
            return info;
        }

        // 2. Cek localStorage (dari Guest login / login sebelumnya)
        if (_state.userId && _state.loginToken) {
            var info = {
                sdk: _state.sdk || "custom",
                loginToken: _state.loginToken,
                nickName: _state.nickname || ("Player_" + _state.userId.slice(0, 6)),
                userId: _state.userId
            };
            console.log("[PPGAME] getSdkLoginInfo → dari storage:", info.userId);
            return info;
        }

        // 3. Tidak ada login info
        console.log("[PPGAME] getSdkLoginInfo → null (belum login)");
        return null;
    };

    // ============================================================
    //  FUNGSI WINDOW — dipanggil TSBrowser.executeFunction()
    //  yang TIDAK ada di index.html bridge
    // ============================================================

    /**
     * checkFromNative — Cek apakah app berjalan di native wrapper.
     * Return false = browser mode.
     */
    window.checkFromNative = function () {
        return false;
    };

    /**
     * switchAccount — Ganti akun.
     * Tampilkan dialog pilih akun atau buat baru.
     */
    window.switchAccount = function () {
        console.log("[PPGAME] switchAccount");
        _showAccountSwitchUI();
    };

    /**
     * getAppId — Return app ID untuk SDK.
     */
    window.getAppId = function () {
        return APP_ID;
    };

    /**
     * getLoginServer — Return URL game server.
     * Game pakai ini untuk koneksi Socket.IO.
     */
    window.getLoginServer = function () {
        return GAME_SERVER;
    };

    /**
     * changeLanguage — Ganti bahasa SDK channel.
     */
    window.changeLanguage = function (lang) {
        console.log("[PPGAME] changeLanguage:", lang);
        window.sdkChannel = lang || "en";
        _httpPost("/api/settings", { language: lang }, function () {
            // Reload tidak perlu — game handle sendiri
        });
    };

    /**
     * accountLoginCallback — Register callback untuk logout/switch.
     * Game mendaftarkan callback yang dipanggil saat user logout.
     */
    window.accountLoginCallback = function (callback) {
        console.log("[PPGAME] accountLoginCallback registered");
        window._ppgameLogoutCallback = callback || function () {};
    };

    /**
     * report2Sdk350CreateRole — Report create role ke SDK 350.
     */
    window.report2Sdk350CreateRole = function (data) {
        console.log("[PPGAME] report2Sdk350CreateRole");
        _httpPost("/api/event", {
            event: "sdk350_create_role",
            userId: _state.userId,
            data: typeof data === "string" ? JSON.parse(data) : data
        });
    };

    /**
     * report2Sdk350LoginUser — Report login ke SDK 350.
     */
    window.report2Sdk350LoginUser = function (data) {
        console.log("[PPGAME] report2Sdk350LoginUser");
        _httpPost("/api/event", {
            event: "sdk350_login",
            userId: _state.userId,
            data: typeof data === "string" ? JSON.parse(data) : data
        });
    };

    /**
     * reportToCpapiCreaterole — Report create role ke CP API.
     */
    window.reportToCpapiCreaterole = function (data) {
        console.log("[PPGAME] reportToCpapiCreaterole");
        _httpPost("/api/event", {
            event: "cpapi_create_role",
            userId: _state.userId,
            data: typeof data === "string" ? JSON.parse(data) : data
        });
    };

    /**
     * reportToBSH5Createrole — Report create role ke BS H5.
     */
    window.reportToBSH5Createrole = function (data) {
        console.log("[PPGAME] reportToBSH5Createrole");
        _httpPost("/api/event", {
            event: "bs_h5_create_role",
            userId: _state.userId,
            data: typeof data === "string" ? JSON.parse(data) : data
        });
    };

    /**
     * reportToFbq — Report ke Facebook Pixel (stub).
     */
    window.reportToFbq = function () {
        // Facebook Pixel — tidak digunakan di self-hosted
    };

    /**
     * fbq — Facebook Pixel function (stub).
     */
    window.fbq = function () {
        // Facebook Pixel — stub
    };

    /**
     * gtag — Google Analytics function (stub).
     */
    window.gtag = function () {
        // Google Analytics — stub
    };

    /**
     * reportLogToPP — Report log ke PPGAME.
     */
    window.reportLogToPP = function (name, data) {
        console.log("[PPGAME] reportLogToPP:", name);
        _httpPost("/api/event", {
            event: "log_pp_" + name,
            userId: _state.userId,
            data: data || {}
        });
    };

    /**
     * sendCustomEvent — Kirim custom event.
     */
    window.sendCustomEvent = function (name, data) {
        console.log("[PPGAME] sendCustomEvent:", name);
        _httpPost("/api/event", {
            event: "custom_" + name,
            userId: _state.userId,
            data: data || {}
        });
    };

    /**
     * openURL — Buka URL di tab baru.
     */
    window.openURL = function (url) {
        console.log("[PPGAME] openURL:", url);
        if (url) window.open(url, "_blank");
    };

    /**
     * reload — Reload halaman.
     */
    window.reload = function () {
        window.document.location.reload();
    };

    /**
     * reportChatMsg — Report chat message (moderasi).
     */
    window.reportChatMsg = function (data) {
        _httpPost("/api/event", {
            event: "chat_msg",
            userId: _state.userId,
            data: typeof data === "string" ? JSON.parse(data) : data
        });
    };

    /**
     * initSDKDe — SDK init delegate (dipanggil game saat boot).
     */
    window.initSDKDe = function () {
        console.log("[PPGAME] initSDKDe called");
    };

    // ============================================================
    //  FUNGSI BRIDGE YANG DIDELEGASIKAN KE PPGAME
    //  index.html define ini di if(window.PPGAME) block.
    //  Tapi kalau sdk.js load setelah inline script,
    //  kita harus define sendiri sebagai fallback.
    // ============================================================
    function _ensureBridgeFunctions() {
        if (typeof window.paySdk === "undefined") {
            window.paySdk = function (a) { window.PPGAME.createPaymentOrder(a); };
        }
        if (typeof window.gameReady === "undefined") {
            window.gameReady = function () { window.PPGAME.gameReady(); };
        }
        if (typeof window.report2Sdk === "undefined") {
            window.report2Sdk = function (a) {
                if (!a) return;
                if (a.dataType == 3) {
                    window.PPGAME.playerEnterServer({
                        characterName: a.roleName,
                        characterId: a.roleID,
                        serverId: a.serverID,
                        serverName: a.serverName
                    });
                } else if (a.dataType == 2) {
                    window.PPGAME.submitEvent("game_create_role", {
                        characterName: a.roleName,
                        characterId: a.roleID,
                        serverId: a.serverID,
                        serverName: a.serverName
                    });
                }
            };
        }
        if (typeof window.gameChapterFinish === "undefined") {
            window.gameChapterFinish = function (a) { window.PPGAME.gameChapterFinish(a); };
        }
        if (typeof window.openShopPage === "undefined") {
            window.openShopPage = function () { window.PPGAME.openShopPage(); };
        }
        if (typeof window.gameLevelUp === "undefined") {
            window.gameLevelUp = function (a) { window.PPGAME.gameLevelUp(a); };
        }
        if (typeof window.tutorialFinish === "undefined") {
            window.tutorialFinish = function () { window.PPGAME.submitEvent("game_tutorial_finish"); };
        }
    }

    // ============================================================
    //  WINDOW VALUES — dibaca TSBrowser.getVariantValue()
    //  Game mengakses: window[name] untuk mendapatkan config.
    //  Kita SET hanya kalau belum ada (supaya index.html bisa override).
    // ============================================================

    // --- SDK Version ---
    window.issdkVer2 = true;

    // --- Game Config (hanya kalau belum di-set oleh index.html) ---
    if (typeof window.CacheNum === "undefined") window.CacheNum = 100;
    if (typeof window.clientserver === "undefined") window.clientserver = GAME_SERVER;
    if (typeof window.debugLanguage === "undefined") window.debugLanguage = "";
    if (typeof window.reportBattlleLog === "undefined") window.reportBattlleLog = false;
    if (typeof window.versionConfig === "undefined") window.versionConfig = {};

    // --- SDK Channel Config ---
    if (typeof window.sdkNativeChannel === "undefined") window.sdkNativeChannel = null;

    // --- Account / User Center ---
    if (typeof window.contactSdk === "undefined") window.contactSdk = false;
    if (typeof window.showContact === "undefined") window.showContact = false;
    if (typeof window.showCurChannel === "undefined") window.showCurChannel = null;
    if (typeof window.userCenterSdk === "undefined") window.userCenterSdk = false;
    if (typeof window.switchAccountSdk === "undefined") window.switchAccountSdk = true;  // Kita support switch
    if (typeof window.switchUser === "undefined") window.switchUser = true;              // Kita support switch

    // --- Login UI Config ---
    if (typeof window.show18Login === "undefined") window.show18Login = false;
    if (typeof window.show18Home === "undefined") window.show18Home = false;
    if (typeof window.loginpictype === "undefined") window.loginpictype = 0;
    if (typeof window.loginpic === "undefined") window.loginpic = "";

    // --- Server Config ---
    if (typeof window.serverList === "undefined") window.serverList = {};
    if (typeof window.replaceServerName === "undefined") window.replaceServerName = [];
    if (typeof window.hiddenServersRange === "undefined") window.hiddenServersRange = [];

    // --- Privacy / Legal ---
    if (typeof window.privacyUrl === "undefined") window.privacyUrl = "";

    // --- Language ---
    if (typeof window.supportLang === "undefined") window.supportLang = null;

    // --- Age Gate ---
    if (typeof window.showSixteenImg === "undefined") window.showSixteenImg = false;

    // --- FB / Social ---
    if (typeof window.fbGiveLiveSdk === "undefined") window.fbGiveLiveSdk = false;
    if (typeof window.giveLikeSdk === "undefined") window.giveLikeSdk = false;

    // --- Debug ---
    if (typeof window.debugUrl === "undefined") window.debugUrl = "";

    // ============================================================
    //  GUEST LOGIN UI
    //  Tombol GUEST muncul di halaman loading (maskloadinglayer)
    //  saat belum login.
    // ============================================================

    /** Fungsi Guest Login — dipanggil saat tombol GUEST diklik */
    window.ppgameGuestLogin = function () {
        console.log("[PPGAME] Guest login requested");
        var btn = document.getElementById("ppgame-guest-btn");
        if (btn) {
            btn.style.opacity = "0.6";
            btn.style.pointerEvents = "none";
            btn.innerHTML = "CONNECTING...";
        }
        _httpPost("/api/account/guest", { deviceId: _getDeviceId() }, function (res) {
            if (res && res.account) {
                _setLogin(res.account);
                console.log("[PPGAME] Guest login success:", res.account.nickname);

                // Redirect dengan URL params supaya game bisa baca login info
                var url = window.location.origin + window.location.pathname;
                url += "?sdk=" + encodeURIComponent(_state.sdk);
                url += "&logintoken=" + encodeURIComponent(_state.loginToken);
                url += "&nickname=" + encodeURIComponent(_state.nickname);
                url += "&userid=" + encodeURIComponent(_state.userId);
                window.location.href = url;
            } else {
                console.error("[PPGAME] Guest login failed:", res);
                _showLoginError("Login gagal. Coba lagi.");
                if (btn) {
                    btn.style.opacity = "1";
                    btn.style.pointerEvents = "auto";
                    btn.innerHTML = "GUEST";
                }
            }
        }, function (err) {
            console.error("[PPGAME] Guest login server error:", err);
            _showLoginError("SDK server tidak bisa dijangkau.\nPastikan: node SDK/server.js (port 9999)");
            if (btn) {
                btn.style.opacity = "1";
                btn.style.pointerEvents = "auto";
                btn.innerHTML = "GUEST";
            }
        });
    };

    /** Device ID — identifikasi unik per browser */
    function _getDeviceId() {
        var deviceId = _storageGet("ppgame_device_id", null);
        if (!deviceId) {
            deviceId = "dev_" + _simpleUID();
            _storageSet("ppgame_device_id", deviceId);
        }
        return deviceId;
    }

    /** Tampilkan error message di layar */
    function _showLoginError(msg) {
        var existing = document.getElementById("ppgame-error");
        if (existing) existing.remove();

        var err = document.createElement("div");
        err.id = "ppgame-error";
        err.innerHTML = msg;
        err.style.cssText = [
            "position: fixed",
            "bottom: 18%",
            "left: 50%",
            "transform: translateX(-50%)",
            "background: rgba(200,0,0,0.85)",
            "color: #fff",
            "padding: 12px 24px",
            "border-radius: 8px",
            "font-size: 14px",
            "z-index: 10001",
            "text-align: center",
            "max-width: 80%",
            "white-space: pre-line"
        ].join(";");
        document.body.appendChild(err);
        setTimeout(function () { if (err.parentNode) err.remove(); }, 4000);
    }

    /** Inject tombol GUEST ke halaman loading */
    function _injectGuestButton() {
        // Kalau sudah login, tidak perlu tombol Guest
        if (_isLoggedIn()) {
            console.log("[PPGAME] Sudah login, skip guest button");
            return;
        }

        // Cari container loading screen
        var container = document.getElementById("maskloadinglayer");
        if (!container) {
            // Container belum ada, coba lagi nanti
            return false;
        }

        // Jangan inject duplikat
        if (document.getElementById("ppgame-guest-btn")) return true;

        // Buat overlay untuk login UI
        var overlay = document.createElement("div");
        overlay.id = "ppgame-login-overlay";
        overlay.style.cssText = [
            "position: absolute",
            "top: 0",
            "left: 0",
            "width: 100%",
            "height: 100%",
            "display: flex",
            "flex-direction: column",
            "justify-content: flex-end",
            "align-items: center",
            "padding-bottom: 18%",
            "z-index: 10000",
            "pointer-events: none"
        ].join(";");

        // Judul
        var title = document.createElement("div");
        title.innerHTML = "SUPER WARRIOR Z";
        title.style.cssText = [
            "color: #ffd700",
            "font-size: 28px",
            "font-weight: bold",
            "text-shadow: 0 0 10px rgba(255,215,0,0.8), 0 2px 4px rgba(0,0,0,0.8)",
            "letter-spacing: 3px",
            "margin-bottom: 40px",
            "font-family: Arial, sans-serif",
            "pointer-events: none"
        ].join(";");
        overlay.appendChild(title);

        // Tombol GUEST
        var btn = document.createElement("div");
        btn.id = "ppgame-guest-btn";
        btn.innerHTML = "▶ GUEST";
        btn.style.cssText = [
            "width: 260px",
            "height: 52px",
            "line-height: 52px",
            "text-align: center",
            "font-size: 20px",
            "font-weight: bold",
            "color: #fff",
            "background: linear-gradient(180deg, #f5a623 0%, #e8871e 100%)",
            "border: 2px solid #ffd700",
            "border-radius: 10px",
            "cursor: pointer",
            "text-shadow: 0 2px 4px rgba(0,0,0,0.5)",
            "box-shadow: 0 4px 12px rgba(0,0,0,0.4), 0 0 20px rgba(245,166,35,0.3)",
            "letter-spacing: 3px",
            "user-select: none",
            "-webkit-tap-highlight-color: transparent",
            "pointer-events: auto",
            "transition: transform 0.1s, opacity 0.2s"
        ].join(";");

        btn.addEventListener("click", function (e) {
            e.preventDefault();
            e.stopPropagation();
            window.ppgameGuestLogin();
        });
        btn.addEventListener("touchstart", function () {
            btn.style.transform = "scale(0.96)";
        });
        btn.addEventListener("touchend", function () {
            btn.style.transform = "scale(1)";
        });
        btn.addEventListener("mousedown", function () {
            btn.style.transform = "scale(0.96)";
        });
        btn.addEventListener("mouseup", function () {
            btn.style.transform = "scale(1)";
        });
        overlay.appendChild(btn);

        // Info text
        var info = document.createElement("div");
        info.innerHTML = "SDK v" + SDK_VERSION + " | Port 9999";
        info.style.cssText = [
            "color: rgba(255,255,255,0.4)",
            "font-size: 11px",
            "margin-top: 16px",
            "font-family: Arial, sans-serif",
            "pointer-events: none"
        ].join(";");
        overlay.appendChild(info);

        // Pastikan container punya position relative
        var containerStyle = window.getComputedStyle(container);
        if (containerStyle.position === "static") {
            container.style.position = "relative";
        }

        container.appendChild(overlay);
        console.log("[PPGAME] Guest login button injected");
        return true;
    }

    // ============================================================
    //  ACCOUNT SWITCH UI
    // ============================================================

    function _showAccountSwitchUI() {
        _httpGet("/api/accounts", function (res) {
            var accounts = res && res.accounts ? res.accounts : [];
            _renderAccountDialog(accounts);
        }, function () {
            _renderAccountDialog([]);
        });
    }

    function _renderAccountDialog(accounts) {
        // Hapus dialog lama kalau ada
        var old = document.getElementById("ppgame-switch-dialog");
        if (old) old.remove();

        var dialog = document.createElement("div");
        dialog.id = "ppgame-switch-dialog";
        dialog.style.cssText = [
            "position: fixed",
            "top: 0", "left: 0",
            "width: 100%", "height: 100%",
            "background: rgba(0,0,0,0.8)",
            "z-index: 99999",
            "display: flex",
            "justify-content: center",
            "align-items: center",
            "font-family: Arial, sans-serif"
        ].join(";");

        var box = document.createElement("div");
        box.style.cssText = [
            "background: #1a1a2e",
            "border: 2px solid #ffd700",
            "border-radius: 12px",
            "padding: 24px",
            "min-width: 300px",
            "max-width: 90%",
            "color: #fff",
            "text-align: center"
        ].join(";");

        var title = document.createElement("h3");
        title.innerHTML = "SWITCH ACCOUNT";
        title.style.cssText = "color: #ffd700; margin: 0 0 16px 0; font-size: 20px; letter-spacing: 2px;";
        box.appendChild(title);

        // List akun yang ada
        if (accounts.length > 0) {
            accounts.forEach(function (acc) {
                var item = document.createElement("div");
                item.innerHTML = (acc.nickname || acc.userId.slice(0, 8)) + (acc.type ? " (" + acc.type + ")" : "");
                item.style.cssText = [
                    "padding: 12px",
                    "margin: 6px 0",
                    "background: #16213e",
                    "border: 1px solid #333",
                    "border-radius: 8px",
                    "cursor: pointer",
                    "transition: background 0.2s"
                ].join(";");
                item.addEventListener("mouseover", function () { item.style.background = "#0f3460"; });
                item.addEventListener("mouseout", function () { item.style.background = "#16213e"; });
                item.addEventListener("click", function () {
                    _httpPost("/api/account/switch", { userId: acc.userId }, function (r) {
                        if (r && r.account) {
                            _setLogin(r.account);
                            dialog.remove();
                            // Redirect dengan URL params baru
                            var url = window.location.origin + window.location.pathname;
                            url += "?sdk=" + encodeURIComponent(_state.sdk);
                            url += "&logintoken=" + encodeURIComponent(_state.loginToken);
                            url += "&nickname=" + encodeURIComponent(_state.nickname);
                            url += "&userid=" + encodeURIComponent(_state.userId);
                            window.location.href = url;
                        }
                    });
                });
                box.appendChild(item);
            });
        } else {
            var noAcc = document.createElement("div");
            noAcc.innerHTML = "No accounts yet";
            noAcc.style.cssText = "color: #888; padding: 12px;";
            box.appendChild(noAcc);
        }

        // Tombol Create New Account
        var createBtn = document.createElement("div");
        createBtn.innerHTML = "+ CREATE NEW";
        createBtn.style.cssText = [
            "padding: 10px",
            "margin: 12px 0 0 0",
            "background: linear-gradient(180deg, #4CAF50, #388E3C)",
            "border-radius: 8px",
            "cursor: pointer",
            "font-weight: bold",
            "letter-spacing: 1px"
        ].join(";");
        createBtn.addEventListener("click", function () {
            var nick = prompt("Enter nickname:");
            if (nick && nick.trim()) {
                _httpPost("/api/account/create", {
                    nickname: nick.trim(),
                    deviceId: _getDeviceId()
                }, function (r) {
                    if (r && r.account) {
                        _setLogin(r.account);
                        dialog.remove();
                        var url = window.location.origin + window.location.pathname;
                        url += "?sdk=" + encodeURIComponent(_state.sdk);
                        url += "&logintoken=" + encodeURIComponent(_state.loginToken);
                        url += "&nickname=" + encodeURIComponent(_state.nickname);
                        url += "&userid=" + encodeURIComponent(_state.userId);
                        window.location.href = url;
                    }
                });
            }
        });
        box.appendChild(createBtn);

        // Tombol Close
        var closeBtn = document.createElement("div");
        closeBtn.innerHTML = "CANCEL";
        closeBtn.style.cssText = [
            "padding: 8px",
            "margin: 8px 0 0 0",
            "color: #888",
            "cursor: pointer"
        ].join(";");
        closeBtn.addEventListener("click", function () { dialog.remove(); });
        box.appendChild(closeBtn);

        dialog.appendChild(box);
        document.body.appendChild(dialog);
    }

    // ============================================================
    //  INIT — Setup & mulai SDK
    // ============================================================

    function _init() {
        console.log("[PPGAME] SDK v" + SDK_VERSION + " initializing...");
        console.log("[PPGAME] Server:", SDK_SERVER);

        // 1. Pastikan bridge functions ada (fallback)
        _ensureBridgeFunctions();

        // 2. Report init ke SDK server
        _httpPost("/api/init", {
            userId: _state.userId,
            nickname: _state.nickname,
            sdk: _state.sdk,
            deviceId: _getDeviceId(),
            version: SDK_VERSION
        }, function (res) {
            if (res && res.userId && !_state.userId) {
                // Server buatkan account untuk kita
                _setLogin(res);
                console.log("[PPGAME] Auto account from server:", res.userId);
            }
            console.log("[PPGAME] Connected to SDK server");
        }, function () {
            console.log("[PPGAME] SDK server not reachable — running offline");
        });

        // 3. Inject tombol Guest (tunggu DOM ready)
        _tryInjectGuestButton();

        console.log("[PPGAME] SDK ready. Logged in:", _isLoggedIn(), _state.userId || "(not logged in)");
    }

    /** Coba inject guest button, retry kalau container belum ada */
    function _tryInjectGuestButton() {
        if (_isLoggedIn()) return; // Sudah login, tidak perlu

        var success = _injectGuestButton();
        if (!success) {
            // Container belum ada, coba lagi setelah delay
            var attempts = 0;
            var interval = setInterval(function () {
                attempts++;
                if (_injectGuestButton() || attempts > 30) {
                    clearInterval(interval);
                    if (attempts > 30) {
                        console.warn("[PPGAME] Could not find maskloadinglayer after 30 attempts");
                    }
                }
            }, 200);
        }
    }

    // Jalankan init
    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", _init);
    } else {
        _init();
    }

})();
