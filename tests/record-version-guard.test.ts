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
import { READABLE_VERSIONS, RECORD_VERSION } from '../src/record.ts';

// Every file whose content changes what a recorded fight does when it is stepped again: the duel rules, the move tables, the
// opponent AI, the fixed-step loop and the record codec itself. Presentation files are deliberately absent — a new sound or a
// different camera does not change the fight.
// The list is the runtime import closure of the sim, and the test below keeps it that way: until 2026-09-23 it named five files while
// duel.ts imported blade.ts and the baked blade tables, so a stale bake changed fights with this guard green.
const SIM_FILES = ['src/duel.ts', 'src/moves.ts', 'src/ai.ts', 'src/sim.ts', 'src/record.ts', 'src/blade.ts', 'src/blade-paths.ts', 'src/roster.ts', 'src/finishers.ts'];
const SIM_DIGEST = 'ef5ddeda9a37c6450f26a741b87fdd58994112fe8bbba9001a93a12583d48d4f';   // re-pinned WITHOUT a bump on 2026-09-23 (the #439 rule): src/roster.ts `hold: true` on ROSTER.knight only (his arms were weighted to spine_02; Lead's ruling), a field no sim file reads (grep: isHeld/ENCOUNTERS are read by src/ladder.ts and src/roster.ts only); record-replay-check --strict identical before/after. The previous pin, 6fb55940… WITH the 7 -> 8 bump: re-pinned WITH a bump (7 -> 8) on 2026-09-23 over roster-v0's four-body tree (80e991a): the Executioner's own normal profile (#550, `anticipate`), the four beta characters on placeholder archetypes (Plague Doctor lapse .2, Combat's one forced retune), and the maul offered. Read AFTER the bump. Previous: '3d3a93221633bad8d47e54780d86103d54a306269c692d42da595eaf80627fd3' — re-pinned WITH a bump (6 -> 7) on 2026-09-23 over Publish B' (the Veteran back on the trident; d63f3a22… was B with the swap, reverted before it went live) — the merged tree (#532 estoc reach, #545 Nightborn profile, #543 gladius as a player weapon, trunk; the Centurion's swap #547 held) and over the WIDENED list: SIM_FILES is now the runtime import closure (+ blade.ts, blade-paths.ts, roster.ts, finishers.ts), with the knife and scythe thrust tables rebaked on 5's timings. Read AFTER the bump (record.ts is inside the list). Previous: re-pinned WITH a bump (5 -> 6) on 2026-09-23: the kicker-hover hold fix in ai.ts — a warden's hold now derives from the inReach margin of the move he has QUEUED, so the Goblin stops parking at a gap his own plan cannot reach. A sim change: fights step differently, so an old record replays a different fight. Read AFTER the bump, because src/record.ts is itself inside SIM_FILES. Previous: re-pinned WITHOUT a bump on 2026-09-22 (12d7a683…): TRIDENT.grip 'one-hand' -> 'two-hand', a data-only field no sim code reads — that re-pin's no-bump receipt still stands, and this bump supersedes its pin rather than contradicting it. Previous: 7e8b5cd8… at version 5 — re-pinned WITHOUT a bump on 2026-09-23 under the #439 precedent: src/record.ts gained the READABLE_VERSIONS accept-list and unpackRecord now returns the version it parsed instead of the constant. Neither changes how a fight steps; receipt is `node scripts/record-replay-check.mjs --strict` before and after, identical. Previous: re-pinned WITHOUT a bump on 2026-09-22: TRIDENT.grip 'one-hand' -> 'two-hand', a data-only field no sim code reads (#472). Previous: re-pinned WITH a bump (4 -> 5) on 2026-09-22: the batched weapon-data flip (knife thrust recovery 15 -> 20, scythe heel-jab 18 -> 30). Previous: re-pinned WITH a bump (3 -> 4) on 2026-09-22: Brief 13's whip tell adds events to the duel stream, so an old record replays a fight whose whip never rose. The previous pin was #439's re-pin WITHOUT a bump (ai.ts line breaks + a rename, replay digest identical over 180 fights) — that rule still stands: a re-pin without a bump needs a receipt that behaviour is unchanged.
const PINNED_FOR_VERSION = 8;

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
  assert.deepEqual([...READABLE_VERSIONS], [8], 'READABLE_VERSIONS changed: widen it deliberately (a record on an accepted version must still decode to the fight it recorded), then re-pin here.');
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
