// Stances are ON by default on the main page (src/main.ts, Dom 2026-10-08), but the Origins world must not get them until Backend's #1791 is live (its verifier then replays with the pick; before it, a stance fight in the
// world settled as an unverified loss: Backend / Auditor, 2026-10-08). The Origins code never reads the page's flag or the pick, so no stance reaches a world fight. This pins it: a future Origins change that wires stances
// in must come with #1791 live and the Auditor's POST, and delete this test deliberately.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

const walk = (dir: string): string[] => readdirSync(dir).flatMap((f) => { const p = join(dir, f); return statSync(p).isDirectory() ? (f === 'node_modules' ? [] : walk(p)) : /\.(ts|mjs)$/.test(f) && !/\.test\./.test(f) ? [p] : []; });
test('no Origins source reads the stance flag, the pick or the panel (world fights stay stance-free until #1791 is live)', () => {
  const offenders = walk(new URL('../origins', import.meta.url).pathname).filter((f) => /\b(stancePref|stanceFlag|mountStancePanel|stance-panel)\b/.test(readFileSync(f, 'utf8')));
  assert.deepEqual(offenders, [], 'Origins files wiring stances: stances in the world need #1791 live and the Auditor\'s POST first');
});
