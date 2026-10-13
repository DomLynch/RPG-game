// The kill-link guard (owner 2026-09-22, via Strategy): a shared link replays a recorded fight by stepping this build's sim over the
// recorded intents. If any sim-deciding file changes without RECORD_VERSION changing with it, every link minted before the change
// replays a different fight and dies mid-play — which is what the viewer page's "Recorded on an older build" freeze exists to catch
// after the fact. This test catches it before the merge: it hashes the CODE that decides how a fight plays (tests/lib/sim-digest.ts:
// the top-level statements of the sim files, comments and import paths left out, as one sorted list) and pins the digest next to the
// version. Change that code and this test fails; the fix is to bump RECORD_VERSION in src/fight/record.ts (old links are then refused cleanly
// at decode) and paste the digest the failure prints into SIM_DIGEST below. Moving code between sim files byte for byte (src/fight/,
// Release K) keeps the digest, so it keeps the version and every live link (Lead, 2026-10-09).
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
import { duplicateNames, simDigest } from './lib/sim-digest.ts';
import { DIALS, POINTS, SHEET_SKILLS } from '../src/fight/sheet-rows.ts';
import { DAMAGE_KINDS } from '../src/fight/damage-kinds.ts';
import { CC_LADDER } from '../src/fight/cc-ladder.ts';
import { SWARM_ROWS } from '../src/fight/roll.ts';
import type { OpponentId } from '../src/roster.ts';

// Every file whose content changes what a recorded fight does when it is stepped again: the duel rules, the move tables, the
// opponent AI, the fixed-step loop and the record codec itself. Presentation files are deliberately absent — a new sound or a
// different camera does not change the fight.
// The list is the runtime import closure of the sim, and the test below keeps it that way: until 2026-09-23 it named five files while
// duel.ts imported blade.ts and the baked blade tables, so a stale bake changed fights with this guard green.
const SIM_FILES = ['src/fight/duel.ts', 'src/fight/cc-ladder.ts', 'src/fight/pools.ts', 'src/fight/pool-defs.json', 'src/fight/moves.ts', 'src/fight/ai.ts', 'src/fight/sim.ts', 'src/fight/record.ts', 'src/fight/blade.ts', 'src/fight/blade-paths.ts', 'src/roster.ts', 'src/fight/catalogue-data.ts', 'src/fight/catalogue-defs.ts', 'src/fight/finishers.ts', 'src/fight/detmath.ts', 'src/fight/play-radius.ts', 'src/fight/stab-rule.ts', 'src/fight/roll.ts', 'src/fight/gambit.ts', 'src/fight/stance.ts'];   // detmath.ts: the sim's own math (2026-09-29); play-radius.ts: the play circle (2026-10-06); stab-rule.ts: the Goblin's stab switch (2026-10-07)
const SIM_DIGEST = 'daeb422f92f609b0b6da9d90bc1c62bcca5f2c63458460becc51a5d2fb11bed6';   // RV50 (2026-10-13, Combat B, Wave A1 steps 6+7, provisional): CC kinds / tiers / resists (cc-defs.json) and the swarm band (swarm-defs.json) as registry rows, all opt-in (every shipped fight as v49). Re-pinned at the same unreleased RV50 when the rows moved into the loader.
// RV49 digest was f6dcaadacd5394769ebf187ccb7fcdddaf01025f4986627b2ce2141a83e8d26d (Combat A, damage kinds).   // RV48 (2026-10-12, Combat, Wave A1 PR1, provisional): gear counts in a fight (THE SHEET: Fighter.sheet, the player's ten dials on their 0-100 lines (the re-lock, 2026-10-13: base 0, a dial at 100 is twice a normal fighter) from the rows of sheet-defs.json, read in stepDuel as damage dealt (attack), damage taken (armour), the health bar, posture taken (poise) and stamina regeneration (recovery); duel.ts withSheet, geared; the point pools, dial and skill rows hashed as resolved/sheet.json); a fight with no gear is unchanged, REACH[48] empty. Chains from RV47 84b80301... RV47 (2026-10-12, Combat, provisional): weapon name switches as row fields (default/natural/look on the weapon rows, DEFAULT_WEAPON for the 'longsword' defaults; the resolved weapon table plus the default weapon is what the digest hashes); same fights, REACH[47] empty. Chains from RV45 bb2d6305... (46 is Combat B's finishers). RV45 (2026-10-12, Combat): skills as data (skill-defs.json through skills.ts; the skills reach the digest as their sim projection in record-byte order, name/clip/tint/fx are presentation; moves.ts, record.ts, duel.ts and ai.ts now read the rows); same fights, REACH[45] empty. Chains from RV44 c7dac03b... (weapons as data). RV44 (2026-10-12, Combat): the weapon table is hashed as its resolved output (LOADER_ONLY: registry.ts, weapons.ts, the rows and manifests), pools and weapons load through the shared loadRegistry; same fights, RV44 not bumped again: unmerged. Before that: weapons as data (weapon-defs.json + weapons.ts, byte-identical resolved table, sha256 pinned in tests/weapon-defs.test.ts). RV43 was (2026-10-12, Combat): resource pools as an open registry (pools.ts + pool-defs.ts, createFighter reads a row's pools); every default is what it always used, so no fight moves (REACH[43] empty). Chains from RV42 c95e1f2c... (the projection digest, #2269)
const PINNED_FOR_VERSION = 50;

