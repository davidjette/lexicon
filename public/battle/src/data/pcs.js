// The Inevitables at level 13. Numbers come from their D&D Beyond sheets of 2026-10-10. How each one fights comes from the 10/2 and 10/9 session transcripts.
// Where the two disagree the source is named in a comment and listed in README.md.

import { melee, ranged, save, emanation, hasAura, harm } from './lib.js?v=mvadc21h';
import { rollDice } from '../engine/dice.js?v=mvadc21h';
import { engage, hasRoom, enemiesInAura, areaTargets } from '../engine/zones.js?v=mvadc21h';
import { PC_EXT } from './registry.js?v=mvadc21h';
import { cast } from './spells.js?v=mvadc21h';

// Spells on a character's sheet that the spell book knows how to run. The scripts above never
// reach for them (each character's brain names what it uses); they are there for a player running
// the character, and for the builder's override menu.
function sheetSpells(tpl, names, o) {
  for (const name of names) {
    const act = cast(name, o);
    if (act) tpl.actions[`sp_${name.replace(/[^a-z0-9]+/g, '_')}`] = act;
  }
  return tpl;
}

const A = (str, dex, con, int, wis, cha) => ({ str, dex, con, int, wis, cha });
const extend = (tpl) => PC_EXT.reduce((t, f) => f(t), tpl);
const liveFoes = (E, c) => E.enemiesOf(c).filter((t) => !t.down && !t.memo.working);
const engagedFoes = (E, c) => [...c.engaged].map((id) => E.get(id)).filter((t) => t && E.present(t) && !t.down);
const downedAllies = (E, c) => E.alliesOf(c).filter((a) => a.down && !a.dead);
const frac = (t) => t.hp / Math.max(1, t.maxHp);
const isCaster = (t) => !!(t.tpl.smart || t.tpl.boss);
const bellRaised = (E, t) => ['honourDead', 'wight', 'risen'].some((k) => E.hasTag(t, k));

// Healing potions as this table runs them: a bonus action, rolled.
const potion = (name, dice, n) => ({ kind: 'heal', name, dice, self: true, cost: 'bonus', uses: n });


