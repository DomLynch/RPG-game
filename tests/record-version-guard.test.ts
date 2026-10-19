// The kill-link guard (owner 2026-09-22, via Strategy): a shared link replays a recorded fight by stepping this build's sim over the
// recorded intents. If any sim-deciding file changes without RECORD_VERSION changing with it, every link minted before the change
// replays a different fight and dies mid-play — which is what the viewer page's "Recorded on an older build" freeze exists to catch
// after the fact. This test catches it before the merge: it hashes the CODE that decides how a fight plays (tests/lib/sim-digest.ts:
// the top-level statements of the sim files, comments and import paths left out, as one sorted list) and pins the digest next to the
// version. Change that code and this test fails; the fix is to bump RECORD_VERSION in src/fight/record.ts (old links are then refused cleanly
// at decode) and paste the digest the failure prints into SIM_DIGEST below. Moving code between sim files byte for byte (src/fight/,
// Release K) keeps the digest, so it keeps the version and every live link (Lead, 2026-10-09).
import './lib/era-off.ts';   // RV78: the legacy suite runs on trunk's rules; sandbox-era.ts is the one switch (tests/lib/era-off.ts)
import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { pathToFileURL } from 'node:url';
import { dirname, join } from 'node:path';
import { FINISHER_POSE, ROTATION, finisherSeconds, finisherRow } from '../src/fight/finishers.ts';
import { NO_PATRON_VERSION, PATRON_VERSION, READABLE_VERSIONS, REACH, RECORD_VERSION, createRecorder, packRecord, unpackRecord } from '../src/fight/record.ts';
import { DEFAULT_WEAPON, PLAYER_WEAPONS, PLAYER_WEAPONS_OFFERED, SKILL_BY_CODE, SKILL_ROWS, WEAPONS } from '../src/fight/moves.ts';
import { playScaleFor, setLateNotice, setPlayScale } from '../src/fight/play-radius.ts';
import { setStab } from '../src/fight/stab-rule.ts';
import { liveRecorder } from './lib/live-recorder.ts';
import { setSandbox } from '../src/fight/sandbox-era.ts';

// A throwaway copy of record.ts reads the era once at load (NO_PATRON_VERSION / PATRON_VERSION): load it the way the game does, era ON, then put the legacy pin back.
async function importEraOn(file: string): Promise<typeof import('../src/fight/record.ts')> {
  setSandbox(true);
  try { return await import(pathToFileURL(file).href) as typeof import('../src/fight/record.ts'); } finally { setSandbox(false); }
}
import { duplicateNames, simDigest } from './lib/sim-digest.ts';
import { DIALS, POINTS, SHEET_SKILLS } from '../src/fight/sheet-rows.ts';
import { RULES } from '../src/fight/rules.ts';
import { MOVES, PATHS } from '../src/fight/move-rows.ts';
import { GEAR } from '../src/fight/gear-rows.ts';
import { SPECIAL_SETS, SPECIAL_RANK_LEVELS } from '../src/fight/special-set-rows.ts';
import { LEVEL_ANCHORS } from '../src/fight/level-anchor-rows.ts';
import { DAMAGE_KINDS } from '../src/fight/damage-kinds.ts';
import { CC_LADDER } from '../src/fight/cc-ladder.ts';
import { SWARM_ROWS } from '../src/fight/roll.ts';
import type { OpponentId } from '../src/roster.ts';

