// Finds and installs the DM pack. On the published site the pack is one encrypted file; in the
// working copy on the DM's own machine the three source files are read as they are.

import { makeApi } from './data/api.js?v=mx07tr2o';
import { packs } from './data/registry.js?v=mx07tr2o';
import { decryptPack } from './pack-crypto.js?v=mx07tr2o';

const FILES = ['monsters.js', 'extras.js', 'revised.js', 'finale.js', 'encounters.js', 'added.js', 'tracker.js'];
// Files for a campaign still being played. They are in the working copy and in a locked pack, and
// are never published in the clear, so an open copy of the site simply does not have them.
const GATED = ['rexor.js'];

// Run the pack's files (plain JavaScript text, no imports of their own) against the registry.
export async function installTexts(texts) {
  if (packs.dm) return;
  const api = makeApi();
  for (const text of texts) {
    const url = URL.createObjectURL(new Blob([text], { type: 'text/javascript' }));
    try {
      const mod = await import(/* @vite-ignore */ url);
      mod.default(api);
    } finally {
      URL.revokeObjectURL(url);
    }
  }
}

// { kind: 'local', texts } | { kind: 'encrypted', pack } | null
export async function findPack(base = '') {
  try {
    const got = await Promise.all(FILES.map((f) => fetch(`${base}src/dm/${f}`, { cache: 'no-store' })));
    if (got.every((r) => r.ok && (r.headers.get('content-type') || '').includes('javascript'))) {
      const texts = await Promise.all(got.map((r) => r.text()));
      for (const f of GATED) {
        try {
          const r = await fetch(`${base}src/dm/${f}`, { cache: 'no-store' });
          if (r.ok && (r.headers.get('content-type') || '').includes('javascript')) texts.push(await r.text());
        } catch { /* not in this copy */ }
      }
      return { kind: 'local', texts };
    }
  } catch { /* not a working copy */ }
  try {
    const r = await fetch(`${base}dm-pack.json`, { cache: 'no-store' });
    if (r.ok) return { kind: 'encrypted', pack: await r.json() };
  } catch { /* no pack published */ }
  return null;
}

export async function unlock(found, passphrase) {
  if (found.kind === 'local') return found.texts;
  const payload = await decryptPack(found.pack, passphrase);
  return payload.texts;
}
