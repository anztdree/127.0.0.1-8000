/**
 * TEA Encryption/Decryption Module (XXTEA variant)
 * 
 * 100% derived from client code analysis.
 * 
 * CLIENT TEA CLASS (line 79576-79633):
 *   Algorithm: XXTEA (Corrected Block TEA / Wheeler-Needham)
 *   Delta: 0x9E3779B9 (2654435769)
 *   Endianness: LITTLE-ENDIAN (strToLongs reads bytes [0]=LSB, [3]=MSB)
 *   Key: Utf8.encode(key).slice(0,16) → 4 × uint32 little-endian
 *   Rounds: floor(6 + 52/n) where n = number of 32-bit words
 *   Output: Base64 encoded
 *   Input: Utf8 encoded
 * 
 * USAGE:
 *   - Socket verify handshake ONLY (line 52006-52013)
 *   - Game data messages are NOT TEA encrypted (plain JSON)
 * 
 * Client code:
 *   socket.on("verify", function(n) {
 *     var o = (new TEA).encrypt(n, "verification");
 *     socket.emit("verify", o, function(n) {
 *       0 == n.ret ? e() : ErrorHandler.ShowErrorTips(n.ret)
 *     })
 *   })
 */

// Minimal Base64 encode/decode (browser-compatible, no Buffer)
const Base64 = {
    encode: function(str) {
        // Convert string to binary string
        let binary = '';
        for (let i = 0; i < str.length; i++) {
            binary += String.fromCharCode(str.charCodeAt(i) & 0xFF);
        }
        return Buffer.from(binary, 'binary').toString('base64');
    },
    decode: function(str) {
        const binary = Buffer.from(str, 'base64').toString('binary');
        let result = '';
        for (let i = 0; i < binary.length; i++) {
            result += String.fromCharCode(binary.charCodeAt(i));
        }
        return result;
    }
};

// Minimal UTF8 encode/decode
const Utf8 = {
    encode: function(str) {
        return Buffer.from(str, 'utf8').toString('binary');
    },
    decode: function(str) {
        const bytes = [];
        for (let i = 0; i < str.length; i++) {
            bytes.push(str.charCodeAt(i) & 0xFF);
        }
        return Buffer.from(bytes).toString('utf8');
    }
};

const DELTA = 0x9E3779B9;

/**
 * Convert string to uint32 array (LITTLE-ENDIAN)
 * Client code (line 79599):
 *   t[n] = e.charCodeAt(4*n) + (e.charCodeAt(4*n+1) << 8)
 *       + (e.charCodeAt(4*n+2) << 16) + (e.charCodeAt(4*n+3) << 24);
 */
function strToLongs(str) {
    const len = Math.ceil(str.length / 4);
    const result = new Array(len);
    for (let n = 0; n < len; n++) {
        result[n] = str.charCodeAt(4 * n)
            + (str.charCodeAt(4 * n + 1) << 8)
            + (str.charCodeAt(4 * n + 2) << 16)
            + (str.charCodeAt(4 * n + 3) << 24);
    }
    return result;
}

/**
 * Convert uint32 array to string (LITTLE-ENDIAN)
 * Client code (line 79606):
 *   t[n] = String.fromCharCode(255 & e[n], e[n]>>>8 & 255,
 *                              e[n]>>>16 & 255, e[n]>>>24 & 255);
 */
function longsToStr(arr) {
    const parts = [];
    for (let n = 0; n < arr.length; n++) {
        parts.push(
            String.fromCharCode(
                arr[n] & 0xFF,
                (arr[n] >>> 8) & 0xFF,
                (arr[n] >>> 16) & 0xFF,
                (arr[n] >>> 24) & 0xFF
            )
        );
    }
    return parts.join('');
}

