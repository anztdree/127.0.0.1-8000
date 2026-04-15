/**
 * Login Server - LoginAnnounce Handler
 * 
 * 100% derived from client code analysis.
 * 
 * CLIENT REQUEST (line 88769-88772):
 *   { type: "User", action: "LoginAnnounce" }
 * 
 * CLIENT RESPONSE HANDLER (line 88773-88790):
 *   Reads e.data as array of notice objects with fields:
 *     text: { lang_code: text_string }   (line 88780: t.text[n.language])
 *     title: { lang_code: title_string }  (line 88781: t.title[n.language])
 *     version: string                      (line 88782)
 *     orderNo: number                      (line 88783)
 *     alwaysPopup: boolean                 (line 88784)
 * 
 * Language keys: "en", "cn", "tw", "kr", "de", "fr", "pt", "vi"
 * 
 * If noticeContent.json has entries, they are loaded.
 * If disabled or file missing, returns empty array (no notices).
 * 
 * noticeContent.json structure (61 entries):
 *   Map of IDs "1"-"61", each with {id, system, name, content}
 *   content = localization key like "noticeContent_content_33"
 * 
 * NOTE: In private server, announcements are typically disabled.
 * Set ANNOUNCE.enabled = true in loginConstants.js to enable.
 */

const { success } = require('../../shared/responseHelper');
const { info, warn } = require('../../shared/utils/logger');
const { ANNOUNCE } = require('../utils/loginConstants');
const path = require('path');

/**
 * Handle LoginAnnounce action
 * 
 * @param {function} callback - Socket.IO ack callback
 */
function loginAnnounce(callback) {
    if (!ANNOUNCE.enabled) {
        info('loginAnnounce', 'Announcements disabled, returning empty');
        // CRITICAL: Client reads t.data from parsed response (L88778: r = t.data)
        // Response data MUST be { data: [] }, NOT [] directly
        if (callback) callback(success({ data: [] }));
        return;
    }

    try {
        // Try to load noticeContent.json
        const noticePath = path.resolve(__dirname, ANNOUNCE.filePath);
        const noticeData = require(noticePath);

        // Transform to client format
        // Client expects each notice: { text: {lang: string}, title: {lang: string}, version, orderNo, alwaysPopup }
        // Client reads: t.data[i].text[n.language], t.data[i].title[n.language], t.data[i].version, t.data[i].orderNo, t.data[i].alwaysPopup
        // Source: main.min.js L88778-88790
        const notices = Object.values(noticeData).map(entry => ({
            text: { en: entry.content || '', cn: entry.content || '' },
            title: { en: entry.name || '', cn: entry.name || '' },
            version: '1.0.0',
            orderNo: entry.id || 0,
            alwaysPopup: false,
        }));

        info('loginAnnounce', `Returning ${notices.length} announcements`);
        // CRITICAL FIX: Wrap in { data: [...] } so client can read t.data (L88778)
        // Before fix: success(notices) → parsed = [...] → t.data = undefined → announcements NEVER show!
        // After fix:  success({ data: notices }) → parsed = {data:[...]} → t.data = [...] → works!
        if (callback) callback(success({ data: notices }));
    } catch (err) {
        warn('loginAnnounce', `Failed to load notices: ${err.message}, returning empty`);
        if (callback) callback(success({ data: [] }));
    }
}

module.exports = { loginAnnounce };
