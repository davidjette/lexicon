// The public pack: fights that have been played, and anything else the players may see.
// Sources: the campaign's own blocks for General Thar, the Red Bird, the Dark Druid and Fora Dollar,
// as run on 2026-10-09.

import { melee, ranged, save, multi, cond, prone, order, hold, healing } from './lib.js?v=mv9oo3oz';
import { breakAll } from '../engine/zones.js?v=mv9oo3oz';
import { ALL, register } from './registry.js?v=mv9oo3oz';

const X = {};
const def = (id, t) => {
  X[id] = { id, side: 'monster', pos: 'front', ...t };
  return X[id];
};
const A = (str, dex, con, int, wis, cha) => ({ str, dex, con, int, wis, cha });
const nextTurnEnd = { who: 'tgt', when: 'end', turns: 1 };
const tharLegs = { lr: 2, leg: 3 };

def('foraDollar', {
  name: 'Master Hunter Fora Dollar', cr: 8, type: 'humanoid', side: 'pc', pos: 'back', smart: true,
  ac: 16, hp: 112, speed: 35, abil: A(14, 20, 16, 12, 16, 10), saves: { str: 6, dex: 9 }, img: 'ranger.webp', battler: 'james',
  actions: {
    bow: ranged('Longbow', 9, [['1d8+5', 'piercing']], { vs: [{ when: (E, t) => !!t.memo.quarry, dice: '1d8', type: 'piercing', label: 'Quarry' }] }),
    sword: melee('Shortsword', 9, [['1d6+5', 'piercing']]),
    multi: multi(['bow', 'bow', 'bow'], ['sword', 'sword'], ['grounding', 'bow', 'bow']),
    quarry: {
      kind: 'special', name: 'Quarry', cost: 'bonus',
      aiTarget: (E, c) => (E.enemiesOf(c).some((t) => t.memo.quarry && !t.down) ? null : E.enemiesOf(c).filter((t) => !t.down).sort((a, b) => b.maxHp - a.maxHp)[0] || null),
      run(E, c, act, choice) {
        // a concentration spell: the mark lasts until he moves it or loses concentration
        for (const o of E.list) {
          o.memo.quarry = false;
          o.fx = o.fx.filter((f) => !(f.id === 'quarry' && f.srcId === c.id));
        }
        const t = E.get(choice.targets[0]);
        if (!t) return;
        if (!c.conc || c.conc.name !== 'Quarry') E.concentrate(c, 'Quarry');
        t.memo.quarry = true;
        E.addFx(t, { id: 'quarry', name: 'Quarry', conc: c.id, onEnd: (E2, o) => { o.memo.quarry = false; } }, c);
        E.log('act', `${c.name} marks ${t.name} as his quarry.`, c);
      },
    },
    grounding: ranged('Grounding Arrow', 9, [['1d8+5', 'piercing']], {
      uses: 3,
      only: (E, t) => t.tpl.flying && !E.has(t, 'grounded'),
      onHit: [{ fx: 'save', ability: 'str', dc: 17, serious: true, onFail: [cond('grounded', { name: 'Grounding Arrow', dur: nextTurnEnd })] }],
    }),
    cure: healing('Cure Wounds', '2d8+3', { uses: 2, below: 0.4 }),
  },
  plan: [
    { use: 'cure', chance: 0.5 },
    {
      use: 'multi',
      opt: (E, c) => {
        if ([...c.engaged].some((id) => E.active(E.get(id)))) return 1;
        const q = E.enemiesOf(c).find((t) => t.memo.quarry && !t.down);
        return q && q.tpl.flying && !E.has(q, 'grounded') && E.round >= 2 && (c.used.grounding || 0) < 3 ? 2 : 0;
      },
      target: (E, c) => {
        const mine = [...c.engaged].map((id) => E.get(id)).filter((t) => E.active(t));
        if (mine.length) return mine[0];
        return E.enemiesOf(c).find((t) => t.memo.quarry && !t.down) || E.ai.pickTarget(E, c, E.action(c, 'bow'));
      },
    },
  ],
  bonusPlan: ['quarry'],
  basic: 'bow', oa: 'sword',
});

