// The item book: magic items a library character has equipped. A sheet's calculated values already hold the
// plain numbers (armour class, saves, +1 weapons), so an item appears here only for what it DOES in a fight.
// Each entry takes the feature-book context and the imported item and returns a part, as features do.
//
// Homebrew items are read from the text on the sheet. Where a text is open to more than one reading the
// cautious one is taken, and the note beside the entry says so.

import { rollDice } from '../engine/dice.js?v=mv6dxdby';
import { isEngaged, areaTargets } from '../engine/zones.js?v=mv6dxdby';
import { cast } from './spells.js?v=mv6dxdby';

const foes = (E, c) => E.enemiesOf(c).filter((t) => !t.down);
const friends = (E, c) => E.alliesOf(c).filter((a) => E.active(a));
const engagedNow = (E, c) => [...c.engaged].some((id) => E.active(E.get(id)));
const used = (c, k) => c.used[k] || 0;
const spendUse = (c, k) => { c.used[k] = used(c, k) + 1; };
const norm = (s) => String(s).toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();

// the attack line on the sheet that belongs to an item, by name, by a hint, or by the rider shown beside it
function lineFor(x, item, { hint, rider } = {}) {
  const lines = x.h.attacks.filter((a) => !a.spell);
  const n = norm(item.name);
  return lines.find((a) => norm(a.name) === n) || lines.find((a) => norm(a.name).includes(n) || n.includes(norm(a.name)))
    || (hint && lines.find((a) => hint.test(a.name))) || (rider && lines.find((a) => a.rider === rider)) || null;
}
const isLine = (ctx, line) => !!line && (ctx.act.name === line.name || ctx.act.name.startsWith(`${line.name} `) || ctx.act.name.startsWith(`${line.name}(`));
const lineType = (ctx) => ctx.act.dmg[0][1];

// extra dice on every hit with the item's own attack line
const rider = (dice, type, o = {}) => (x, item) => {
  const line = lineFor(x, item, { hint: o.hint, rider: dice });
  if (!line) return null;
  const key = `charge:${item.name}`;
  const n = o.charges ? (typeof o.charges === 'function' ? o.charges(item) : o.charges) : 0;
  return {
    hooks: {
      onHit(E, c, ctx) {
        if (!(isLine(ctx, line) || (o.hint && o.hint.test(ctx.act.name))) || ctx.act.spell || (o.only && !o.only(E, ctx.tgt)) || (o.crit && ctx.nat !== 20)) return null;
        if (n) { if (used(c, key) >= n || ctx.tgt.hp < 12) return null; spendUse(c, key); }
        const big = o.bigVs && o.bigVs(E, ctx.tgt);
        return { dmg: [[big ? o.bigDice : dice, type || lineType(ctx), o.label || item.label]], fx: o.fx ? o.fx(E, c, ctx) : [] };
      },
    },
  };
};
const undead = (E, t) => t.tpl.type === 'undead';

// a spell from a wand or staff: cast without slots, a set number of times, when it beats what the bearer does at will
const wand = (spell, { uses, at, dc, label }) => (x, item) => {
  const a = cast(spell, { dc: dc || x.h.dc || 15, toHit: x.h.spellHit || 5, mod: 0, charLevel: x.h.level, uses, at });
  if (!a || !a.book || a.book.value(at, 2) <= x.atWill * 1.1) return null;
  const id = `item_${norm(item.name).replace(/ /g, '_')}`;
  return { actions: { [id]: { ...a, name: `${a.name} (${label || item.label})` } }, plan: [id] };
};

// ---------------------------------------------------------------------------------------------
// Published items
// ---------------------------------------------------------------------------------------------
const cloakOfDisplacement = () => ({
  hooks: {
    onTurnStart(E, c) { if (E.active(c) && !E.incapacitated(c)) E.addFx(c, { id: 'displacement', name: 'Cloak of Displacement', disAgainst: true, unlessEyeless: true, endsOnDamage: true }, c); },
  },
  onStart(E, c) { E.addFx(c, { id: 'displacement', name: 'Cloak of Displacement', disAgainst: true, unlessEyeless: true, endsOnDamage: true }, c); },
});

const ringOfEvasion = (x, item) => ({
  hooks: {
    forceSave(E, c, ctx) {
      if (ctx.ability !== 'dex' || used(c, 'ringOfEvasion') >= (item.charges || 3)) return null;
      spendUse(c, 'ringOfEvasion');
      return 'Ring of Evasion: the save holds';
    },
  },
});