// The weapon table is hashed as what the loader RETURNS (Lead, 2026-10-12, as the catalogue and the pools are): the canonical JSON of the 11 resolved Weapon objects, their order and both player lists. The loader
// (weapons.ts), the shared registry (src/core/registry.ts), the rows and the manifests are LOADER_ONLY: a refactor of them that resolves to the same table moves nothing, a change that alters a resolved value moves the digest.
const LOADER_ONLY = ['src/fight/cc-defs.json', 'src/fight/cc-defs.manifest.json', 'src/fight/swarm-defs.json', 'src/fight/swarm-defs.manifest.json', 'src/fight/damage-kinds.ts', 'src/fight/damage-kind-defs.json', 'src/fight/damage-kind-defs.manifest.json', 'src/fight/sheet-rows.ts', 'src/fight/sheet-defs.json', 'src/fight/sheet-defs.manifest.json', 'src/fight/skills.ts', 'src/fight/skill-defs.json', 'src/fight/skill-defs.manifest.json', 'src/core/registry.ts', 'src/fight/weapons.ts', 'src/fight/weapon-defs.json', 'src/fight/pool-defs.manifest.json', 'src/fight/weapon-defs.manifest.json', 'src/fight/finisher-rows.ts', 'src/fight/finisher-defs.json', 'src/fight/finisher-defs.manifest.json'];
const canon = (v: unknown): unknown => Array.isArray(v) ? v.map(canon) : v && typeof v === 'object' ? Object.fromEntries(Object.keys(v).sort().map((k) => [k, canon((v as Record<string, unknown>)[k])])) : v;
const resolvedWeapons = (): string => JSON.stringify(canon({ weapons: WEAPONS, order: Object.keys(WEAPONS), player: PLAYER_WEAPONS, offered: PLAYER_WEAPONS_OFFERED, default: DEFAULT_WEAPON }));
// The skills reach the digest as their SIM projection (id, code, move, opponent, dayOne, tell, in record-byte order); name, clip, impactTint and fx are presentation and move no fight.
const resolvedSkills = (): string => JSON.stringify(SKILL_BY_CODE.map((id) => (id === null ? null : (({ code, move, opponent, dayOne, tell }) => ({ id, code, move, opponent, dayOne: !!dayOne, tell: !!tell }))(SKILL_ROWS[id]!))));
// The finisher table is hashed as what the loader RETURNS (Lead, 2026-10-12, as the catalogue is): the canonical JSON of the rotation order and, per row in
// order, its id, template and resolved duration. The loader (finisher-rows.ts), the shared registry (src/core/registry.ts), the rows and the manifest are
// LOADER_ONLY: a refactor of them, or a cosmetic field (a pose, a label, a camera number), that resolves to the same projection moves nothing; a change to a
// resolved sim value moves the digest.
const resolvedFinishers = (): string => JSON.stringify(canon({ rotation: ROTATION, rows: Object.keys(FINISHER_POSE).map((id) => ({ id, template: finisherRow(id)!.template, ...finisherSeconds(id) })) }));
const simSources = (): Record<string, string> => ({ ...Object.fromEntries(SIM_FILES.map((file) => [file, readFileSync(new URL(`../${file}`, import.meta.url), 'utf8')])), 'resolved/weapons.json': resolvedWeapons(), 'resolved/skills.json': resolvedSkills(), 'resolved/finishers.json': resolvedFinishers(), 'resolved/sheet.json': JSON.stringify({ points: POINTS, dials: DIALS, skills: SHEET_SKILLS }), 'resolved/damage-kinds.json': JSON.stringify(canon(DAMAGE_KINDS)), 'resolved/cc.json': JSON.stringify(canon(CC_LADDER)), 'resolved/swarm.json': JSON.stringify(canon(SWARM_ROWS)) });

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
  assert.notEqual(edit('src/fight/play-radius.ts', /BASE_RADIUS = 8\.55/, 'BASE_RADIUS = 8.56'), before, 'a sim constant changed and the digest did not');
  assert.notEqual(edit('src/fight/duel.ts', /\.85 - 1e-8/, '.86 - 1e-8'), before, 'a number inside a function body changed and the digest did not');
  assert.notEqual(simDigest({ ...real, 'src/fight/ai.ts': real['src/fight/ai.ts']!.replace(/import \{ aim,/, 'import { aim as aimOther, aim,') }), before, 'an aliased import is a rebinding: it must count');
  assert.notEqual(simDigest({ ...real, 'src/blade-table.json': '{"a":1}' }), simDigest({ ...real, 'src/blade-table.json': '{"a":2}' }), 'a data file is hashed by its bytes');
  assert.equal(edit('src/fight/sim.ts', /\/\/ World coordinates only\./, '// World coordinates only, reworded.'), before, 'a comment is not the fight');
  assert.deepEqual(duplicateNames({ ...real, 'src/fight/stance.ts': `${real['src/fight/stance.ts']}\nexport const walled = 1;\n` }), ['walled: src/fight/duel.ts, src/fight/stance.ts'], 'a second declaration of a sim name is reported');
});

