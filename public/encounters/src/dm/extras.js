// DM ONLY. Allies and variants that go with the Lazaret fights. No imports: see monsters.js.

export default function (api) {
const { melee, save, multi, toll, order, healing, isHonourDead } = api;
const M = api.M;
const X = api.X;
const def = (id, t) => {
  X[id] = { id, side: 'monster', pos: 'front', ...t };
  return X[id];
};
const A = (str, dex, con, int, wis, cha) => ({ str, dex, con, int, wis, cha });

def('zeroOne', {
  name: 'Zero-One (placeholder stats)', cr: 5, type: 'humanoid', side: 'pc', pos: 'back',
  ac: 15, hp: 60, abil: A(10, 12, 14, 14, 18, 14), saves: { wis: 7, cha: 5 }, img: 'zero-one.webp',
  actions: {
    flame: save('Sacred Flame', 'dex', 15, [['3d8', 'radiant']], {}),
    word: healing('Healing Word', '2d4+4', { cost: 'bonus', uses: 3, below: 0.35 }),
    cutBond: {
      kind: 'special', name: 'Cut the bond (her own rite)', noTarget: true,
      when: (E, c) => E.enemiesOf(c).some((t) => t.memo.working),
      run(E, c) {
        const u = E.enemiesOf(c).find((t) => t.memo.working);
        E.log('end', `${c.name} cuts the bond without a check: it is the rite she used on Uriel years ago. The child lives.`, c);
        u.memo.working = 0; u.memo.risen = true; u.fx = [];
        E.kill(u, c, 'the bond is cut');
      },
    },
  },
  plan: ['cutBond', 'flame'],
  bonusPlan: ['word'],
  basic: 'flame',
});

def('choir', {
  name: 'Choir of Black Doves', cr: 7, type: 'humanoid', tags: ['sister', 'singer'], pos: 'mid', areaVuln: true,
  ac: 14, hp: 150, abil: A(10, 12, 14, 10, 16, 12), saves: { wis: 5 }, resist: ['necrotic'],
  condImmune: ['grappled', 'restrained', 'prone'], img: 'black-dove.webp',
  outMult: (E, c) => (c.hp < 75 ? 0.5 : 1),
  actions: {
    knives: melee('Knives', 5, [['4d6', 'necrotic']], { also: 5 }),
    toll: save('Toll', 'wis', 13, [['2d12', 'necrotic']], { area: { type: 'all', max: 3 } }),
    direct: order('Direct the Dead', { n: 1, filter: isHonourDead, cost: 'bonus' }),
  },
  plan: [{ use: 'knives', if: (E, c) => c.engaged.size > 0, chance: 0.5 }, 'toll'],
  bonusPlan: ['direct'],
  basic: 'toll', oa: 'knives',
});

def('slabSister', {
  ...M.doveWight, id: 'slabSister', name: 'Sorrowful Sister (as run 10/2)', hp: 92, check: null,
  actions: {
    sickle: melee('Grave Hand', 7, [['2d6+3', 'slashing']], {
      onHit: [{ fx: 'save', ability: 'con', dc: 12, oncePerTurn: 'drain', onFail: [{ fx: 'dmg', dmg: [['10', 'necrotic']] }, { fx: 'maxHp', amount: 10, label: 'life drain' }] }],
    }),
    toll: toll(13, '2d12'),
    multi: multi(['sickle', 'sickle'], ['toll', 'toll']),
  },
  bonusPlan: [],
});

// Variants used only by the slab-room replay.
X.maelisDornSlab = { ...M.maelisDorn, id: 'maelisDornSlab', name: 'Maelis Dorn (as run 10/2)', fleeAt: 0.8, fleeText: 'seals the door behind her and is gone' };
X.estherSlab = {
  ...M.estherRaised, id: 'estherSlab', name: 'Esther Crona, rising (as run 10/2)', leg: 0, legs: [], untouchable: true,
  plan: [{ use: 'hurl', if: (E, c) => !c.memo.threw, target: (E, c) => { c.memo.threw = true; return E.ai.pickTarget(E, c, E.action(c, 'hurl')); } }, 'void', 'hurl'],
};

api.register({
  creatures: X,
  library: [
    { group: 'Allies (DM)', ids: ['zeroOne'], ally: true },
    { group: 'The slab room, as run', ids: ['choir', 'slabSister', 'maelisDornSlab', 'estherSlab'] },
  ],
});
}
