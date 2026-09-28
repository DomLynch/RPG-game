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
import { READABLE_VERSIONS, RECORD_VERSION, V18_REACH, createRecorder, packRecord, unpackRecord } from '../src/record.ts';
import type { OpponentId } from '../src/roster.ts';

// Every file whose content changes what a recorded fight does when it is stepped again: the duel rules, the move tables, the
// opponent AI, the fixed-step loop and the record codec itself. Presentation files are deliberately absent — a new sound or a
// different camera does not change the fight.
// The list is the runtime import closure of the sim, and the test below keeps it that way: until 2026-09-23 it named five files while
// duel.ts imported blade.ts and the baked blade tables, so a stale bake changed fights with this guard green.
const SIM_FILES = ['src/duel.ts', 'src/moves.ts', 'src/ai.ts', 'src/sim.ts', 'src/record.ts', 'src/blade.ts', 'src/blade-paths.ts', 'src/roster.ts', 'src/finishers.ts'];
const SIM_DIGEST = '575afbdb41677cb38850f388848bf4adcb9e0c7a74d593626f8372afc4faa337';   // re-pinned WITHOUT a bump on 2026-09-28, v19 live: record.ts's decoder accept-list widened to [18, 19] with V18_REACH (decode only; packRecord, quantizeIntent and every stepped fight unchanged, so no v19 link moves, and a bump here would kill every v19 link for a change that plays no differently). Before: c71b88b4, re-pinned WITHOUT a bump on 2026-09-28: duel.ts reads postureDecay through guardOf() (a no-op refactor; every reference fight replays with the same digest), inside the unreleased v19. Before: re-pinned WITH a bump (18 -> 19) on 2026-09-28: the Centurion's gladius + scutum from Legionary (RV18 content) on top of RV19, + the Auditer's two ai.ts nits. Before: re-pinned WITH a bump (17 -> 18) on 2026-09-28: the Centurion's tellReaction + braceHeavy (RV19, lane numbering). Before: re-pinned WITH a bump (16 -> 17) on 2026-09-27: RV17, the Witch's easy skill fields retuned (thrust-from-range hole at L10–16); re-pinned again inside RV17 (unreleased) for a moves.ts comment-only edit, and for her normal skill fields (reaction 12, parry .45, read .8; Lead ruling (a), 2026-09-28)
const PINNED_FOR_VERSION = 19;

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
  assert.deepEqual([...READABLE_VERSIONS], [18, 19], 'READABLE_VERSIONS changed: widen it deliberately (a record on an accepted version must still decode to the fight it recorded), then re-pin here.');
  assert.deepEqual(V18_REACH, { opponent: 'veteran', from: 6 }, 'V18_REACH is what bump 19 changed (the Centurion from level 6): it is history, not tuning.');
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

// The widening's other half (2026-09-28): v18 is read only outside what bump 19 reached. A v18 Centurion record from level 6 replays his old
// trident with no scutum, so it must still be refused, and with a message the page converts (main.ts matches 'Fight record: version').
// Mutation receipt (PR body): dropping the V18_REACH line in unpackRecord, or turning `>=` into `>`, fails this test.
test('a v18 record decodes only where bump 19 cannot reach', () => {
  const v18 = (opponent: OpponentId, level: number) => { const b = packRecord(createRecorder({ build: 'x', opponent, weapon: 'longsword', level, seed: 5 }).finish('abandoned')); b[2] = 18; return b; };
  for (const [opponent, level] of [['goblin', 18], ['witch', 10], ['pitborn', 46], ['skeleton', 18], ['veteran', 1], ['veteran', 5]] as const)
    assert.equal(unpackRecord(v18(opponent, level)).v, 18, `a v18 ${opponent} L${level} fight steps the same on v19, so its link must keep working`);
  for (const level of [6, 7, 18, 46]) assert.throws(() => unpackRecord(v18('veteran', level)), /^Error: Fight record: version 18 is not supported for the veteran from level 6/, `a v18 Centurion L${level} record replays his old kit`);
  const v17 = packRecord(createRecorder({ build: 'x', opponent: 'goblin', weapon: 'longsword', level: 18, seed: 5 }).finish('abandoned')); v17[2] = 17;
  assert.throws(() => unpackRecord(v17), /version 17 is not supported/, 'the widening is v18 only');
});
