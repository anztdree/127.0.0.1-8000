/**
 * ================================================================
 *  PPGAME SDK Server — Backend untuk PPGAME SDK
 *  Super Warrior Z (超级战士Z)
 * ================================================================
 *
 *  Port: 9999
 *  Game server ada di port 8000 (terpisah — ini BUKAN game server)
 *
 *  Fitur:
 *    - Account management (guest, create, switch, list)
 *    - Session management (login, logout, verify)
 *    - Payment processing (create order, complete, list)
 *    - Event tracking (all SDK events)
 *    - Settings management
 *    - Token verification
 *    - Data stored in JSON files (Termux friendly)
 *
 *  Jalankan: node server.js
 */

var http = require("http");
var fs = require("fs");
var path = require("path");
var url = require("url");

// ============================================================
//  Konfigurasi
// ============================================================
var PORT = 9999;
var DATA_DIR = path.join(__dirname, "data");
var MAX_EVENTS = 5000;
var TOKEN_EXPIRY_MS = 7 * 24 * 60 * 60 * 1000; // 7 hari

// Pastikan folder data ada
if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
}

// ============================================================
//  Data Storage (file-based, simpel untuk Termux)
// ============================================================
function loadData(filename, defaultVal) {
    var filepath = path.join(DATA_DIR, filename);
    try {
        if (fs.existsSync(filepath)) {
            var raw = fs.readFileSync(filepath, "utf-8");
            return JSON.parse(raw);
        }
    } catch (e) {
        console.log("[SDK-Server] Error loading " + filename + ":", e.message);
    }
    return defaultVal;
}

function saveData(filename, data) {
    var filepath = path.join(DATA_DIR, filename);
    try {
        fs.writeFileSync(filepath, JSON.stringify(data, null, 2), "utf-8");
    } catch (e) {
        console.log("[SDK-Server] Error saving " + filename + ":", e.message);
    }
}

// Debounced save — tidak save terlalu sering
var _saveTimers = {};
function saveDataDebounced(filename, data, delay) {
    delay = delay || 1000;
    if (_saveTimers[filename]) clearTimeout(_saveTimers[filename]);
    _saveTimers[filename] = setTimeout(function () {
        saveData(filename, data);
        delete _saveTimers[filename];
    }, delay);
}

// ============================================================
//  State
// ============================================================
var accounts = loadData("accounts.json", []);
var sessions = loadData("sessions.json", {});
var payments = loadData("payments.json", []);
var events = loadData("events.json", []);
var settings = loadData("settings.json", {
    language: "en",
    gameServerUrl: "http://127.0.0.1:8000",
    maintenanceMode: false
});

// ============================================================
//  Helpers
// ============================================================
function generateUUID() {
    return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, function (c) {
        var r = (Math.random() * 16) | 0;
        var v = c === "x" ? r : (r & 0x3) | 0x8;
        return v.toString(16);
    });
}

function generateToken() {
    return "tk_" + generateUUID() + "_" + Date.now().toString(36);
}

function timestamp() {
    return new Date().toISOString();
}

function isTokenValid(token) {
    if (!token) return false;
    // Cek format
    if (!token.startsWith("tk_")) return true; // backward compat
    return true;
}

/** Kirim JSON response dengan CORS headers */
function sendJSON(res, statusCode, data) {
    var body = JSON.stringify(data);
    res.writeHead(statusCode, {
        "Content-Type": "application/json; charset=utf-8",
        "Content-Length": Buffer.byteLength(body, "utf-8"),
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type, Authorization",
        "Access-Control-Max-Age": "86400"
    });
    res.end(body);
}

/** Parse request body as JSON */
function parseBody(req, callback) {
    var body = "";
    var size = 0;
    var maxSize = 1024 * 1024; // 1MB limit

    req.on("data", function (chunk) {
        size += chunk.length;
        if (size > maxSize) {
            callback(new Error("Body too large"), null);
            req.destroy();
            return;
        }
        body += chunk;
    });

    req.on("end", function () {
        try {
            if (body.length > 0) {
                callback(null, JSON.parse(body));
            } else {
                callback(null, {});
            }
        } catch (e) {
            callback(e, null);
        }
    });

    req.on("error", function (e) {
        callback(e, null);
    });
}

