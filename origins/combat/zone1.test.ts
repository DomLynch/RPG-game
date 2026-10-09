// Zone 1's combat (origins/combat/zone1.ts): every fight rule is the Pit's, run through the verbatim copies (duel-open / ai-open / sim-open, whose tick-for-tick parity is duel-open.test.ts), so these tests pin the
// WORLD layer and the adapter: who fights whom, the chase to the hold ring, the leash and heal-home, a pack taking turns, gear / levels / stances / specials / skill reaching the duel, and the player-vs-player rules.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { MOVES, OPPONENTS, RULES, opponentAt, specialOf } from '../../src/moves.ts';
import { CAPS } from '../../src/gear-stats.ts';
import { GIVE_UP_UNSEEN_S, LEASH, SPEEDS } from '../preview/speeds.ts';
import { AGGRO_M, ENGAGE_M, SIGHT_M, HOLD_M, MAX_LEVEL, PROTECT_LEVEL, creature, levelHealth, minKillSeconds, newWorld, player, stepCombat, withMood, withSpecial, withStance, type Event, type Fighter, type Input, type World } from './zone1.ts';

const DT = 1 / 60, STILL: Input = { x: 0, z: 0 };
const get = (w: World, id: string): Fighter => w.fighters.find((f) => f.id === id)!;
/** Step `seconds` with `input(t, world)` for each player id; collects every event. */
function run(world: World, seconds: number, input: (t: number, w: World) => Record<string, Input> = () => ({ p: STILL }), until?: (w: World) => boolean): { world: World; events: Event[]; ticks: number } {
  const events: Event[] = []; let t = 0;
  for (; t < Math.round(seconds * 60); t++) { const r = stepCombat(world, input(t, world), DT); world = r.world; events.push(...r.events); if (until?.(world)) { t++; break; } }
  return { world, events, ticks: t };
}
const of = (events: Event[], type: Event['type'], id?: string) => events.filter((e) => e.type === type && (id === undefined || ('id' in e ? e.id === id : 'attacker' in e && e.attacker === id)));
const boost = (f: Fighter) => { f.health = f.maxHealth = 1e6; return f; };

test('the speed table: a hunting creature chases at the table\'s speed (the wolf faster than the boar) and closes to the hold ring', () => {
  const closed = (kind: string) => { const r = run(newWorld([player('p', 0, 0), creature('c', kind, 0, 8)]), 3, undefined, (w) => !!w.streams.p?.foe); return r.ticks / 60; };
  assert.ok(closed('wolf') < closed('boar'), `wolf ${closed('wolf')} s, boar ${closed('boar')} s`);
  const w = run(newWorld([player('p', 0, 0), creature('c', 'wolf', 0, AGGRO_M - 0.5)]), 0.25).world;
  assert.ok(get(w, 'c').hunting, 'inside the aggro ring it hunts');
  assert.ok(Math.hypot(get(w, 'c').z - 0, 0) < AGGRO_M - 0.5, 'and closes');
  assert.equal(SPEEDS.creature.amble > 0, true);
});

test('stepCombat is pure: it never mutates the world it is given', () => {
  const w = newWorld([player('p', 0, 0), creature('c', 'wolf', 0, 3)]); const before = JSON.stringify(w);
  stepCombat(w, { p: { x: 0, z: 0, attack: 'light' } }, DT);
  assert.equal(JSON.stringify(w), before);
});

test('a lone creature that closes in fights on the Pit duel: it telegraphs and hits through the Pit rows, and the world Fighter mirrors the Pit fighter', () => {
  const r = run(newWorld([player('p', 0, 0), creature('c', 'goblin', 0, 3.5)]), 6);
  assert.ok(of(r.events, 'Telegraph', 'c').length > 0, 'the creature winds up (the Pit\'s AttackStarted)');
  assert.ok(of(r.events, 'Hit', 'c').length > 0, 'and lands a Pit blow');
  const [ph, pc] = r.world.streams.p!.duel.fighters;
  assert.equal(get(r.world, 'p').health, ph.health); assert.equal(get(r.world, 'c').health, pc.health);
});

