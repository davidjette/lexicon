// Passphrase encryption for the DM pack: PBKDF2-SHA256 to an AES-256-GCM key. The same code
// runs in the publish tool (Node) and in the page (Web Crypto).

const ITER = 600000;
const enc = new TextEncoder();
const dec = new TextDecoder();

const toB64 = (buf) => {
  const bytes = new Uint8Array(buf);
  let s = '';
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(s);
};
const fromB64 = (s) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));

async function keyFrom(passphrase, salt, iter) {
  const base = await crypto.subtle.importKey('raw', enc.encode(passphrase.normalize('NFKC')), 'PBKDF2', false, ['deriveKey']);
  return crypto.subtle.deriveKey({ name: 'PBKDF2', hash: 'SHA-256', salt, iterations: iter }, base, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
}

export async function encryptPack(payload, passphrase) {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await keyFrom(passphrase, salt, ITER);
  const ct = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, enc.encode(JSON.stringify(payload)));
  return { v: 1, kdf: 'PBKDF2-SHA256', iter: ITER, cipher: 'AES-256-GCM', salt: toB64(salt), iv: toB64(iv), ct: toB64(ct) };
}

// Throws if the passphrase is wrong.
export async function decryptPack(pack, passphrase) {
  const key = await keyFrom(passphrase, fromB64(pack.salt), pack.iter);
  const plain = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: fromB64(pack.iv) }, key, fromB64(pack.ct));
  return JSON.parse(dec.decode(plain));
}