const sentinelShield = () => ({ flags: { initAdv: true } });

// Blood Fury Tattoo: ten charges of 4d6 necrotic that heals the bearer, and a blow struck back when hurt
const bloodFury = (x, item) => ({
  hooks: {
    onHit(E, c, ctx) {
      if (ctx.act.spell || ctx.act.weapon === false || used(c, 'bloodFury') >= (item.charges || 10) || ctx.tgt.hp < 25) return null;
      spendUse(c, 'bloodFury');
      return { dmg: [['4d6', 'necrotic', 'Blood Fury Tattoo']], fx: [{ fx: 'healSelf', amount: 'dealtNecrotic', label: 'Blood Fury Tattoo' }] };
    },
  },
  reactions: x.tpl.oa ? [{
    id: 'bloodFuryStrike', name: 'Blood Fury Tattoo (Reflexive Retaliation)', trigger: 'damaged',
    when: (E, me, ctx) => ctx.src && E.active(ctx.src) && isEngaged(me, ctx.src),
    run(E, me, ctx) { E.log('act', `${me.name} strikes back (Blood Fury Tattoo).`, me); E.attack(me, ctx.src, E.action(me, me.tpl.oa), { adv: 'Blood Fury Tattoo' }); },
  }] : [],
});

// Blackrazor: the hit points of what it kills, as temporary hit points, and advantage while they last
const blackrazor = (x, item) => {
  const line = lineFor(x, item);
  if (!line) return null;
  return {
    hooks: {
      afterHit(E, c, ctx) {
        if (!isLine(ctx, line) || E.alive(ctx.tgt) || ['undead', 'construct'].includes(ctx.tgt.tpl.type)) return;
        E.tempHp(c, ctx.tgt.maxHp, 'Blackrazor devours a soul');
        c.memo.devoured = true;
      },
      attackMods(E, c) { return c.memo.devoured && c.tempHp > 0 ? { adv: 'Blackrazor' } : null; },
    },
  };
};

const wandOfParalysis = (x, item) => {
  const fits = (E, t) => !E.has(t, 'paralysed') && !E.condImmune(t, 'paralysed') && t.hp >= 60;
  const pick = (E, c) => (E.round > 3 ? null : foes(E, c).filter((t) => fits(E, t)).sort((a, b) => b.hp - a.hp)[0] || null);
  return {
    actions: {
      wandOfParalysis: {
        kind: 'special', name: 'Wand of Paralysis', uses: Math.min(3, item.charges || 3), aiTarget: pick, when: (E, c) => friends(E, c).length > 0 && !!pick(E, c),
        run(E, c, act, choice) {
          const t = E.get((choice.targets || [])[0]) || pick(E, c);
          if (t) E.saveEffect(c, { name: 'Wand of Paralysis', save: 'con', dc: 15, dmg: null, onFail: [{ fx: 'cond', cond: 'paralysed', name: 'Wand of Paralysis', saveEnds: { ability: 'con', dc: 15 } }] }, [t]);
        },
      },
    },
    plan: ['wandOfParalysis'],
  };
};

const staffOfHealing = (x, item) => {
  const pick = (E, c) => E.alliesOf(c, true).filter((a) => !E.has(a, 'noHeal')).find((a) => a.down) || (c.hp < c.maxHp * 0.3 ? c : null);
  const flat = Math.max(0, x.mod('wis'));
  return {
    actions: {
      staffOfHealing: {
        kind: 'special', name: 'Staff of Healing (Cure Wounds)', ally: true, uses: Math.floor((item.charges || 10) / 2), aiTarget: pick, when: (E, c) => !!pick(E, c),
        run(E, c, act, choice) {
          const t = E.get((choice.targets || [])[0]) || c;
          const r = rollDice(E.rng, `2d8+${flat}`);
          E.log('act', `${c.name} uses the Staff of Healing on ${t === c ? 'themself' : t.name}: ${r.text} = ${r.total}.`, c);
          E.heal(t, r.total, c, 'Staff of Healing');
        },
      },
    },
    plan: ['staffOfHealing'],
  };
};

