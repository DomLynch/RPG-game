// The sandbox carry gap's item 2 ("no time change in a live zone", Dom; scope ruling by Lead 2026-10-19: live zone = the OPEN-WORLD zones only, the Pit, the arena and PvP keep today's hit-stop): the hit-stop is a
// presentation hold owned by src/main.ts (stopFor, hit-stop.ts), which only the Pit page draws with. The open-world preview (origins/) never reads it, so a hit there changes no clock and the sandbox's value of 0
// is what trunk already does. This pins both halves so neither drifts silently: the open world imports nothing of the hold, and the Pit's rows still hold today's values.
import './lib/era-off.ts';   // RV78: the legacy suite runs on trunk's rules; sandbox-era.ts is the one switch (tests/lib/era-off.ts)
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import RULES from '../src/hit-stop-rules.json' with { type: 'json' };
import { stopFor } from '../src/hit-stop.ts';

const walk = (dir: string): string[] => readdirSync(dir).flatMap((f) => { const p = join(dir, f); return statSync(p).isDirectory() ? (f === 'node_modules' ? [] : walk(p)) : /\.(ts|mjs|html)$/.test(f) ? [p] : []; });

test('the open-world zones never read the hit-stop hold (so a hit there changes no clock)', () => {
  const root = new URL('../origins/', import.meta.url).pathname;
  const offenders = walk(root).filter((f) => /hit-stop|hit-impact|stopFor|impactStopMs|HIT_STOP/.test(readFileSync(f, 'utf8')));
  assert.deepEqual(offenders, [], 'an open-world file reads the hit-stop: a world hit would hold the clock (Dom: no time change in a live zone)');
});

test('the Pit keeps today\'s hit-stop: the rows and a landed blow still hold', () => {
  const stop = Object.fromEntries(RULES.stop.map((r) => [r.id, r.ms])), heavy = Object.fromEntries(RULES.heavy.map((r) => [r.id, r.ms]));
  assert.deepEqual(stop, { SpecialLanded: 50, Blocked: 30, Hit: 50, Parried: 70, GuardBroken: 90, PostureBroken: 150, Killed: 220 });
  assert.deepEqual(heavy, { Hit: 90, Blocked: 50 });
  assert.ok(stopFor([{ type: 'Killed', actor: 0 } as never]) >= 220, 'a kill still stops the Pit\'s clock');
});