// ======================================================================================
// Gemma Corso  (Tiefling, Warlock 9 Archfey / Fighter 4 Battle Master)   played by Nichole
// ======================================================================================
export function makeGemma(o = {}) {
  const L = o.level || (o.level12 ? 12 : 13);
  const L12 = L === 12;
  const dc = L12 ? 17 : 18;
  const dials = { style: 'mixed', surgeFreely: false, rebukeWithSlots: true, ...(o.dials || {}) };
  const swordDmg = [['1d10+7', 'slashing'], ['1d4', 'radiant']];
  const sword = (n) => melee('Bright Dawn', L12 ? 11 : 12, swordDmg, { n });

  const tpl = {
    id: 'gemma', name: 'Gemma Corso', side: 'pc', pc: true, type: 'humanoid', pos: 'back', smart: true, warlock: true,
    img: 'gemma.webp', sub: `Tiefling Warlock ${L >= 15 ? 11 : L >= 14 ? 10 : 9} / Fighter ${L12 ? 3 : 4}`, level: L,
    ac: 19, hp: L12 ? 90 : 98 + 7 * (L - 13), init: 4,
    abil: A(10, 18, 14, 12, 14, 20), saves: { str: 1, dex: 5, con: 3, int: 2, wis: 8, cha: 11 },
    resist: ['fire'], concBreaker: !L12, condImmune: L >= 14 ? ['charmed'] : [],
    pact: { n: L >= 15 ? 3 : 2, level: 5 },
    dials,
    dialInfo: {
      style: ['mixed', 'ranged', 'melee'],
      surgeFreely: 'Action Surge whenever she is in melee, not only to finish a caster',
      rebukeWithSlots: 'Hellish Rebuke with a pact slot once the free one is gone (keeps one slot back)',
    },
    actions: {
      eb: ranged('Eldritch Blast', L12 ? 9 : 10, [['1d10+5', 'force']], { n: 3, warlock: true, spell: true, weapon: false }),
      fireBolt: ranged('Fire Bolt', L12 ? 9 : 10, [['3d10', 'fire']], { spell: true, weapon: false }),
      sword: { ...sword(2), warlock: true },
      swordPlain: { ...sword(1), hidden: true },
      surge: {
        kind: 'special', name: 'Action Surge', cost: 'free', uses: 1, noTarget: true,
        run(E, c) { c.turn.action = true; c.turn.surged = true; E.log('act', `${c.name} uses Action Surge.`, c); },
      },
      misty: {
        kind: 'special', name: 'Misty Step (Steps of the Fey)', cost: 'bonus', uses: 5, warlock: true, spell: true,
        run(E, c, act, choice) {
          const mode = choice.mode || 'away';
          const rider = choice.rider || 'vanish';
          const t = E.get((choice.targets || [])[0]);
          const left = engagedFoes(E, c);
          if (mode === 'away') E.withdraw(c, { teleport: true, label: 'misty steps out of melee' });
          else if (mode === 'in' && t && E.present(t) && hasRoom(E, t)) {
            E.withdraw(c, { teleport: true, label: 'misty steps' });
            engage(c, t);
            E.log('move', `${c.name} misty steps in beside ${t.name}.`, c);
          } else E.log('move', `${c.name} misty steps.`, c);
          E.removeFx(c, (f) => f.cond === 'grappled' || f.cond === 'restrained');
          if (rider === 'refresh') {
            const ally = t && t.side === c.side ? t : c;
            const r = rollDice(E.rng, '1d10');
            E.log('act', `Refreshing Step: ${r.text} temporary HP for ${ally.name}.`, c);
            E.tempHp(ally, r.total, 'Refreshing Step');
          } else if (rider === 'dread') {
            const hit = mode === 'in' && t ? [t] : left;
            if (hit.length) E.saveEffect(c, { name: 'Dreadful Step', save: 'wis', dc, dmg: [['2d10', 'psychic']], spell: true }, hit);
          } else {
            E.addFx(c, { cond: 'invisible', name: 'Disappearing Step', endsOnAttack: true, ends: { who: c.id, when: 'start', turns: 1 } }, c);
          }
        },
      },
      secondWind: { kind: 'heal', name: 'Second Wind', dice: '1d10+4', self: true, cost: 'bonus', uses: 3 },
      potionSuperior: potion('Potion of Healing (Superior)', '8d4+8', 2),
      potionGreater: potion('Potion of Healing (Greater)', '4d4+4', 2),
    },
    reactions: [
      {
        // Lucky: spend a point to make an attacker reroll. Kept for critical hits.
        id: 'luckDefend', name: 'Lucky', trigger: 'attacked', free: true,
        when: (E, me, ctx) => ctx.crit && (me.used.luck || 0) < 5,
        run(E, me, ctx) { me.used.luck = (me.used.luck || 0) + 1; ctx.reroll = 'Lucky'; },
      },
      ...(L >= 14 ? [{
        // Beguiling Defenses (Warlock 10): halve a hit, and the attacker saves or takes what she takes. Once a long rest.
        id: 'beguiling', name: 'Beguiling Defenses', trigger: 'preDamage', uses: 1,
        when: (E, me, ctx) => ctx.total >= 22 && !E.has(me, 'pactVoid') && ctx.src && E.active(ctx.src),
        run(E, me, ctx) {
          ctx.mult = 0.5;
          ctx.note = 'Beguiling Defenses halves it';
          const taken = Math.floor(ctx.total / 2);
          E.log('act', `${me.name} uses Beguiling Defenses on ${ctx.src.name} (DC ${dc} WIS).`, me);
          const r = E.save(ctx.src, 'wis', dc, { serious: true, expected: taken });
          if (!r.success) E.damage(ctx.src, [{ amt: taken, type: 'psychic' }], me, { rollText: `${taken} psychic` });
        },
      }] : []),
      {
        id: 'parry', name: 'Parry', trigger: 'preDamage',
        when: (E, me, ctx) => ctx.o.melee && ctx.total >= 16 && (me.used.sup || 0) < 4,
        run(E, me, ctx) {
          me.used.sup = (me.used.sup || 0) + 1;
          if (E.rules.parryHalves) { ctx.mult = 0.5; ctx.note = 'Parry halves it'; }
          else {
            const r = rollDice(E.rng, '1d8+4');
            ctx.mult = Math.max(0, ctx.total - r.total) / ctx.total;
            ctx.note = `Parry -${r.total}`;
          }
          E.log('info', `${me.name} parries (superiority die).`, me);
        },
      },
      {
        id: 'riposte', name: 'Riposte', trigger: 'missed',
        when: (E, me, ctx) => ctx.melee && (me.used.sup || 0) < 3 && !E.has(me, 'pactVoid') && E.active(ctx.att),
        run(E, me, ctx) {
          me.used.sup = (me.used.sup || 0) + 1;
          E.log('act', `${me.name} ripostes.`, me);
          me.turn.riposte = true;
          E.attack(me, ctx.att, E.action(me, 'swordPlain'), {});
          me.turn.riposte = false;
        },
      },
      {
        id: 'mistyEscape', name: 'Misty Escape', trigger: 'damaged', warlock: true, spell: true,
        when: (E, me) => me.hp < me.maxHp * 0.35 && engagedFoes(E, me).length > 0 && (me.used.misty || 0) < 5,
        run(E, me) {
          me.used.misty = (me.used.misty || 0) + 1;
          E.log('act', `${me.name} uses Misty Escape.`, me);
          E.withdraw(me, { teleport: true, label: 'vanishes out of melee' });
          E.addFx(me, { cond: 'invisible', name: 'Disappearing Step', endsOnAttack: true, ends: { who: me.id, when: 'start', turns: 1 } }, me);
        },
      },
      {
        id: 'rebuke', name: 'Hellish Rebuke', trigger: 'damaged', spell: true,
        when: (E, me, ctx) => E.active(ctx.src) && ctx.src.side !== me.side && (!me.used.rebukeFree || (me.tpl.dials.rebukeWithSlots && me.pact.n > 1 && !E.has(me, 'pactVoid'))),
        run(E, me, ctx) {
          let dice = '2d10';
          if (!me.used.rebukeFree) me.used.rebukeFree = 1;
          else { me.pact.n -= 1; dice = '6d10'; }
          E.saveEffect(me, { name: `Hellish Rebuke${dice === '6d10' ? ' (5th-level pact slot)' : ''}`, save: 'dex', dc, dmg: [[dice, 'fire']], half: true, spell: true }, [ctx.src]);
        },
      },
    ],
    hooks: {
      rerollSave(E, c, ctx) {
        if ((c.used.luck || 0) >= 5) return null;
        if (!ctx.o.serious && !(ctx.o.expected >= 20) && !ctx.o.conc) return null;
        c.used.luck = (c.used.luck || 0) + 1;
        return `Lucky (${5 - c.used.luck} left)`;
      },
      forceSave(E, c, ctx) {
        if (L12 || c.used.guardedMind || !['int', 'wis', 'cha'].includes(ctx.ability)) return null;
        if (!ctx.o.serious && !(ctx.o.expected >= 25)) return null;
        c.used.guardedMind = 1;
        return 'Guarded Mind: succeeds instead';
      },
      onHit(E, c, ctx) {
        const out = { dmg: [], fx: [] };
        const name = ctx.act.name;
        if (name === 'Eldritch Blast') {
          const t = ctx.tgt;
          const cliff = E.flags.cliffChance && !t.tpl.boss && t.tpl.size !== 'huge';
          const peel = [...t.engaged].some((id) => { const a = E.get(id); return a && a.side === c.side && (a === c || frac(a) < 0.4 || a.down); });
          if (cliff || peel) {
            out.fx.push({ fx: 'call', run: (E2, src, tgt) => {
              if (!E2.alive(tgt)) return;
              if (cliff && E2.rng.chance(E2.flags.cliffChance)) {
                E2.log('move', `Repelling Blast drives ${tgt.name} over the edge.`, src);
                E2.kill(tgt, src, 'the fall');
              } else if (peel) E2.push(src, tgt, 'Repelling Blast');
            } });
          }
          return out;
        }
        if (name !== 'Bright Dawn') return null;
        const voided = E.has(c, 'pactVoid');
        if (!voided && !c.turn.lifedrinker && E.current === c) {
          c.turn.lifedrinker = true;
          // her choice of necrotic, psychic or radiant: whichever the target resists least
          const type = ['radiant', 'psychic', 'necrotic'].sort((a, b) => E.resistMult(ctx.tgt, b) - E.resistMult(ctx.tgt, a))[0];
          out.dmg.push(['1d6', type, 'Lifedrinker']);
          // and she may spend a Hit Point Die to heal: 9d8 from warlock levels, then 4d10 from fighter
          const spentDice = c.used.hitDice || 0;
          if (frac(c) < 0.6 && spentDice < L) {
            c.used.hitDice = spentDice + 1;
            const r = rollDice(E.rng, spentDice < 9 ? '1d8+2' : '1d10+2');
            E.log('act', `${c.name} spends a Hit Point Die on Lifedrinker: ${r.text} = ${r.total}.`, c);
            E.heal(c, r.total, c, 'Lifedrinker');
          }
        }
        if (c.turn.riposte) out.dmg.push(['1d8', 'slashing', 'Riposte']);
        else if (E.current === c && !c.turn.tripped && (c.used.sup || 0) < 4 && !E.has(ctx.tgt, 'prone') && !['huge', 'gargantuan'].includes(ctx.tgt.tpl.size) && !E.condImmune(ctx.tgt, 'prone')) {
          c.turn.tripped = true;
          c.used.sup = (c.used.sup || 0) + 1;
          out.dmg.push(['1d8', 'slashing', 'Trip Attack']);
          out.fx.push({ fx: 'save', ability: 'str', dc: L12 ? 16 : 17, onFail: [{ fx: 'prone' }], serious: true });
        }
        // Sap: disadvantage on the target's next attack before her next turn
        out.fx.push({ fx: 'effect', effect: { id: 'sap', name: 'Sap', disAtk: true, oneAttack: true }, dur: { who: 'src', when: 'start', turns: 1 } });
        return out;
      },
    },
    brain(E, c) {
      const d = c.tpl.dials;
      const voided = E.has(c, 'pactVoid');
      const foes = liveFoes(E, c);
      if (!foes.length) return null;
      const mine = engagedFoes(E, c);
      const canStep = E.usable(c, 'misty', { cost: 'bonus' });
      if (c.turn.mode === undefined) {
        const finish = foes.filter((t) => isCaster(t) && frac(t) <= 0.5 && E.canReach(c, t) || (t.conc && E.canReach(c, t)));
        let mode = 'ranged';
        if (d.style === 'melee') mode = 'melee';
        else if (voided && mine.length) mode = 'melee';
        else if (mine.length && !canStep) mode = 'melee';
        else if (d.style === 'mixed' && (finish.length || E.flags.closeQuarters || (mine.length && E.rng.chance(0.5)))) mode = 'melee';
        c.turn.mode = mode;
        if (mode === 'melee') {
          const pool = finish.length ? finish : mine.length ? mine : foes.filter((t) => E.canReach(c, t));
          c.turn.tgt = pool.length ? E.rng.weighted(pool, (t) => (t.conc ? 3 : 1) * (2 - frac(t))).id : null;
          if (!c.turn.tgt) c.turn.mode = 'ranged';
        }
      }
      const mode = c.turn.mode;
      const lowAlly = E.alliesOf(c, true).filter((a) => !a.down && frac(a) < 0.5 && a.tempHp === 0).sort((a, b) => frac(a) - frac(b))[0];

      if (c.turn.bonus) {
        if (frac(c) < 0.3) {
          for (const id of ['potionSuperior', 'potionGreater']) if (E.usable(c, id)) return { act: id };
        }
        if (canStep) {
          if (mode === 'ranged' && mine.length) return { act: 'misty', mode: 'away', rider: lowAlly ? 'refresh' : 'vanish', targets: lowAlly ? [lowAlly.id] : [] };
          const t = E.get(c.turn.tgt);
          if (mode === 'melee' && t && E.present(t) && !c.engaged.has(t.id) && (c.used.misty || 0) < 4) return { act: 'misty', mode: 'in', rider: 'dread', targets: [t.id] };
          if (mode === 'ranged' && lowAlly && (c.used.misty || 0) < 3) return { act: 'misty', mode: 'stay', rider: 'refresh', targets: [lowAlly.id] };
        }
        // she forgets Second Wind as often as not
        if (frac(c) < 0.4 && E.usable(c, 'secondWind') && E.rng.chance(0.5)) return { act: 'secondWind' };
      }
      if (c.turn.action) {
        if (mode === 'melee') {
          let t = E.get(c.turn.tgt);
          if (!t || !E.present(t) || t.down || !E.canReach(c, t)) t = E.ai.pickTarget(E, c, E.action(c, 'swordPlain'));
          if (t) { c.turn.tgt = t.id; return { act: voided ? 'swordPlain' : 'sword', targets: [t.id] }; }
        }
        const act = voided ? 'fireBolt' : 'eb';
        if (E.usable(c, act)) {
          const t = E.ai.pickTarget(E, c, E.action(c, act), { weight: (x) => (x.conc ? 3 : 1) * (c.engaged.has(x.id) ? 2 : 1) });
          if (t) return { act, targets: [t.id] };
        }
        const t = E.ai.pickTarget(E, c, E.action(c, 'swordPlain'));
        if (t) return { act: 'swordPlain', targets: [t.id] };
      }
      // Action Surge: reluctant, and only to finish a wounded caster
      if (mode === 'melee' && !c.turn.surged && E.usable(c, 'surge')) {
        const t = E.get(c.turn.tgt);
        if (t && E.present(t) && !t.down && (d.surgeFreely || (isCaster(t) && frac(t) <= 0.35))) return { act: 'surge' };
      }
      return null;
    },
    basic: 'swordPlain', basicN: 2, oa: 'swordPlain',
  };
  // sheet, SPELLS tab (5TH filter view): the ones the book runs
  sheetSpells(tpl, ['dimension door', 'greater invisibility'], { dc, toHit: dc - 8, mod: 5, charLevel: L });
  return extend(tpl);
}