const tentacleRod = (x) => (9.75 * 0.65 > x.atWill ? {
  actions: { tentacleRod: { kind: 'attack', name: 'Tentacle Rod', toHit: 9, melee: true, n: 3, dmg: [['1d6', 'bludgeoning']] } },
  plan: [{ use: 'tentacleRod', if: (E, c) => engagedNow(E, c) }],
} : null);

// ---------------------------------------------------------------------------------------------
// Homebrew items, from their text on the sheets
// ---------------------------------------------------------------------------------------------
// The moonblades. Copperbane: 2d6 lightning on every hit with the staff or with a spell attack, immunity to
// lightning, and a blinding light. The text sets no limit on the light and names no saving throw; it is run
// once a fight, as a Constitution save, with a new save at the end of each turn.
const copperbane = (x, item) => {
  const line = lineFor(x, item);
  return {
    flags: { immune: [...(x.tpl.immune || []), 'lightning'] },
    hooks: {
      onHit(E, c, ctx) { return isLine(ctx, line) || (ctx.act.spell && ctx.act.toHit !== undefined) ? { dmg: [['2d6', 'lightning', 'Copperbane']] } : null; },
    },
    actions: {
      copperbaneLight: {
        kind: 'save', name: "Copperbane's blinding light", save: 'con', dc: 19, dmg: null, uses: 1, area: { type: 'all' },
        only: (E, t) => !E.condImmune(t, 'blinded') && !t.tpl.eyeless,
        onFail: [{ fx: 'cond', cond: 'blinded', name: 'Copperbane', saveEnds: { ability: 'con', dc: 19 } }],
      },
    },
    plan: [{ use: 'copperbaneLight', if: (E, c) => E.round <= 2 && foes(E, c).length >= 2 }],
  };
};

// Silverbane and Pewterthorn: the charged strike. 2d6 radiant (4d6 against fey and shapechangers); with
// Silverbane a target on 100 hit points or fewer then saves or dies. The text could be read as the death
// save riding on every hit; here it rides on the charges only.
const moonStrike = (deathSave) => (x, item) => {
  const line = lineFor(x, item, { rider: '2d6' });
  if (!line) return null;
  const n = item.charges || 2;
  const key = `charge:${item.name}`;
  return {
    hooks: {
      onHit(E, c, ctx) {
        if (!isLine(ctx, line) || used(c, key) >= n || ctx.tgt.hp < 15) return null;
        spendUse(c, key);
        const fey = ctx.tgt.tpl.type === 'fey' || (ctx.tgt.tpl.tags || []).includes('shapechanger');
        const out = { dmg: [[fey ? '4d6' : '2d6', 'radiant', item.label]], fx: [] };
        if (deathSave) {
          out.fx.push({ fx: 'call', run: (E2, src, tgt) => {
            if (!E2.alive(tgt) || tgt.hp > 100 || tgt.tpl.type === 'undead' || tgt.tpl.type === 'construct') return;
            E2.log('info', `${item.label}: ${tgt.name} is on ${tgt.hp} hit points and must save or die (DC 15 CON).`, src);
            if (!E2.save(tgt, 'con', 15, { serious: true, dis: fey }).success) E2.kill(tgt, src, item.label);
          } });
        }
        return out;
      },
    },
  };
};

// Onyxbane: one Shadow Sword attack a turn (3d6 necrotic and 3d6 poison), and 6d6 necrotic when a second
// blow lands on the same target in the darkness it leaves. Steel Wind Strike three times. "When you fail a
// saving throw, you may choose to succeed" has no limit in the text; it is run once a fight.
const onyxbane = (x, item) => {
  const sws = cast('steel wind strike', { dc: x.h.dc, toHit: x.h.spellHit || x.h.attacks[0].toHit, mod: 0, charLevel: x.h.level, uses: Math.max(1, Math.floor(x.prof / 2)), at: 5 });
  const part = {
    hooks: {
      onHit(E, c, ctx) {
        if (E.current !== c || !ctx.melee || ctx.act.spell) return null;
        if (!c.turn.shadow) { c.turn.shadow = ctx.tgt.id; return { dmg: [['3d6', 'necrotic', 'Shadow Sword'], ['3d6', 'poison', 'Shadow Sword']] }; }
        if (c.turn.shadow === ctx.tgt.id && !c.turn.shadowBurst) { c.turn.shadowBurst = true; return { dmg: [['6d6', 'necrotic', 'Onyxbane: the darkness closes']] }; }
        return null;
      },
      forceSave(E, c, ctx) {
        if (c.used.onyxbane || ctx.o.conc || !(ctx.o.serious || ctx.o.expected >= 30)) return null;
        c.used.onyxbane = 1;
        return 'Onyxbane: the save holds';
      },
    },
    actions: {}, plan: [],
  };
  if (sws && sws.book && sws.book.value(5, 3) > x.atWill) { part.actions.steelWind = { ...sws, name: 'Steel Wind Strike (Onyxbane)' }; part.plan.push({ use: 'steelWind', if: (E, c) => foes(E, c).length >= 3 }); }
  return part;
};

