// Special Moves on the SKILL slot (RULES.special, duel.ts withSpecials; Dom 2026-09-29 via Strategy / Lead). Constructed states and scripted
// intents, no AI: deterministic. A fight without withSpecials is the fight it always was (tests/fixtures/fight-records.json, v20, still replays).
import test from 'node:test';
import assert from 'node:assert/strict';
import { legal, stepDuel, withSpecials, type Duel, type Intent } from '../src/duel.ts';
import { OPPONENTS, RULES, opponentAt, profileAt } from '../src/moves.ts';
import { initialPractice, stepPractice } from '../src/combat.ts';
import { createRecorder, decodeRecord, encodeRecord } from '../src/record.ts';
import { recordSpecials, verifyRecord } from '../src/replay.ts';
import { STRATEGIES, act, arena, idle } from './strategies.ts';

const S = RULES.special;
const ready = (level = 6): Duel => { const d = withSpecials(arena(OPPONENTS.veteran), level, 'shove'); d.fighters[0].skillCooldown = 0; d.fighters[1].skillCooldown = 0; return d; };
const run = (d: Duel, ticks: number, intents: (d: Duel) => [Intent, Intent]) => { const events: Duel['events'] = []; for (let i = 0; i < ticks && !d.finish; i++) { d = stepDuel(d, intents(d)); events.push(...d.events); } return { d, events }; };

test('specials: both sides carry the share, the boss share from rank 8, and nothing fires in the first 20 s', () => {
  const d = withSpecials(arena(OPPONENTS.veteran), 6, 'shove'), boss = withSpecials(arena(OPPONENTS.veteran), S.bossFrom, 'shove');
  assert.deepEqual([d.fighters[0].specialShare, d.fighters[1].specialShare, boss.fighters[0].specialShare, boss.fighters[1].specialShare], [S.damage, S.damage, S.damage, S.bossDamage]);
  assert.deepEqual([d.fighters[0].skillCooldown, d.fighters[1].skillCooldown, d.fighters[1].skill], [S.first, S.first, 'shove']);
  assert.equal(legal(d.fighters[0], 'skill'), false, 'the first cast waits RULES.special.first');
  assert.equal(arena(OPPONENTS.veteran).fighters[0].specialShare, undefined, 'a fight without withSpecials has no special');
});

test('specials: the cast commits the caster; guard, roll and parry are ignored until the release', () => {
  let d = stepDuel(ready(), [act('skill'), idle()]);
  const caster = d.fighters[0];
  assert.deepEqual([caster.special, caster.skillCooldown], [S.windup - 1, S.cooldown]);
  assert.ok(d.events.some(e => e.type === 'SpecialStarted' && e.actor === 0));
  assert.equal(legal(caster, 'dodge'), false);
  for (const press of [act('dodge'), act('parry'), { ...idle(), guard: true }, act('light')]) {
    d = stepDuel(d, [press, idle()]);
    assert.equal(d.fighters[0].phase, 'ready', `a ${press.action ?? 'guard'} press during the windup does nothing`);
  }
});

test('specials: unblockable and undodgeable, landing the share of max health on the release tick', () => {
  const start = ready(), max = start.fighters[1].maxHealth;
  const d = stepDuel(start, [act('skill'), idle()]), cast = d.tick;
  // The target holds a guard throughout, and rolls into the release: neither matters.
  const out = run(d, S.windup + 5, x => [idle(), x.fighters[0].special === 3 ? act('dodge') : { ...idle(), guard: true }]);
  const landed = out.events.filter(e => e.type === 'SpecialLanded');
  assert.equal(landed.length, 1);
  assert.equal(landed[0].tick, cast + S.windup - 1, 'the windup is RULES.special.windup ticks, the cast tick included');
  assert.equal(out.d.fighters[1].health, max - Math.round(S.damage * max));
});

test('specials: a caster who falls during his windup fizzles (no damage)', () => {
  const d = ready(S.bossFrom);
  d.fighters[0].special = 50; d.fighters[0].health = 5;   // the player is winding up, nearly dead
  d.fighters[1].special = 1; d.fighters[1].specialShare = S.bossDamage;   // the boss releases this tick
  const hp = d.fighters[1].health, next = stepDuel(d, [idle(), idle()]);
  assert.ok(next.events.some(e => e.type === 'SpecialFizzled' && e.actor === 0));
  assert.ok(!next.events.some(e => e.type === 'SpecialLanded' && e.actor === 0));
  assert.equal(next.fighters[1].health, hp);
  assert.deepEqual([next.finish?.victim, !!next.finish?.draw], [0, false]);
});

test('specials: a release on the tick its caster falls still lands; lethal both ways it is a double kill (Finish.draw)', () => {
  const d = ready();
  for (const f of d.fighters) { f.special = 1; f.health = 5; }
  const next = stepDuel(d, [idle(), idle()]);
  assert.equal(next.events.filter(e => e.type === 'SpecialLanded').length, 2);
  assert.deepEqual([next.fighters[0].health, next.fighters[1].health, next.finish?.draw], [0, 0, true]);
});