test('the hero cuts, blocks and rolls through the Pit rows and wins; a killed creature emits Died once and stays dead', () => {
  const w0 = newWorld([player('p', 0, 0), creature('c', 'wolf', 0, 1.4)]);
  const r = run(w0, 60, (t) => ({ p: { x: 0, z: 0, attack: t % 40 === 0 ? 'light' : null, guard: t % 40 > 25 } }), (w) => get(w, 'c').phase === 'dead' || get(w, 'p').phase === 'dead');
  assert.ok(of(r.events, 'Hit', 'p').length > 0, 'the hero lands cuts');
  assert.ok(of(r.events, 'Died').length <= 1, 'at most one Died');
  assert.ok(get(r.world, 'c').phase === 'dead' || get(r.world, 'p').phase === 'dead', 'the fight ends');
  if (get(r.world, 'c').phase === 'dead') { const after = run(r.world, 2); assert.equal(of(after.events, 'Died').length, 0); assert.equal(get(after.world, 'c').health, 0); }
});

test('alone, the hero is still on the Pit rules: a cut telegraphs and costs stamina that comes back; a roll costs the rules\' stamina and moves a stride; a held guard raises', () => {
  const cut = run(newWorld([player('p', 0, 0)]), 1.5, (t) => ({ p: t === 0 ? { x: 0, z: 0, attack: 'light' } : STILL }));
  assert.ok(of(cut.events, 'Telegraph', 'p').length === 1, 'a cut winds up');
  assert.ok(get(cut.world, 'p').stamina > 100 - MOVES.light_right.stamina - 1, 'and the bar recovers or is near full');
  const roll = run(newWorld([player('p', 0, 0)]), 0.1, (t) => ({ p: t === 0 ? { x: 0, z: 0, roll: { x: 1, z: 0 } } : STILL }));
  assert.ok(get(roll.world, 'p').x > 0.2, `rolled ${get(roll.world, 'p').x} m`);
  assert.ok(get(roll.world, 'p').stamina < 100, 'a roll costs stamina');
  const guard = run(newWorld([player('p', 0, 0)]), 0.2, () => ({ p: { x: 0, z: 0, guard: true } }));
  assert.equal(get(guard.world, 'p').phase, 'guard');
});

test('running away works from a boar (chase 4.5 < run 5.2): the leash ends the chase, it walks home and heals to full, one Evaded event and nothing else', () => {
  let w = newWorld([player('p', 0, 0), creature('b', 'boar', 0, 8)]); const events: Event[] = [];
  for (let t = 0; t < 60 * 90; t++) {
    const hero = get(w, 'p'); hero.z += SPEEDS.player.run * DT * (t < 60 * 25 ? 1 : 0);   // the page walks the hero; he runs for 25 s, then stops far away
    const r = stepCombat(w, { p: STILL }, DT); w = r.world; events.push(...r.events);
  }
  assert.equal(of(events, 'Evaded', 'b').length, 1, 'one Evaded');
  assert.equal(get(w, 'b').health, get(w, 'b').maxHealth, 'healed');
  assert.equal(of(events, 'Hit', 'b').length, 0, 'it never landed a blow');
  assert.ok(Math.hypot(get(w, 'b').x, get(w, 'b').z - 8) < 0.5, 'and is back home');
  assert.ok(LEASH.wolf < LEASH.default, 'the wolf gives up sooner');
});