// Unicorn Horn: fourteen charges that never come back, so it is kept for the fallen
const unicornHorn = (x, item) => {
  const n = item.charges || 14;
  const left = (c) => n - used(c, 'horn');
  const down = (E, c) => E.alliesOf(c).filter((a) => a.down && !E.has(a, 'noHeal'));
  return {
    actions: {
      hornWord: {
        kind: 'special', name: 'Healing Word (Unicorn Horn)', cost: 'bonus', ally: true, aiTarget: (E, c) => down(E, c)[0] || null,
        when: (E, c) => left(c) > 0 && down(E, c).length === 1,
        run(E, c, act, choice) { const t = E.get((choice.targets || [])[0]); if (!t) return; spendUse(c, 'horn'); const r = rollDice(E.rng, `3d4+${x.mod('cha')}`); E.log('act', `${c.name} speaks a Healing Word through the Unicorn Horn: ${r.text} = ${r.total} on ${t.name}.`, c); E.heal(t, r.total, c, 'Unicorn Horn'); },
      },
      hornMass: {
        kind: 'special', name: 'Mass Healing Word (Unicorn Horn)', cost: 'bonus', noTarget: true,
        when: (E, c) => left(c) > 0 && down(E, c).length >= 2,
        run(E, c) { spendUse(c, 'horn'); const r = rollDice(E.rng, `3d4+${x.mod('cha')}`); E.log('act', `${c.name} speaks a Mass Healing Word through the Unicorn Horn: ${r.text} = ${r.total} each.`, c); for (const a of E.alliesOf(c, true).filter((p) => p.hp < p.maxHp && !E.has(p, 'noHeal')).slice(0, 6)) E.heal(a, r.total, c, 'Unicorn Horn'); },
      },
    },
    bonusFirst: ['hornMass', 'hornWord'],
  };
};

const ringOfCounterspells = (x, item) => ({
  reactions: [{
    id: 'ringCounter', name: 'Ring of Counterspells', trigger: 'spellCast', who: 'enemy', uses: item.charges || 4,
    when: (E, me, ctx) => ctx.level >= 3,
    run(E, me, ctx) {
      const dc = x.h.dc || 15;
      E.log('act', `${me.name}'s Ring of Counterspells answers ${ctx.caster.name}'s ${ctx.act.name} (DC ${dc} CON).`, me);
      if (!E.save(ctx.caster, 'con', dc, { spell: true, lr: false }).success) ctx.countered = true;
    },
  }],
});

// Bazooka Joe: the grenades, each a Fireball without magic. The javelin launcher is a ranged mode the sheet
// has no line for.
const bazookaJoe = (x, item) => ({
  actions: {
    grenade: { kind: 'save', name: 'Bazooka Joe (grenade)', save: 'dex', dc: 15, dmg: [['8d6', 'fire']], half: true, uses: item.charges || 3, area: { type: 'near', max: 6, spread: 0.3 } },
  },
  plan: [{ use: 'grenade', if: (E, c) => foes(E, c).length >= 3 }],
});

const armorOfTheWoods = () => ({
  actions: {
    woodsHeal: {
      kind: 'special', name: 'Armor of the Woods', cost: 'bonus', noTarget: true, uses: 1,
      when: (E, c) => c.hp < c.maxHp * 0.5,
      run(E, c) { E.log('act', `${c.name} draws on the Armor of the Woods.`, c); E.heal(c, 50, c, 'Armor of the Woods'); },
    },
  },
  bonusFirst: ['woodsHeal'],
});
const axeOfTheWoods = (x, item) => {
  const line = lineFor(x, item);
  for (const a of Object.values(x.tpl.actions)) if (line && a.kind === 'attack' && a.name === line.name) a.critMin = 19;
  return line ? {} : null;
};