test('specials: a fight with them records the flag (v21), and the replay builds the same fight from it', async () => {
  const specials = { level: 12, aiSkill: 'shove' as const };
  const profile = profileAt(OPPONENTS.veteran, 12);
  let p = initialPractice(9, opponentAt(OPPONENTS.veteran, 12), 'longsword', 'pommel', specials);   // the level's body and profile, as verifyRecord builds it
  const rec = createRecorder({ build: 'specials', opponent: 'veteran', weapon: 'longsword', skill: 'pommel', level: 12, seed: 9, specials: true });
  let landed = 0;
  for (let i = 0; i < 7200 && !p.finish; i++) {
    const f = p.duel.fighters[0], intent = rec.push(legal(f, 'skill') ? act('skill') : f.phase === 'sheathed' ? act('light') : STRATEGIES['light spam'](p.duel));   // the special whenever it is ready, else the battery's light spam
    p = stepPractice(p, intent, profile); landed += p.duel.events.filter(e => e.type === 'SpecialLanded').length;
  }
  assert.ok(landed > 0, 'a special landed in the fight');
  const record = rec.finish(p.finish ? (p.finish.draw ? 'draw' : p.finish.victim === 1 ? 'killed' : 'died') : 'abandoned');
  const back = await decodeRecord(await encodeRecord(record));
  assert.deepEqual([back.v, back.specials, recordSpecials(back)], [21, true, { level: 12, aiSkill: 'shove' }]);
  const v = verifyRecord(back); assert.equal(v.ok, true, `the replay reaches the same finish: ${v.ok ? '' : v.reason}`);
  assert.equal(verifyRecord({ ...back, specials: undefined }).ok, false, 'the same intents without specials are another fight');
});

// The registry (special-modes.ts): a lane adds one entry, the scene has no per-special branch. Pinned: the scene names no special id and reads the registry.
import { readFileSync } from 'node:fs';
import { gait, SPECIAL_MODES, type SpecialMode } from '../src/special-modes.ts';
import { SPECIAL_TESTS } from '../src/special-look.ts';
test('the special registry: every entry names a page id, the scene branches on none of them', () => {
  for (const id of Object.keys(SPECIAL_MODES)) assert.ok(Object.hasOwn(SPECIAL_TESTS, id), `${id} is a ?special= page`);
  assert.ok(SPECIAL_MODES.set && SPECIAL_MODES.shield && !SPECIAL_MODES.hades, 'Red Wind and Shield Quake have entries; Hades draws as the default');
  const scene = readFileSync('src/scene.ts', 'utf8');
  assert.match(scene, /SPECIAL_MODES\[specialId\]/);
  for (const flag of ["=== 'set'", "=== 'shield'", "=== 'tithe'"]) assert.ok(!scene.includes(flag), `no per-special branch ${flag} in scene.ts`);
  assert.equal(SPECIAL_MODES.shield!.lift, 0.12); assert.equal(SPECIAL_MODES.set!.lift, 0.12);
});

// A mode may set how fast the rig is told a fighter travels (special-modes.ts `travel`, in a ready stance): the Centurion's Charge runs him in. No travel, or undefined, is the sim's own.
test('a mode without travel leaves the sim speed and pose untouched; one that answers puts the fighter in a ready stance at its speed', () => {
  const duel = initialPractice().duel, fighters = duel.fighters as unknown as readonly [never, never];
  const base = { load: () => Promise.reject(new Error('unused')), at: 'feet' as const, lift: 0 } satisfies SpecialMode;
  assert.deepEqual(gait(undefined, 1, fighters, -2.5, 'attack'), { travel: -2.5, pose: 'attack' }, 'a page with no special');
  assert.deepEqual(gait(base, 1, fighters, 1.7, 'guard'), { travel: 1.7, pose: 'guard' }, 'a mode with no travel hook');
  assert.deepEqual(gait({ ...base, travel: () => undefined }, 0, fighters, 0, 'ready'), { travel: 0, pose: 'ready' }, 'a hook that answers undefined');
  const seen: number[] = [];
  assert.deepEqual(gait({ ...base, travel: (side) => { seen.push(side); return side === 1 ? 4 : undefined; } }, 1, fighters, 0, 'attack'), { travel: 4, pose: 'ready' });
  assert.deepEqual(gait({ ...base, travel: (side) => (side === 1 ? 4 : undefined) }, 0, fighters, 0.9, 'draw'), { travel: 0.9, pose: 'draw' }, 'it is per side: the other fighter keeps the sim speed');
  assert.deepEqual(seen, [1]);
  for (const id of ['set', 'shield'] as const) assert.equal(SPECIAL_MODES[id]!.travel, undefined, `${id} leaves the sim speed alone`);
  const scene = readFileSync('src/scene.ts', 'utf8');
  assert.match(scene, /gait\(mode, 0, practice\.duel\.fighters,/); assert.match(scene, /gait\(mode, 1, practice\.duel\.fighters,/);
  assert.match(scene, /mineGait\.travel/); assert.match(scene, /theirGait\.pose/);
});
