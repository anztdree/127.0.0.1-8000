/**
 * =====================================================
 *  Dungeon Server — Super Warrior Z Game Server
 *  Port 8003
 * =====================================================
 *
 *  Dual-protocol server:
 *    - Socket.IO (port 8003) — real-time team dungeon actions
 *    - HTTP GET             — team dungeon query endpoints
 *
 *  All logic delegated to modules:
 *    handlers/         → Socket.IO action handlers (7 actions)
 *    httpHandlers/     → HTTP endpoint handlers (5 endpoints)
 *    services/         → teamManager, battleManager, robotService
 *    middleware/       → dungeonAuth (TEA verify)
 *    utils/            → dungeonConstants, responseBuilder
 *
 *  SOCKET ACTIONS (type: "teamDungeonTeam"):
 *    clientConnect, refreshApplyList, changePos,
 *    startBattle, changeAutoJoinCondition, queryUserTeam, agree
 *
 *  HTTP ACTIONS (via teamServerHttpUrl):
 *    queryTodayMap, queryRobot, queryHistoryMap,
 *    queryTeamRecord, queryBattleRecord
 *
 *  NOTIFY PUSH EVENTS (server→client):
 *    TDMemberJoin, TDMemberQuit, TDStartBattle,
 *    TDChangePos, TDNewApply
 *
 *  Usage:
 *    node dungeon-server/index.js
 * =====================================================
 */

'use strict';

var http = require('http');

// =============================================
// 1. CONFIGURATION
// =============================================

var config = require('../shared/config');
config.validateConfig();

var SERVER_PORT = config.config.servers.dungeon.port;
var SERVER_HOST = config.config.servers.dungeon.host;
var TEA_KEY = config.config.security.teaKey || 'verification';

// =============================================
// 2. SHARED MODULES
// =============================================

var RH = require('../shared/responseHelper');
var DB = require('../database/connection');
var GameData = require('../shared/gameData/loader');
var logger = require('../shared/utils/logger');

// =============================================
// 3. DUNGEON-SERVER MODULES
// =============================================

var dungeonAuth = require('./middleware/dungeonAuth');
var dungeonConstants = require('./utils/dungeonConstants');

var createTeamManager = require('./services/teamManager').createTeamManager;
var createBattleManager = require('./services/battleManager').createBattleManager;
var createRobotService = require('./services/robotService').createRobotService;

// Socket handlers
var handleClientConnect = require('./handlers/clientConnect').handle;
var handleRefreshApplyList = require('./handlers/refreshApplyList').handle;
var handleChangePos = require('./handlers/changePos').handle;
var handleStartBattle = require('./handlers/startBattle').handle;
var handleChangeAutoJoinCondition = require('./handlers/changeAutoJoinCondition').handle;
var handleQueryUserTeam = require('./handlers/queryUserTeam').handle;
var handleAgree = require('./handlers/agree').handle;

// HTTP handlers
var httpQueryTodayMap = require('./httpHandlers/queryTodayMap').handle;
var httpQueryRobot = require('./httpHandlers/queryRobot').handle;
var httpQueryHistoryMap = require('./httpHandlers/queryHistoryMap').handle;
var httpQueryTeamRecord = require('./httpHandlers/queryTeamRecord').handle;
var httpQueryBattleRecord = require('./httpHandlers/queryBattleRecord').handle;

// =============================================
// 4. INITIALIZE SERVICES
// =============================================

var teamManager = createTeamManager();
var battleManager = createBattleManager();
var robotService = createRobotService();

var deps = {
    teamManager: teamManager,
    battleManager: battleManager,
    robotService: robotService,
    io: null,
};

// =============================================
// 5. CONNECTION TRACKING
// =============================================

var totalConnections = 0;
var activeConnections = 0;

// =============================================
// 6. CREATE HTTP SERVER (dual purpose: health + HTTP endpoints)
// =============================================