// The accept-list, pinned as data beside the digest above and for the same reason: which versions this build will READ is a decision
// someone makes, not a value that drifts. The server reads this same list — scripts/verify-daily.mjs imports `decodeRecord` from
// src/fight/record.ts and deploy.sh rsyncs src/**/*.ts to the verifier host — so widening it here widens it there, in one deploy, and a
// second copy on the server can never quietly disagree with this one.
test('the decoder accept-list is what someone pinned, and this build can read what it writes', () => {
  assert.deepEqual([...READABLE_VERSIONS], [18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 29, 30, 31, 32, 33, 34, 35, 36, 37, 38, 39, 40, 41, 42, 43, 44, 45, 46, 47, 48, 49, 50], 'READABLE_VERSIONS changed: widen it deliberately (a record on an accepted version must still decode to the fight it recorded), then re-pin here.');
  assert.deepEqual(REACH, { 19: [{ opponent: 'veteran', from: 6 }], 20: [{ opponent: 'plaguedoctor', from: 1 }], 21: [], 22: [], 23: [], 24: [], 25: [], 26: [], 27: [], 28: [], 29: ['veteran', 'pitborn', 'goblin', 'nightborn', 'executioner', 'minotaur', 'wraith', 'werewolf', 'skeleton', 'dwarf', 'plaguedoctor', 'knight', 'witch', 'shieldmaiden'].map((opponent) => ({ opponent, from: 1 })), 30: ['shieldmaiden', 'knight', 'plaguedoctor'].map((opponent) => ({ opponent, from: 1 })), 31: ['veteran', 'pitborn', 'dwarf', 'knight', 'shieldmaiden'].map((opponent) => ({ opponent, from: 1 })), 32: [], 33: [], 34: [], 35: [], 36: [], 37: [], 38: [], 40: [], 39: [], 41: [], 42: [], 43: [], 44: [], 45: [], 46: [], 47: [], 48: [], 49: [], 50: [] }, 'REACH is what each bump changed (19: the Centurion from level 6; 20: the Plague Doctor; 21: nothing, Special Moves ride the record\'s own flag; 24: nothing, late notice is keyed on the record\'s version): history, not tuning. A new bump appends its own line.');
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
  const at = (v: number, opponent: OpponentId, level: number) => { const p = packRecord(liveRecorder({ build: 'x', opponent, weapon: 'longsword', level, seed: 5 }).finish('abandoned')); let o = 3; for (let k = 0; k < 3; k++) o += 1 + p[o]; const b = v >= 26 ? new Uint8Array(p) : v >= 21 ? new Uint8Array([...p.subarray(0, o + 2), ...p.subarray(o + 3)]) : new Uint8Array([...p.subarray(0, o + 1), ...p.subarray(o + 3)]); b[2] = v; return b; };   // the skill byte, then the specials byte (v21 on) and the arena byte (v26 on): an older stamp drops the ones it has no field for
  for (const [v, opponent, level] of [[31, 'goblin', 18], [31, 'witch', 10], [31, 'plaguedoctor', 46], [31, 'knight', 1], [30, 'goblin', 18], [30, 'witch', 10], [30, 'plaguedoctor', 46], [29, 'goblin', 18], [29, 'witch', 10], [29, 'skeleton', 18]] as const)
    assert.equal(unpackRecord(at(v, opponent, level)).v, v, `a v${v} ${opponent} L${level} fight is this build's own, so its link must keep working`);
  for (const [v, opponent, level] of [[28, 'goblin', 1], [27, 'veteran', 46], [26, 'witch', 10], [19, 'plaguedoctor', 1], [18, 'veteran', 6], [18, 'knight', 18], [29, 'knight', 1], [29, 'shieldmaiden', 46], [29, 'plaguedoctor', 10], [30, 'knight', 1], [30, 'veteran', 18], [30, 'pitborn', 46], [30, 'dwarf', 6], [30, 'shieldmaiden', 12], [29, 'veteran', 5], [29, 'dwarf', 46]] as const)
    assert.throws(() => unpackRecord(at(v, opponent, level)), new RegExp(`^Error: Fight record: version ${v} is not supported for the ${opponent} from level \\d+ \\(bump \\d+ changed`), `a v${v} ${opponent} L${level} record replays a fight the RV29 rule batch changed`);
  assert.throws(() => unpackRecord(at(17, 'goblin', 18)), /version 17 is not supported/, 'v17 is outside the window');
});

