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
import { RECORD_VERSION } from '../src/record.ts';

// Every file whose content changes what a recorded fight does when it is stepped again: the duel rules, the move tables, the
// opponent AI, the fixed-step loop and the record codec itself. Presentation files are deliberately absent — a new sound or a
// different camera does not change the fight.
const SIM_FILES = ['src/duel.ts', 'src/moves.ts', 'src/ai.ts', 'src/sim.ts', 'src/record.ts'];
const SIM_DIGEST = '81ab8567482ab4019fa994627e3f58f44f7fda820b5824e092cc0afb9034d44c';
const PINNED_FOR_VERSION = 3;

test('a sim change without a RECORD_VERSION bump would break every live kill link', () => {
  const hash = createHash('sha256');
  for (const file of SIM_FILES) hash.update(file).update('\0').update(readFileSync(new URL(`../${file}`, import.meta.url)));
  const digest = hash.digest('hex');
  assert.ok(RECORD_VERSION >= PINNED_FOR_VERSION, 'RECORD_VERSION went backwards');
  assert.ok(digest === SIM_DIGEST ? RECORD_VERSION === PINNED_FOR_VERSION : RECORD_VERSION > PINNED_FOR_VERSION,
    `The sim files changed (digest ${digest}) but RECORD_VERSION is still ${RECORD_VERSION}. Bump RECORD_VERSION in src/record.ts so older links are refused at decode instead of replaying a different fight, then set SIM_DIGEST = '${digest}' and PINNED_FOR_VERSION = ${RECORD_VERSION + 1} here.`);
});