def('thar', {
  name: 'General Stockton Thar', cr: 12, type: 'humanoid', smart: true, boss: true, pos: 'mid', ...tharLegs,
  ac: 17, hp: 110, abil: A(12, 14, 14, 14, 21, 16), saves: { con: 6, int: 6, wis: 9 }, resist: ['fire'], img: 'thar.webp', battler: 'general',
  actions: {
    staff: melee('Dragon Staff', 9, [['1d8+5', 'bludgeoning'], ['3d6', 'fire']]),
    hand: save('Strangling Hand', 'con', 17, [['4d10', 'bludgeoning']], { half: true, onFail: [cond('quiet', { name: 'Strangling Hand', dur: { who: 'src', when: 'end', turns: 1 } })] }),
    multi: multi(['staff', 'staff'], ['staff', 'hand']),
    wallOfFire: save('Wall of Fire', 'dex', 17, [['5d8', 'fire']], { half: true, spell: true, uses: 1, area: { type: 'near', max: 4, spread: 0.5 } }),
    callLightning: save('Call Lightning', 'dex', 17, [['4d10', 'lightning']], { half: true, spell: true, uses: 2, area: { type: 'near', max: 2, spread: 0 } }),
    heal: { kind: 'heal', name: 'Heal', dice: '70', self: true, spell: true, uses: 1, when: (E, c) => c.hp <= c.maxHp - 60 },
    command: order('Command', { n: 1, filter: (E, a) => a.tpl.id === 'darkDruid', cost: 'leg' }),
    root: save('Root', 'str', 17, null, { onFail: [cond('restrained', { name: 'Root', dur: nextTurnEnd })] }),
  },
  plan: ['heal', 'wallOfFire', { use: 'callLightning', chance: 0.6 }, { use: 'multi', opt: (E, c) => (c.engaged.size ? 0 : 1) }, 'hand'],
  legs: [{ act: 'staff', cost: 1, w: 3, if: (E, c) => c.engaged.size > 0 }, { act: 'root', cost: 1, w: 2 }, { act: 'command', cost: 1, w: 2 }],
  basic: 'staff', oa: 'staff',
});

def('redBird', {
  name: 'The Red Bird (Thar)', type: 'beast', smart: true, boss: true, flying: true, noOA: true, size: 'huge', ...tharLegs,
  ac: 16, hp: 136, abil: A(24, 16, 14, 14, 21, 16), saves: { con: 6, int: 6, wis: 9 }, resist: ['fire'], img: 'red-bird.webp', battler: 'firebird',
  actions: {
    beak: melee('Beak', 11, [['2d8+7', 'piercing']]),
    talons: melee('Talons', 11, [['2d6+7', 'slashing']], { onHit: [{ fx: 'grapple', dc: 18 }] }),
    dive: melee('Talons (Dive)', 11, [['2d6+7', 'slashing'], ['3d8', 'slashing']], { onHit: [{ fx: 'grapple', dc: 18 }, prone] }),
    multi: multi(['beak', 'talons']),
    gust: save('Wing Gust', 'str', 18, [['4d8', 'bludgeoning']], { half: true, recharge: 5, onFail: [{ fx: 'push', label: 'Wing Gust' }, prone], area: { type: 'near', max: 4, spread: 0.5 } }),
    shriek: save('Shriek', 'wis', 17, null, { uses: 1, area: { type: 'all' }, onFail: [cond('frightened', { name: 'Shriek', saveEnds: { ability: 'wis', dc: 17 } })] }),
    command: order('Command', { n: 1, filter: (E, a) => a.tpl.id === 'darkDruid', cost: 'leg' }),
  },
  plan: [{ use: 'shriek', if: (E) => E.round >= 2, chance: 0.6 }, 'gust', 'multi'],
  legs: [{ act: 'talons', cost: 1, w: 3 }, { act: 'dive', cost: 2, w: 3 }, { act: 'command', cost: 1, w: 2 }],
  hooks: {
    // Flyby: he does not stay in reach unless he is holding someone.
    onTurnEnd(E, c) {
      if (E.has(c, 'grounded') || E.immobile(c)) return;
      const held = E.enemiesOf(c).filter((t) => t.fx.some((f) => f.cond === 'grappled' && f.srcId === c.id));
      const keep = new Set(held.map((t) => t.id));
      for (const id of [...c.engaged]) if (!keep.has(id)) { const o = E.get(id); if (o) o.engaged.delete(c.id); c.engaged.delete(id); }
    },
    // At 0 hit points the bird is Thar again, with the hit points he had when he changed.
    onZero(E, c) {
      E.log('end', 'The Red Bird falls out of the air and is General Thar again.', c);
      const t = E.spawn(ALL.thar, { side: c.side, name: ALL.thar.name, after: c });
      t.lr = c.lr;
      if (E.flags.tharHumanHp) t.hp = E.flags.tharHumanHp;
      for (const id of c.engaged) { const o = E.get(id); if (o && E.present(o)) { t.engaged.add(o.id); o.engaged.add(t.id); } }
      for (const o of E.list) E.removeFx(o, (f) => f.cond === 'grappled' && f.srcId === c.id);
      c.tpl = { ...c.tpl, noCorpse: true };
      breakAll(E, c);
      c.fled = true;
      return 'handled';
    },
  },
  basic: 'talons', oa: 'beak', check: { perRound: 30 },
});