/** Cari account by userId */
function findAccount(userId) {
    for (var i = 0; i < accounts.length; i++) {
        if (accounts[i].userId === userId) return accounts[i];
    }
    return null;
}

/** Cari account by deviceId */
function findAccountByDevice(deviceId) {
    for (var i = 0; i < accounts.length; i++) {
        if (accounts[i].deviceId === deviceId) return accounts[i];
    }
    return null;
}

/** Buat account baru */
function createAccount(opts) {
    var account = {
        userId: opts.userId || generateUUID(),
        nickname: opts.nickname || ("Player_" + Math.floor(Math.random() * 99999)),
        loginToken: generateToken(),
        sdk: opts.sdk || "custom",
        channelCode: opts.channelCode || "custom",
        deviceId: opts.deviceId || null,
        type: opts.type || "registered",  // "guest" or "registered"
        createTime: Date.now(),
        lastLoginTime: Date.now(),
        loginCount: 1,
        banned: false
    };
    accounts.push(account);
    saveDataDebounced("accounts.json", accounts, 500);
    return account;
}

/** Update last login */
function touchAccount(userId) {
    var acc = findAccount(userId);
    if (acc) {
        acc.lastLoginTime = Date.now();
        acc.loginCount = (acc.loginCount || 0) + 1;
        saveDataDebounced("accounts.json", accounts, 2000);
    }
}

/** Tambah event */
function addEvent(eventName, data, userId) {
    events.push({
        event: eventName,
        userId: userId || null,
        data: data || {},
        time: Date.now(),
        isoTime: timestamp()
    });
    // Trim events kalau kebanyakan
    if (events.length > MAX_EVENTS) {
        events = events.slice(-MAX_EVENTS);
    }
    saveDataDebounced("events.json", events, 2000);
}