const cloakOfTheVoid = () => ({
  reactions: [{
    id: 'cloakOfTheVoid', name: 'Cloak of the Void', trigger: 'preDamage',
    when: (E, me, ctx) => ctx.o.melee === false && ctx.o.act && !ctx.o.act.spell && ctx.total >= 6,
    run(E, me, ctx) { if (E.save(me, 'dex', 17, {}).success) { ctx.mult = 0; ctx.note = 'Cloak of the Void swallows the shot'; } },
  }],
});

// Eldritch Staff: up to three charges of 1d8 lightning on a hit with it, and three charges to vanish when hurt
const eldritchStaff = (x, item) => {
  const line = lineFor(x, item);
  const n = item.charges || 10;
  const left = (c) => n - used(c, 'eldritchStaff');
  return {
    hooks: {
      onHit(E, c, ctx) {
        if (!isLine(ctx, line) || left(c) < 3 || ctx.tgt.hp < 15) return null;
        c.used.eldritchStaff = used(c, 'eldritchStaff') + 3;
        return { dmg: [['3d8', 'lightning', 'Eldritch Staff']] };
      },
    },
    reactions: [{
      id: 'eldritchStaffStep', name: 'Eldritch Staff', trigger: 'damaged',
      when: (E, me) => left(me) >= 3 && me.hp < me.maxHp * 0.35 && engagedNow(E, me),
      run(E, me) {
        me.used.eldritchStaff = used(me, 'eldritchStaff') + 3;
        E.log('act', `${me.name} vanishes with the Eldritch Staff.`, me);
        E.withdraw(me, { teleport: true, label: 'is gone from melee' });
        E.addFx(me, { cond: 'invisible', name: 'Eldritch Staff', endsOnAttack: true, ends: { who: me.id, when: 'start', turns: 1 } }, me);
      },
    }],
  };
};

// Roland's Cube (Rules\ROLAND'S CUBE.pdf), Arcane Demolitions only: thrown, then set off, as one
// action. Three charges for the fight. A Half Blast spends one (5d8 + 5d6), a Full Blast two
// (5d8 + 10d6), Dexterity save for half, a 20-foot sphere. The text gives no save DC; 8 + proficiency
// + Intelligence is used. Fire is chosen for the damage. The Suicide Blast, the Reliquary spells and
// the Key are left out.
const rolandsCube = (x) => {
  const dc = 8 + x.prof + x.mod('int');
  const area = { type: 'near', max: 99, spread: 0.5, size: 6 };
  return {
    actions: {
      cubeHalf: { kind: 'save', name: "Roland's Cube: Half Blast (1 charge)", save: 'dex', dc, dmg: [['5d8', 'fire'], ['5d6', 'fire']], half: true, uses: 3, usesKey: 'cube', area },
      cubeFull: {
        kind: 'special', name: "Roland's Cube: Full Blast (2 charges)", uses: 2, usesKey: 'cube',
        run(E, c, act, choice) {
          spendUse(c, 'cube');
          const t = E.get((choice.targets || [])[0]) || E.ai.pickTarget(E, c, null);
          if (!t) return;
          E.saveEffect(c, { name: "Roland's Cube (Full Blast)", save: 'dex', dc, dmg: [['5d8', 'fire'], ['10d6', 'fire']], half: true, isArea: true }, areaTargets(E, c, t, area));
        },
      },
    },
    // the script throws it when there is a crowd to catch
    plan: [{ use: 'cubeHalf', if: (E, c) => foes(E, c).length >= 3 }],
  };
};

