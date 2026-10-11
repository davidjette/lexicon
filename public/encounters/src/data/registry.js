// Everything that can be put on the field, and every preset fight. The public pack registers
// itself on load; the DM pack registers only after it has been unlocked.

export const ALL = {};
export const PRESETS = [];
export const LIBRARY = []; // { group, ids, dm }
export const PC_EXT = []; // functions (tpl) => tpl, applied to each character when it is built
export const packs = { dm: false };

export function register(pack, { dm = false } = {}) {
  for (const [id, t] of Object.entries(pack.creatures || {})) {
    if (dm) t.dm = true;
    ALL[id] = t;
  }
  for (const p of pack.presets || []) {
    if (!PRESETS.some((x) => x.id === p.id)) PRESETS.push(dm ? { ...p, dm: true } : p);
  }
  for (const g of pack.library || []) {
    if (!LIBRARY.some((x) => x.group === g.group)) LIBRARY.push({ ...g, dm });
  }
  for (const f of pack.pcExt || []) PC_EXT.push(f);
  if (dm) packs.dm = true;
}