// ============================================================
//  API Routes
// ============================================================
var server = http.createServer(function (req, res) {

    // CORS preflight
    if (req.method === "OPTIONS") {
        sendJSON(res, 200, {});
        return;
    }

    var parsedUrl = url.parse(req.url, true);
    var pathname = parsedUrl.pathname;
    var method = req.method;
    var query = parsedUrl.query;

    // Logging (hanya untuk non-event endpoints)
    if (pathname !== "/api/event") {
        console.log("[SDK-Server]", method, pathname);
    }

    // ==========================================
    //  GET / — API info
    // ==========================================
    if (method === "GET" && pathname === "/") {
        sendJSON(res, 200, {
            name: "PPGAME SDK Server",
            version: "2.0.0",
            status: "running",
            endpoints: {
                "POST /api/init": "SDK init / auto register",
                "POST /api/account/guest": "Guest login (quick)",
                "POST /api/account/create": "Create account",
                "POST /api/account/switch": "Switch to existing account",
                "GET  /api/accounts": "List all accounts",
                "POST /api/account/login": "Login with credentials",
                "POST /api/account/logout": "Logout",
                "POST /api/account/verify": "Verify token",
                "POST /api/payment/create": "Create payment order",
                "POST /api/payment/complete": "Complete payment",
                "GET  /api/payments": "List payments",
                "POST /api/event": "Track event",
                "GET  /api/events": "List events (filterable)",
                "GET  /api/settings": "Get settings",
                "POST /api/settings": "Update settings",
                "GET  /api/status": "Server status"
            }
        });
        return;
    }

    // ==========================================
    //  POST /api/init — SDK init
    //  Kalau userId tidak ada, buat account baru.
    //  Kalau userId ada, verifikasi dan return info.
    // ==========================================
    if (method === "POST" && pathname === "/api/init") {
        parseBody(req, function (err, body) {
            if (err) {
                sendJSON(res, 400, { error: "Invalid request", detail: err.message });
                return;
            }

            // Kalau ada userId, verifikasi
            if (body.userId) {
                var acc = findAccount(body.userId);
                if (acc) {
                    touchAccount(acc.userId);
                    sendJSON(res, 200, {
                        userId: acc.userId,
                        nickname: acc.nickname,
                        loginToken: acc.loginToken,
                        sdk: acc.sdk,
                        type: acc.type
                    });
                    addEvent("sdk_init", { source: "existing_user" }, acc.userId);
                    return;
                }
                // Account tidak ditemukan, buat baru dengan userId yang diberikan
            }

            // Cek apakah device sudah punya account
            if (body.deviceId) {
                var existing = findAccountByDevice(body.deviceId);
                if (existing) {
                    touchAccount(existing.userId);
                    sendJSON(res, 200, {
                        userId: existing.userId,
                        nickname: existing.nickname,
                        loginToken: existing.loginToken,
                        sdk: existing.sdk,
                        type: existing.type
                    });
                    addEvent("sdk_init", { source: "device_reuse" }, existing.userId);
                    return;
                }
            }

            // Buat account baru
            var account = createAccount({
                userId: body.userId || undefined,
                nickname: body.nickname || undefined,
                sdk: body.sdk || undefined,
                deviceId: body.deviceId || undefined,
                type: "guest"
            });
            addEvent("sdk_init", { source: "new_user" }, account.userId);
            console.log("[SDK-Server] Init → new account:", account.nickname, "(" + account.userId.slice(0, 8) + ")");

            sendJSON(res, 200, {
                userId: account.userId,
                nickname: account.nickname,
                loginToken: account.loginToken,
                sdk: account.sdk,
                type: account.type
            });
        });
        return;
    }

    // ==========================================
    //  POST /api/account/guest — Quick guest login
    //  Tombol GUEST di halaman login memanggil ini.
    //  Selalu buat account baru (satu device bisa punya banyak).
    // ==========================================
    if (method === "POST" && pathname === "/api/account/guest") {
        parseBody(req, function (err, body) {
            if (err) {
                sendJSON(res, 400, { error: "Invalid request" });
                return;
            }

            var account = createAccount({
                nickname: "Guest_" + Math.floor(Math.random() * 99999),
                sdk: "custom",
                channelCode: "custom",
                deviceId: body.deviceId || null,
                type: "guest"
            });

            addEvent("guest_login", { nickname: account.nickname }, account.userId);
            console.log("[SDK-Server] Guest account:", account.nickname, "(" + account.userId.slice(0, 8) + ")");

            sendJSON(res, 200, { account: account });
        });
        return;
    }

    // ==========================================
    //  POST /api/account/create — Create account with nickname
    // ==========================================
    if (method === "POST" && pathname === "/api/account/create") {
        parseBody(req, function (err, body) {
            if (err) {
                sendJSON(res, 400, { error: "Invalid request" });
                return;
            }

            var account = createAccount({
                nickname: body.nickname || ("Player_" + Math.floor(Math.random() * 99999)),
                sdk: body.sdk || "custom",
                channelCode: body.channelCode || "custom",
                deviceId: body.deviceId || null,
                type: "registered"
            });

            addEvent("account_create", { nickname: account.nickname }, account.userId);
            console.log("[SDK-Server] Account created:", account.nickname);

            sendJSON(res, 200, { account: account });
        });
        return;
    }

    // ==========================================
    //  POST /api/account/switch — Switch to existing account
    // ==========================================
    if (method === "POST" && pathname === "/api/account/switch") {
        parseBody(req, function (err, body) {
            if (err) {
                sendJSON(res, 400, { error: "Invalid request" });
                return;
            }

            var account = findAccount(body.userId);
            if (account) {
                // Generate new token untuk session baru
                account.loginToken = generateToken();
                touchAccount(account.userId);
                saveDataDebounced("accounts.json", accounts, 500);

                addEvent("account_switch", { to: account.nickname }, account.userId);
                console.log("[SDK-Server] Switch to:", account.nickname);

                sendJSON(res, 200, { account: account });
            } else {
                sendJSON(res, 404, { error: "Account not found" });
            }
        });
        return;
    }

    // ==========================================
    //  POST /api/account/login — Login with credentials
    // ==========================================
    if (method === "POST" && pathname === "/api/account/login") {
        parseBody(req, function (err, body) {
            if (err) {
                sendJSON(res, 400, { error: "Invalid request" });
                return;
            }

            var account = findAccount(body.userId);
            if (account && account.loginToken === body.loginToken) {
                if (account.banned) {
                    sendJSON(res, 403, { error: "Account banned" });
                    return;
                }
                // Generate new token
                account.loginToken = generateToken();
                touchAccount(account.userId);
                saveDataDebounced("accounts.json", accounts, 500);

                addEvent("account_login", { type: "token" }, account.userId);
                sendJSON(res, 200, { account: account });
            } else {
                sendJSON(res, 401, { error: "Invalid credentials" });
            }
        });
        return;
    }

    // ==========================================
    //  POST /api/account/logout — Logout
    // ==========================================
    if (method === "POST" && pathname === "/api/account/logout") {
        parseBody(req, function (err, body) {
            if (err) {
                sendJSON(res, 400, { error: "Invalid request" });
                return;
            }
            addEvent("account_logout", {}, body.userId);
            sendJSON(res, 200, { ok: true });
        });
        return;
    }

    // ==========================================
    //  POST /api/account/verify — Verify token
    // ==========================================
    if (method === "POST" && pathname === "/api/account/verify") {
        parseBody(req, function (err, body) {
            if (err) {
                sendJSON(res, 400, { error: "Invalid request" });
                return;
            }

            var account = findAccount(body.userId);
            if (account && account.loginToken === body.loginToken) {
                sendJSON(res, 200, { valid: true, account: { userId: account.userId, nickname: account.nickname } });
            } else {
                sendJSON(res, 200, { valid: false });
            }
        });
        return;
    }

    // ==========================================
    //  GET /api/accounts — List all accounts
    // ==========================================
    if (method === "GET" && pathname === "/api/accounts") {
        var list = accounts.map(function (a) {
            return {
                userId: a.userId,
                nickname: a.nickname,
                type: a.type,
                lastLoginTime: a.lastLoginTime,
                loginCount: a.loginCount
            };
        });
        sendJSON(res, 200, { accounts: list, total: list.length });
        return;
    }

    // ==========================================
    //  POST /api/payment/create — Create payment order
    // ==========================================
    if (method === "POST" && pathname === "/api/payment/create") {
        parseBody(req, function (err, body) {
            if (err) {
                sendJSON(res, 400, { error: "Invalid request" });
                return;
            }

            var order = {
                orderId: "ORD_" + Date.now() + "_" + Math.floor(Math.random() * 10000),
                orderData: body.order || {},
                userId: body.userId || null,
                serverId: body.serverId || null,
                characterId: body.characterId || null,
                characterName: body.characterName || null,
                status: "pending",         // pending → completed / failed / refunded
                createTime: Date.now(),
                completeTime: null
            };
            payments.push(order);
            saveDataDebounced("payments.json", payments, 500);

            addEvent("payment_create", {
                orderId: order.orderId,
                userId: order.userId,
                serverId: order.serverId
            }, order.userId);

            console.log("[SDK-Server] Payment order:", order.orderId, "for user:", order.userId);
            sendJSON(res, 200, {
                orderId: order.orderId,
                status: "pending",
                createTime: order.createTime
            });
        });
        return;
    }

    // ==========================================
    //  POST /api/payment/complete — Complete payment
    // ==========================================
    if (method === "POST" && pathname === "/api/payment/complete") {
        parseBody(req, function (err, body) {
            if (err) {
                sendJSON(res, 400, { error: "Invalid request" });
                return;
            }

            var found = null;
            for (var i = 0; i < payments.length; i++) {
                if (payments[i].orderId === body.orderId) {
                    found = payments[i];
                    break;
                }
            }

            if (found) {
                found.status = "completed";
                found.completeTime = Date.now();
                saveDataDebounced("payments.json", payments, 500);

                addEvent("payment_complete", {
                    orderId: found.orderId,
                    userId: found.userId
                }, found.userId || body.userId);

                console.log("[SDK-Server] Payment completed:", found.orderId);
                sendJSON(res, 200, {
                    orderId: found.orderId,
                    status: "completed",
                    completeTime: found.completeTime
                });
            } else {
                sendJSON(res, 404, { error: "Order not found" });
            }
        });
        return;
    }

    // ==========================================
    //  POST /api/payment/fail — Mark payment as failed
    // ==========================================
    if (method === "POST" && pathname === "/api/payment/fail") {
        parseBody(req, function (err, body) {
            if (err) {
                sendJSON(res, 400, { error: "Invalid request" });
                return;
            }

            var found = null;
            for (var i = 0; i < payments.length; i++) {
                if (payments[i].orderId === body.orderId) {
                    found = payments[i];
                    break;
                }
            }

            if (found) {
                found.status = "failed";
                found.completeTime = Date.now();
                saveDataDebounced("payments.json", payments, 500);
                sendJSON(res, 200, { orderId: found.orderId, status: "failed" });
            } else {
                sendJSON(res, 404, { error: "Order not found" });
            }
        });
        return;
    }

    // ==========================================
    //  GET /api/payments — List payments
    // ==========================================
    if (method === "GET" && pathname === "/api/payments") {
        var filter = query.userId;
        var result = payments;
        if (filter) {
            result = payments.filter(function (p) { return p.userId === filter; });
        }
        sendJSON(res, 200, { payments: result, total: result.length });
        return;
    }

    // ==========================================
    //  POST /api/event — Track event
    // ==========================================
    if (method === "POST" && pathname === "/api/event") {
        parseBody(req, function (err, body) {
            if (err) {
                sendJSON(res, 400, { error: "Invalid request" });
                return;
            }

            addEvent(body.event || "unknown", body.data || {}, body.userId || null);
            sendJSON(res, 200, { ok: true });
        });
        return;
    }

    // ==========================================
    //  GET /api/events — List events
    //  Support filter: ?event=NAME &userId=ID &limit=N &offset=N
    // ==========================================
    if (method === "GET" && pathname === "/api/events") {
        var result = events;

        // Filter by event name
        if (query.event) {
            result = result.filter(function (e) { return e.event === query.event; });
        }

        // Filter by userId
        if (query.userId) {
            result = result.filter(function (e) { return e.userId === query.userId; });
        }

        // Pagination
        var limit = parseInt(query.limit) || 100;
        var offset = parseInt(query.offset) || 0;
        var total = result.length;
        result = result.slice(offset, offset + limit);

        sendJSON(res, 200, {
            events: result,
            total: total,
            limit: limit,
            offset: offset
        });
        return;
    }

    // ==========================================
    //  GET /api/settings — Get settings
    // ==========================================
    if (method === "GET" && pathname === "/api/settings") {
        sendJSON(res, 200, { settings: settings });
        return;
    }

    // ==========================================
    //  POST /api/settings — Update settings
    // ==========================================
    if (method === "POST" && pathname === "/api/settings") {
        parseBody(req, function (err, body) {
            if (err) {
                sendJSON(res, 400, { error: "Invalid request" });
                return;
            }

            // Update settings (merge)
            var keys = Object.keys(body);
            for (var i = 0; i < keys.length; i++) {
                settings[keys[i]] = body[keys[i]];
            }
            saveDataDebounced("settings.json", settings, 500);
            addEvent("settings_update", body, null);

            sendJSON(res, 200, { ok: true, settings: settings });
        });
        return;
    }

    // ==========================================
    //  GET /api/status — Server status
    // ==========================================
    if (method === "GET" && pathname === "/api/status") {
        var uptime = process.uptime();
        var mem = process.memoryUsage();
        sendJSON(res, 200, {
            status: "running",
            version: "2.0.0",
            uptime: Math.floor(uptime),
            uptimeHuman: Math.floor(uptime / 3600) + "h " + Math.floor((uptime % 3600) / 60) + "m",
            accounts: accounts.length,
            payments: payments.length,
            paymentsCompleted: payments.filter(function (p) { return p.status === "completed"; }).length,
            events: events.length,
            settings: settings,
            memory: {
                rss: Math.round(mem.rss / 1024 / 1024) + "MB",
                heapUsed: Math.round(mem.heapUsed / 1024 / 1024) + "MB"
            }
        });
        return;
    }

    // ==========================================
    //  DELETE /api/account/:userId — Delete account
    // ==========================================
    if (method === "DELETE" && pathname.startsWith("/api/account/")) {
        var userId = pathname.replace("/api/account/", "");
        var idx = -1;
        for (var i = 0; i < accounts.length; i++) {
            if (accounts[i].userId === userId) { idx = i; break; }
        }
        if (idx >= 0) {
            var removed = accounts.splice(idx, 1)[0];
            saveDataDebounced("accounts.json", accounts, 500);
            addEvent("account_delete", { nickname: removed.nickname }, null);
            console.log("[SDK-Server] Account deleted:", removed.nickname);
            sendJSON(res, 200, { ok: true, deleted: removed.nickname });
        } else {
            sendJSON(res, 404, { error: "Account not found" });
        }
        return;
    }

    // ==========================================
    //  404 — Not Found
    // ==========================================
    sendJSON(res, 404, { error: "Not found", path: pathname, method: method });
});