def('darkDruid', {
  name: 'Dark Druid', cr: 4, type: 'humanoid', pos: 'mid',
  ac: 14, hp: 78, abil: A(10, 14, 14, 12, 18, 11), img: 'dark-druid.webp', battler: 'witch',
  actions: {
    lash: melee('Thorn Lash', 7, [['2d10', 'piercing']]),
    flame: ranged('Produce Flame', 7, [['3d8', 'fire']]),
    entangle: save('Entangle', 'str', 15, null, { spell: true, uses: 2, conc: true, area: { type: 'near', max: 3, spread: 0.3 }, onFail: [{ fx: 'cond', cond: 'restrained', name: 'Entangle', saveEnds: { ability: 'str', dc: 15 }, conc: true }] }),
    moonbeam: save('Moonbeam', 'con', 15, [['2d10', 'radiant']], { half: true, spell: true, uses: 1 }),
    holdPerson: hold('Hold Person', 15, { uses: 1 }),
  },
  plan: [
    { use: 'holdPerson', if: (E, c) => !c.conc, chance: 0.4 },
    { use: 'entangle', if: (E, c) => !c.conc, chance: 0.5 },
    { use: 'moonbeam', chance: 0.5 },
    { use: 'lash', if: (E, c) => c.engaged.size > 0 },
    'flame',
  ],
  basic: 'flame', oa: 'lash',
});

register({
  creatures: X,
  presets: [
  {
    id: 'blank',
    name: 'New encounter',
    where: 'Your own fight',
    blurb: 'The party is loaded. Add creatures to either side from the lists below, or build a custom one, then roll initiative.',
    monsters: [],
    switches: [],
    scenario: () => ({ flags: {} }),
  },
  {
    id: 'replaySummit',
    name: 'The summit: Thar and the Red Bird',
    where: 'The peak above the falls',
    blurb: 'Thar as the Red Bird (136 HP at the table) with four dark druids, against Gemma, Eric and Fora Dollar with resources already spent on the two fights before it. At the table: about five rounds, Eric took about 90 and stayed up, nobody dropped.',
    party: ['gemma', 'eric'],
    allies: [['foraDollar', 1]],
    monsters: [['redBird', 1], ['darkDruid', 4]],
    spent: {
      eric: { slots: { 1: 2, 2: 1, 3: 2, 4: 2, 5: 1 }, used: { flare: 2, mistyFree: 0 } },
      gemma: { used: { misty: 2, sup: 2, surge: 1 } },
    },
    switches: [],
    // at the table several of Thar's legendary actions were forgotten
    rules: { legendaryUse: 0.5 },
    scenario: () => ({ flags: { cliffChance: 0.35, tharHumanHp: 80, focusBoss: false }, initAdv: 'pc' }),
  },
  ],
  library: [
    { group: 'Allies', ids: ['foraDollar'], ally: true },
    { group: 'The Red Bird hunt', ids: ['redBird', 'thar', 'darkDruid'] },
  ],
});