// The patron rule must survive the NEXT fight-logic bump (the Auditor's RV33 probe, 2026-10-07): a throwaway copy of src/fight/record.ts with the ceiling at 33 (imports pointed back
// at the real src/ and src/fight/, so the one sim and the one set of era flags). Today the ceiling is 33 (RV33/RV34 stamp only a Gambit / stances fight; a patron-less fight writes 31, a patron fight 32); at 35 every
// live fight stamps the ceiling again (a patron byte of 0 for a patron-less one), the build must read its own fresh links, and only v32 refuses a zero patron.
test('RV43 simulated: a patron-less fight stamps the new ceiling and round-trips; a patron fight too; a v32 record with no patron is still refused', async () => {
  assert.equal(NO_PATRON_VERSION, RECORD_VERSION <= 50 ? 31 : RECORD_VERSION); assert.equal(PATRON_VERSION, RECORD_VERSION <= 50 ? 32 : RECORD_VERSION);
  const src = readFileSync(new URL('../src/fight/record.ts', import.meta.url), 'utf8').replace(/from '\.\.\//g, `from '${new URL('../src/', import.meta.url).href}`).replace(/from '\.\//g, `from '${new URL('../src/fight/', import.meta.url).href}`);
  const bumped = src.replace('export const RECORD_VERSION = 50;', 'export const RECORD_VERSION = 51;').replace('48, 49, 50] as const', '48, 49, 50, 51] as const').replace('  50: [],', '  50: [],\n  51: [],');
  assert.notEqual(bumped, src); assert.ok(bumped.includes('RECORD_VERSION = 51') && bumped.includes('50, 51] as const') && bumped.includes('51: [],'), 'the probe edits applied');
  const dir = mkdtempSync(join(tmpdir(), 'rv33-'));
  try {
    const file = join(dir, 'record33.ts'); writeFileSync(file, bumped);
    const m = await import(pathToFileURL(file).href) as typeof import('../src/fight/record.ts');
    assert.equal(m.RECORD_VERSION, 51); assert.equal(m.NO_PATRON_VERSION, 51); assert.equal(m.PATRON_VERSION, 51);
    setPlayScale(playScaleFor('goblin', 43)); setLateNotice(true); setStab(true);
    const fightOf = (patron?: number) => {
      const rec = m.createRecorder({ weapon: 'longsword', build: 'abc1234', opponent: 'goblin', level: 12, seed: 7, ...(patron ? { patron } : {}) });
      for (let i = 0; i < 20; i++) rec.push({ move: { x: 0, z: 0, yaw: 0, run: false }, action: null, guard: false, lock: true });
      return rec.finish('draw');
    };
    const none = fightOf(), withPatron = fightOf(5);
    assert.equal(none.v, 51, 'a live patron-less fight stamps this build, so the build reads its own fresh link');
    assert.equal(m.packRecord(none)[2], 51);
    assert.deepEqual(m.unpackRecord(m.packRecord(none)), none, 'a v38 record with patron byte 0 round-trips with no patron');
    assert.equal(withPatron.v, 51); assert.deepEqual(m.unpackRecord(m.packRecord(withPatron)), withPatron);
    const v32 = m.packRecord(withPatron).slice(); v32[2] = 32;
    const at = v32.length - 6 * 20 - 4 - 4 - 1 - 1 - 1; assert.equal(v32[at], 5); v32[at] = 0;
    assert.throws(() => m.unpackRecord(v32), /names a patron/, 'a v32 record with no patron is refused: it was always written as v31');
  } finally { rmSync(dir, { recursive: true, force: true }); setLateNotice(false); setStab(false); setPlayScale(1); }
  void createRecorder;
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