// ======================================================================================
// Chancellor Eric  (Human, Cleric 13, Light Domain)   played by Jeff
// ======================================================================================
export function makeEric(o = {}) {
  const L = o.level || (o.level12 ? 12 : 13);
  const L12 = L === 12;
  const dc = L12 ? 17 : 18;
  // The sheet gives spell attack +11 and the dagger +8 with Dexterity. At the table True Strike
  // is called at +12 ("six plus twelve, eighteen to hit", 10/9), so +12 is used here.
  const tsHit = L12 ? 11 : 12;
  const tsDmg = [['1d4+5', 'piercing'], ['2d6', 'radiant'], ['1d6', 'acid']];
  const dials = { guardiansLevel: 5, useTopSlot: false, flareFreely: false, ...(o.dials || {}) };

  const tpl = {
    id: 'eric', name: 'Chancellor Eric', side: 'pc', pc: true, type: 'humanoid', pos: 'mid', smart: true,
    img: 'eric.webp', sub: `Human Cleric ${L}, Light Domain`, level: L,
    ac: 20, hp: L12 ? 111 : 120 + 9 * (L - 13), init: 3,
    abil: A(7, 16, 18, 11, 20, 9), saves: { str: -2, dex: 3, con: 4, int: 0, wis: 10, cha: 4 },
    resist: ['poison', 'psychic'], concAdv: true,
    slots: L12 ? { 1: 4, 2: 3, 3: 3, 4: 3, 5: 2, 6: 1 } : L >= 15 ? { 1: 4, 2: 3, 3: 3, 4: 3, 5: 2, 6: 1, 7: 1, 8: 1 } : { 1: 4, 2: 3, 3: 3, 4: 3, 5: 2, 6: 1, 7: 1 },
    dials,
    dialInfo: {
      guardiansLevel: [3, 4, 5, 6, 7],
      useTopSlot: 'Spend the 7th-level slot (Harm or Spirit Guardians upcast) instead of holding it',
      flareFreely: 'Warding Flare on any hit, not only crits, boss attacks and wounded allies',
    },
    actions: {
      guardians: emanation('Spirit Guardians', {
        dc, slot: 3, dmg: (lvl) => [[`${lvl}d8`, 'radiant']], on: ['enemyEnd', 'casterTurn'],
      }),
      trueStrike: melee('True Strike (Dragontooth Dagger)', tsHit, tsDmg),
      trueStrikeThrown: ranged('True Strike (thrown dagger)', tsHit, tsDmg, { hidden: true }),
      harm: harm(dc, { slot: 6 }),
      radiance: save('Radiance of the Dawn', 'con', dc, [[`2d10+${L}`, 'radiant']], { half: true, uses: 3, area: { type: 'all' } }),
      fireball: {
        kind: 'special', name: 'Fireball', slot: 3, spell: true,
        aiTarget: () => null,
        run(E, c, act, choice) {
          const t = E.get(choice.targets[0]);
          if (!t) return;
          const lvl = choice.level || 3;
          E.saveEffect(c, { name: `Fireball (level ${lvl})`, save: 'dex', dc, dmg: [[`${5 + lvl}d6`, 'fire']], half: true, spell: true, isArea: true }, areaTargets(E, c, t, { max: 6, spread: 0.2, size: 6 }));
        },
      },
      bless: { kind: 'buff', name: 'Bless', slot: 1, spell: true, conc: true, effect: { id: 'bless', name: 'Bless', atkDice: '1d4', saveDice: '1d4' } },
      massHealingWord: {
        kind: 'special', name: 'Mass Healing Word', cost: 'bonus', slot: 3, spell: true, noTarget: true,
        run(E, c, act, choice) {
          const lvl = choice.level || 3;
          const r = rollDice(E.rng, `${lvl - 1}d4+5`);
          E.log('act', `${c.name} casts Mass Healing Word (level ${lvl}): ${r.text} = ${r.total} each.`, c);
          for (const a of E.alliesOf(c, true).filter((x) => x.hp < x.maxHp).sort((a, b) => a.hp - b.hp).slice(0, 6)) E.heal(a, r.total, c, 'Mass Healing Word');
        },
      },
      healingWord: {
        kind: 'special', name: 'Healing Word', cost: 'bonus', slot: 1, spell: true, ally: true,
        run(E, c, act, choice) {
          const t = E.get(choice.targets[0]);
          if (!t) return;
          const lvl = choice.level || 1;
          const r = rollDice(E.rng, `${2 * lvl}d4+5`);
          E.log('act', `${c.name} casts Healing Word (level ${lvl}) on ${t.name}: ${r.text} = ${r.total}.`, c);
          E.heal(t, r.total, c, 'Healing Word');
        },
      },
      misty: {
        kind: 'special', name: 'Misty Step (Mark of Passage)', cost: 'bonus', slot: 2, freeKey: 'mistyFree', spell: true, noTarget: true,
        run(E, c) {
          E.log('act', `${c.name} misty steps free.`, c);
          E.removeFx(c, (f) => f.cond === 'grappled' || f.cond === 'restrained');
        },
      },
      potion: potion('Potion of Healing (Superior)', '8d4+8', 3),
    },
    reactions: [
      {
        id: 'shield', name: 'Shield', trigger: 'attacked', spell: true,
        when: (E, me, ctx) => !ctx.crit && ctx.total < E.acOf(me) + 5 && (!me.used.shieldFree || (me.slots[1] > 0 && me.hp < me.maxHp * 0.6)),
        run(E, me, ctx) {
          if (!me.used.shieldFree) me.used.shieldFree = 1;
          else me.slots[1] -= 1;
          ctx.acBonus += 5;
          E.addFx(me, { id: 'shield', name: 'Shield', ac: 5, ends: { who: me.id, when: 'start', turns: 1 } }, me);
          ctx.acBonus -= 5; // the effect above already raises his AC for this attack
          E.log('info', `${me.name} casts Shield: +5 AC until his next turn.`, me);
        },
      },
      {
        // Warding Flare, with the Improved Warding Flare temporary hit points. He hoards these.
        id: 'flare', name: 'Warding Flare', trigger: 'attacked', who: 'allyOrSelf', uses: 5,
        when: (E, me, ctx) => me.tpl.dials.flareFreely || ctx.crit || ctx.att.tpl.boss || frac(ctx.tgt) < 0.5,
        run(E, me, ctx) {
          ctx.reroll = 'Warding Flare';
          const r = rollDice(E.rng, '2d6+5');
          E.log('info', `${me.name} uses Warding Flare on ${ctx.att.name}'s attack (${5 - me.used.flare} left).`, me);
          E.tempHp(ctx.tgt, r.total, 'Improved Warding Flare');
        },
      },
    ],
    hooks: {
      opportunity: () => 'trueStrike',
      onHit(E, c, ctx) {
        // Divine Strike: once on each of his own turns
        if (E.current !== c || c.turn.divineStrike || !ctx.act.name.startsWith('True Strike')) return null;
        c.turn.divineStrike = true;
        return { dmg: [[L >= 14 ? '2d8' : '1d8', 'radiant', 'Divine Strike']] };
      },
    },
    brain(E, c) {
      const d = c.tpl.dials;
      const foes = liveFoes(E, c);
      const down = downedAllies(E, c);
      if (c.turn.bonus) {
        if (down.length >= 2 && E.usable(c, 'massHealingWord')) return { act: 'massHealingWord' };
        if (down.length === 1) {
          if (E.usable(c, 'healingWord')) return { act: 'healingWord', targets: [down[0].id] };
          if (E.usable(c, 'massHealingWord')) return { act: 'massHealingWord' };
        }
        if ((E.has(c, 'grappled') || E.has(c, 'restrained')) && E.usable(c, 'misty')) return { act: 'misty' };
        if (frac(c) < 0.25 && E.usable(c, 'potion')) return { act: 'potion' };
      }
      if (!c.turn.action) return null;
      if (!foes.length) return null;
      const boss = foes.filter((t) => t.tpl.boss).sort((a, b2) => b2.hp - a.hp)[0];
      // Old reliable: Spirit Guardians, then start True Striking.
      if (!hasAura(E, c, 'Spirit Guardians') && E.usable(c, 'guardians')) {
        const inAura = enemiesInAura(E, c).length;
        const near = foes.filter((t) => E.canReach(c, t));
        if (inAura || near.length) {
          const closeTo = inAura ? null : E.rng.weighted(near, (t) => 1 + t.engaged.size);
          return { act: 'guardians', level: d.useTopSlot ? (L >= 15 ? 8 : 7) : d.guardiansLevel, engage: closeTo ? closeTo.id : null };
        }
      }
      if (E.usable(c, 'radiance') && foes.length >= 3) return { act: 'radiance' };
      if (boss && boss.hp > 60 && E.usable(c, 'harm') && (c.slots[6] > 0 || (d.useTopSlot && (c.slots[7] > 0 || c.slots[8] > 0)))) return { act: 'harm', level: 6, targets: [boss.id] };
      // A fleeing or standing-off cluster with no friend in it: upcast Fireball
      if (E.usable(c, 'fireball')) {
        const loose = foes.filter((t) => ![...t.engaged].some((id) => E.get(id) && E.get(id).side === c.side));
        if (loose.length >= 3) return { act: 'fireball', level: 5, targets: [loose[0].id] };
      }
      const t = E.ai.pickTarget(E, c, E.action(c, 'trueStrike'), { weight: (x) => (x.tpl.boss && E.flags.focusBoss ? 2 : 1) });
      if (t) return { act: 'trueStrike', targets: [t.id] };
      const r = E.ai.pickTarget(E, c, E.action(c, 'trueStrikeThrown'));
      if (r) return { act: 'trueStrikeThrown', targets: [r.id] };
      return null;
    },
    basic: 'trueStrike', oa: 'trueStrike',
  };
  // sheet, SPELLS tab 6c and 6d: the ones the book runs
  sheetSpells(tpl, ['fire bolt', 'guiding bolt', 'burning hands', 'scorching ray', 'cure wounds'], { dc, toHit: dc - 7, mod: 5, charLevel: L });
  return extend(tpl);
}

