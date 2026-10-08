// The kill-link guard (owner 2026-09-22, via Strategy): a shared link replays a recorded fight by stepping this build's sim over the
// recorded intents. If any sim-deciding file changes without RECORD_VERSION changing with it, every link minted before the change
// replays a different fight and dies mid-play — which is what the viewer page's "Recorded on an older build" freeze exists to catch
// after the fact. This test catches it before the merge: it hashes the files that decide how a fight plays and pins the digest next
// to the version. Change one of them and this test fails; the fix is to bump RECORD_VERSION in src/record.ts (old links are then
// refused cleanly at decode) and paste the digest the failure prints into SIM_DIGEST below.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { pathToFileURL } from 'node:url';
import { dirname, join } from 'node:path';
import { NO_PATRON_VERSION, PATRON_VERSION, READABLE_VERSIONS, REACH, RECORD_VERSION, createRecorder, packRecord, unpackRecord } from '../src/record.ts';
import { playScaleFor, setLateNotice, setPlayScale } from '../src/play-radius.ts';
import { setStab } from '../src/stab-rule.ts';
import { liveRecorder } from './lib/live-recorder.ts';
import type { OpponentId } from '../src/roster.ts';

// Every file whose content changes what a recorded fight does when it is stepped again: the duel rules, the move tables, the
// opponent AI, the fixed-step loop and the record codec itself. Presentation files are deliberately absent — a new sound or a
// different camera does not change the fight.
// The list is the runtime import closure of the sim, and the test below keeps it that way: until 2026-09-23 it named five files while
// duel.ts imported blade.ts and the baked blade tables, so a stale bake changed fights with this guard green.
const SIM_FILES = ['src/duel.ts', 'src/moves.ts', 'src/ai.ts', 'src/sim.ts', 'src/record.ts', 'src/blade.ts', 'src/blade-paths.ts', 'src/roster.ts', 'src/finishers.ts', 'src/detmath.ts', 'src/play-radius.ts', 'src/stab-rule.ts', 'src/roll.ts', 'src/gambit.ts', 'src/stance.ts'];   // detmath.ts: the sim's own math (2026-09-29); play-radius.ts: the play circle (2026-10-06); stab-rule.ts: the Goblin's stab switch (2026-10-07)
const SIM_DIGEST = 'dd92b380ea65f5972757b16a9d35bf0d44bcd9da022633c49f92bc25925609a6';   // RV36 (2026-10-08, the Tusked Boar: roster row, bite weapon on its own baked jaw table, archetype; no existing fight moves)
const PINNED_FOR_VERSION = 36;

test('a sim change without a RECORD_VERSION bump would break every live kill link', () => {
  const hash = createHash('sha256');
  for (const file of SIM_FILES) hash.update(file).update('\0').update(readFileSync(new URL(`../${file}`, import.meta.url)));
  const digest = hash.digest('hex');
  assert.ok(RECORD_VERSION >= PINNED_FOR_VERSION, 'RECORD_VERSION went backwards');
  assert.ok(digest === SIM_DIGEST ? RECORD_VERSION === PINNED_FOR_VERSION : RECORD_VERSION > PINNED_FOR_VERSION,
    `The sim files changed (digest ${digest}) but RECORD_VERSION is still ${RECORD_VERSION}. Bump RECORD_VERSION in src/record.ts so older links are refused at decode instead of replaying a different fight, then set SIM_DIGEST = '${digest}' and PINNED_FOR_VERSION = ${RECORD_VERSION + 1} here.`);
});