// Every file whose content changes what a recorded fight does when it is stepped again: the duel rules, the move tables, the
// opponent AI, the fixed-step loop and the record codec itself. Presentation files are deliberately absent — a new sound or a
// different camera does not change the fight.
// The list is the runtime import closure of the sim, and the test below keeps it that way: until 2026-09-23 it named five files while
// duel.ts imported blade.ts and the baked blade tables, so a stale bake changed fights with this guard green.
const SIM_FILES = ['src/fight/sandbox-rules-defs.json', 'src/fight/sandbox-rules-defs.manifest.json', 'src/fight/sandbox-rules.ts', 'src/fight/ai-dial-defs.json', 'src/fight/ai-dial-defs.manifest.json', 'src/fight/ai-dial-rows.ts', 'src/fight/sim-bounds-defs.json', 'src/fight/sim-bounds-defs.manifest.json', 'src/fight/sim-bounds-rows.ts', 'src/fight/spell-hit-defs.json', 'src/fight/spell-slot-defs.json', 'src/fight/spell-slot-defs.manifest.json', 'src/fight/bands.ts', 'src/fight/archetype-rows.ts', 'src/fight/ai-read-rows.ts', 'src/fight/tactic-rows.ts', 'src/fight/moves-tables-rows.ts', 'src/fight/stance-legacy-rows.ts', 'src/fight/roll-rows.ts', 'src/fight/gambit-rows.ts', 'src/fight/duel-rows.ts', 'src/fight/spell-rows.ts', 'src/fight/moves-dials-rows.ts', 'src/fight/play-radius-rows.ts', 'src/fight/level-anchor-rows.ts', 'src/fight/special-set-rows.ts', 'src/fight/cast-penalty-era.ts', 'src/fight/move-rows.ts', 'src/fight/rules.ts', 'src/fight/cone-era.ts', 'src/fight/sandbox-era.ts', 'src/fight/cone-rules.ts', 'src/fight/cone-defs.json', 'src/fight/poise-era.ts', 'src/fight/poise-ladder.ts', 'src/fight/poise-ladder-defs.json', 'src/fight/duel.ts', 'src/fight/spell-cast.ts', 'src/fight/spell-index.json', 'src/fight/cast-rules.json', 'src/fight/brick-defs.json', 'src/fight/school-defs.json', 'src/fight/cc-ladder.ts', 'src/fight/pools.ts', 'src/fight/pool-defs.json', 'src/fight/moves.ts', 'src/fight/ai.ts', 'src/fight/sim.ts', 'src/fight/record.ts', 'src/fight/blade.ts', 'src/fight/blade-paths.ts', 'src/roster.ts', 'src/fight/catalogue-data.ts', 'src/fight/catalogue-defs.ts', 'src/fight/finishers.ts', 'src/fight/detmath.ts', 'src/fight/play-radius.ts', 'src/fight/stab-rule.ts', 'src/fight/roll.ts', 'src/fight/gambit.ts', 'src/fight/stance.ts', 'src/fight/stance-era.ts', 'src/fight/stance-defs.json', 'src/fight/gear-defs.json', 'src/fight/boss-phase-defs.json', 'src/fight/rows79-defs.json', 'src/fight/rows79-defs.manifest.json', 'src/fight/rows80-defs.json', 'src/fight/rows80-defs.manifest.json', 'src/fight/rows80.ts'];   // detmath.ts: the sim's own math (2026-09-29); play-radius.ts: the play circle (2026-10-06); stab-rule.ts: the Goblin's stab switch (2026-10-07)
const SIM_DIGEST = '53aff10d10c54c378f1b0a23bbd5cf073c473ff38283d3d1889c76f50b8cb41a';   // RV81 (2026-10-19, Combat): a stance fight stamps the live era (record.ts); re-pinned on release-K5d, whose RV80 carries the level-1 warden's later first special (rows80 foeOpeners). // RV80 (2026-10-19, Combat, Dom "turn it on, migrate fully from the sandboxes"): the leathers' shape (gear-defs.json era 80) and the special timers (rows80-defs.json) era-keyed by rows80For; was 76ef1f5b... at RV79 //   // RV79 sandbox rows (2026-10-19, Combat: stances pure 2x with the feint cap as its own row, Arena 1 circle 0.468, plate shape era 79, reach bands live, plainPosture, heavyHold 220; Dom-approved 2026-10-18; RV79 not yet shipped), was 5f5dde88... at RV78 // RV78 BULK-CS (2026-10-19, Combat: the combat sandbox's rules as one era switch, sandbox-era.ts; RV78 was never shipped, so the pin moves, not the version), was d561dd0c... at RV77 // RV77 melee specials + reach (2026-10-18, Combat, sandbox port slice (d): windup, react, reach; RV77 was never shipped, so the pin moves, not the version), was b2141cd2... after (e) alone, 7348b980... at RV76 // RV76 troll-only (2026-10-18, Combat, Strategy's ruling: goblin rows back to trunk, REACH[76] = cave-troll), was e484f459... with the goblin rows // RV76 (2026-10-17, Combat, balance rows: the Cave Troll and Goblin archetype rows, reachStamp, the reader's minimum-length check), was f10e11960410... at RV75 //RV75 (2026-10-17, Combat, the sim batch + SPECIAL 2 (duel.ts Fighter.skill2, record.ts flag2 bit 1) rebased on IC ad1a13adc, final pin of the stack: ai.ts exports lcg / seedUnit, the motion rows are fractions and radians, the record flag masks are named; packRecord also accepts SHEET_ERA_VERSION, because a sheet fight stamps the era floor (74) while RV is 75 until #3051 raises the era: sim-bounds-defs.json + ai-dial-defs.json rows replace inline numbers in ai / blade / sim / moves / spell-cast / gear-caps / cc-ladder / combat / world / record with identical values; the Pit's fights are byte for byte what they were), was 7efe2940b2c7 at RV74 (2026-10-17, Combat, the leathers set's era: gear-defs.json sets eras + cast-penalty-era.ts + gear-rows.ts), was 62e11632... at RV73 // RV73 (2026-10-16, Combat many-on-one: Duel.crowd + swarm-defs slots + the world hero's retarget; digest read from a clean VPS clone), was 11ca84f7... at RV69-72   // RV69 (2026-10-16, Combat spell combat slice 1, provisional): spell-hit-defs.json rows, Spell.hits, the volley in duel.ts, hitsFrom in cast-rules.json, the NO_PATRON/PATRON ceilings moved to <= 69 (was 0ff22541c9be8408bb8e064b548c1c4352e9a5aca3d866be1f03999ff8fcda92 before them); was 9fa788125eb95e50060d62e56b1085b3f204ca6d2b9c54e07225a3511ac94231 (RV65-68) --  // RV65 (2026-10-15, Combat positioning bands, provisional, on GJ); was RV64 (spell cost cap, GJ) --  // RV64 (2026-10-15, Combat positioning bands, provisional); was RV63 --    // RV63 (2026-10-14, Combat, Gothic tactic table PR 1): the tactic rows loader and the reaction slot's branch, no profile names a row. Before: RV62 (2026-10-14, Combat sim batch B): FAR_M / MAX_ATTACKERS as world-rules rows, stance HOME read from the catalogue; the same numbers. Before: RV61 (2026-10-14, Combat sim batch A): sim numbers, AI/stance tables and the archetypes as rows, same numbers
// RV49 digest was f6dcaadacd5394769ebf187ccb7fcdddaf01025f4986627b2ce2141a83e8d26d (Combat A, damage kinds).   // RV48 (2026-10-12, Combat, Wave A1 PR1, provisional): gear counts in a fight (THE SHEET: Fighter.sheet, the player's ten dials on their 0-100 lines (the re-lock, 2026-10-13: base 0, a dial at 100 is twice a normal fighter) from the rows of sheet-defs.json, read in stepDuel as damage dealt (attack), damage taken (armour), the health bar, posture taken (poise) and stamina regeneration (recovery); duel.ts withSheet, geared; the point pools, dial and skill rows hashed as resolved/sheet.json); a fight with no gear is unchanged, REACH[48] empty. Chains from RV47 84b80301... RV47 (2026-10-12, Combat, provisional): weapon name switches as row fields (default/natural/look on the weapon rows, DEFAULT_WEAPON for the 'longsword' defaults; the resolved weapon table plus the default weapon is what the digest hashes); same fights, REACH[47] empty. Chains from RV45 bb2d6305... (46 is Combat B's finishers). RV45 (2026-10-12, Combat): skills as data (skill-defs.json through skills.ts; the skills reach the digest as their sim projection in record-byte order, name/clip/tint/fx are presentation; moves.ts, record.ts, duel.ts and ai.ts now read the rows); same fights, REACH[45] empty. Chains from RV44 c7dac03b... (weapons as data). RV44 (2026-10-12, Combat): the weapon table is hashed as its resolved output (LOADER_ONLY: registry.ts, weapons.ts, the rows and manifests), pools and weapons load through the shared loadRegistry; same fights, RV44 not bumped again: unmerged. Before that: weapons as data (weapon-defs.json + weapons.ts, byte-identical resolved table, sha256 pinned in tests/weapon-defs.test.ts). RV43 was (2026-10-12, Combat): resource pools as an open registry (pools.ts + pool-defs.ts, createFighter reads a row's pools); every default is what it always used, so no fight moves (REACH[43] empty). Chains from RV42 c95e1f2c... (the projection digest, #2269)
const PINNED_FOR_VERSION = 81;

