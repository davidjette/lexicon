// Public monsters and NPCs added through the bestiary inbox (the Encounter Builder's "Add to library"
// form). Each block is read from an uploaded stat block by Claude (skill: bestiary-inbox), in the same
// form as npcs.js. Every entry carries `campaign`, which names its picker group ("Added: <campaign>"),
// and `sheet: { source: 'inbox/<submission folder>', date }`. DM-only blocks go in src/dm/added.js.

import { melee, ranged, save, multi, cond, prone, saveOr, hold, summon, emanation, healing, parry } from '../data/lib.js?v=mvad14p5';
import { register } from '../data/registry.js?v=mvad14p5';
import { breakAll } from '../engine/zones.js?v=mvad14p5';

const N = {};
const def = (id, t) => { N[id] = { id, side: 'monster', pos: 'front', ...t }; return N[id]; };
const A = (str, dex, con, int, wis, cha) => ({ str, dex, con, int, wis, cha });

// ---- entries below this line ----

// Vecna the Archlich (CR 26), from the stat block Dave pasted on 2026-10-16. Left out: the utility and
// long-lasting spells (Animate Dead, Dimension Door, Invisibility, Dominate Monster, Globe of Invulnerability,
// Plane Shift), and the zombie a humanoid killed by Rotten Fate becomes.
const ENTROPY = 'Entropic Magic';
// up to three reactions a round, never two on the same creature's turn
const vecnaGate = (E, me) => {
  const m = (me.memo.rx = me.memo.rx || {});
  if (m.round !== E.round) Object.assign(m, { round: E.round, n: 0, turn: null });
  const turn = E.current ? E.current.id : null;
  if (m.n >= 3 || m.turn === turn) return false;
  return true;
};
const vecnaSpend = (E, me) => { me.memo.rx.n++; me.memo.rx.turn = E.current ? E.current.id : null; };
def('vecna', {
  name: 'Vecna the Archlich', campaign: 'Villains', cr: 26, type: 'undead', size: 'medium', smart: true, boss: true, pos: 'mid', init: 3, battler: 'vecna',
  sub: 'Undead wizard, CR 26',
  ac: 18, hp: 272, abil: A(14, 16, 18, 22, 24, 16), saves: { con: 12, int: 14, wis: 15 },
  resist: ['cold', 'lightning', 'necrotic'], immune: ['poison'],
  condImmune: ['charmed', 'exhaustion', 'frightened', 'paralysed', 'poisoned', 'stunned'], lr: 5,
  actions: {
    afterthought: melee('Afterthought', 13, [['1d4+5', 'piercing'], ['2d8', 'necrotic']], {
      onHit: [cond('noHeal', { name: ENTROPY })],
    }),
    rotten: save('Rotten Fate', 'con', 22, [['8d8+60', 'necrotic']], { half: true }),
    flight: save('Flight of the Damned', 'con', 22, [['8d8', 'necrotic']], {
      half: true, recharge: 5, area: { type: 'near', max: 6, spread: 0.6 },
      onFail: [cond('frightened', { name: 'Flight of the Damned', saveEnds: { ability: 'con', dc: 22 } })],
    }),
    bolt: save('Lightning Bolt', 'dex', 22, [['8d6', 'lightning']], { half: true, spell: true, area: { type: 'near', max: 3, spread: 0.5 } }),
    multi: multi(['rotten', 'afterthought', 'afterthought'], ['flight', 'afterthought', 'afterthought'], ['bolt', 'afterthought', 'afterthought']),
    vile: {
      kind: 'special', name: 'Vile Teleport', cost: 'bonus', noTarget: true,
      when: (E, c) => c.hp < c.maxHp - 40 && E.enemiesOf(c).some((t) => E.present(t) && !t.down),
      run(E, c) {
        breakAll(E, c);
        const near = E.enemiesOf(c).filter((t) => E.present(t) && !t.down).slice(0, 2);
        E.log('act', `${c.name} teleports in a burst of rot beside ${near.map((t) => t.name).join(' and ')}.`, c);
        let hurt = 0;
        for (const t of near) hurt += E.rollAndDamage(c, t, [{ dice: '3d6', type: 'psychic' }], { label: 'Vile Teleport' }) > 0 ? 1 : 0;
        if (hurt) E.heal(c, 80, c, 'Vile Teleport');
      },
    },
  },
  plan: [{ use: 'multi', opt: 1, if: (E, c) => c.ready.flight !== false && E.enemiesOf(c).filter((t) => !t.down).length >= 2 }, { use: 'multi', opt: 0 }],
  bonusPlan: ['vile'],
  reactions: [
    {
      // the afflicted take 2d8 necrotic at the start of each of their turns, then save to end it
      id: 'entropy', name: ENTROPY, trigger: 'turnStart', who: 'enemy', free: true,
      when: (E, me, ctx) => ctx.subject.fx.some((f) => f.name === ENTROPY) && !ctx.subject.down,
      run(E, me, ctx) {
        const t = ctx.subject;
        E.rollAndDamage(me, t, [{ dice: '2d8', type: 'necrotic' }], { label: ENTROPY });
        if (E.alive(t) && E.save(t, 'con', 20).success) E.removeFx(t, (f) => f.name === ENTROPY);
      },
    },
    {
      id: 'dread', name: 'Dread Counterspell', trigger: 'spellCast', who: 'enemy', free: true,
      when: (E, me, ctx) => ctx.level >= 1 && vecnaGate(E, me),
      run(E, me, ctx) {
        vecnaSpend(E, me);
        const lvl = ctx.level;
        // 4th level or lower simply fails; higher needs Int +6 against DC 10 + level
        const ok = lvl <= 4 || E.rng.chance(Math.max(0.05, Math.min(1, (21 - (10 + lvl - 6)) / 20)));
        E.log('act', `${me.name} speaks a dread word at ${ctx.caster.name}'s ${ctx.act.name}${ok ? '' : ', and it holds'}.`, me);
        if (!ok) return;
        ctx.countered = true;
        E.rollAndDamage(me, ctx.caster, [{ dice: '3d6', type: 'psychic' }], { label: 'Dread Counterspell' });
      },
    },
    {
      id: 'rebuke', name: 'Fell Rebuke', trigger: 'hitBy', free: true,
      when: (E, me, ctx) => ctx.att && E.present(ctx.att) && vecnaGate(E, me),
      run(E, me, ctx) {
        vecnaSpend(E, me);
        E.log('act', `${me.name} utters a fell word at ${ctx.att.name} and is gone.`, me);
        E.rollAndDamage(me, ctx.att, [{ dice: '3d6', type: 'necrotic' }], { label: 'Fell Rebuke' });
        breakAll(E, me);
      },
    },
  ],
  basic: 'afterthought', oa: 'afterthought',
});

// ---- entries above this line ----

const groups = {};
for (const t of Object.values(N)) (groups[t.campaign || 'Inbox'] = groups[t.campaign || 'Inbox'] || []).push(t.id);
register({
  creatures: N,
  library: Object.entries(groups).map(([campaign, ids]) => ({ group: `Added: ${campaign}`, ids, ally: ids.every((id) => N[id].side === 'pc') })),
});
