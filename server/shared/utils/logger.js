/**
 * Logger Utility
 */

const LOG_LEVELS = {
    DEBUG: 0,
    INFO: 1,
    WARN: 2,
    ERROR: 3,
};

const currentLevel = LOG_LEVELS[process.env.LOG_LEVEL] !== undefined
    ? LOG_LEVELS[process.env.LOG_LEVEL]
    : LOG_LEVELS.INFO;

function getTimestamp() {
    return new Date().toISOString();
}

function debug(tag, ...args) {
    if (currentLevel <= LOG_LEVELS.DEBUG) {
        console.log(`[${getTimestamp()}] [DEBUG] [${tag}]`, ...args);
    }
}

function info(tag, ...args) {
    if (currentLevel <= LOG_LEVELS.INFO) {
        console.log(`[${getTimestamp()}] [INFO] [${tag}]`, ...args);
    }
}

function warn(tag, ...args) {
    if (currentLevel <= LOG_LEVELS.WARN) {
        console.warn(`[${getTimestamp()}] [WARN] [${tag}]`, ...args);
    }
}

function error(tag, ...args) {
    if (currentLevel <= LOG_LEVELS.ERROR) {
        console.error(`[${getTimestamp()}] [ERROR] [${tag}]`, ...args);
    }
}

module.exports = { debug, info, warn, error, LOG_LEVELS };
