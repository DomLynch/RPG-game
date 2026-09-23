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
const SIM_DIGEST = '12d7a683d2eab6ac92a063e27da79f8a5f48d9e680bf328a4e1957300d0df917';   // re-pinned WITHOUT a bump on 2026-09-22: TRIDENT.grip 'one-hand' -> 'two-hand', a data-only field no sim code reads. Receipt, the rule this file already sets for a bump-free re-pin: both committed references replay IDENTICALLY without being regenerated (1677/1452 ticks, same outcome, same state digest d953a09b/552f30e5), and the 24-seed fairness table is unchanged. Previous: the estoc/Nightborn work's pin.   // re-pinned WITH a bump (4 -> 5) on 2026-09-22: the batched weapon-data flip (knife thrust recovery 15 -> 20, scythe heel-jab 18 -> 30). Previous: re-pinned WITH a bump (3 -> 4) on 2026-09-22: Brief 13's whip tell adds events to the duel stream, so an old record replays a fight whose whip never rose. The previous pin was #439's re-pin WITHOUT a bump (ai.ts line breaks + a rename, replay digest identical over 180 fights) — that rule still stands: a re-pin without a bump needs a receipt that behaviour is unchanged.
const PINNED_FOR_VERSION = 5;

test('a sim change without a RECORD_VERSION bump would break every live kill link', () => {
  const hash = createHash('sha256');
  for (const file of SIM_FILES) hash.update(file).update('\0').update(readFileSync(new URL(`../${file}`, import.meta.url)));
  const digest = hash.digest('hex');
  assert.ok(RECORD_VERSION >= PINNED_FOR_VERSION, 'RECORD_VERSION went backwards');
  assert.ok(digest === SIM_DIGEST ? RECORD_VERSION === PINNED_FOR_VERSION : RECORD_VERSION > PINNED_FOR_VERSION,
    `The sim files changed (digest ${digest}) but RECORD_VERSION is still ${RECORD_VERSION}. Bump RECORD_VERSION in src/record.ts so older links are refused at decode instead of replaying a different fight, then set SIM_DIGEST = '${digest}' and PINNED_FOR_VERSION = ${RECORD_VERSION + 1} here.`);
});