// The accept-list, pinned as data beside the digest above and for the same reason: which versions this build will READ is a decision
// someone makes, not a value that drifts. The server reads this same list — scripts/verify-daily.mjs imports `decodeRecord` from
// src/record.ts and deploy.sh rsyncs src/**/*.ts to the verifier host — so widening it here widens it there, in one deploy, and a
// second copy on the server can never quietly disagree with this one.
test('the decoder accept-list is what someone pinned, and this build can read what it writes', () => {
  assert.deepEqual([...READABLE_VERSIONS], [18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 29, 30, 31, 32, 33, 34, 35, 36], 'READABLE_VERSIONS changed: widen it deliberately (a record on an accepted version must still decode to the fight it recorded), then re-pin here.');
  assert.deepEqual(REACH, { 19: [{ opponent: 'veteran', from: 6 }], 20: [{ opponent: 'plaguedoctor', from: 1 }], 21: [], 22: [], 23: [], 24: [], 25: [], 26: [], 27: [], 28: [], 29: ['veteran', 'pitborn', 'goblin', 'nightborn', 'executioner', 'minotaur', 'wraith', 'werewolf', 'skeleton', 'dwarf', 'plaguedoctor', 'knight', 'witch', 'shieldmaiden'].map((opponent) => ({ opponent, from: 1 })), 30: ['shieldmaiden', 'knight', 'plaguedoctor'].map((opponent) => ({ opponent, from: 1 })), 31: ['veteran', 'pitborn', 'dwarf', 'knight', 'shieldmaiden'].map((opponent) => ({ opponent, from: 1 })), 32: [], 33: [], 34: [], 35: [], 36: [] }, 'REACH is what each bump changed (19: the Centurion from level 6; 20: the Plague Doctor; 21: nothing, Special Moves ride the record\'s own flag; 24: nothing, late notice is keyed on the record\'s version): history, not tuning. A new bump appends its own line.');
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
  assert.deepEqual([...seen].filter(f => !SIM_FILES.includes(f)), [], 'a file the sim imports is missing from SIM_FILES: add it, bump RECORD_VERSION and re-pin');
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

// The patron rule must survive the NEXT fight-logic bump (the Auditor's RV33 probe, 2026-10-07): a throwaway copy of src/record.ts with the ceiling at 33 (imports pointed back
// at the real src/, so the one sim and the one set of era flags). Today the ceiling is 33 (RV33/RV34 stamp only a Gambit / stances fight; a patron-less fight writes 31, a patron fight 32); at 35 every
// live fight stamps the ceiling again (a patron byte of 0 for a patron-less one), the build must read its own fresh links, and only v32 refuses a zero patron.
test('RV37 simulated: a patron-less fight stamps the new ceiling and round-trips; a patron fight too; a v32 record with no patron is still refused', async () => {
  assert.equal(NO_PATRON_VERSION, RECORD_VERSION <= 36 ? 31 : RECORD_VERSION); assert.equal(PATRON_VERSION, RECORD_VERSION <= 36 ? 32 : RECORD_VERSION);
  const src = readFileSync(new URL('../src/record.ts', import.meta.url), 'utf8').replace(/from '\.\//g, `from '${new URL('../src/', import.meta.url).href}`);
  const bumped = src.replace('export const RECORD_VERSION = 36;', 'export const RECORD_VERSION = 37;').replace('34, 35, 36] as const', '34, 35, 36, 37] as const').replace('  36: [],', '  36: [],\n  37: [],');
  assert.notEqual(bumped, src); assert.ok(bumped.includes('RECORD_VERSION = 37') && bumped.includes('36, 37] as const') && bumped.includes('37: [],'), 'the probe edits applied');
  const dir = mkdtempSync(join(tmpdir(), 'rv33-'));
  try {
    const file = join(dir, 'record33.ts'); writeFileSync(file, bumped);
    const m = await import(pathToFileURL(file).href) as typeof import('../src/record.ts');
    assert.equal(m.RECORD_VERSION, 37); assert.equal(m.NO_PATRON_VERSION, 37); assert.equal(m.PATRON_VERSION, 37);
    setPlayScale(playScaleFor('goblin', 37)); setLateNotice(true); setStab(true);
    const fightOf = (patron?: number) => {
      const rec = m.createRecorder({ weapon: 'longsword', build: 'abc1234', opponent: 'goblin', level: 12, seed: 7, ...(patron ? { patron } : {}) });
      for (let i = 0; i < 20; i++) rec.push({ move: { x: 0, z: 0, yaw: 0, run: false }, action: null, guard: false, lock: true });
      return rec.finish('draw');
    };
    const none = fightOf(), withPatron = fightOf(5);
    assert.equal(none.v, 37, 'a live patron-less fight stamps this build, so the build reads its own fresh link');
    assert.equal(m.packRecord(none)[2], 37);
    assert.deepEqual(m.unpackRecord(m.packRecord(none)), none, 'a v37 record with patron byte 0 round-trips with no patron');
    assert.equal(withPatron.v, 37); assert.deepEqual(m.unpackRecord(m.packRecord(withPatron)), withPatron);
    const v32 = m.packRecord(withPatron).slice(); v32[2] = 32;
    const at = v32.length - 6 * 20 - 4 - 4 - 1 - 1 - 1; assert.equal(v32[at], 5); v32[at] = 0;
    assert.throws(() => m.unpackRecord(v32), /names a patron/, 'a v32 record with no patron is refused: it was always written as v31');
  } finally { rmSync(dir, { recursive: true, force: true }); setLateNotice(false); setStab(false); setPlayScale(1); }
  void createRecorder;
});