// ======================================================================================
// Sir Dario Argentino  (Dragonborn, Paladin 13, Oath of Devotion)   played by Dave
// ======================================================================================
export function makeDario(o = {}) {
  const L = o.level || (o.level12 ? 12 : 13);
  const L12 = L === 12;
  const dc = L12 ? 15 : 17;
  const aura = L12 ? 3 : 4;
  const dials = { weapon: 'palefire', smite: 'finish+boss', hasteRound: 2, cloak: false, grip: 'shield', auraOfLife: false, lostEye: false, ...(o.dials || {}) };
  const die = dials.grip === 'two-handed' ? '1d10' : '1d8';
  const weapon = () => (dials.weapon === 'knell'
    ? { name: 'Knell', toHit: L12 ? 11 : 12, dmg: [[`${die}+7`, 'bludgeoning'], ['1d8', 'radiant']], vs: [{ when: bellRaised, dice: '2d6', type: 'force', label: 'bell-raised' }] }
    : { name: 'Palefire', toHit: L12 ? 9 : 10, dmg: [[`${die}+5`, 'slashing'], ['2d6', 'fire'], ['1d4', 'cold'], ['1d8', 'radiant']] });
  const w = weapon();
  const strike = (n) => melee(w.name, w.toHit, w.dmg, { n, vs: w.vs });
  const smiteAvg = (lvl) => (1 + lvl) * 4.5;

  const tpl = {
    id: 'dario', name: 'Sir Dario Argentino', side: 'pc', pc: true, type: 'humanoid', pos: 'front', smart: true,
    img: 'dario.webp', sub: `Dragonborn Paladin ${L}, Oath of Devotion`, level: L,
    ac: dials.grip === 'two-handed' ? 18 : 20, hp: L12 ? 88 : 95 + 7 * (L - 13), init: 0, initAdv: true,
    abil: A(20, 10, 13, 8, 10, 18),
    // the sheet's save numbers already include his own Aura of Protection
    saves: L12 ? { str: 8, dex: 3, con: 4, int: 2, wis: 7, cha: 11 } : { str: 9, dex: 4, con: 5, int: 3, wis: 9, cha: 13 },
    resist: ['cold'], condImmune: ['charmed', 'frightened'], auraSave: aura, auraCourage: true,
    slots: { 1: 4, 2: 3, 3: 3, 4: L >= 15 ? 2 : 1 },
    dials,
    dialInfo: {
      weapon: ['palefire', 'knell'],
      grip: ['shield', 'two-handed'],
      smite: ['finish', 'finish+boss', 'always'],
      hasteRound: [0, 1, 2, 3, 4],
      cloak: 'Cloak of Displacement, if he attunes to it (attackers have disadvantage until he is hit)',
      auraOfLife: 'Starts the fight concentrating on Aura of Life instead of using Haste',
      lostEye: 'The lost eye: his targets count as having light cover (+2 AC)',
    },
    actions: {
      strike: strike(2),
      strike1: { ...strike(1), name: `${w.name} (Haste)`, cost: 'free', hidden: true, takes: 'hasteAction' },
      // the player's smite: readied before the swing, spent (slot and bonus action) when a melee hit lands
      ...Object.fromEntries([1, 2, 3, 4, 'blind'].map((lvl) => [`smite_${lvl}`, {
        kind: 'special', cost: 'free', noTarget: true,
        name: lvl === 'blind' ? 'Blinding Smite on the next hit (3rd-level slot)' : `Divine Smite on the next hit (level ${lvl})`,
        offer: (E, c) => c.turn.bonus && !c.turn.slotSpell && !c.turn.smiteArmed
          && (lvl === 'blind' ? c.slots[3] > 0 : c.slots[lvl] > 0 || (lvl === 1 && !c.used.smiteFree)),
        run(E, c) {
          c.turn.smiteArmed = lvl;
          E.log('info', `${c.name} readies ${lvl === 'blind' ? 'Blinding Smite' : `Divine Smite (level ${lvl})`} for his next hit.`, c);
        },
      }])),
      sacred: {
        kind: 'special', name: 'Sacred Weapon', cost: 'free', uses: 3, noTarget: true,
        run(E, c) {
          E.addFx(c, { id: 'sacred', name: 'Sacred Weapon', atk: aura }, c);
          E.log('act', `${c.name} imbues ${w.name}: Sacred Weapon, +${aura} to hit.`, c);
        },
      },
      haste: {
        kind: 'special', name: 'Haste (Ioun stone)', uses: 1, noTarget: true, conc: true, selfManaged: true,
        run(E, c) {
          E.log('act', `${c.name} activates the Ioun stone: Haste (a Magic action).`, c);
          E.concentrate(c, 'Haste');
          E.addFx(c, {
            id: 'haste', name: 'Haste', ac: 2, advSave: ['dex'], conc: c.id,
            onEnd: (E2, who) => {
              if (!E2.alive(who) || who.down) return;
              E2.log('cond', `${who.name} is lethargic as Haste ends.`, who);
              E2.addFx(who, { cond: 'incapacitated', name: 'Haste ends', ends: { who: who.id, when: 'end', turns: E2.current === who ? 2 : 1 } }, null);
            },
          }, c);
          c.turn.hasteAction = true;
        },
      },
      flight: {
        kind: 'special', name: 'Draconic Flight', cost: 'bonus', uses: 1, noTarget: true,
        run(E, c) {
          E.addFx(c, { id: 'flight', name: 'Draconic Flight', flying: true }, c);
          E.log('act', `${c.name} spreads his wings: Draconic Flight.`, c);
        },
      },
      layOnHands: {
        kind: 'special', name: 'Lay on Hands', cost: 'bonus', ally: true,
        when: (E, c) => (c.memo.loh ?? 5 * L) > 0,
        run(E, c, act, choice) {
          const t = E.get(choice.targets[0]) || c;
          const pool = c.memo.loh ?? 5 * L;
          const want = t.down ? 20 : Math.min(40, t.maxHp - t.hp);
          const amt = Math.min(pool, want);
          c.memo.loh = pool - amt;
          E.log('act', `${c.name} lays on hands: ${amt} HP to ${t.name} (${c.memo.loh} left in the pool).`, c);
          E.heal(t, amt, c, 'Lay on Hands');
        },
      },
    },
    reactions: [{
      id: 'shield', name: 'Shield', trigger: 'attacked', uses: 1, spell: true,
      when: (E, me, ctx) => !ctx.crit && ctx.total < E.acOf(me) + 5,
      run(E, me) {
        E.addFx(me, { id: 'shield', name: 'Shield', ac: 5, ends: { who: me.id, when: 'start', turns: 1 } }, me);
        E.log('info', `${me.name} casts Shield: +5 AC until his next turn.`, me);
      },
    }],
    hooks: {
      onFightStart(E, c) {
        if (!c.tpl.dials.auraOfLife || c.slots[4] < 1) return;
        c.slots[4] -= 1;
        E.concentrate(c, 'Aura of Life');
        for (const a of E.alliesOf(c, true)) E.addFx(a, { id: 'auraOfLife', name: 'Aura of Life', resist: ['necrotic'], noMaxHpLoss: true, conc: c.id }, c);
        E.log('info', `${c.name} is concentrating on Aura of Life: allies resist necrotic damage and their hit point maximums cannot be reduced.`, c);
      },
      onTurnStart(E, c) {
        if (c.tpl.dials.cloak && !c.down) c.fx = c.fx.filter((f) => f.id !== 'displacement').concat([{ id: 'displacement', name: 'Cloak of Displacement', disAgainst: true, unlessEyeless: true, endsOnDamage: true, srcId: c.id }]);
        if (E.fxOf(c, 'haste')) c.turn.hasteAction = true;
      },
      attackMods(E, c) {
        return c.tpl.dials.lostEye ? { bonus: -2 } : null;
      },
      // Divine Smite is a bonus action taken on the hit, and counts as the turn's slotted spell.
      onHit(E, c, ctx) {
        if (E.current !== c || !c.turn.bonus || c.turn.slotSpell || !ctx.melee) return null;
        const t = ctx.tgt;
        const mode = c.tpl.dials.smite;
        const weaponAvg = (dials.weapon === 'knell' ? 17 : 24.5) - (dials.grip === 'two-handed' ? 0 : 1);
        const top = [4, 3, 2, 1].find((l) => c.slots[l] > 0);
        const free = !c.used.smiteFree;
        if (!top && !free) return null;
        let level = 0;
        // a player says before the blow whether the next hit is a smite, and at what level
        const mine = !!(E.playerRuns && E.playerRuns(c));
        const armed = c.turn.smiteArmed;
        if (mine) {
          if (!armed) return null;
          c.turn.smiteArmed = null;
          if (armed !== 'blind' && (c.slots[armed] > 0 || (armed === 1 && free))) level = armed;
        } else if (ctx.crit) level = top || 1;
        else if (t.hp > weaponAvg && t.hp <= weaponAvg + smiteAvg(top || 1)) {
          level = [1, 2, 3, 4].find((l) => (c.slots[l] > 0 || (l === 1 && free)) && weaponAvg + smiteAvg(l) >= t.hp) || 0;
        } else if (mode === 'always' || (mode === 'finish+boss' && t.tpl.boss && t.hp > weaponAvg)) {
          level = [2, 1, 3, 4].find((l) => c.slots[l] > 0) || (free ? 1 : 0);
        }
        const blind = mine ? armed === 'blind' && c.slots[3] > 0 : level >= 2 && t.tpl.boss && !c.memo.blinding && c.slots[3] > 0 && !ctx.crit && !E.has(t, 'blinded') && !t.tpl.eyeless;
        if (!level && !blind) return null;
        // Blinding Smite once on a boss that can be blinded
        if (blind) {
          c.memo.blinding = true;
          c.slots[3] -= 1;
          c.turn.bonus = false;
          c.turn.slotSpell = true;
          return {
            dmg: [['3d8', 'radiant', 'Blinding Smite']],
            fx: [{ fx: 'save', ability: 'con', dc, serious: true, onFail: [{ fx: 'cond', cond: 'blinded', name: 'Blinding Smite', saveEnds: { ability: 'con', dc } }] }],
          };
        }
        if (level === 1 && free) c.used.smiteFree = 1;
        else c.slots[level] -= 1;
        c.turn.bonus = false;
        c.turn.slotSpell = true;
        const undead = t.tpl.type === 'undead' || E.hasTag(t, 'undead');
        return { dmg: [[`${1 + level + (undead ? 1 : 0)}d8`, 'radiant', `Divine Smite (level ${level})`]] };
      },
    },
    brain(E, c) {
      const d = c.tpl.dials;
      const foes = liveFoes(E, c);
      if (c.turn.bonus && E.usable(c, 'layOnHands')) {
        const down = downedAllies(E, c)[0];
        if (down && !E.immobile(c)) return { act: 'layOnHands', targets: [down.id] };
        if (frac(c) < 0.35) return { act: 'layOnHands', targets: [c.id] };
      }
      if (!foes.length) return null;
      // an enemy in the air that nobody on the ground can reach: he takes wing
      if (c.turn.bonus && !E.flies(c) && E.usable(c, 'flight') && foes.some((t) => E.flies(t) && !E.has(t, 'grounded'))) return { act: 'flight' };
      if (c.turn.action) {
        if (d.hasteRound && E.round >= d.hasteRound && !c.conc && E.usable(c, 'haste')) return { act: 'haste' };
        const t = E.ai.pickTarget(E, c, E.action(c, 'strike'), { weight: (x) => (x.tpl.boss && E.flags.focusBoss ? 2 : 1) });
        if (t) {
          if (!E.fxOf(c, 'sacred') && E.usable(c, 'sacred')) return { act: 'sacred' };
          return { act: 'strike', targets: [t.id] };
        }
      }
      if (c.turn.hasteAction) {
        c.turn.hasteAction = false;
        const t = E.ai.pickTarget(E, c, E.action(c, 'strike'));
        if (t) return { act: 'strike1', targets: [t.id], cost: 'free' };
      }
      return null;
    },
    basic: 'strike', oa: 'strike1',
  };
  // sheet, SPELLS tab: the ones the book runs
  sheetSpells(tpl, ['bless', 'cure wounds', 'banishment'], { dc, toHit: dc - 8, mod: 4, charLevel: L });
  return extend(tpl);
}

// Where a character stands after a hard fight with no rest: 70% of their hit points and about
// half of what they can spend.
export const SPENT = {
  fresh: {},
  half: {
    gemma: { hpFrac: 0.7, used: { misty: 2, sup: 2, luck: 2 }, pact: 1 },
    eric: { hpFrac: 0.7, slots: { 1: 2, 2: 1, 3: 1, 4: 1, 5: 1, 6: 1 }, used: { flare: 2, shieldFree: 1, radiance: 1 } },
    dario: { hpFrac: 0.7, slots: { 1: 2, 2: 1, 3: 1, 4: 1 }, used: { sacred: 1, smiteFree: 1 }, memo: { loh: 35 } },
  },
};

export const PARTY = {
  gemma: makeGemma,
  eric: makeEric,
  dario: makeDario,
};
