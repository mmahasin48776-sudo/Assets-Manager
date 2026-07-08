// Helper to convert base32 to/from Uint8Array
function base32ToBytes(str: string): Uint8Array {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
  str = str.replace(/=+$/, '').toUpperCase();
  const bytes = new Uint8Array(Math.floor((str.length * 5) / 8));
  let val = 0;
  let count = 0;
  let index = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str[i];
    const charVal = alphabet.indexOf(char);
    if (charVal === -1) continue;
    val = (val << 5) | charVal;
    count += 5;
    if (count >= 8) {
      bytes[index++] = (val >> (count - 8)) & 255;
      count -= 8;
    }
  }
  return bytes;
}

// SHA1 function (pure JS, safe in browser and node)
function sha1(bytes: Uint8Array): Uint8Array {
  const words: number[] = [];
  const len = bytes.length;
  for (let i = 0; i < len; i++) {
    words[i >> 2] |= bytes[i] << (24 - (i % 4) * 8);
  }
  
  // Pad
  const bitLen = len * 8;
  const wordCount = ((len + 8) >> 6) * 16 + 16;
  words[len >> 2] |= 0x80 << (24 - (len % 4) * 8);
  words[wordCount - 1] = bitLen;
  
  const w = new Int32Array(80);
  let a = 1732584193;
  let b = -271733879;
  let c = -1732584194;
  let d = 271733878;
  let e = -1009589776;
  
  for (let i = 0; i < wordCount; i += 16) {
    const tempA = a, tempB = b, tempC = c, tempD = d, tempE = e;
    for (let j = 0; j < 80; j++) {
      if (j < 16) {
        w[j] = words[i + j] | 0;
      } else {
        const val = w[j - 3] ^ w[j - 8] ^ w[j - 14] ^ w[j - 16];
        w[j] = (val << 1) | (val >>> 31);
      }
      
      let f = 0, k = 0;
      if (j < 20) {
        f = (b & c) | (~b & d);
        k = 1518500249;
      } else if (j < 40) {
        f = b ^ c ^ d;
        k = 1859775393;
      } else if (j < 60) {
        f = (b & c) | (b & d) | (c & d);
        k = -1894007588;
      } else {
        f = b ^ c ^ d;
        k = -899497514;
      }
      
      const temp = (((a << 5) | (a >>> 27)) + f + e + k + w[j]) | 0;
      e = d;
      d = c;
      c = (b << 30) | (b >>> 2);
      b = a;
      a = temp;
    }
    a = (a + tempA) | 0;
    b = (b + tempB) | 0;
    c = (c + tempC) | 0;
    d = (d + tempD) | 0;
    e = (e + tempE) | 0;
  }
  
  const res = new Uint8Array(20);
  for (let i = 0; i < 5; i++) {
    const word = i === 0 ? a : i === 1 ? b : i === 2 ? c : i === 3 ? d : e;
    res[i * 4] = (word >> 24) & 255;
    res[i * 4 + 1] = (word >> 16) & 255;
    res[i * 4 + 2] = (word >> 8) & 255;
    res[i * 4 + 3] = word & 255;
  }
  return res;
}

// HMAC-SHA1 function (pure JS)
function hmacSha1(key: Uint8Array, message: Uint8Array): Uint8Array {
  let finalKey = key;
  if (key.length > 64) {
    finalKey = sha1(key);
  }
  
  const ipad = new Uint8Array(64);
  const opad = new Uint8Array(64);
  ipad.fill(0x36);
  opad.fill(0x5c);
  
  for (let i = 0; i < finalKey.length; i++) {
    ipad[i] ^= finalKey[i];
    opad[i] ^= finalKey[i];
  }
  
  const innerMsg = new Uint8Array(64 + message.length);
  innerMsg.set(ipad, 0);
  innerMsg.set(message, 64);
  const innerHash = sha1(innerMsg);
  
  const outerMsg = new Uint8Array(64 + 20);
  outerMsg.set(opad, 0);
  outerMsg.set(innerHash, 64);
  return sha1(outerMsg);
}

// Generate the 6-digit TOTP token
export function generateToken(secret: string, time: number = Date.now()): string {
  const secretBytes = base32ToBytes(secret);
  const epoch = Math.floor(time / 1000 / 30);
  
  const message = new Uint8Array(8);
  let temp = epoch;
  for (let i = 7; i >= 0; i--) {
    message[i] = temp & 255;
    temp = Math.floor(temp / 256);
  }
  
  const hmac = hmacSha1(secretBytes, message);
  const offset = hmac[19] & 0xf;
  
  const code = (
    ((hmac[offset] & 0x7f) << 24) |
    ((hmac[offset + 1] & 255) << 16) |
    ((hmac[offset + 2] & 255) << 8) |
    (hmac[offset + 3] & 255)
  ) % 1000000;
  
  return code.toString().padStart(6, '0');
}

// Verify a 6-digit TOTP token (supports window back and ahead for time drift)
export function verifyToken(secret: string, token: string, windowSeconds = 30): boolean {
  if (!secret || !token) return false;
  const cleanedToken = token.trim().replace(/\s/g, "");
  if (cleanedToken.length !== 6) return false;
  
  const time = Date.now();
  const step = 30000; // 30 seconds
  const allowedSteps = Math.floor(windowSeconds / 30);
  
  for (let i = -allowedSteps; i <= allowedSteps; i++) {
    const computed = generateToken(secret, time + i * step);
    if (computed === cleanedToken) {
      return true;
    }
  }
  return false;
}

// Generate a random Base32 string (for new TOTP configurations)
export function generateBase32Secret(length = 16): string {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
  let res = '';
  for (let i = 0; i < length; i++) {
    const randIdx = Math.floor(Math.random() * alphabet.length);
    res += alphabet[randIdx];
  }
  return res;
}