var server = http.createServer(function(req, res) {
    // Health endpoint
    if (req.method === 'GET' && req.url === '/health') {
        var tmStats = teamManager.getStats();
        var bmStats = battleManager.getStats();

        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
            status: 'online',
            server: 'dungeon',
            port: SERVER_PORT,
            uptime: process.uptime(),
            totalConnections: totalConnections,
            activeConnections: activeConnections,
            timestamp: new Date().toISOString(),
            teams: tmStats,
            battles: bmStats,
        }));
        return;
    }

    // HTTP query endpoints (teamServerHttpUrl)
    // Client sends POST with form-urlencoded body: data=<JSON>
    // Source: main.min.js L76888-76913
    //   i.open(e, egret.HttpMethod.POST);
    //   i.setRequestHeader("Content-Type", "application/x-www-form-urlencoded");
    //   i.send("data=" + JSON.stringify(t));
    if (req.method === 'POST') {
        var body = '';
        req.on('data', function(chunk) {
            body += chunk.toString();
            if (body.length > 1e6) {
                req.connection.destroy();
            }
        });
        req.on('end', function() {
            // Parse form-urlencoded body: data=<JSON_string>
            var payload = {};
            try {
                var formParams = {};
                var pairs = body.split('&');
                for (var i = 0; i < pairs.length; i++) {
                    var pair = pairs[i].split('=');
                    if (pair.length >= 2) {
                        formParams[decodeURIComponent(pair[0])] =
                            decodeURIComponent(pair.slice(1).join('='));
                    }
                }
                payload = JSON.parse(formParams.data || '{}');
            } catch (err) {
                logger.warn('DUNGEON', 'HTTP: Failed to parse request body');
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ ret: 1, data: 'Invalid request body' }));
                return;
            }

            var action = payload.action;
            if (!action) {
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ ret: 1, data: 'Missing action' }));
                return;
            }

            logger.info('DUNGEON', 'HTTP POST: action=' + action);

            var result;
            switch (action) {
                case 'queryTodayMap':
                    result = httpQueryTodayMap(deps, payload);
                    break;
                case 'queryRobot':
                    result = httpQueryRobot(deps, payload);
                    break;
                case 'queryHistoryMap':
                    result = httpQueryHistoryMap(deps, payload);
                    break;
                case 'queryTeamRecord':
                    result = httpQueryTeamRecord(deps, payload);
                    break;
                case 'queryBattleRecord':
                    result = httpQueryBattleRecord(deps, payload);
                    break;
                default:
                    result = { ret: 5, data: 'Unknown action: ' + action, serverTime: Date.now() };
                    break;
            }

            res.writeHead(200, {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*',
            });
            res.end(JSON.stringify(result));
        });
        return;
    }

    res.writeHead(404, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Not found' }));
});

// =============================================
// 7. SOCKET.IO SETUP
// =============================================

var io = require('socket.io')(server, {
    serveClient: false,
    pingInterval: 10000,
    pingTimeout: 5000,
    cookie: false,
    transports: ['websocket', 'polling'],
});

deps.io = io;

// =============================================
// 8. CONNECTION HANDLING
// =============================================

