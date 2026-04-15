/**
 * ============================================================================
 *  JSON File Storage — Generic persistence layer
 *  ============================================================================
 *
 *  File-based storage tanpa database dependency.
 *  Menggunakan atomic write (write temp → rename) untuk mencegah corruption.
 *
 *  Supported operations:
 *    - load(filename, defaultValue) → parsed JSON or default
 *    - save(filename, data) → boolean success
 *    - exists(filename) → boolean
 *
 *  CRITICAL: Semua operasi synchronous (fs.readFileSync / fs.writeFileSync).
 *  Untuk private server ini acceptable karena:
 *    - Volume request rendah (< 100 concurrent users)
 *    - File size kecil (< 5MB per file)
 *    - Tidak perlu locking karena single-threaded Node.js
 *
 * ============================================================================
 */

var fs = require('fs');
var path = require('path');
var CONSTANTS = require('../config/constants');

// =============================================
// PUBLIC API
// =============================================

/**
 * Pastikan data directory ada. Dipanggil sekali saat startup.
 */
function ensureDataDir() {
    if (!fs.existsSync(CONSTANTS.DATA_DIR)) {
        fs.mkdirSync(CONSTANTS.DATA_DIR, { recursive: true });
        console.log('[Storage] Created directory:', CONSTANTS.DATA_DIR);
    }
}

/**
 * Cek apakah file ada.
 * @param {string} filename - Nama file (bukan full path)
 * @returns {boolean}
 */
function exists(filename) {
    return fs.existsSync(filename);
}

/**
 * Load JSON file. Return parsed object atau defaultValue jika file tidak ada/error.
 *
 * @param {string} filename - Full path ke file JSON
 * @param {*} defaultValue - Default value jika file tidak ada atau parse error
 * @returns {*} Parsed JSON object atau defaultValue
 */
function load(filename, defaultValue) {
    try {
        if (fs.existsSync(filename)) {
            var raw = fs.readFileSync(filename, 'utf8');
            return JSON.parse(raw);
        }
    } catch (e) {
        console.error('[Storage] Error loading', filename, ':', e.message);
    }
    return (defaultValue !== undefined) ? defaultValue : null;
}

/**
 * Save JSON file — atomic write (write to .tmp lalu rename).
 *
 * Proses atomic:
 *   1. Pastikan data directory ada
 *   2. Write ke filename.tmp (temporary file)
 *   3. Rename filename.tmp → filename (atomic pada POSIX)
 *
 * Ini mencegah corruption jika proses crash saat write.
 *
 * @param {string} filename - Full path ke file JSON
 * @param {*} data - Data yang akan disimpan
 * @returns {boolean} true jika berhasil, false jika gagal
 */
function save(filename, data) {
    try {
        ensureDataDir();
        var tempPath = filename + '.tmp';
        fs.writeFileSync(tempPath, JSON.stringify(data, null, 2), 'utf8');
        fs.renameSync(tempPath, filename);
        return true;
    } catch (e) {
        console.error('[Storage] Error saving', filename, ':', e.message);
        return false;
    }
}

/**
 * Build full path untuk file data.
 * @param {string} filename - Nama file (contoh: 'users.json')
 * @returns {string} Full path (contoh: '/path/to/data/users.json')
 */
function buildPath(filename) {
    return path.join(CONSTANTS.DATA_DIR, filename);
}

module.exports = {
    ensureDataDir: ensureDataDir,
    exists: exists,
    load: load,
    save: save,
    buildPath: buildPath
};
