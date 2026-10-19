// Stances are ON by default on the main page (src/main.ts, Dom 2026-10-08), but the Origins world must not get them until Backend's #1791 is live (its verifier then replays with the pick; before it, a stance fight in the
// world settled as an unverified loss: Backend / Auditor, 2026-10-08). The Origins code never reads the page's flag or the pick, so no stance reaches a world fight. This pins it: a future Origins change that wires stances
// in must come with #1791 live and the Auditor's POST, and delete this test deliberately.
import './lib/era-off.ts';   // RV78: the legacy suite runs on trunk's rules; sandbox-era.ts is the one switch (tests/lib/era-off.ts)
import test from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

const walk = (dir: string): string[] => readdirSync(dir).flatMap((f) => { const p = join(dir, f); return statSync(p).isDirectory() ? (f === 'node_modules' ? [] : walk(p)) : /\.(ts|mjs)$/.test(f) && !/\.test\./.test(f) ? [p] : []; });
// RV81 (Dom 2026-10-19: "world-fight stances applied today"): the world's duel takes the player's stance, and the encounter verifier replays a record with its pick (origins/server/encounter-verify.ts, tests/origins-encounter.test.ts).
// The ONE Origins file that wires it is origins/preview/pit-duel.ts (the duel host); the panel is never mounted in the world, and no other Origins file reads the flag or the pick.
test('only the world duel host (pit-duel.ts) reads the stance flag or the pick; no Origins file mounts the panel', () => {
  const root = new URL('../origins', import.meta.url).pathname, offenders = walk(root).filter((f) => /\b(stancePref|stanceFlag|mountStancePanel|stance-panel)\b/.test(readFileSync(f, 'utf8'))).map((f) => f.slice(root.length + 1));
  assert.deepEqual(offenders, ['preview/pit-duel.ts'], 'Origins files wiring stances: only the duel host does');
  assert.doesNotMatch(readFileSync(join(root, 'preview/pit-duel.ts'), 'utf8'), /mountStancePanel/, 'the panel is the Pit page\'s; the world takes the pick, it does not draw it');
});
