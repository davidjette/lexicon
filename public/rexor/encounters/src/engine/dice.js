// Seeded dice. Every roll in the simulator comes through here so a fight can be replayed from its seed.

export function makeRng(seed) {
  let a = (seed >>> 0) || 1;
  const next = () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  return {
    seed,
    next,
    int: (n) => 1 + Math.floor(next() * n),
    chance: (p) => next() < p,
    pick: (arr) => arr[Math.floor(next() * arr.length)],
    weighted(items, weightOf) {
      let total = 0;
      const w = items.map((it) => {
        const x = Math.max(0, weightOf(it));
        total += x;
        return x;
      });
      if (total <= 0) return items.length ? items[Math.floor(next() * items.length)] : undefined;
      let r = next() * total;
      for (let i = 0; i < items.length; i++) {
        r -= w[i];
        if (r <= 0) return items[i];
      }
      return items[items.length - 1];
    },
  };
}

const cache = new Map();

// "2d8+7", "1d4+1d8+2d6+5", "3d6-1", 12 -> { terms: [{n, sides}], mod }
export function parseDice(expr) {
  if (typeof expr === 'number') return { terms: [], mod: expr };
  let p = cache.get(expr);
  if (p) return p;
  const terms = [];
  let mod = 0;
  const clean = String(expr).replace(/\s+/g, '').replace(/−/g, '-');
  const re = /([+-]?)(\d+)(?:d(\d+))?/g;
  let m;
  while ((m = re.exec(clean))) {
    const sign = m[1] === '-' ? -1 : 1;
    if (m[3]) terms.push({ n: +m[2], sides: +m[3], sign });
    else mod += sign * +m[2];
  }
  p = { terms, mod };
  cache.set(expr, p);
  return p;
}

export function avgDice(expr) {
  const { terms, mod } = parseDice(expr);
  return terms.reduce((s, t) => s + t.sign * t.n * (t.sides + 1) / 2, mod);
}

export function maxDice(expr) {
  const { terms, mod } = parseDice(expr);
  return terms.reduce((s, t) => s + t.sign * t.n * t.sides, mod);
}

// critRule: 'maxPlusRoll' (this table: maximum dice plus the dice rolled again) or 'double' (book rule).
export function rollDice(rng, expr, { crit = false, critRule = 'maxPlusRoll', average = false } = {}) {
  const { terms, mod } = parseDice(expr);
  if (average && !crit) {
    const total = Math.floor(avgDice(expr));
    return { total, text: `${total}` };
  }
  let total = mod;
  const bits = [];
  for (const t of terms) {
    const faces = [];
    for (let i = 0; i < t.n; i++) faces.push(rng.int(t.sides));
    let sub = faces.reduce((s, f) => s + f, 0);
    let label = `${t.n}d${t.sides}[${faces.join(',')}]`;
    if (crit) {
      if (critRule === 'double') {
        const extra = [];
        for (let i = 0; i < t.n; i++) extra.push(rng.int(t.sides));
        sub += extra.reduce((s, f) => s + f, 0);
        label += `+crit[${extra.join(',')}]`;
      } else {
        sub += t.n * t.sides;
        label += `+max ${t.n * t.sides}`;
      }
    }
    total += t.sign * sub;
    bits.push((t.sign < 0 ? '-' : '') + label);
  }
  if (mod) bits.push(mod > 0 ? `${mod}` : `(${mod})`);
  return { total: Math.max(0, total), text: bits.join(' + ') || '0' };
}

// mode: 'adv' | 'dis' | 'normal'
export function d20(rng, mode = 'normal') {
  const a = rng.int(20);
  if (mode === 'normal') return { nat: a, first: a, text: `d20[${a}]` };
  const b = rng.int(20);
  const nat = mode === 'adv' ? Math.max(a, b) : Math.min(a, b);
  return { nat, first: a, text: `d20[${a},${b}]${mode === 'adv' ? ' adv' : ' dis'}` };
}

export const mod = (score) => Math.floor((score - 10) / 2);
export const signed = (n) => (n >= 0 ? `+${n}` : `${n}`);