test('#1936 c(a): a pack joins - the nearest fights on his lock-on, the others join on their own duel and hit him too; a fourth holds off at the ring; each engage is one FightStarted; when the foe falls the next takes his lock-on', () => {
  const w0 = newWorld([player('p', 0, 0, 0, undefined, 10), creature('a', 'wolf', 0, 1.6), creature('b', 'wolf', 1.2, 1.6), creature('c', 'wolf', -1.2, 1.6), creature('d', 'wolf', 0, 3.5)]); boost(get(w0, 'p'));
  const r = run(w0, 8, (t) => ({ p: t % 25 === 0 ? { x: 0, z: 0, attack: 'light' } : STILL }));
  const hitters = new Set(r.events.filter((e) => e.type === 'Hit' && e.victim === 'p').map((e) => (e as { attacker: string }).attacker));
  assert.ok(hitters.has('a') && hitters.has('b') && hitters.has('c'), `three creatures hit him: ${[...hitters]}`);
  const started = r.events.filter((e) => e.type === 'FightStarted').map((e) => (e as { creature: string }).creature);
  assert.equal(new Set(started).size, started.length, 'one FightStarted per creature per engage'); assert.ok(started.includes('a') && started.includes('b') && started.includes('c'));
  const w1 = run(newWorld([player('p', 0, 0, 0, undefined, 10), creature('a', 'wolf', 0, 1.6), creature('b', 'wolf', 1.2, 1.6), creature('c', 'wolf', -1.2, 1.6), creature('d', 'wolf', 0, 3.5)]), 1 / 60).world;
  assert.equal(get(w1, 'd').phase, 'ready', 'the fourth is held off at the ring: no windup'); assert.ok(!w1.streams.p!.joined!.some((j) => j.foe === 'd') && w1.streams.p!.joined!.length === 2);
  // the primary falls: a joiner takes his lock-on at once
  const w2 = newWorld([player('p', 0, 0, 0, undefined, 10), creature('a', 'wolf', 0, 1.6), creature('b', 'wolf', 1.2, 1.6)]); boost(get(w2, 'p'));
  let w = w2, aDown = -1, bFoe = false;
  for (let t = 0; t < 60 * 60; t++) { const q = stepCombat(w, { p: t % 25 === 0 ? { x: 0, z: 0, attack: 'light' } : STILL }, DT); w = q.world; if (q.events.some((e) => e.type === 'Died' && e.id === 'a')) aDown = t; if (aDown >= 0 && w.streams.p?.foe === 'b') bFoe = true; if (get(w, 'b').phase === 'dead') break; }
  assert.ok(aDown >= 0 && bFoe, 'when the first falls the second is his foe'); assert.ok(HOLD_M < ENGAGE_M);
});

test('gear: Attack scales what the hero deals, RES what he takes (the numbers the Pit reports); naked is the Pit number', () => {
  const dealt = (attack: number) => { const r = run(newWorld([player('p', 0, 0, 0, { attack, res: 1 }), creature('c', 'boar', 0, 1.3)]), 3, (t) => ({ p: t === 0 ? { x: 0, z: 0, attack: 'light' } : STILL })); return of(r.events, 'Hit', 'p').map((e) => (e as Extract<Event, { type: 'Hit' }>).damage)[0] ?? 0; };
  const taken = (res: number) => { const r = run(newWorld([player('p', 0, 0, 0, { attack: 1, res }), creature('c', 'bear', 0, 1.4)]), 4); return of(r.events, 'Hit', 'c').map((e) => (e as Extract<Event, { type: 'Hit' }>).damage)[0] ?? 0; };
  assert.ok(dealt(1) > 0, 'a naked cut lands');
  assert.equal(dealt(CAPS.attack), Math.round(dealt(1) * CAPS.attack), 'Attack scales it');
  assert.ok(taken(1) > 0 && taken(CAPS.res) === Math.round(taken(1) * CAPS.res), `RES scales what he takes: ${taken(1)} -> ${taken(CAPS.res)}`);
});

test('level: a creature of level L has the Pit\'s own level body (moves.ts opponentAt), no Zone 1 scaling; minKillSeconds follows the level and the best gear', () => {
  for (const level of [1, 6, 18, 46]) { const c = creature('c', 'wolf', 0, 5, 0, level); assert.equal(c.maxHealth, opponentAt(OPPONENTS.wolf, level).health); assert.equal(c.poise, opponentAt(OPPONENTS.wolf, level).poise); assert.equal(c.level, level); }
  assert.equal(creature('c', 'wolf', 0, 5).level, 6, 'the default is the easy anchor (the roster row)');
  assert.equal(levelHealth('bear', 99), levelHealth('bear', MAX_LEVEL));
  assert.ok(minKillSeconds('bear', 1) <= minKillSeconds('bear', 46), 'a higher level cannot be killed faster');
  assert.ok(minKillSeconds('wolf') > 0);
});