io.on('connection', function(socket) {
    totalConnections++;
    activeConnections++;

    var clientIp = socket.handshake.address ||
        socket.handshake.headers['x-forwarded-for'] ||
        'unknown';

    logger.info('DUNGEON', 'Client connected: ' + socket.id + ' (IP: ' + clientIp + ')');

    socket._userId = null;
    socket._teamId = null;

    // ---- TEA Verification ----
    var authHandle = dungeonAuth.setupVerification(socket, TEA_KEY);

    // ---- Main Request Handler ----
    socket.on('handler.process', function(request, callback) {
        if (!dungeonAuth.requireVerified(socket, callback)) return;

        if (!request) {
            RH.sendResponse(socket, 'handler.process', RH.error(2, 'Empty request'), callback);
            return;
        }

        var parsed = RH.parseRequest(request);
        if (!parsed) {
            RH.sendResponse(socket, 'handler.process', RH.error(2, 'Invalid request format'), callback);
            return;
        }

        var type = (parsed.type || '').toLowerCase();
        var action = parsed.action;

        logger.info('DUNGEON', 'Socket: type=' + type + ' action=' + action +
            ' userId=' + (parsed.userId || '-'));

        // Only accept "teamDungeonTeam" type
        if (type !== 'teamdungeonteam') {
            logger.warn('DUNGEON', 'Unknown type: ' + type);
            RH.sendResponse(socket, 'handler.process', RH.error(5, 'Unknown type'), callback);
            return;
        }

        // Route by action
        try {
            switch (action) {
                case 'clientConnect':
                    handleClientConnect(deps, socket, parsed, callback);
                    break;
                case 'refreshApplyList':
                    handleRefreshApplyList(deps, socket, parsed, callback);
                    break;
                case 'changePos':
                    handleChangePos(deps, socket, parsed, callback);
                    break;
                case 'startBattle':
                    handleStartBattle(deps, socket, parsed, callback);
                    break;
                case 'changeAutoJoinCondition':
                    handleChangeAutoJoinCondition(deps, socket, parsed, callback);
                    break;
                case 'queryUserTeam':
                    handleQueryUserTeam(deps, socket, parsed, callback);
                    break;
                case 'agree':
                    handleAgree(deps, socket, parsed, callback);
                    break;
                default:
                    logger.warn('DUNGEON', 'Unknown action: ' + action);
                    RH.sendResponse(socket, 'handler.process',
                        RH.error(5, 'Unknown action: ' + action), callback);
                    break;
            }
        } catch (err) {
            logger.error('DUNGEON', 'Handler error for ' + action + ': ' + err.message);
            logger.error('DUNGEON', 'Stack: ' + err.stack);
            RH.sendResponse(socket, 'handler.process', RH.error(1, 'Internal server error'), callback);
        }
    });

    // ---- Disconnect Handler ----
    socket.on('disconnect', function(reason) {
        activeConnections--;
        authHandle.destroy();

        var result = deps.teamManager.unregisterSocket(socket.id);
        if (result.userId && result.teamId) {
            var team = deps.teamManager.getTeam(result.teamId);
            if (team) {
                // Broadcast TDMemberQuit
                var responseBuilder = require('./utils/responseBuilder');
                responseBuilder.broadcastToTeam(team.members, {
                    action: dungeonConstants.NOTIFY_ACTION.MEMBER_QUIT,
                    memberUserId: result.userId,
                });
            }
            logger.info('DUNGEON', 'Disconnected: userId=' + result.userId + ' teamId=' + result.teamId);
        } else {
            logger.info('DUNGEON', 'Disconnected: ' + socket.id + ' (Reason: ' + reason + ')');
        }
    });

    // ---- Error Handler ----
    socket.on('error', function(err) {
        logger.error('DUNGEON', 'Socket error (' + socket.id + '): ' + err.message);
    });
});

// =============================================
// 9. PERIODIC CLEANUP
// =============================================

var cleanupInterval = setInterval(function() {
    var teamsCleaned = teamManager.cleanupExpired();
    var battlesCleaned = battleManager.cleanup();
    if (teamsCleaned > 0 || battlesCleaned > 0) {
        logger.info('DUNGEON', 'Cleanup: ' + teamsCleaned + ' teams, ' + battlesCleaned + ' battles');
    }
}, 5 * 60 * 1000);

// =============================================
// 10. GRACEFUL SHUTDOWN
// =============================================

function gracefulShutdown(signal) {
    logger.info('DUNGEON', 'Received ' + signal + '. Shutting down...');

    clearInterval(cleanupInterval);

    io.close(function() {
        logger.info('DUNGEON', 'Socket.IO closed');

        DB.closePool()
            .then(function() {
                logger.info('DUNGEON', 'Database pool closed');
                server.close(function() {
                    logger.info('DUNGEON', 'Server closed');
                    process.exit(0);
                });
            })
            .catch(function(err) {
                logger.error('DUNGEON', 'Error closing DB: ' + err.message);
                server.close(function() {
                    process.exit(0);
                });
            });
    });

    setTimeout(function() {
        logger.error('DUNGEON', 'Forced exit after timeout');
        process.exit(1);
    }, 10000);
}

