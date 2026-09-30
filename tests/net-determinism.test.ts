// Determinism guards for live PvP (docs/duel-architecture.md §2). Rollback needs every phone to compute bit-identical state, so:
// (1) the ban list cannot drift: every file the sim or the rollback core reaches must be a scanned sim file; (2) stepDuel never writes
// into its input (a snapshot is just the old Duel object); (3) the cross-engine fixture is stable in Node — the browser legs
// (scripts/net-engines-check.mjs: Chromium + WebKit on CI) compare against this same Node run.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { decide, initialAi } from '../src/ai.ts';
import { idleIntent, stepDuel, type Duel, type Intent } from '../src/duel.ts';
import { PROFILES } from '../src/moves.ts';
import { fightChain } from '../src/net/fixture.ts';
import { pvpDuel } from '../src/net/rollback.ts';
import { quantizeIntent } from '../src/record.ts';

const ROOT = new URL('../', import.meta.url);
const read = (file: string) => readFileSync(new URL(file, ROOT), 'utf8');
// The one list tests/detmath.test.ts scans, read from that file so there is still exactly one list.
const SIM = JSON.parse(read('tests/detmath.test.ts').match(/const SIM = (\[[^\]]*\])/)![1].replace(/'/g, '"')) as string[];
// Beyond detmath's transcendentals: anything that differs per device, per run or per locale.
const NONDETERMINISTIC = /\bMath\.random\b|\bDate\b|\bperformance\.|\bMath\.fround\b|\bFloat32Array\b|\blocaleCompare\b|\btoLocale\w*\b|\bIntl\./;

function reach(entries: string[]): Set<string> {
  const seen = new Set<string>(), todo = [...entries];
  while (todo.length) {
    const file = todo.pop()!;
    if (seen.has(file)) continue;
    seen.add(file);
    for (const m of read(file).matchAll(/(?:from|import\()\s*'(\.{1,2}\/[^']+\.ts)'/g)) todo.push(path.posix.normalize(path.posix.join(path.posix.dirname(file), m[1])));
  }
  return seen;
}

test('net determinism: every file the sim or the rollback core reaches is scanned by the detmath ban (the list cannot drift)', () => {
  const reached = reach(['src/duel.ts', 'src/net/rollback.ts', 'src/net/fixture.ts']);
  const unscanned = [...reached].filter((f) => !f.startsWith('src/net/') && !SIM.includes(f));
  assert.deepEqual(unscanned, [], 'a sim file outside tests/detmath.test.ts SIM: add it there (and to SIM_FILES if it changes fights)');
  for (const file of reached) {
    const hits = read(file).split('\n').map((l, i) => [i + 1, l.replace(/\/\/.*$/, '')] as const).filter(([, l]) => NONDETERMINISTIC.test(l));
    assert.deepEqual(hits, [], `${file}: a per-device, per-run or per-locale value inside the sim`);
  }
});

function deepFreeze<T>(value: T): T {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) { Object.freeze(value); for (const v of Object.values(value)) deepFreeze(v); }
  return value;
}

test('net determinism: stepDuel never writes into the state or intents it is given (rollback keeps old Duels as snapshots)', () => {
  let duel: Duel = deepFreeze(pvpDuel({ weapon: 'estoc', skill: 'pommel' }, { weapon: 'maul', skill: null }));
  let ai = [initialAi(11), initialAi(12)];
  for (let t = 1; t <= 5400; t++) {
    const intents = ([0, 1] as const).map((side): Intent => {
      if (duel.fighters[side].phase === 'sheathed') return { ...idleIntent(), action: 'light' };
      const d = decide(duel, side, ai[side], PROFILES.hard); ai = side ? [ai[0], d.ai] : [d.ai, ai[1]]; return quantizeIntent(d.intent);
    }) as [Intent, Intent];
    duel = deepFreeze(stepDuel(duel, deepFreeze(intents)));   // strict-mode ESM: a write into a frozen object throws here
  }
  assert.ok(duel.tick === 5400);
});

test('net determinism: the cross-engine fixture is a pure function of the fight number (same chain twice, different per fight)', () => {
  const a = fightChain(4), b = fightChain(4), c = fightChain(5);
  assert.deepEqual(a, b);
  assert.notEqual(a.chain, c.chain);
  assert.match(a.chain, /^[0-9a-f]{16}$/);
});
