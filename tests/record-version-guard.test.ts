// The kill-link guard (owner 2026-09-22, via Strategy): a shared link replays a recorded fight by stepping this build's sim over the
// recorded intents. If any sim-deciding file changes without RECORD_VERSION changing with it, every link minted before the change
// replays a different fight and dies mid-play — which is what the viewer page's "Recorded on an older build" freeze exists to catch
// after the fact. This test catches it before the merge: it hashes the files that decide how a fight plays and pins the digest next
// to the version. Change one of them and this test fails; the fix is to bump RECORD_VERSION in src/record.ts (old links are then
// refused cleanly at decode) and paste the digest the failure prints into SIM_DIGEST below.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { READABLE_VERSIONS, REACH, RECORD_VERSION, packRecord, unpackRecord } from '../src/record.ts';
import { liveRecorder } from './lib/live-recorder.ts';
import type { OpponentId } from '../src/roster.ts';

// Every file whose content changes what a recorded fight does when it is stepped again: the duel rules, the move tables, the
// opponent AI, the fixed-step loop and the record codec itself. Presentation files are deliberately absent — a new sound or a
// different camera does not change the fight.
// The list is the runtime import closure of the sim, and the test below keeps it that way: until 2026-09-23 it named five files while
// duel.ts imported blade.ts and the baked blade tables, so a stale bake changed fights with this guard green.
const SIM_FILES = ['src/duel.ts', 'src/moves.ts', 'src/ai.ts', 'src/sim.ts', 'src/record.ts', 'src/blade.ts', 'src/blade-paths.ts', 'src/roster.ts', 'src/finishers.ts', 'src/detmath.ts', 'src/play-radius.ts', 'src/stab-rule.ts'];   // detmath.ts: the sim's own math (2026-09-29); play-radius.ts: the play circle (2026-10-06); stab-rule.ts: the Goblin's stab switch (2026-10-07)
const SIM_DIGEST = '1590340143b3b32cc7bab44472fd0a25d277213086c4c73c20fc01105e429b75';   // re-pinned WITHOUT a bump on 2026-10-07 inside the unreleased v31: Strategy's run-reset ruling (ai.ts: any defence resets the spam run, the early gate reads the run alone). Before: re-pinned WITH a bump (30 -> 31) on 2026-10-07: RV31, the early spammer read (ai.ts readOpponent + the run habit, moves.ts spamRun / spamBoth on the Veteran, Pitborn, Dwarf, Knight and Shieldmaiden), REACH[31] names those five. Before: re-pinned WITH a bump (29 -> 30) on 2026-10-07: RV30, the Shieldmaiden / Knight / Plague Doctor own AI profile rows (moves.ts; profile numbers only), REACH[30] names those three. Before: re-pinned WITH a bump (28 -> 29) on 2026-10-07: the RV29 rule batch (RULES.posture hold 60 + bloodied drain, exhaustedStun, rear retune; duel.ts shake/stagger/hit; REACH[29] = every opponent from level 1, so every pre-29 link is refused; Combat, Dom via Lead). Earlier pin: re-pinned WITH a bump (27 -> 28) on 2026-10-07: interruptible special casts (duel.ts castHurt + the cut in the countdown loop, moves.ts RULES.special interruptAt / interruptCooldown and SPECIAL_ROWS; #1507 item 1; only a specials-flag fight with a cast hit past the threshold moves, REACH[28] empty; Combat). Earlier pin: re-pinned WITH a bump (26 -> 27) on 2026-10-06: the 50-level ladder (moves.ts LEVELS 50 + tailApex, levels 47–50; levels 1–46 untouched, REACH[27] empty; Combat). Earlier pin: re-pinned WITH a bump (25 -> 26) on 2026-10-06: the arena byte in the record header (record.ts; presentation only, REACH[26] empty; World, rotation). Earlier pin: re-pinned WITH a bump (24 -> 25) on 2026-10-07: the Goblin's stab, gated by record version (stab-rule.ts; COMBAT-001 3/3). Earlier pin: re-pinned WITH a bump (23 -> 24) on 2026-10-07: COMBAT-001 late notice (ai.ts READ.lateNotice, moves.ts softNotice on the in-between levels from L12, play-radius.ts LATE_NOTICE keyed on the record's version; v23 stays readable, REACH[24] empty); earlier pin fb58577c: re-pinned WITH a bump (22 -> 23) on 2026-10-06 (unreleased, pinned twice): Arena 1's play circle comes inward to 0.36 and the fighters start inside it (play-radius.ts, keyed on the record's version; v22 stays readable, REACH[23] empty); earlier pin 4ee25eba: re-pinned WITH a bump (21 -> 22) on 2026-10-02 (not shipped: specials OFF live): Dom's final special rule in the sim (moves.ts RULES.special, duel.ts specialRecover); earlier pin 726b50c5: re-pinned 2026-10-01 at 21 (not shipped: specials OFF live) for the Centurion's named specials (moves.ts specialOf, duel.ts specialName, events carry name); earlier pin: re-pinned WITH a bump (20 -> 21) on 2026-09-29: Special Moves on the SKILL slot behind withSpecials (duel.ts, ai.ts, RULES.special) and the record's specials byte; a fight without the flag steps as v20 did, so v20 stays readable (REACH[21] empty). Before: 3d66f2d2, re-pinned WITHOUT a new bump on 2026-09-29, inside the unreleased v20: the sim's math moves to src/detmath.ts (sin/cos/atan2/hypot on + − * / sqrt, identical in every engine; Node and Chromium had split a Dwarf kill link on a 1-ulp atan2). v18/v19 records replay on the frozen native Math through detmath.underRecord (Strategy ruling (b)), so no v19 link moves. Before: 1a3cc206, re-pinned WITHOUT a new bump on 2026-09-29, inside the unreleased v20: the Plague Doctor's easy tellReaction 15 (moves.ts, + its note in record.ts; his L6 thrust-from-range hole with the estoc, Lead ruling (a)). His fights are all inside REACH[20] already. Before: 9502e2b6, re-pinned WITH a bump (19 -> 20) on 2026-09-28: the Plague Doctor's estoc (roster.ts; REACH[20] = the Plague Doctor, every level). Before: 575afbdb41677cb38850f388848bf4adcb9e0c7a74d593626f8372afc4faa337';   // re-pinned WITHOUT a bump on 2026-09-28, v19 live: record.ts's decoder accept-list widened to [18, 19] with V18_REACH (decode only; packRecord, quantizeIntent and every stepped fight unchanged, so no v19 link moves, and a bump here would kill every v19 link for a change that plays no differently). Before: c71b88b4, re-pinned WITHOUT a bump on 2026-09-28: duel.ts reads postureDecay through guardOf() (a no-op refactor; every reference fight replays with the same digest), inside the unreleased v19. Before: re-pinned WITH a bump (18 -> 19) on 2026-09-28: the Centurion's gladius + scutum from Legionary (RV18 content) on top of RV19, + the Auditer's two ai.ts nits. Before: re-pinned WITH a bump (17 -> 18) on 2026-09-28: the Centurion's tellReaction + braceHeavy (RV19, lane numbering). Before: re-pinned WITH a bump (16 -> 17) on 2026-09-27: RV17, the Witch's easy skill fields retuned (thrust-from-range hole at L10–16); re-pinned again inside RV17 (unreleased) for a moves.ts comment-only edit, and for her normal skill fields (reaction 12, parry .45, read .8; Lead ruling (a), 2026-09-28)
const PINNED_FOR_VERSION = 31;

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
  assert.deepEqual([...READABLE_VERSIONS], [18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 29, 30, 31], 'READABLE_VERSIONS changed: widen it deliberately (a record on an accepted version must still decode to the fight it recorded), then re-pin here.');
  assert.deepEqual(REACH, { 19: [{ opponent: 'veteran', from: 6 }], 20: [{ opponent: 'plaguedoctor', from: 1 }], 21: [], 22: [], 23: [], 24: [], 25: [], 26: [], 27: [], 28: [], 29: ['veteran', 'pitborn', 'goblin', 'nightborn', 'executioner', 'minotaur', 'wraith', 'werewolf', 'skeleton', 'dwarf', 'plaguedoctor', 'knight', 'witch', 'shieldmaiden'].map((opponent) => ({ opponent, from: 1 })), 30: ['shieldmaiden', 'knight', 'plaguedoctor'].map((opponent) => ({ opponent, from: 1 })), 31: ['veteran', 'pitborn', 'dwarf', 'knight', 'shieldmaiden'].map((opponent) => ({ opponent, from: 1 })) }, 'REACH is what each bump changed (19: the Centurion from level 6; 20: the Plague Doctor; 21: nothing, Special Moves ride the record\'s own flag; 24: nothing, late notice is keyed on the record\'s version): history, not tuning. A new bump appends its own line.');
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
