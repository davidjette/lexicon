// Abstract position. There is no map: a combatant is in melee with named enemies ("engaged"),
// may be marked as staying beside an ally ("near"), and is otherwise at range.

export const MAX_ENGAGERS = 6;

export function engage(a, b) {
  if (!a || !b || a === b) return;
  a.engaged.add(b.id);
  b.engaged.add(a.id);
}

export function disengage(a, b) {
  a.engaged.delete(b.id);
  b.engaged.delete(a.id);
}

export function breakAll(E, c) {
  for (const id of [...c.engaged]) {
    const o = E.get(id);
    if (o) o.engaged.delete(c.id);
  }
  c.engaged.clear();
}

export function isEngaged(a, b) {
  return a.engaged.has(b.id);
}

export function hasRoom(E, target) {
  let n = 0;
  for (const id of target.engaged) if (E.alive(E.get(id))) n++;
  return n < MAX_ENGAGERS;
}

// Allies standing together: linked by a "near" marker either way, or sharing an engaged enemy.
export function cluster(E, c) {
  const seen = new Set([c.id]);
  const queue = [c];
  const allies = E.side(c.side).filter((x) => E.present(x));
  while (queue.length) {
    const cur = queue.pop();
    for (const o of allies) {
      if (seen.has(o.id)) continue;
      const linked =
        o.near === cur.id ||
        cur.near === o.id ||
        [...cur.engaged].some((id) => o.engaged.has(id));
      if (linked) {
        seen.add(o.id);
        queue.push(o);
      }
    }
  }
  return [...seen].map((id) => E.get(id));
}

// Enemies inside an emanation centred on c (Spirit Guardians and the like): anything in melee
// with c or with an ally standing in c's cluster.
export function enemiesInAura(E, c) {
  const out = new Set();
  for (const ally of cluster(E, c)) {
    for (const id of ally.engaged) {
      const e = E.get(id);
      if (e && E.present(e) && e.side !== c.side) out.add(e);
    }
  }
  return [...out];
}

// Allies inside a short aura centred on c (Aura of Protection): c and its cluster.
export function alliesInAura(E, c) {
  return cluster(E, c).filter((x) => E.present(x));
}

const RANKS = ['front', 'mid', 'back'];
const rankOf = (c) => (RANKS.includes(c.pos) ? c.pos : 'front');

// With the table rule `ranks` on: an area aimed at a creature catches every enemy in that
// creature's rank, with no cap. A big area (a spell-book size of 6, or a spread of half or more)
// also catches the neighbouring rank, the fuller one where there are two.
function rankTargets(foes, primary, { spread, size }) {
  const mine = rankOf(primary);
  const caught = [mine];
  if (size >= 6 || spread >= 0.5) {
    const count = (r) => foes.filter((f) => rankOf(f) === r).length;
    const beside = mine === 'mid' ? (count('back') > count('front') ? 'back' : 'front') : 'mid';
    caught.push(beside);
  }
  return [primary, ...foes.filter((f) => f !== primary && caught.includes(rankOf(f)))];
}

// Targets of an area effect aimed at `primary`. `spread` is the chance that a creature on the
// same side who is not standing with the primary is caught anyway (big cones and bursts).
// `size` is the spell book's size for the area, where it has one.
export function areaTargets(E, caster, primary, { max = 99, spread = 0, type = 'near', size = 0 } = {}) {
  const foes = E.enemiesOf(caster).filter((x) => E.present(x));
  if (type === 'all') return foes.slice(0, max);
  if (type === 'engaged') {
    return foes.filter((x) => caster.engaged.has(x.id)).slice(0, max);
  }
  if (!primary) return [];
  if (E.rules.ranks) return rankTargets(foes, primary, { spread, size });
  const group = new Set(cluster(E, primary).map((x) => x.id));
  const out = [primary];
  for (const f of foes) {
    if (f === primary || out.length >= max) continue;
    if (group.has(f.id) || (spread > 0 && E.rng.chance(spread))) out.push(f);
  }
  return out;
}
