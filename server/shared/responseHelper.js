/**
 * Response Helper Module
 * 
 * 100% derived from client code analysis.
 * 
 * CLIENT RESPONSE FORMAT (line 76925-76935):
 *   Response object: { ret, data, compress, serverTime, server0Time }
 *   
 *   SUCCESS detection (line 76925):
 *     if(0 === e.ret) { ... success path ... }
 *   ERROR detection:
 *     else { ErrorHandler.ShowErrorTips(e.ret, callback) }
 *   
 *   Data parsing (line 76926-76929):
 *     var i = e.data;              // data is a STRING (not object)
 *     e.compress && (t = LZString.decompressFromUTF16(t));  // optional decompress
 *     var a = JSON.parse(t);       // parse string to object
 *   
 *   Special error handling:
 *     "22" == e.ret → ts.reportBattlleLog()
 *     "38" == e.ret → TSBrowser.executeFunction("reload")
 *   
 * PUSH/NOTIFY FORMAT (line 77182):
 *   if("SUCCESS" == t.ret) { ... process push ... }
 *   Push uses ret = "SUCCESS" (string)
 * 
 * ERROR CODES from resource/json/errorDefine.json (365 codes):
 *   1 = ERROR_UNKNOWN
 *   12 = ERROR_USER_LOGIN_BEFORE (user already logged in)
 *   38 = ERROR_LOGIN_CHECK_FAILED (triggers page reload)
 *   45 = FORBIDDEN_LOGIN
 *   47 = NOT_ENABLE_REGIST
 *   51 = GAME_SERVER_OFFLINE
 *   62 = CLIENT_VERSION_ERR
 *   65 = MAINTAIN
 *   57003 = USER_NOT_REGIST (KICK)
 */

/**
 * Build success response
 * Client expects: ret=0 (number), data=JSON string, serverTime, server0Time
 * 
 * @param {object} dataObj - Data object to return (will be JSON.stringify'd)
 * @param {boolean} compress - Whether to compress data with LZString
 * @returns {object} Response object matching client format
 */
function success(dataObj, compress) {
    const now = Date.now();
    let dataStr;

    if (dataObj !== undefined && dataObj !== null) {
        dataStr = JSON.stringify(dataObj);
        if (compress) {
            const { compressData } = require('./lzHelper');
            dataStr = compressData(dataStr);
        }
    }

    return {
        ret: 0,           // 0 = SUCCESS (number, strict equality: 0 === e.ret)
        data: dataStr,
        compress: !!compress,
        serverTime: now,  // Current server timestamp
        server0Time: now, // Same timestamp reference
    };
}

/**
 * Build error response
 * Client expects: ret=error_code (number), triggers ErrorHandler.ShowErrorTips
 * 
 * Error codes from errorDefine.json:
 *   1  = ERROR_UNKNOWN - Unknown error
 *   2  = ERROR_STATE_ERROR - State error
 *   3  = ERROR_DATA_ERROR - Data error
 *   4  = ERROR_INVALID - Invalid request
 *   8  = ERROR_LACK_PARAM - Missing parameter
 *   12 = ERROR_USER_LOGIN_BEFORE - User already logged in
 *   38 = ERROR_LOGIN_CHECK_FAILED - Login check failed (triggers reload!)
 *   45 = FORBIDDEN_LOGIN - Login forbidden
 *   47 = NOT_ENABLE_REGIST - Registration not enabled
 *   51 = GAME_SERVER_OFFLINE - Game server offline
 *   62 = CLIENT_VERSION_ERR - Client version error
 *   65 = MAINTAIN - Server maintenance
 * 
 * @param {number} code - Error code from errorDefine.json
 * @param {string} dataStr - Optional error data string
 * @returns {object} Error response object
 */
function error(code, dataStr) {
    return {
        ret: code,        // Error code number from errorDefine.json
        data: dataStr || '',
        compress: false,
        serverTime: Date.now(),
        server0Time: Date.now(),
    };
}

/**
 * Build push/notify response
 * Client expects: ret="SUCCESS" (string literal)
 * 
 * Client source (line 77182):
 *   if("SUCCESS" == t.ret) { ... process push data ... }
 * 
 * @param {object} dataObj - Push data object
 * @returns {object} Push response
 */
function push(dataObj) {
    return {
        ret: 'SUCCESS',   // String "SUCCESS" for push/notify (NOT number 0)
        data: JSON.stringify(dataObj || {}),
        action: dataObj ? dataObj.action : undefined,
    };
}

// Common error codes from errorDefine.json
const ErrorCode = {
    UNKNOWN: 1,
    STATE_ERROR: 2,
    DATA_ERROR: 3,
    INVALID: 4,
    INVALID_COMMAND: 5,
    LACK_PARAM: 8,
    USER_LOGIN_BEFORE: 12,
    USER_NOT_LOGIN_BEFORE: 13,
    USER_NOT_LOGOUT: 14,
    LOGIN_CHECK_FAILED: 38,
    FORBIDDEN_LOGIN: 45,
    NOT_ENABLE_REGIST: 47,
    GAME_SERVER_OFFLINE: 51,
    CLIENT_VERSION_ERR: 62,
    MAINTAIN: 65,
    USER_NOT_REGIST: 57003,
};

module.exports = { success, error, push, ErrorCode };