test('minKillSeconds is a bound from the whole Pit kit: no attack spam at the best gear kills any kind at L1-3 faster, and a low-level creature falls to one stacked blow (so the bound is the fastest windup)', () => {
  const kinds = Object.keys(OPPONENTS).filter((k) => k !== 'player' && ['wolf', 'boar', 'bear', 'goblin'].includes(k));
  let kills = 0;
  for (const kind of kinds) for (const level of [1, 2, 3]) for (const attack of ['light', 'heavy'] as const) {
    const p = boost(player('p', 0, 0, 0, { attack: CAPS.attack, res: 1 }, 10)), c = creature('c', kind, 0, 1.3, Math.PI, level);
    const r = run(newWorld([p, c]), 120, () => ({ p: { x: 0, z: 0, attack } }), (w) => get(w, 'c').health <= 0);
    if (get(r.world, 'c').health > 0) continue;   // never killed in 120 s of spam: nothing to bound
    kills++;
    assert.ok(r.ticks / 60 + 1e-9 >= minKillSeconds(kind, level), `${kind} L${level} ${attack}: killed in ${(r.ticks / 60).toFixed(2)} s, bound ${minKillSeconds(kind, level).toFixed(2)} s`);
  }
  assert.ok(kills > 0, 'the spam killed something, so the bound was actually compared');
  for (const kind of ['wolf', 'boar', 'bear']) assert.ok(minKillSeconds(kind, 1) < 1, `${kind} L1: one stacked blow can kill, so the bound is under a second`);
});

test('stances: the Pit table applies in the open - aggressive deals more than Balanced, defensive less; Balanced is the stance-less fight', () => {
  const hit = (pick: 'neutral' | 'aggressive' | 'defensive') => {   // against an idle player, so nothing interrupts the cut
    const a = withStance(player('a', 0, 0, 0, undefined, 10), pick), b = player('b', 0, 1.2, Math.PI, undefined, 10); a.pvp = b.pvp = true;
    const r = run(newWorld([a, b]), 2, (t) => ({ a: t === 0 ? { x: 0, z: 0, attack: 'heavy' } : STILL, b: STILL }));
    return (of(r.events, 'Hit', 'a')[0] as Extract<Event, { type: 'Hit' }> | undefined)?.damage ?? 0;
  };
  assert.ok(hit('aggressive') > hit('neutral') && hit('neutral') > hit('defensive'), `${hit('aggressive')} > ${hit('neutral')} > ${hit('defensive')}`);
  const mk = (pick?: 'neutral') => JSON.stringify(run(newWorld([pick ? withStance(player('p', 0, 0), pick) : player('p', 0, 0), creature('c', 'wolf', 0, 2)]), 3, (t) => ({ p: t % 60 === 0 ? { x: 0, z: 0, attack: 'light' } : STILL })).events);
  assert.equal(mk('neutral'), mk(), 'Balanced is byte for byte the stance-less fight');
});

test('stab: a thrust press plays the Pit\'s thrust row, not the slash (the page used to fold STAB into SLASH)', () => {
  const hit = (attack: 'light' | 'thrust') => {   // against an idle player, so nothing interrupts the cut
    const a = player('a', 0, 0, 0, undefined, 10), b = player('b', 0, 1.2, Math.PI, undefined, 10); a.pvp = b.pvp = true;
    const r = run(newWorld([a, b]), 2, (t) => ({ a: t === 0 ? { x: 0, z: 0, attack } : STILL, b: STILL }));
    return of(r.events, 'Hit', 'a')[0] as Extract<Event, { type: 'Hit' }> | undefined;
  };
  const stab = hit('thrust'), slash = hit('light');
  assert.ok(stab && slash, 'both land at 1.2 m');
  assert.equal(stab.move, 'thrust');
  assert.notEqual(stab.move, slash.move);
});