// ---------------------------------------------------------------------------------------------
const BOOK = {
  'flame tongue longsword': rider('2d6', 'fire', { hint: /flame tongue/i }),
  'sun blade': rider('1d8', 'radiant', { only: undead, hint: /lightsaber|sun blade/i }),
  'vicious longsword': rider('2d6', null, { crit: true }),
  'club of compliance': rider('2d6', 'lightning', { bigVs: (E, t) => t.tpl.type === 'construct', bigDice: '4d6' }),
  blackrazor,
  'cloak of displacement': cloakOfDisplacement,
  'ring of evasion': ringOfEvasion,
  'sentinel shield': sentinelShield,
  'blood fury tattoo': bloodFury,
  'wand of magic missiles': wand('magic missile', { uses: 2, at: 3 }),
  'wand of lightning bolts': wand('lightning bolt', { uses: 3, at: 4, dc: 15 }),
  'wand of winter': wand('ice storm', { uses: 1, at: 4, dc: 15 }),
  'circlet of blasting': (x, item) => wand('scorching ray', { uses: 1, at: 2 })({ ...x, h: { ...x.h, spellHit: 5 } }, item),
  'wand of paralysis': wandOfParalysis,
  'staff of healing': staffOfHealing,
  'tentacle rod': tentacleRod,
  copperbane,
  "roland's cube": rolandsCube,
  silverbane: moonStrike(true),
  pewterthorn: moonStrike(false),
  onyxbane,
  'unicorn horn': unicornHorn,
  'ring of counterspells': ringOfCounterspells,
  'bazooka joe': bazookaJoe,
  'armor of the woods': armorOfTheWoods,
  'axe of the woods': axeOfTheWoods,
  'cloak of the void': cloakOfTheVoid,
  'eldritch staff': eldritchStaff,
};

// Has an effect in a fight and is left out, with the reason.
const SKIPPED = {
  'winged boots': 'flight is not run', 'boots of levitation': 'flight is not run', 'cape of the mountebank': 'a Dimension Door once a day is not run',
  'ring of reaction': 'a second reaction each round is not run: the engine gives every creature one',
  'the darkcember spear': 'its second concentration spell is not run (the +2 is in the sheet\'s numbers)',
  'ring of shooting stars': 'it works only in dim light or darkness, which is not tracked',
  'boots of speed': 'movement is not measured',
  scroller: 'the scrolls stored in it are not listed on the sheet',
  wave: 'equipped but not attuned on the sheet',
  weathervein: 'equipped but not attuned on the sheet',
  'teeth of dahlver-nar': 'its effects are drawn at random',
  'wind fan': 'Gust of Wind is not run',
  'rod of rulership': 'charming a crowd is not run',
  'antlers of true shape': 'Animal Shapes is not run',
  'ioun stone of reserve': 'the spells stored in it are not listed on the sheet',
  'voyager staff': 'its teleporting spells do nothing the three ranks show',
  'enspelled quarterstaff': 'the spell bound into it (Calm Emotions) has no effect the simulator runs',
  'bowl of commanding water elementals': 'the summoning takes a minute', 'brazier of commanding fire elementals': 'the summoning takes a minute',
  'figurine of wondrous power (silver raven)': 'a messenger, not a fighter',
  'zanzibar ring 2': 'the sheet says only "King ring"',
  'dimensional shackles': 'binding a held creature is not run',
  'wand of web': 'Web is not in the spell book',
  'hat of vermin': 'bats, rats and frogs are not run',
  'dust of dryness': 'not a weapon as the sheet holds it',
};

// Plain bonuses the sheet has already added, and things for outside a fight.
const NUMBERS = /^(.*, \+\d|.* \+\d|shield|rod|wand|hide|plate|pistol|leather.*|studded leather.*|mithral .*|elven chain|cast-off armor.*|armblade.*|armor of .* resistance.*|mariner's .*|belt of .*|gauntlets of ogre power|amulet of health|headband of intellect|cloak of protection|cloak of resistance|ring of protection|ioun stone of mastery|wand of the war mage.*|barrier tattoo.*|arcane grimoire.*|rhythm-maker's drum.*|bloodwell vial.*|lvl 22 mastery stone|greater silver sword|helm of the woods|garden armor of the toadstool|elven longsword|longbow.*|shortbow.*|greataxe.*|rapier.*|scimitar.*|shortsword.*|crossbow.*|dart.*)$/;

export function itemParts(x) {
  const parts = []; const run = []; const numbers = []; const outside = []; const skipped = []; const unknown = [];
  const done = new Set();
  for (const item of x.h.items || []) {
    const name = item.name;
    if (done.has(name)) continue;
    done.add(name);
    item.label = name.replace(/\b[a-z]/g, (ch) => ch.toUpperCase()).replace(/ Of /g, ' of ').replace(/ The /g, ' the ');
    const entry = BOOK[name];
    if (entry) {
      const part = entry(x, item);
      if (part) { parts.push(part); run.push(name); } else outside.push(name);
    } else if (SKIPPED[name]) skipped.push(`${name} (${SKIPPED[name]})`);
    else if (NUMBERS.test(name)) numbers.push(name);
    else outside.push(name);
  }
  return { parts, run, numbers, outside, skipped, unknown };
}