// ============================================================
//  Graceful Shutdown
// ============================================================
function gracefulShutdown(signal) {
    console.log("\n[SDK-Server] " + signal + " received, saving data...");

    // Force save semua data
    saveData("accounts.json", accounts);
    saveData("sessions.json", sessions);
    saveData("payments.json", payments);
    saveData("events.json", events);
    saveData("settings.json", settings);

    console.log("[SDK-Server] Data saved. Shutting down.");
    process.exit(0);
}

process.on("SIGINT", function () { gracefulShutdown("SIGINT"); });
process.on("SIGTERM", function () { gracefulShutdown("SIGTERM"); });

// ============================================================
//  Start Server
// ============================================================
server.listen(PORT, "0.0.0.0", function () {
    console.log("");
    console.log("╔══════════════════════════════════════════════════╗");
    console.log("║          PPGAME SDK Server v2.0.0                ║");
    console.log("║          http://0.0.0.0:" + PORT + "                     ║");
    console.log("╠══════════════════════════════════════════════════╣");
    console.log("║                                                  ║");
    console.log("║  Account Management:                             ║");
    console.log("║    POST /api/account/guest     Guest login        ║");
    console.log("║    POST /api/account/create    Create account     ║");
    console.log("║    POST /api/account/switch    Switch account     ║");
    console.log("║    POST /api/account/login     Login              ║");
    console.log("║    POST /api/account/logout    Logout             ║");
    console.log("║    POST /api/account/verify    Verify token       ║");
    console.log("║    GET  /api/accounts          List accounts      ║");
    console.log("║    DELETE /api/account/:id     Delete account     ║");
    console.log("║                                                  ║");
    console.log("║  Payment:                                        ║");
    console.log("║    POST /api/payment/create    Create order       ║");
    console.log("║    POST /api/payment/complete  Complete payment   ║");
    console.log("║    POST /api/payment/fail      Fail payment       ║");
    console.log("║    GET  /api/payments          List payments      ║");
    console.log("║                                                  ║");
    console.log("║  Events:                                         ║");
    console.log("║    POST /api/event             Track event        ║");
    console.log("║    GET  /api/events            List events        ║");
    console.log("║                                                  ║");
    console.log("║  Settings:                                       ║");
    console.log("║    GET  /api/settings          Get settings       ║");
    console.log("║    POST /api/settings          Update settings    ║");
    console.log("║                                                  ║");
    console.log("║  System:                                         ║");
    console.log("║    GET  /                      API info           ║");
    console.log("║    GET  /api/status            Server status      ║");
    console.log("║                                                  ║");
    console.log("╠══════════════════════════════════════════════════╣");
    console.log("║  Data dir: " + DATA_DIR);
    console.log("║  Accounts: " + accounts.length + "  Payments: " + payments.length + "  Events: " + events.length);
    console.log("╚══════════════════════════════════════════════════╝");
    console.log("");
});