// The weapon table is hashed as what the loader RETURNS (Lead, 2026-10-12, as the catalogue and the pools are): the canonical JSON of the 11 resolved Weapon objects, their order and both player lists. The loader
// (weapons.ts), the shared registry (src/core/registry.ts), the rows and the manifests are LOADER_ONLY: a refactor of them that resolves to the same table moves nothing, a change that alters a resolved value moves the digest.
const LOADER_ONLY = ['src/fight/band-defs.json', 'src/fight/band-defs.manifest.json', 'src/fight/archetype-defs.json', 'src/fight/archetype-defs.manifest.json', 'src/fight/ai-read-defs.json', 'src/fight/moves-tables-defs.json', 'src/fight/stance-legacy-defs.json', 'src/fight/ai-read-defs.manifest.json', 'src/fight/tactic-defs.json', 'src/fight/tactic-defs.manifest.json', 'src/fight/moves-tables-defs.manifest.json', 'src/fight/stance-legacy-defs.manifest.json', 'src/fight/roll-defs.json', 'src/fight/gambit-defs.json', 'src/fight/duel-defs.json', 'src/fight/spell-list-defs.json', 'src/fight/spell-list-defs.manifest.json', 'src/fight/spell-list-defs.json', 'src/fight/spell-list-defs.manifest.json', 'src/fight/moves-dials-defs.json', 'src/fight/play-radius-defs.json', 'src/fight/roll-defs.manifest.json', 'src/fight/gambit-defs.manifest.json', 'src/fight/duel-defs.manifest.json', 'src/fight/moves-dials-defs.manifest.json', 'src/fight/play-radius-defs.manifest.json', 'src/fight/level-anchor-defs.json', 'src/fight/level-anchor-defs.manifest.json', 'src/fight/special-set-defs.json', 'src/fight/special-set-defs.manifest.json', 'src/fight/armour-weights.json', 'src/fight/gear-defs.json','src/fight/armour-weights.manifest.json', 'src/fight/move-defs.json', 'src/fight/move-defs.manifest.json', 'src/fight/rules-defs.json', 'src/fight/rules-defs.manifest.json', 'src/fight/cone-defs.manifest.json', 'src/fight/poise-ladder-defs.manifest.json', 'src/fight/cast-rules.manifest.json', 'src/fight/spell-hit-defs.manifest.json', 'src/fight/brick-defs.manifest.json', 'src/fight/school-defs.manifest.json', 'src/fight/stance-defs.manifest.json', 'src/fight/cc-defs.json', 'src/fight/cc-defs.manifest.json', 'src/fight/swarm-defs.json', 'src/fight/swarm-defs.manifest.json', 'src/fight/damage-kinds.ts', 'src/fight/damage-kind-defs.json', 'src/fight/damage-kind-defs.manifest.json', 'src/fight/sheet-rows.ts', 'src/fight/sheet-defs.json', 'src/fight/sheet-defs.manifest.json', 'src/fight/skills.ts', 'src/fight/skill-defs.json', 'src/fight/skill-defs.manifest.json', 'src/core/registry.ts', 'src/fight/weapons.ts', 'src/fight/weapon-defs.json', 'src/fight/pool-defs.manifest.json', 'src/fight/weapon-defs.manifest.json', 'src/fight/finisher-rows.ts', 'src/fight/finisher-defs.json', 'src/fight/finisher-defs.manifest.json'];
const canon = (v: unknown): unknown => Array.isArray(v) ? v.map(canon) : v && typeof v === 'object' ? Object.fromEntries(Object.keys(v).sort().map((k) => [k, canon((v as Record<string, unknown>)[k])])) : v;
const resolvedWeapons = (): string => JSON.stringify(canon({ weapons: WEAPONS, order: Object.keys(WEAPONS), player: PLAYER_WEAPONS, offered: PLAYER_WEAPONS_OFFERED, default: DEFAULT_WEAPON }));
// The skills reach the digest as their SIM projection (id, code, move, opponent, dayOne, tell, in record-byte order); name, clip, impactTint and fx are presentation and move no fight.
const resolvedSkills = (): string => JSON.stringify(SKILL_BY_CODE.map((id) => (id === null ? null : (({ code, move, opponent, dayOne, tell }) => ({ id, code, move, opponent, dayOne: !!dayOne, tell: !!tell }))(SKILL_ROWS[id]!))));
// The finisher table is hashed as what the loader RETURNS (Lead, 2026-10-12, as the catalogue is): the canonical JSON of the rotation order and, per row in
// order, its id, template and resolved duration. The loader (finisher-rows.ts), the shared registry (src/core/registry.ts), the rows and the manifest are
// LOADER_ONLY: a refactor of them, or a cosmetic field (a pose, a label, a camera number), that resolves to the same projection moves nothing; a change to a
// resolved sim value moves the digest.
const resolvedFinishers = (): string => JSON.stringify(canon({ rotation: ROTATION, rows: Object.keys(FINISHER_POSE).map((id) => ({ id, template: finisherRow(id)!.template, ...finisherSeconds(id) })) }));
const simSources = (): Record<string, string> => ({ ...Object.fromEntries(SIM_FILES.map((file) => [file, readFileSync(new URL(`../${file}`, import.meta.url), 'utf8')])), 'resolved/weapons.json': resolvedWeapons(), 'resolved/skills.json': resolvedSkills(), 'resolved/finishers.json': resolvedFinishers(), 'resolved/rules.json': JSON.stringify(canon(RULES)), 'resolved/moves.json': JSON.stringify(canon({ MOVES, PATHS })), 'resolved/armour-weights.json': JSON.stringify(canon(GEAR.weights)), 'resolved/special-sets.json': JSON.stringify(canon({ SPECIAL_SETS, SPECIAL_RANK_LEVELS })), 'resolved/level-anchors.json': JSON.stringify(canon(LEVEL_ANCHORS)), 'resolved/sheet.json': JSON.stringify({ points: POINTS, dials: DIALS, skills: SHEET_SKILLS }), 'resolved/damage-kinds.json': JSON.stringify(canon(DAMAGE_KINDS)), 'resolved/cc.json': JSON.stringify(canon(CC_LADDER)), 'resolved/swarm.json': JSON.stringify(canon(SWARM_ROWS)) });