process.on('SIGTERM', function() { gracefulShutdown('SIGTERM'); });
process.on('SIGINT', function() { gracefulShutdown('SIGINT'); });

// =============================================
// 11. START SERVER
// =============================================

async function startServer() {
    logger.info('DUNGEON', 'Initializing database...');
    try {
        await DB.initPool();
        logger.info('DUNGEON', 'Database connected');
    } catch (err) {
        logger.error('DUNGEON', 'FATAL: Database connection failed!');
        logger.error('DUNGEON', err.message);
        process.exit(1);
    }

    // Load game data (required for queryTodayMap, queryRobot, queryHistoryMap)
    // teamDungeon.json, teamDungeonRobot.json, teamDungeon101.json, etc.
    GameData.load();
    robotService.load();

    server.listen(SERVER_PORT, SERVER_HOST, function() {
        console.log('');
        console.log('================================================');
        console.log('  Super Warrior Z — Dungeon Server');
        console.log('================================================');
        console.log('  Address:     http://' + SERVER_HOST + ':' + SERVER_PORT);
        console.log('  Socket.IO:   http://' + SERVER_HOST + ':' + SERVER_PORT);
        console.log('  HTTP API:    http://' + SERVER_HOST + ':' + SERVER_PORT + '/?type=teamDungeonTeam&action=xxx');
        console.log('  Health:      http://' + SERVER_HOST + ':' + SERVER_PORT + '/health');
        console.log('  TEA Key:     ' + TEA_KEY);
        console.log('================================================');
        console.log('  Modules:');
        console.log('    handlers/      → clientConnect, refreshApplyList,');
        console.log('                      changePos, startBattle,');
        console.log('                      changeAutoJoinCondition,');
        console.log('                      queryUserTeam, agree');
        console.log('    httpHandlers/  → queryTodayMap, queryRobot,');
        console.log('                      queryHistoryMap, queryTeamRecord,');
        console.log('                      queryBattleRecord');
        console.log('    services/      → teamManager, battleManager, robotService');
        console.log('    middleware/    → dungeonAuth (TEA verify)');
        console.log('    utils/         → dungeonConstants, responseBuilder');
        console.log('================================================');
        console.log('  Socket Actions (type: teamDungeonTeam):');
        console.log('    clientConnect, refreshApplyList, changePos');
        console.log('    startBattle, changeAutoJoinCondition');
        console.log('    queryUserTeam, agree');
        console.log('================================================');
        console.log('  HTTP Endpoints (teamServerHttpUrl):');
        console.log('    queryTodayMap, queryRobot, queryHistoryMap');
        console.log('    queryTeamRecord, queryBattleRecord');
        console.log('================================================');
        console.log('  Notify Push Events:');
        console.log('    TDMemberJoin, TDMemberQuit, TDStartBattle');
        console.log('    TDChangePos, TDNewApply');
        console.log('================================================');
        console.log('  Status:');
        console.log('    Database:      ' + (DB.isReady() ? 'CONNECTED' : 'NOT CONNECTED'));
        console.log('    TEA Security:  ENABLED');
        console.log('    Max Team Size: ' + dungeonConstants.LIMITS.MAX_TEAM_MEMBERS);
        console.log('================================================');
        console.log('');
        console.log('  Waiting for client connections...');
        console.log('');
    });
}

server.on('error', function(err) {
    if (err.code === 'EADDRINUSE') {
        logger.error('DUNGEON', 'FATAL: Port ' + SERVER_PORT + ' is already in use!');
    } else {
        logger.error('DUNGEON', 'FATAL: Server error: ' + err.message);
    }
    process.exit(1);
});

startServer();
