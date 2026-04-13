/**
 * Super Warrior Z - Global Configuration
 * 
 * 100% derived from client code analysis:
 * - Port 8000: login-server (verifyEnable=false, NO TEA)
 * - Port 8001: main-server (verifyEnable=true, TEA key="verification")
 * - Port 8002: chat-server (verifyEnable=true, TEA key="verification")
 * - Port 8003: dungeon-server (verifyEnable=true, TEA key="verification")
 * 
 * Client source: main.min.js line 76751
 *   t.loginClient = new TSSocketClient("login-server", false)
 *   t.mainClient  = new TSSocketClient("main-server", true)
 *   t.chatClient  = new TSSocketClient("chat-server", true)
 *   t.dungeonClient = new TSSocketClient("dungeon-server", true)
 * 
 * TEA verify handshake: line 52006-52013
 *   socket.on("verify", function(n) {
 *     var o = (new TEA).encrypt(n, "verification");
 *     socket.emit("verify", o, function(n) {
 *       0 == n.ret ? e() : ErrorHandler.ShowErrorTips(n.ret)
 *     })
 *   })
 */

require('dotenv').config();

const config = {
    // Server ports (from client index.html and TSSocketClient init)
    ports: {
        login: parseInt(process.env.LOGIN_PORT) || 8000,
        main: parseInt(process.env.MAIN_PORT) || 8001,
        chat: parseInt(process.env.CHAT_PORT) || 8002,
        dungeon: parseInt(process.env.DUNGEON_PORT) || 8003,
    },

    // TEA encryption key (from client line 52008)
    teaKey: process.env.TEA_KEY || 'verification',

    // MariaDB configuration
    database: {
        host: process.env.DB_HOST || '127.0.0.1',
        port: parseInt(process.env.DB_PORT) || 3306,
        user: process.env.DB_USER || 'admin',
        password: process.env.DB_PASSWORD || 'admin',
        database: process.env.DB_DATABASE || 'super_warrior_z',
        connectionLimit: parseInt(process.env.DB_CONNECTION_LIMIT) || 10,
    },

    // Protocol version (from client: version: "1.0")
    version: '1.0',

    // Game version (from client: sent as gameVersion field)
    gameVersion: '1.0.0',
};

/**
 * Get server list for client
 * 
 * 100% from client code analysis:
 * 
 * Client request (line 77332):
 *   { type:"User", action:"GetServerList", userId, subChannel, channel }
 * 
 * Client processes response in selectNewServer (line 88652-88660):
 *   this.filterByWhiteList(t.serverList);
 *   var o = !t.history || t.history.length <= 0;
 *   var a = t.history.length > 0 ? t.history[0] : t.serverList[0].serverId;
 *   var r = n.matchServerUrl(a, t.serverList);
 *   r ? n.onLoginSuccess(e, r, o) : n.selectServer(e, t)
 * 
 * matchServerUrl (line 88666-88678):
 *   Finds server by serverId in serverList array
 *   Returns server object with: serverId, name, url, dungeonurl, online, hot, "new"
 * 
 * changeServerInfo (line 88663-88665):
 *   Copies offlineReason to each server item if present
 * 
 * EXPECTED RESPONSE (parsed JSON):
 * {
 *   serverList: [
 *     {
 *       serverId: number,
 *       name: string,
 *       url: string (main server URL, e.g. "http://127.0.0.1:8001"),
 *       dungeonurl: string (dungeon server URL),
 *       online: boolean,
 *       hot: boolean,
 *       "new": boolean
 *     }
 *   ],
 *   history: [serverId, ...],  // Array of server IDs user played on
 *   offlineReason: string       // Optional maintenance message
 * }
 */
function getServerList() {
    return {
        // CRITICAL: key must be "serverList" NOT "servers"
        // Client: t.serverList (line 88653)
        serverList: [
            {
                serverId: 1,
                name: 'Server 1',
                url: `http://127.0.0.1:${config.ports.main}`,
                dungeonurl: `http://127.0.0.1:${config.ports.dungeon}`,
                online: true,
                hot: false,
                "new": true,
            },
        ],
        // CRITICAL: key must be "history"
        // Client: t.history.length (line 88656)
        history: [],
        // Optional: maintenance message
        offlineReason: '',
    };
}

module.exports = { config, getServerList };