test('a sim change without a RECORD_VERSION bump would break every live kill link', () => {
  const digest = simDigest(simSources());
  assert.ok(RECORD_VERSION >= PINNED_FOR_VERSION, 'RECORD_VERSION went backwards');
  assert.ok(digest === SIM_DIGEST ? RECORD_VERSION === PINNED_FOR_VERSION : RECORD_VERSION > PINNED_FOR_VERSION,
    `The sim files changed (digest ${digest}) but RECORD_VERSION is still ${RECORD_VERSION}. Bump RECORD_VERSION in src/fight/record.ts so older links are refused at decode instead of replaying a different fight, then set SIM_DIGEST = '${digest}' and PINNED_FOR_VERSION = ${RECORD_VERSION + 1} here.`);
});

// The digest follows the code, not where it lives (Lead, 2026-10-09: Release K moves sim code into src/fight/ unchanged). Each case below starts
// from the real sim sources, so it proves the property on this build's own files and not on a toy.
test('the digest is sound only while every top-level name lives in one sim file', () => {
  assert.deepEqual(duplicateNames(simSources()), [], 'a top-level name is declared in two sim files: a moved function could then bind the other one with the digest unchanged; rename one');
});
test('moving a function between sim files byte for byte (or a file split) keeps the digest, so it keeps RECORD_VERSION', () => {
  const real = simSources(), before = simDigest(real);
  const fn = /^export function walled[\s\S]*?\n\}\n|^export const walled = [^\n]*\n/m.exec(real['src/fight/duel.ts']!)?.[0];
  assert.ok(fn, 'the probe moves duel.ts walled(): it must exist');
  const moved = { ...real, 'src/fight/duel.ts': real['src/fight/duel.ts']!.replace(fn, "import { walled } from './fight/walls.ts';\nexport { walled } from './fight/walls.ts';\n"), 'src/fight/walls.ts': `import { RULES } from '../moves.ts';\n// moved, unchanged\n${fn}` };
  assert.notEqual(moved['src/fight/duel.ts'], real['src/fight/duel.ts']);
  assert.equal(simDigest(moved), before, 'a byte-identical move changed the digest: it would force a bump and kill every live link for nothing');
  assert.deepEqual(duplicateNames(moved), []);
  const renamed = Object.fromEntries(Object.entries(real).map(([p, src]) => [p.replace('src/', 'src/fight/'), src]));
  assert.equal(simDigest(renamed), before, 'renaming every sim file keeps the digest');
});
test('any real change still moves the digest (a constant, a number in a body, an aliased import, a data file); a comment does not', () => {
  const real = simSources(), before = simDigest(real), edit = (path: string, from: RegExp, to: string) => { const src = real[path]!.replace(from, to); assert.notEqual(src, real[path], `the probe edit applies to ${path}`); return simDigest({ ...real, [path]: src }); };
  assert.notEqual(edit('src/fight/play-radius.ts', /FIRST_SCALED_VERSION = 23/, 'FIRST_SCALED_VERSION = 24'), before, 'a sim constant changed and the digest did not');
  assert.notEqual(edit('src/fight/duel.ts', /stall: Math\.max\(0, f\.stall - 1\)/, 'stall: Math.max(0, f.stall - 2)'), before, 'a number inside a function body changed and the digest did not');
  assert.notEqual(simDigest({ ...real, 'src/fight/ai.ts': real['src/fight/ai.ts']!.replace(/import \{ aim,/, 'import { aim as aimOther, aim,') }), before, 'an aliased import is a rebinding: it must count');
  assert.notEqual(edit('src/fight/spell-slot-defs.json', /"id":"sharedCooldown","value":0/, '"id":"sharedCooldown","value":1'), before, 'sharedCooldown decides when slot b can fire: editing it must move the digest');
  assert.notEqual(edit('src/fight/spell-slot-defs.json', /"id":"allowDuplicate","value":0/, '"id":"allowDuplicate","value":1'), before, 'allowDuplicate decides which world records are accepted: editing it must move the digest');
  assert.notEqual(simDigest({ ...real, 'src/blade-table.json': '{"a":1}' }), simDigest({ ...real, 'src/blade-table.json': '{"a":2}' }), 'a data file is hashed by its bytes');
  assert.equal(edit('src/fight/sim.ts', /\/\/ World coordinates only\./, '// World coordinates only, reworded.'), before, 'a comment is not the fight');
  assert.deepEqual(duplicateNames({ ...real, 'src/fight/stance.ts': `${real['src/fight/stance.ts']}\nexport const walled = 1;\n` }), ['walled: src/fight/duel.ts, src/fight/stance.ts'], 'a second declaration of a sim name is reported');
});

// The accept-list, pinned as data beside the digest above and for the same reason: which versions this build will READ is a decision
// someone makes, not a value that drifts. The server reads this same list — scripts/verify-daily.mjs imports `decodeRecord` from
// src/fight/record.ts and deploy.sh rsyncs src/**/*.ts to the verifier host — so widening it here widens it there, in one deploy, and a
// second copy on the server can never quietly disagree with this one.
test('the decoder accept-list is what someone pinned, and this build can read what it writes', () => {
  assert.deepEqual([...READABLE_VERSIONS], [18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 29, 30, 31, 32, 33, 34, 35, 36, 37, 38, 39, 40, 41, 42, 43, 44, 45, 46, 47, 48, 49, 50, 51, 52, 53, 54, 55, 56, 57, 58, 59, 60, 61, 62, 63, 64, 65, 66, 67, 68, 69, 70, 71, 72, 73, 74, 75, 76, 77, 78, 79, 80, 81], 'READABLE_VERSIONS changed: widen it deliberately (a record on an accepted version must still decode to the fight it recorded), then re-pin here.');
  assert.deepEqual(REACH, { 19: [{ opponent: 'veteran', from: 6 }], 20: [{ opponent: 'plaguedoctor', from: 1 }], 21: [], 22: [], 23: [], 24: [], 25: [], 26: [], 27: [], 28: [], 29: ['veteran', 'pitborn', 'goblin', 'nightborn', 'executioner', 'minotaur', 'wraith', 'werewolf', 'skeleton', 'dwarf', 'plaguedoctor', 'knight', 'witch', 'shieldmaiden'].map((opponent) => ({ opponent, from: 1 })), 30: ['shieldmaiden', 'knight', 'plaguedoctor'].map((opponent) => ({ opponent, from: 1 })), 31: ['veteran', 'pitborn', 'dwarf', 'knight', 'shieldmaiden'].map((opponent) => ({ opponent, from: 1 })), 32: [], 33: [], 34: [], 35: [], 36: [], 37: [], 38: [], 40: [], 39: [], 41: [], 42: [], 43: [], 44: [], 45: [], 46: [], 47: [], 48: [], 49: [], 50: [], 51: [], 52: [], 53: [], 54: [], 55: [], 56: [], 57: [], 58: [], 59: [], 60: [], 61: [], 62: [], 63: [], 64: [], 65: [], 66: [], 67: [], 68: [], 69: [], 70: [], 71: [], 72: [{ opponent: 'cave-troll', from: 2 }], 73: [], 74: [], 75: [], 76: [{ opponent: 'cave-troll', from: 1 }], 77: [], 78: [], 79: [], 80: [], 81: [] },'REACH is what each bump changed (19: the Centurion from level 6; 20: the Plague Doctor; 21: nothing, Special Moves ride the record\'s own flag; 24: nothing, late notice is keyed on the record\'s version): history, not tuning. A new bump appends its own line.');
  for (let v = READABLE_VERSIONS[0] + 1; v <= RECORD_VERSION; v++) assert.ok(REACH[v], `bump ${v} is read across but declares no reach`);
  assert.ok((READABLE_VERSIONS as readonly number[]).includes(RECORD_VERSION), `This build writes version ${RECORD_VERSION} but does not accept it back: a fight it recorded would be refused at decode.`);
});

// SIM_FILES must be closed under runtime imports (Lead, 2026-09-23). The hand-kept list above once named five files while duel.ts
// imported blade.ts, which imported the baked blade tables, so a rebake changed how fights stepped and this guard stayed green. The
// knife and scythe recovery flips (4 -> 5) shipped exactly that way, with stale tables. This walks every value import out of the listed
// files (an `import type` is erased at runtime and cannot change a fight) and fails on any file the digest does not hash.
const VALUE_IMPORT = /^\s*(?:import|export)\s+(?!type\b)[^'"]*?\bfrom\s+['"](\.[^'"]+)['"]|^\s*import\s+['"](\.[^'"]+)['"]/gm;
test('SIM_FILES is every file a recorded fight imports at runtime', () => {
  const seen = new Set<string>(), queue = [...SIM_FILES];
  while (queue.length) {
    const file = queue.shift()!; if (seen.has(file)) continue; seen.add(file);
    for (const m of readFileSync(new URL(`../${file}`, import.meta.url), 'utf8').matchAll(VALUE_IMPORT)) queue.push(join(dirname(file), m[1] ?? m[2]!));
  }
  assert.deepEqual([...seen].filter(f => !SIM_FILES.includes(f) && !LOADER_ONLY.includes(f)), [], 'a file the sim imports is missing from SIM_FILES: add it, bump RECORD_VERSION and re-pin');
});
test('the closure walk skips type-only imports and follows every value form', () => {
  const src = "import { a } from './duel.ts';\nimport type { B } from './moves.ts';\nexport { c } from './blade.ts';\nexport type { D } from './hud.ts';\nimport './side.ts';\nimport * as T from 'three';\n";
  assert.deepEqual([...src.matchAll(VALUE_IMPORT)].map(m => m[1] ?? m[2]), ['./duel.ts', './blade.ts', './side.ts']);
});

// The widening's other half (2026-09-28, the standing rule): an older record decodes only where no later bump reached its fight, and a
// reached one is refused with a message the page converts (main.ts matches 'Fight record: version').
// Mutation receipts (the PRs): dropping the reach loop in unpackRecord, or turning `>=` into `>`, fails this test.
test('an older record decodes only where no later bump reached its fight', () => {
  // A pre-21 header has no specials byte (it follows the skill byte, after the three strings): drop it, then stamp the old version.
  const at = (v: number, opponent: OpponentId, level: number) => { const full = packRecord(liveRecorder({ build: 'x', opponent, weapon: 'longsword', level, seed: 5 }).finish('abandoned')); let o = 3; for (let k = 0; k < 3; k++) o += 1 + full[o]; const p = full[2] >= 53 ? new Uint8Array([...full.subarray(0, o + 3), ...full.subarray(o + 5)]) : full; const b = v >= 26 ? new Uint8Array(p) : v >= 21 ? new Uint8Array([...p.subarray(0, o + 2), ...p.subarray(o + 3)]) : new Uint8Array([...p.subarray(0, o + 1), ...p.subarray(o + 3)]); b[2] = v; return b; };   // the skill byte, then the specials byte (v21 on) and the arena byte (v26 on): an older stamp drops the ones it has no field for
  for (const [v, opponent, level] of [[31, 'goblin', 18], [31, 'witch', 10], [31, 'plaguedoctor', 46], [31, 'knight', 1], [30, 'goblin', 18], [30, 'witch', 10], [30, 'plaguedoctor', 46], [29, 'goblin', 18], [29, 'witch', 10], [29, 'skeleton', 18]] as const)
    assert.equal(unpackRecord(at(v, opponent, level)).v, v, `a v${v} ${opponent} L${level} fight is this build's own, so its link must keep working`);
  for (const [v, opponent, level] of [[31, 'cave-troll', 3], [28, 'goblin', 1], [27, 'veteran', 46], [26, 'witch', 10], [19, 'plaguedoctor', 1], [18, 'veteran', 6], [18, 'knight', 18], [29, 'knight', 1], [29, 'shieldmaiden', 46], [29, 'plaguedoctor', 10], [30, 'knight', 1], [30, 'veteran', 18], [30, 'pitborn', 46], [30, 'dwarf', 6], [30, 'shieldmaiden', 12], [29, 'veteran', 5], [29, 'dwarf', 46]] as const)
    assert.throws(() => unpackRecord(at(v, opponent, level)), new RegExp(`^Error: Fight record: version ${v} is not supported for the ${opponent} from level \\d+ \\(bump \\d+ changed`), `a v${v} ${opponent} L${level} record replays a fight the RV29 rule batch changed`);
  assert.throws(() => unpackRecord(at(17, 'goblin', 18)), /version 17 is not supported/, 'v17 is outside the window');
});

// The patron rule must survive the NEXT fight-logic bump (the Auditor's RV33 probe, 2026-10-07): a throwaway copy of src/fight/record.ts with the ceiling at 33 (imports pointed back
// at the real src/ and src/fight/, so the one sim and the one set of era flags). Today the ceiling is 33 (RV33/RV34 stamp only a Gambit / stances fight; a patron-less fight writes 31, a patron fight 32); at 35 every
// live fight stamps the ceiling again (a patron byte of 0 for a patron-less one), the build must read its own fresh links, and only v32 refuses a zero patron.
test('RV43 simulated: a patron-less fight stamps the new ceiling and round-trips; a patron fight too; a v32 record with no patron is still refused', async () => {
  assert.equal(NO_PATRON_VERSION, 31); assert.equal(PATRON_VERSION, 32);   // this file runs era-off (the legacy stamps); the game, era ON, stamps RECORD_VERSION for both
  const src = readFileSync(new URL('../src/fight/record.ts', import.meta.url), 'utf8').replace(/from '\.\.\//g, `from '${new URL('../src/', import.meta.url).href}`).replace(/from '\.\//g, `from '${new URL('../src/fight/', import.meta.url).href}`);
  const bumped = src.replace('export const RECORD_VERSION = 81;', 'export const RECORD_VERSION = 82;').replace('80, 81] as const', '80, 81, 82] as const').replace("  81: [],", "  82: [],\n  81: [],");
  assert.notEqual(bumped, src); assert.ok(bumped.includes('RECORD_VERSION = 82') && bumped.includes('81, 82] as const') && bumped.includes('82: [],'), 'the probe edits applied');
  const dir = mkdtempSync(join(tmpdir(), 'rv33-'));
  try {
    const file = join(dir, 'record33.ts'); writeFileSync(file, bumped);
    const m = await importEraOn(file);
    assert.equal(m.RECORD_VERSION, 82); assert.equal(m.NO_PATRON_VERSION, 82); assert.equal(m.PATRON_VERSION, 82);
    setPlayScale(playScaleFor('goblin', 43)); setLateNotice(true); setStab(true);
    const fightOf = (patron?: number) => {
      const rec = m.createRecorder({ weapon: 'longsword', build: 'abc1234', opponent: 'goblin', level: 12, seed: 7, ...(patron ? { patron } : {}) });
      for (let i = 0; i < 20; i++) rec.push({ move: { x: 0, z: 0, yaw: 0, run: false }, action: null, guard: false, lock: true });
      return rec.finish('draw');
    };
    const none = fightOf(), withPatron = fightOf(5);
    assert.equal(none.v, 82, 'a live patron-less fight stamps this build, so the build reads its own fresh link');
    assert.equal(m.packRecord(none)[2], 82);
    assert.deepEqual(m.unpackRecord(m.packRecord(none)), none, 'a v38 record with patron byte 0 round-trips with no patron');
    assert.equal(withPatron.v, 82); assert.deepEqual(m.unpackRecord(m.packRecord(withPatron)), withPatron);
    for (const opponent of ['cave-troll'] as const) {   // RV76's reach (cave-troll): at a ceiling bump a fight against it must still pack and round-trip
      setPlayScale(playScaleFor(opponent, 43));
      const rec = m.createRecorder({ weapon: 'longsword', build: 'abc1234', opponent, level: 3, seed: 7 });
      for (let i = 0; i < 20; i++) rec.push({ move: { x: 0, z: 0, yaw: 0, run: false }, action: null, guard: false, lock: true });
      const f = rec.finish('draw');
      assert.equal(f.v, 82, `a ${opponent} fight stamps the new ceiling`); assert.deepEqual(m.unpackRecord(m.packRecord(f)), f, `a ${opponent} fight packs and round-trips at the next bump`);
    }
    const v32 = m.packRecord(withPatron).slice(); v32[2] = 32;
    const at = v32.length - 6 * 20 - 4 - 4 - 1 - 1 - 1 - 1; assert.equal(v32[at], 5); v32[at] = 0;   // v53 adds the second flag byte, one more from the end
    assert.throws(() => m.unpackRecord(v32), /names a patron/, 'a v32 record with no patron is refused: it was always written as v31');
  } finally { rmSync(dir, { recursive: true, force: true }); setLateNotice(false); setStab(false); setPlayScale(1); }
  void createRecorder;
});

// The REAL bump recipe at RV80 (Lead, 2026-10-17): the `<= 77` thresholds move to `<= 80` with the version, so a plain fight stays the v31 it always was, while a cave-troll fight (REACH[76]) is stamped 76 by reachStamp
// and must still PACK and round-trip: packRecord accepts the reach stamp, not only the current version.
test('RV80 simulated with the real recipe (thresholds move too): a cave-troll fight packs at v76 and round-trips; a plain fight (the goblin, the veteran) is still v31', async () => {
  const src = readFileSync(new URL('../src/fight/record.ts', import.meta.url), 'utf8').replace(/from '\.\.\//g, `from '${new URL('../src/', import.meta.url).href}`).replace(/from '\.\//g, `from '${new URL('../src/fight/', import.meta.url).href}`);
  const bumped = src.replaceAll('(RECORD_VERSION as number) <= 77', '(RECORD_VERSION as number) <= 82').replace('export const RECORD_VERSION = 81;', 'export const RECORD_VERSION = 82;').replace('80, 81] as const', '80, 81, 82] as const').replace("  81: [],", "  82: [],\n  81: [],");
  assert.ok(bumped.includes('RECORD_VERSION = 82') && bumped.includes('<= 82 ? 31') && bumped.includes('82: [],'), 'the probe edits applied');
  const dir = mkdtempSync(join(tmpdir(), 'rv80-'));
  try {
    const file = join(dir, 'record80.ts'); writeFileSync(file, bumped);
    const m = await importEraOn(file);
    assert.equal(m.RECORD_VERSION, 82); assert.equal(m.NO_PATRON_VERSION, 31);
    const fight = (opponent: OpponentId, level: number) => { setPlayScale(playScaleFor(opponent, 43)); setLateNotice(true); setStab(true); const rec = m.createRecorder({ weapon: 'longsword', build: 'abc1234', opponent, level, seed: 7 }); for (let i = 0; i < 20; i++) rec.push({ move: { x: 0, z: 0, yaw: 0, run: false }, action: null, guard: false, lock: true }); return rec.finish('draw'); };
    for (const [opponent, level] of [['cave-troll', 3]] as const) { const f = fight(opponent, level); assert.equal(f.v, 76, `${opponent}: stamped at the reaching bump`); assert.deepEqual(m.unpackRecord(m.packRecord(f)), f, `${opponent}: packs and round-trips at RV77`); }
    for (const [opponent, level] of [['veteran', 18], ['goblin', 6]] as const) { const plain = fight(opponent, level); assert.equal(plain.v, 31, `${opponent} is not reached by RV76: still v31`); assert.deepEqual(m.unpackRecord(m.packRecord(plain)), plain); }
  } finally { rmSync(dir, { recursive: true, force: true }); setLateNotice(false); setStab(false); setPlayScale(1); }
});

// RV76 (balance): a live fight against an opponent the bump REACHED is stamped at that bump (reachStamp), and a plain v76 record (no patron, no flag) must round-trip; a fight against an unreached opponent stays the no-patron v31, unaffected.
test('a live cave-troll fight is a plain v76 record that round-trips; a live goblin or veteran fight is still the v31 it always was', () => {
  const fight = (opponent: OpponentId, level: number) => { const rec = liveRecorder({ build: 'abc1234', opponent, weapon: 'longsword', level, seed: 3 }); for (let i = 0; i < 20; i++) rec.push({ move: { x: 0, z: 0, yaw: 0, run: false }, action: null, guard: false, lock: true }); return rec.finish('draw'); };
  try {
    for (const [opponent, level] of [['cave-troll', 1], ['cave-troll', 3], ['cave-troll', 46]] as const) { const r = fight(opponent, level); assert.equal(r.v, 76, `${opponent} L${level} is stamped at the reaching bump`); assert.deepEqual(unpackRecord(packRecord(r)), r, `${opponent} L${level}: a plain v76 record round-trips`); }
    const veteran = fight('veteran', 18); assert.equal(veteran.v, NO_PATRON_VERSION); assert.equal(packRecord(veteran)[2], 31, 'an unreached fight is still written as v31'); assert.deepEqual(unpackRecord(packRecord(veteran)), veteran);
  } finally { setLateNotice(false); setStab(false); setPlayScale(1); }
});

// The catalogue rows reach the digest as their SIM PROJECTION (tests/lib/sim-digest.ts), so a cosmetic row edit needs no RECORD_VERSION bump, and a sim edit still does (Lead, 2026-10-12).
test('catalogue digest: a cosmetic row edit (name, voice, look, ranks, a brand-new cosmetic field) leaves it alone; a sim edit (weapon, rig, archetype, finishers, hold, a new roster row) moves it', () => {
  const real = simSources(), before = simDigest(real), path = 'src/fight/catalogue-data.ts', src = real[path]!;
  const edit = (from: RegExp, to: string, all = false) => { const out = src.replace(all ? new RegExp(from.source, 'g') : from, to); assert.notEqual(out, src, `the probe edit applies: ${from}`); return simDigest({ ...real, [path]: out }); };
  assert.equal(edit(/name: "the Centurion"/, 'name: "the Legate"'), before, 'a rename is not the fight');
  assert.equal(edit(/voice: null,/, 'voice: "changed",'), before, 'a voice is not the fight');
  assert.equal(edit(/ranks: \[/, 'ranks: [{ rank: 0, legend: "x" },'), before, 'ranks are not the fight');
  assert.equal(edit(/ladder: \{ order: 1,/, 'ladder: { order: 9,'), before, 'the ladder order is not a replayed fight');
  assert.equal(edit(/\{ id: "veteran", name:/, '{ id: "veteran", futureCosmetic: { anything: [1, 2] }, name:'), before, 'a field nobody listed is left out automatically');
  assert.notEqual(edit(/weapon: "trident"/, 'weapon: "cleaver"'), before, 'a weapon is the fight');
  assert.notEqual(edit(/rig: "hero"/, 'rig: "goblin"'), before, 'the rig picks the blade table');
  assert.notEqual(edit(/archetype: "veteran"/, 'archetype: "pitborn"'), before, 'the archetype is the combat tuning');
  assert.notEqual(edit(/stats: \{ archetype: "veteran",/, 'stats: { pools: { stamina: 120 }, archetype: "veteran",'), before, 'a pool is the fight');
  assert.notEqual(edit(/ladder: \{ order: 1, hold: false \}/, 'ladder: { order: 1, hold: true }'), before, 'hold changes who the roster fields');
  assert.notEqual(simDigest({ ...real, [path]: src.replace('const CATALOGUE_ROWS = [', 'const CATALOGUE_ROWS = [\n  { id: "newcomer", name: "N", rig: "hero", weapon: "trident", stats: { archetype: "veteran", levels: [1, 5] }, finisher: {}, blood: {}, ladder: { order: 99, hold: false } },') }), before, 'a new roster row is a new opponent');
  assert.equal(simDigest({ ...real, [path]: src.replace('const CATALOGUE_ROWS = [', 'const CATALOGUE_ROWS = [\n  { id: "ember", body: "veteran", name: "Ember", weapon: "cleaver", rig: "goblin" },') }), before, 'a variant row is not a roster entry');
});