/**
 * XXTEA Encrypt
 * Client code (line 79582-79596):
 *   var n = this.strToLongs(Utf8.encode(e));
 *   n.length <= 1 && (n[1] = 0);
 *   var r = this.strToLongs(Utf8.encode(t).slice(0, 16));
 *   var i = n.length, s = n[i-1], l = n[0], u = 2654435769;
 *   var c = Math.floor(6 + 52/i), p = 0;
 *   for (; c-- > 0;) {
 *     p += u; a = p >>> 2 & 3;
 *     for (var d = 0; i > d; d++)
 *       l = n[(d+1) % i],
 *       o = (s>>>5 ^ l<<2) + (l>>>3 ^ s<<4) ^ (p^l) + (r[3&d^a] ^ s),
 *       s = n[d] += o;
 *   }
 *   return Base64.encode(this.longsToStr(n));
 * 
 * @param {string} plaintext - String to encrypt
 * @param {string} key - Encryption key (default: "verification")
 * @returns {string} Base64-encoded encrypted string
 */
function encrypt(plaintext, key) {
    key = key || 'verification';
    if (plaintext.length === 0) return '';

    // UTF-8 encode and convert to uint32 array
    const n = strToLongs(Utf8.encode(plaintext));
    // Ensure at least 2 elements
    if (n.length <= 1) n[1] = 0;

    // Key: UTF-8 encode, truncate to 16 chars, convert to uint32
    const r = strToLongs(Utf8.encode(key).slice(0, 16));

    const i = n.length;
    let s = n[i - 1];
    let l = n[0];
    const u = DELTA;
    const c = Math.floor(6 + 52 / i);
    let p = 0;

    for (; c-- > 0;) {
        p = (p + u) >>> 0;
        const a = p >>> 2 & 3;
        for (let d = 0; i > d; d++) {
            l = n[(d + 1) % i];
            const o = ((s >>> 5 ^ l << 2) + (l >>> 3 ^ s << 4) ^ (p ^ l) + (r[3 & d ^ a] ^ s)) >>> 0;
            s = n[d] = (n[d] + o) >>> 0;
        }
    }

    return Base64.encode(longsToStr(n));
}

/**
 * XXTEA Decrypt
 * Client code (line 79616-79630):
 *   var a = this.strToLongs(Base64.decode(e));
 *   var r = this.strToLongs(Utf8.encode(t).slice(0, 16));
 *   var i = a.length, s = a[i-1], l = a[0];
 *   var c = Math.floor(6+52/i), p = c*u;
 *   for (; 0 != p;) {
 *     o = p >>> 2 & 3;
 *     for (var d = i-1; d >= 0; d--)
 *       s = a[d > 0 ? d-1 : i-1],
 *       n = (s>>>5 ^ l<<2) + (l>>>3 ^ s<<4) ^ (p^l) + (r[3&d^o] ^ s),
 *       l = a[d] -= n;
 *     p -= u;
 *   }
 *   var g = this.longsToStr(a);
 *   return g = g.replace(/\0+$/, ""), Utf8.decode(g);
 * 
 * @param {string} base64Cipher - Base64-encoded encrypted string
 * @param {string} key - Encryption key (default: "verification")
 * @returns {string} Decrypted plaintext string
 */
function decrypt(base64Cipher, key) {
    key = key || 'verification';
    if (base64Cipher.length === 0) return '';

    const a = strToLongs(Base64.decode(base64Cipher));
    const r = strToLongs(Utf8.encode(key).slice(0, 16));

    const i = a.length;
    let s = a[i - 1];
    let l = a[0];
    const c = Math.floor(6 + 52 / i);
    let p = c * DELTA;

    for (; p !== 0;) {
        const o = p >>> 2 & 3;
        for (let d = i - 1; d >= 0; d--) {
            s = a[d > 0 ? d - 1 : i - 1];
            const n = ((s >>> 5 ^ l << 2) + (l >>> 3 ^ s << 4) ^ (p ^ l) + (r[3 & d ^ o] ^ s)) >>> 0;
            l = a[d] = (a[d] - n) >>> 0;
        }
        p = (p - DELTA) >>> 0;
    }

    let g = longsToStr(a);
    g = g.replace(/\0+$/, '');
    return Utf8.decode(g);
}

module.exports = { encrypt, decrypt };
