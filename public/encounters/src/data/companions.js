// Creatures that fight beside a library character (a Steel Defender, a drake, a beast, an Eldritch Cannon),
// and Wild Shape. The archive holds no stat blocks for these, so each is built from its class rules and the
// owner's level and numbers. A companion stands on its owner's side, makes no death saves, and does not by
// itself keep the party "standing" (it has no `pc` flag).

import { melee, ranged, multi } from './lib.js?v=mvaaioll';
import { ALL } from './registry.js?v=mvaaioll';
import { cluster } from '../engine/zones.js?v=mvaaioll';

const A = (str, dex, con, int, wis, cha) => ({ str, dex, con, int, wis, cha });
const base = (o) => ({ side: 'pc', deathSaves: false, companion: true, smart: false, pos: 'front', ...o });

export function steelDefender(h, x) {
  const L = x.lvl('artificer');
  return base({
    id: `${h.id}-defender`, name: `${h.name.split(' ')[0]}'s Steel Defender`, type: 'construct', ac: 15, hp: 2 + x.mod('int') + 5 * L,
    abil: A(14, 12, 14, 4, 10, 6), saves: { dex: 1 + x.prof, con: 2 + x.prof }, immune: ['poison'], condImmune: ['charmed', 'exhaustion', 'poisoned'],
    actions: { rend: melee('Force-Empowered Rend', h.spellHit || 2 + x.prof, [[`1d8+${x.prof}`, 'force']]) },
    plan: ['rend'], basic: 'rend', oa: 'rend',
    reactions: [{
      id: 'deflectAttack', name: 'Deflect Attack', trigger: 'attacked', who: 'ally',
      when: (E, me, ctx) => !ctx.crit && cluster(E, me).includes(ctx.tgt),
      run(E, me, ctx) { ctx.reroll = `${me.name} deflects`; },
    }],
  });
}

export function drake(h, x) {
  const L = x.lvl('ranger');
  return base({
    id: `${h.id}-drake`, name: `${h.name.split(' ')[0]}'s Drake`, type: 'dragon', ac: 14 + x.prof, hp: 5 + 5 * L,
    abil: A(16, 12, 15, 8, 14, 8), saves: { dex: 1 + x.prof, con: 2 + x.prof }, immune: ['fire'],
    actions: { bite: melee('Bite', h.spellHit || 2 + x.prof + x.mod('wis'), [[`1d6+${x.prof}`, 'piercing']]) },
    plan: ['bite'], basic: 'bite', oa: 'bite',
  });
}

export function primalBeast(h, x) {
  const L = x.lvl('ranger');
  return base({
    id: `${h.id}-beast`, name: `${h.name.split(' ')[0]}'s Beast of the Land`, type: 'beast', ac: 13 + x.prof, hp: 5 + 5 * L,
    abil: A(14, 14, 15, 8, 14, 11), saves: {},
    actions: { maul: melee('Maul', h.spellHit || 2 + x.prof + x.mod('wis'), [[`1d8+${2 + x.prof}`, 'slashing']]) },
    plan: ['maul'], basic: 'maul', oa: 'maul',
  });
}

// An Eldritch Cannon acts on its own count, straight after its maker, and only in a round when the maker
// has spent the bonus action to fire it. Nothing aims at something that small.
export function cannon(h, x, kind, n) {
  const L = x.lvl('artificer');
  const dice = L >= 9 ? '3d8' : '2d8';
  const commanded = (E, c) => { const o = E.get(c.summonedBy); return o && E.active(o) && o.memo.cannons === E.round; };
  return base({
    id: `${h.id}-cannon-${kind}`, name: `${h.name.split(' ')[0]}'s Eldritch Cannon${n > 1 ? ` ${n}` : ''} (${kind === 'protector' ? 'Protector' : 'Force Ballista'})`,
    type: 'construct', ac: 18, hp: 5 * L, abil: A(10, 10, 10, 1, 10, 1), saves: {}, immune: ['poison', 'psychic'], untouchable: true, pos: 'back',
    condImmune: ['charmed', 'frightened', 'poisoned', 'exhaustion', 'prone', 'stunned', 'paralysed'],
    actions: {
      ballista: ranged('Force Ballista', h.spellHit, [[dice, 'force']], { spell: true, weapon: false, noRangePenalty: true }),
      protect: {
        kind: 'special', name: 'Protector', noTarget: true,
        when: (E, c) => E.alliesOf(c).some((a) => E.active(a) && !a.tpl.companion && a.tempHp <= 0),
        run(E, c) {
          const amt = Math.floor(4.5 + x.mod('int'));
          E.log('act', `${c.name} pulses: ${amt} temporary hit points to friends close by.`, c);
          const o = E.get(c.summonedBy);
          for (const a of E.alliesOf(c).filter((p) => E.active(p) && !p.tpl.companion && (p === o || !o || cluster(E, o).includes(p)))) E.tempHp(a, amt, 'Protector');
        },
      },
    },
    plan: kind === 'protector' ? ['protect', 'ballista'] : ['ballista'], basic: 'ballista',
    hooks: { skipTurn: (E, c) => (commanded(E, c) ? null : 'waits for a command.') },
  });
}

// ---------------------------------------------------------------------------------------------
// Wild Shape: the form brings its own hit points, armour and body. At 0 the druid is back in their own
// shape with whatever damage was left over.
// ---------------------------------------------------------------------------------------------
export function formFrom(tpl, ref, own) {
  const m = ALL[ref];
  if (!m) return null;
  return { name: m.name, type: m.type, size: m.size, hp: m.hp, ac: m.ac, abil: { ...own, str: m.abil.str, dex: m.abil.dex, con: m.abil.con }, actions: { formStrike: m.actions.multi || Object.values(m.actions)[0], ...m.actions } };
}

export function shape(E, c, key) {
  const f = c.tpl.forms[key];
  c.memo.own = { hp: c.hp, maxHp: c.maxHp };
  c.form = key;
  c.maxHp = f.hp;
  c.hp = f.hp;
  E.log('act', `${c.name} takes the shape of ${/^[aeiou]/i.test(f.name) ? 'an' : 'a'} ${f.name} (${f.hp} HP, AC ${f.ac}).`, c);
}

// the onZero hook for a shaped druid: back to their own body, less what carried over
export function unshape(E, c, ctx) {
  if (!c.form || !c.memo.own) return null;
  const own = c.memo.own;
  const name = c.tpl.forms[c.form].name;
  c.form = null;
  c.memo.own = null;
  c.maxHp = own.maxHp;
  c.hp = own.hp - (ctx.overflow || 0);
  if (c.hp > 0) {
    E.log('info', `${c.name}'s ${name} shape is beaten down; they are themself again at ${c.hp} HP.`, c);
    return 'handled';
  }
  // the blow went through both bodies: carry on to the ordinary fall, with what is left of the overflow
  ctx.overflow = -c.hp;
  c.hp = 0;
  return null;
}

export { multi };