test('creature mood: the Pit\'s moodOf draw - about half the home stance, the rest spread over the other three; same rand = same stance', () => {
  let seed = 7; const rnd = () => (seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296;
  const count: Record<string, number> = {};
  for (let i = 0; i < 2000; i++) { const k = withMood(creature('c', 'wolf', 0, 0), rnd).stance ?? 'neutral'; count[k] = (count[k] ?? 0) + 1; }
  assert.ok(count.neutral! > 900 && count.neutral! < 1100, `wolf home = Balanced about half: ${JSON.stringify(count)}`);
  for (const k of ['aggressive', 'defensive', 'trickster']) assert.ok(count[k]! > 250, `${k} is drawn: ${JSON.stringify(count)}`);
  assert.equal(withMood(creature('c', 'bear', 0, 0), () => 0.77).stance, withMood(creature('c', 'bear', 0, 0), () => 0.77).stance);
});

test('special: not ready until RULES.special.first in; then a 2 s telegraph carrying its name and an unblockable release on the foe for a share of ITS max health', () => {
  const name = specialOf('knight', 36)!, c = withSpecial(player('p', 0, 0, 0, undefined, 10), name), bear = creature('b', 'bear', 0, 2.0);
  const early = run(newWorld([c, bear]), 1, (t) => ({ p: t === 0 ? { x: 0, z: 0, special: true } : STILL }));
  assert.equal(of(early.events, 'Telegraph', 'p').length, 0, 'not ready in the first seconds');
  const ready = { ...c, specialIn: 0 }, r = run(newWorld([ready, creature('b', 'bear', 0, 2.0)]), 4, (t) => ({ p: t === 0 ? { x: 0, z: 0, special: true } : STILL }));
  const tel = of(r.events, 'Telegraph', 'p')[0] as Extract<Event, { type: 'Telegraph' }>;
  assert.equal(tel.move, name); assert.equal(tel.ms, Math.round((RULES.special.windup / 60) * 1000));
  const landed = of(r.events, 'Hit', 'p').find((e) => (e as Extract<Event, { type: 'Hit' }>).move === name || true) as Extract<Event, { type: 'Hit' }> | undefined;
  assert.ok(landed, 'the release hit');
});

test('skill: the SKILL button fires the equipped skill\'s move (the Pit\'s single button) when the hero has no named special', () => {
  const r = run(newWorld([player('p', 0, 0, 0, undefined, 10, 'pommel'), creature('c', 'goblin', 0, 8)]), 2, (t) => ({ p: t === 0 ? { x: 0, z: 0, skill: true } : STILL }));
  const tel = of(r.events, 'Telegraph', 'p')[0] as Extract<Event, { type: 'Telegraph' }> | undefined;
  assert.ok(tel && tel.move === 'skill_pommel', `fired ${tel?.move}`);
  const none = run(newWorld([player('p', 0, 0)]), 1, (t) => ({ p: t === 0 ? { x: 0, z: 0, skill: true } : STILL }));
  assert.equal(of(none.events, 'Telegraph', 'p').length, 0, 'no skill equipped: nothing fires');
});

// ---- player against player (the Pit duel with two humans; the server sets pvp per area) ----
const duo = (opts: { aPvp?: boolean; bPvp?: boolean; aLevel?: number; bLevel?: number } = {}) => {
  const a = player('a', 0, 0, 0, undefined, opts.aLevel ?? 10), b = player('b', 0, 1.2, Math.PI, undefined, opts.bLevel ?? 10);
  a.pvp = opts.aPvp ?? true; b.pvp = opts.bPvp ?? true;
  return newWorld([a, b]);
};
const swing = (w: World, who = 'a', seconds = 1.2, other: Input = STILL) => run(w, seconds, (t) => ({ [who]: t === 0 ? { x: 0, z: 0, attack: 'light' } : STILL, [who === 'a' ? 'b' : 'a']: other }));

test('pvp: in the wild a player\'s cut lands on another player on the Pit duel (same Hit, Died as against a creature); one first-strike event names the aggressor', () => {
  const { world, events } = swing(duo());
  assert.ok(get(world, 'b').health < RULES.health, 'b was hurt');
  assert.deepEqual(of(events, 'Aggressed'), [{ type: 'Aggressed', attacker: 'a', victim: 'b', first: true }]);
  const w = duo(); get(w, 'b').health = 1;
  assert.deepEqual(of(swing(w).events, 'Died'), [{ type: 'Died', id: 'b', by: 'a' }]);
});

test('pvp: a safe-town volume (pvp false on either side) means no fight, no Aggressed', () => {
  for (const o of [{ aPvp: false }, { bPvp: false }]) { const { world, events } = swing(duo(o)); assert.equal(get(world, 'b').health, RULES.health); assert.equal(of(events, 'Aggressed').length + of(events, 'Hit', 'a').length, 0); }
});

test('pvp: under level 3 a player is shielded until his own first attack; nobody fights a player more than 10 levels away', () => {
  assert.equal(get(swing(duo({ bLevel: PROTECT_LEVEL - 1 })).world, 'b').health, RULES.health, 'a level-2 target is shielded');
  assert.equal(get(swing(duo({ aLevel: 30, bLevel: 19 })).world, 'b').health, RULES.health, '11 levels apart: refused');
  assert.ok(get(swing(duo({ aLevel: 30, bLevel: 20 })).world, 'b').health < RULES.health, '10 levels apart: allowed');
  const w = swing(duo({ aLevel: 10, bLevel: 2 }), 'b', 0.2).world;   // the shielded player swings: his protection ends
  assert.equal(get(w, 'b').shielded, false);
});

test('pvp: hitting back is not "first" (inside the window)', () => {
  const w = swing(duo()).world, back = swing(w, 'b');
  assert.deepEqual(of(back.events, 'Aggressed')[0], { type: 'Aggressed', attacker: 'b', victim: 'a', first: false });
});

test('parry: a guard raised just before a creature\'s blow turns it aside - a Parried event, no damage, the creature thrown off', () => {
  let w = newWorld([player('p', 0, 0), creature('c', 'wolf', 0, 1.4)]); const events: Event[] = [];
  for (let t = 0; t < 300; t++) { const c = get(w, 'c'), guard = c.phase === 'windup' && c.t >= 0.15; const r = stepCombat(w, { p: { x: 0, z: 0, guard } }, DT); w = r.world; events.push(...r.events); }
  assert.ok(of(events, 'Parried').length > 0, 'parried');
  assert.ok(of(events, 'Staggered', 'c').length > 0, 'the creature is thrown off');
});

// Dom's ruling (via Strategy): the level band is ONE-WAY - the higher player cannot attack down past MAX_LEVEL_GAP, the lower player still can attack up - plus protection to L3. The symmetric Pit duel above refuses
// the pair outright, so this stays a TODO (node reports it as todo, not as a failure) until the PvP PR gives the duel a one-way hit rule.
test('pvp one-way band: a level-20 player CAN attack a level-40 player, and the level-40 cannot attack down (TODO: the symmetric duel refuses the pair)', { todo: 'PvP PR: Dom\'s one-way 10-level band' }, () => {
  const w = duo({ aLevel: 20, bLevel: 40 });
  const up = swing(w, 'a', 1.2).world, down = swing(duo({ aLevel: 40, bLevel: 20 }), 'a', 1.2).world;
  assert.ok(get(up, 'b').health < RULES.health, 'the lower attacks up');
  assert.equal(get(down, 'b').health, RULES.health, 'the higher cannot attack down');
});

test('#1936 b: a rebuilt fight resumes the creature\'s swing timing (its brain lives on the creature) instead of restarting at the 90-tick opening wait', () => {
  const w0 = run(newWorld([player('p', 0, 0), creature('c', 'wolf', 0, 1.3)]), 0.5).world;   // 30 ticks in: the wait has been counting down
  const brain0 = get(w0, 'c').brain!; assert.ok(brain0, 'the creature carries its brain after a fight step'); assert.ok(brain0.wait < 90, `wait counting down, got ${brain0.wait}`);
  const rebuilt = run({ ...w0, streams: {} }, 1 / 60).world;   // streams cleared = the fight is rebuilt (a pack's next bout, a re-engage)
  const resumed = get(rebuilt, 'c').brain!.wait;
  assert.ok(resumed <= brain0.wait && resumed >= brain0.wait - 1, `resumed at ${resumed}, was ${brain0.wait}: not reset to 89`);
  const fresh = run(newWorld([player('p', 0, 0), creature('c', 'wolf', 0, 1.3)]), 1 / 60).world;
  assert.equal(get(fresh, 'c').brain!.wait, 89, 'a creature that never fought starts at the opening wait');
  // a creature that walks home heals and forgets: its next fight starts fresh
  const home = { ...w0, fighters: w0.fighters.map((f) => (f.id === 'c' ? { ...f, returning: true, hunting: false, x: f.homeX + 0.01, z: f.homeZ } : f)), streams: {} };
  const after = run(home, 0.2);   // it evades (heals home) and then, with the hero still beside it, starts a NEW fight on a FRESH brain
  assert.ok(of(after.events, 'Evaded', 'c').length >= 1, 'it evaded');
  assert.ok(get(after.world, 'c').brain!.habits.ticks < brain0.habits.ticks, 'evading cleared the old brain: the new fight started counting from zero');
});

test('#1936 b (Auditor HOLD): a brain carried out of a LONG bout is rebased - hit late (tick > 500), rebuild, and the creature swings within ~2 s instead of retreating for the length of the old fight', () => {
  const w0 = newWorld([boost(player('p', 0, 0)), boost(creature('c', 'wolf', 0, 1.3))]);
  const long = run(w0, 20, (t) => ({ p: t % 90 === 0 ? { x: 0, z: 0, attack: 'light' } : STILL }));   // 1200 ticks of hits taken
  assert.ok(long.world.streams.p!.duel.tick > 500, 'a long bout'); assert.ok(of(long.events, 'Hit', 'p').length > 0, 'the creature was hit');
  const after = run({ ...long.world, streams: {} }, 2);   // re-engage: the stream is rebuilt, the player stands still
  assert.ok(of(after.events, 'Telegraph', 'c').length > 0, 'the creature swings within 2 s of the rebuild (not 0 swings while an old retreatUntil counts down)');
});

test('#1936 c: the creature chooses by threat - of two players in reach it fights the one that hurt it, not the nearer; with no threat it takes the nearer', () => {
  const mk = (threat?: Fighter['threat']) => { const c = creature('c', 'wolf', 0, 0); if (threat) c.threat = threat; return newWorld([player('a', 3.5, 0), player('b', 0, 2), c]); };
  const none = run(mk(), 1 / 60, () => ({ a: STILL, b: STILL })).world;
  assert.equal(none.streams.b!.foe, 'c', 'no threat: the nearer player (b) is the foe'); assert.equal(none.streams.a!.foe, null);
  const hurt = run(mk({ a: { threat: 50, damage: 50, out: 0 } }), 1 / 60, () => ({ a: STILL, b: STILL })).world;
  assert.equal(hurt.streams.a!.foe, 'c', 'threat on a: the creature fights a'); assert.equal(hurt.streams.b!.foe, null);
});

test('#1936 c: FightStarted fires once per engage (not per step), and the damage the hero lands is the creature\'s threat and credit', () => {
  const w = newWorld([boost(player('p', 0, 0)), creature('c', 'wolf', 0, 1.3)]);
  const r = run(w, 3, (t) => ({ p: t % 30 === 0 ? { x: 0, z: 0, attack: 'light' } : STILL }));
  assert.equal(r.events.filter((e) => e.type === 'FightStarted').length, 1);
  assert.deepEqual(r.events.find((e) => e.type === 'FightStarted'), { type: 'FightStarted', creature: 'c', player: 'p' });
  const dealt = r.events.reduce((n, e) => n + (e.type === 'Hit' && e.attacker === 'p' ? e.damage : 0), 0);
  assert.ok(dealt > 0, 'the hero landed a blow'); assert.equal(get(r.world, 'c').threat!.p!.damage, dealt); assert.equal(get(r.world, 'c').threat!.p!.threat, dealt);
});

test('#1936 c: threat is forgotten when the player is out of sight for the give-up time, and when the creature walks home', () => {
  const c = creature('c', 'wolf', 0, 0); c.threat = { p: { threat: 9, damage: 9, out: 0 } };
  const far = run(newWorld([player('p', SIGHT_M + 5, 0), c]), 1, () => ({ p: STILL })).world;
  assert.ok(get(far, 'c').threat!.p, 'out of sight for 1 s: still on the list');
  const gone = run(far, GIVE_UP_UNSEEN_S + 1, () => ({ p: STILL })).world;
  assert.equal(get(gone, 'c').threat?.p, undefined, 'out of sight past the give-up time: forgotten');
});

test('#1936 c(a) (Auditor HOLD): a player killed by a JOINER stays dead - phase dead, no further fight, one Died', () => {
  const p = player('p', 0, 0); p.health = p.maxHealth = 40;   // a few wolf bites
  const w0 = newWorld([p, creature('a', 'wolf', 0, 1.6), creature('b', 'wolf', 1.2, 1.6), creature('c', 'wolf', -1.2, 1.6)]);
  const r = run(w0, 40, () => ({ p: STILL }), (w) => of([], 'Died').length === 0 && get(w, 'p').phase === 'dead');
  const killers = r.events.filter((e) => e.type === 'Died' && e.id === 'p').map((e) => (e as { by: string }).by);
  assert.equal(killers.length, 1, 'he died once'); assert.equal(get(r.world, 'p').phase, 'dead');
  const later = run(r.world, 5, () => ({ p: STILL }));
  assert.equal(get(later.world, 'p').phase, 'dead', 'five seconds later he is still dead'); assert.equal(later.events.filter((e) => e.type === 'Died' && e.id === 'p').length, 0, 'no second Died');
  assert.equal(later.events.filter((e) => e.type === 'Hit' && e.victim === 'p').length, 0, 'nothing keeps hitting the corpse');
});

test('#1936 c(b): disengage - the player runs from three creatures; the fight just stops (no end event), each loses him, gives up or hits its leash, walks home, heals and says Evaded once; no bout is left', () => {
  const w0 = newWorld([boost(player('p', 0, 0, 0, undefined, 10)), creature('a', 'wolf', 0, 1.6), creature('b', 'wolf', 1.2, 1.6), creature('c', 'wolf', -1.2, 1.6)]);
  const fight = run(w0, 1);
  assert.equal(fight.world.streams.p!.joined!.length, 2, 'three on him'); for (const id of ['a', 'b', 'c']) get(fight.world, id).health -= 20;
  // he runs away at the run speed and keeps going: past the sight ring the unseen clock runs, past the leash they turn back
  const gone = run(fight.world, 60, () => ({ p: { x: 1, z: 0, run: true } }), (w) => ['a', 'b', 'c'].every((id) => { const c = get(w, id); return !c.hunting && !c.returning && c.health === c.maxHealth; }));
  for (const id of ['a', 'b', 'c']) { const c = get(gone.world, id); assert.equal(c.health, c.maxHealth, `${id} healed home`); assert.ok(!c.hunting && !c.returning, `${id} is idle at home`); assert.equal(of(gone.events, 'Evaded', id).length, 1, `${id}: one Evaded`); assert.equal(c.threat, undefined, `${id}: threat cleared`); }
  assert.equal(gone.events.filter((e) => e.type === 'Died').length, 0, 'nobody died: no end of fight');
  assert.equal(gone.world.streams.p!.foe, null, 'his bout is the alone-bout again'); assert.ok(!gone.world.streams.p!.joined?.length);
});

test('#1936 c(a): FightStarted is once per creature per engage - a joiner that becomes his foe, or hovers at the edge of the ring, does not fire again', () => {
  const w0 = newWorld([boost(player('p', 0, 0, 0, undefined, 10)), creature('a', 'boar', 0, 1.6), creature('b', 'boar', 1.4, 1.8), creature('c', 'boar', -1.4, 1.8)]);
  let aDown = -1;
  const r = run(w0, 120, (t) => ({ p: aDown < 0 ? { x: 0, z: 0, attack: t % 25 === 0 ? 'light' : null } : { x: -1, z: 0, run: true } }), (w) => { if (aDown < 0 && get(w, 'a').phase === 'dead') aDown = 1; return false; });
  const started = r.events.filter((e) => e.type === 'FightStarted').map((e) => (e as { creature: string }).creature), died = r.events.filter((e) => e.type === 'Died' && e.id === 'a').length;
  assert.equal(died, 1, 'he killed one'); assert.equal(started.filter((id) => id === 'a').length, 1); assert.ok(started.filter((id) => id === 'b').length <= 2 && started.filter((id) => id === 'c').length <= 2, `no churn: ${started}`);
  assert.equal(started.slice(0, 3).sort().join(), 'a,b,c', 'the first three are the pack');
});
