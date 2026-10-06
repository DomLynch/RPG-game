// Special Moves on the SKILL slot (RULES.special, duel.ts withSpecials; Dom 2026-09-29 via Strategy / Lead). Constructed states and scripted
// intents, no AI: deterministic. A fight without withSpecials is the fight it always was (tests/fixtures/fight-records.json, v20, still replays).
import test from 'node:test';
import assert from 'node:assert/strict';
import { legal, stepDuel, withSpecials, type Duel, type Intent } from '../src/duel.ts';
import { OPPONENTS, RULES, opponentAt, profileAt, specialOf } from '../src/moves.ts';
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
  assert.deepEqual([caster.special, caster.skillCooldown], [S.windup - 1, 0]);   // the cooldown re-arms at the release, not here
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

test('specials: a fight with them records the flag (v22: a headless fight in the old circle), and the replay builds the same fight from it', async () => {
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
  assert.deepEqual([back.v, back.specials, recordSpecials(back)], [22, true, { level: 12, aiSkill: 'shove' }]);
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

// Named specials (Strategy 2026-10-01): rank 8 / 9 / 10 = level 36 / 41 / 46, per character. Identity only: the rule is RULES.special.
const SETS: Record<string, [string, string, string]> = {
  veteran: ['quake', 'charge', 'tithe'], nightborn: ['redwind', 'hadesshadow', 'nyxnightfall'], executioner: ['bayingcircle', 'longshadow', 'harvestsweep'],
  goblin: ['dirtyfistful', 'gone', 'threeliars'], pitborn: ['crackingground', 'ashfall', 'windwall'], dwarf: ['theword', 'threeblows', 'rimshake'],
  shieldmaiden: ['baredface', 'thering', 'aegissweep'], witch: ['avalonmist', 'foretoldstep', 'theprice'], plaguedoctor: ['plagueflies', 'poisonstain', 'lastbreath'],
  knight: ['thesling', 'wrath', 'stormfollowshim'],
};
for (const [id, set] of Object.entries(SETS)) {
  for (const [level, name] of [[35, undefined], [36, set[0]], [40, set[0]], [41, set[1]], [45, set[1]], [46, set[2]]] as Array<[number, string | undefined]>) {
    test(`specials: ${id} at level ${level} casts ${name ?? 'his class skill'}, named in SpecialStarted and SpecialLanded, on the shared rule`, () => {
      const spec = recordSpecials({ specials: true, level, opponent: id as never })!;
      assert.equal(spec.name, name);
      const d = withSpecials(arena(OPPONENTS[id as keyof typeof OPPONENTS]), level, spec.aiSkill, undefined, spec.name);
      assert.equal(d.fighters[1].specialName, name);
      d.fighters[1].skillCooldown = 0;
      const out = run(d, S.windup + 5, () => [idle(), act('skill')]);
      const named = out.events.filter(e => e.type === 'SpecialStarted' || e.type === 'SpecialLanded');
      assert.equal(named.length, 2, 'cast and release');
      for (const e of named) assert.equal(e.name, name);
      assert.equal(named[1].damage, Math.round((level >= S.bossFrom ? S.bossDamage : S.damage) * out.d.fighters[0].maxHealth), 'same share as every other special');
    });
  }
}
test('specials: an opponent with no set has no name, and the player never does', () => {
  assert.equal(specialOf('skeleton', 46), null);
  assert.equal(withSpecials(arena(OPPONENTS.veteran), 46, 'shove', undefined, 'tithe').fighters[0].specialName, undefined);
});

// Dom's final rule (2026-10-01, docs/briefs/specials/boss-special-balance-2026-10-01.md): one rule row for every special.
test('specials: 25 % of max health at ranks 8-10 (levels 36-50), 20 % at ranks 1-7 (levels 1-35)', () => {
  for (const level of [1, 5, 15, 25, 35, 36, 41, 46, 50]) {
    const d = withSpecials(arena(OPPONENTS.veteran), level, 'shove'), expect = level >= 36 ? .25 : .2;
    assert.equal(d.fighters[1].specialShare, expect, `level ${level}`);
    const cast = ready(level); cast.fighters[1].special = 1; const hit = stepDuel(cast, [idle(), idle()]), max = cast.fighters[0].maxHealth;
    assert.equal(hit.events.find(e => e.type === 'SpecialLanded')!.damage, Math.round(expect * max), `level ${level} lands its share`);
  }
});
test('specials: a hit in the windup, even a lethal one on the caster\'s foe-side, never stops it; the release can be the kill shot', () => {
  const d = ready(); d.fighters[1].health = Math.round(S.damage * d.fighters[1].maxHealth);   // one special from death
  let x = stepDuel(d, [act('skill'), idle()]); const cast0 = x.tick;
  const out = run(x, S.windup + 2, y => [idle(), y.fighters[0].phase === 'ready' && !y.fighters[1].special ? act('heavy') : idle()]);
  assert.ok(out.events.some(e => e.type === 'Hit' && e.actor === 1 && e.target === 0 && e.tick < cast0 + S.windup), "the foe's blow connected on the caster inside the windup (else this test proves nothing)");
  assert.ok(out.events.some(e => e.type === 'SpecialLanded' && e.actor === 0), 'the special landed through whatever the target threw');
  assert.equal(out.d.fighters[1].health, 0, 'the release killed him');
  assert.ok(out.events.some(e => e.type === 'Killed' && e.actor === 0 && e.target === 1));
});
test('specials: re-arms 20 s after the release (not the cast), and the first cast waits 20 s', () => {
  const d = ready(); d.fighters[0].maxHealth = d.fighters[0].health = 9999;
  let x = stepDuel(d, [act('skill'), idle()]);
  x = run(x, S.windup - 1, () => [idle(), idle()]).d;   // the release tick
  assert.equal(x.events.some(e => e.type === 'SpecialLanded'), true);
  assert.equal(x.fighters[0].skillCooldown, S.cooldown, 'the cooldown starts at the release');
  assert.equal(legal({ ...x.fighters[0], specialRecover: 0, phase: 'ready' }, 'skill'), false);
  x = run(x, S.cooldown, () => [idle(), idle()]).d;
  assert.equal(x.fighters[0].skillCooldown, 0);
  assert.equal(legal({ ...x.fighters[0], phase: 'ready', specialRecover: 0 }, 'skill'), true, 'ready again exactly S.cooldown ticks after the release');
});
test('specials: after the release the caster starts no attack for 45 ticks; guard, roll and steps stay legal', () => {
  assert.equal(S.recovery, 45);
  const d = ready(); d.fighters[1].special = 1; const landed = stepDuel(d, [idle(), idle()]), f = landed.fighters[1];
  assert.equal(f.specialRecover, S.recovery);
  const ok = { ...f, phase: 'ready' as const, stamina: 100 };
  for (const a of ['light', 'light_left', 'heavy', 'thrust', 'kick', 'skill'] as const) assert.equal(legal(ok, a), false, `${a} refused in the recovery`);
  for (const a of ['dodge', 'backstep'] as const) assert.equal(legal(ok, a), true, `${a} still allowed`);
  let x = landed, n = 0; while (!legal({ ...x.fighters[1], phase: 'ready', stamina: 100 }, 'heavy') && n < 100) { x = stepDuel(x, [idle(), idle()]); n++; }
  assert.equal(n, S.recovery, 'exactly 45 ticks of no attack');
});
test('specials: a caster mashing every attack starts none for 45 ticks after his release, then one starts', () => {
  const d = ready(36); d.fighters[1].special = 1;
  let x = stepDuel(d, [idle(), idle()]); const released = x.tick, started: number[] = [];
  for (const press of ['light', 'heavy', 'thrust', 'kick', 'skill'] as const) {
    x = stepDuel(d, [idle(), idle()]); started.length = 0;
    for (let i = 0; i < S.recovery + 2; i++) { x = stepDuel(x, [idle(), act(press)]); if (x.events.some(e => e.type === 'AttackStarted' && e.actor === 1)) started.push(x.tick - released); }
    assert.ok(started.length === 0 || started[0] > S.recovery, `${press}: first start at +${started[0]}, not inside the ${S.recovery}-tick recovery`);
    if (press !== 'skill') assert.ok(started.length > 0, `${press}: starts once the recovery ends`);
  }
});
