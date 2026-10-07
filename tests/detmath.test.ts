// The sim's math is the same bits in every engine (Strategy ruling, 2026-09-29; the Dwarf seed-828 kill link split between Node's V8 and
// Chromium's on a 1-ulp Math.atan2). src/detmath.ts carries sin / cos / atan2 / hypot on + − * / sqrt only; old records replay on the
// engine's own Math, frozen, picked by the record's version and nothing else.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import * as detmath from '../src/detmath.ts';
import { FIRST_DETMATH_VERSION, LEGACY_TABLE_IS_NATIVE, M, atan2, cos, hypot, mathTableFor, sin, underRecord } from '../src/detmath.ts';
import { RECORD_VERSION, READABLE_VERSIONS } from '../src/record.ts';

// Every file the sim steps through. SIM_FILES in tests/record-version-guard.test.ts plus combat.ts (stepPractice) and detmath.ts itself.
const SIM = ['src/duel.ts', 'src/moves.ts', 'src/ai.ts', 'src/sim.ts', 'src/record.ts', 'src/blade.ts', 'src/blade-paths.ts', 'src/roster.ts', 'src/finishers.ts', 'src/combat.ts', 'src/detmath.ts', 'src/play-radius.ts', 'src/stab-rule.ts', 'src/roll.ts'];
const BANNED = /\bMath\.(sin|cos|tan|asin|acos|atan|atan2|sinh|cosh|tanh|asinh|acosh|atanh|exp|expm1|log|log1p|log2|log10|pow|cbrt|hypot)\b|[\w)\]]\s*\*\*\s*[\w(]/;
const code = (line: string) => line.replace(/\/\/.*$/, '');   // line comments may name them

test('detmath: no Math transcendental and no ** in any sim file; the one exception is the FROZEN legacy table', () => {
  for (const file of SIM) {
    const lines = readFileSync(new URL(`../${file}`, import.meta.url), 'utf8').split('\n');
    const hits = lines.map((l, i) => [i + 1, l] as const).filter(([, l]) => BANNED.test(code(l)));
    if (file === 'src/detmath.ts') {
      // Exactly two lines: the frozen table, and its identity check (compares the functions, calls none).
      assert.equal(hits.length, 2, `detmath.ts: only the LEGACY table and its check may name Math.<transcendental>:\n${hits.map(h => h.join(': ')).join('\n')}`);
      assert.match(hits[0][1], /^const LEGACY: Table = Object\.freeze\(\{ sin: Math\.sin, cos: Math\.cos, atan2: Math\.atan2, hypot: Math\.hypot \}\);/, 'the legacy line is the frozen table, unchanged');
      assert.match(hits[1][1], /^export const LEGACY_TABLE_IS_NATIVE = \(\): boolean => LEGACY\.sin === Math\.sin && LEGACY\.cos === Math\.cos && LEGACY\.atan2 === Math\.atan2 && LEGACY\.hypot === Math\.hypot;$/);
    } else assert.deepEqual(hits, [], `${file} calls a Math transcendental or **; the sim uses detmath's M (engines round them differently)`);
  }
});

test('detmath: the legacy table IS the engine\'s own Math (frozen, never edited), and only a record version reaches it', () => {
  assert.ok(LEGACY_TABLE_IS_NATIVE(), 'LEGACY must be the native functions, so a v18/v19 link replays exactly as before');
  assert.equal(FIRST_DETMATH_VERSION, 20);
  for (const v of READABLE_VERSIONS) assert.equal(mathTableFor({ v }), v < 20 ? 'legacy' : 'detmath', `record v${v}`);
  assert.equal(mathTableFor({ v: RECORD_VERSION }), 'detmath', 'every new record (and every live fight) is on detmath');
  // No other way in: the module exports no setter, and underRecord puts the table back even when its run throws.
  assert.deepEqual(Object.keys(detmath).sort(), ['FIRST_DETMATH_VERSION', 'LEGACY_TABLE_IS_NATIVE', 'M', 'atan', 'atan2', 'cos', 'hypot', 'mathTableFor', 'sin', 'underRecord'].sort());
  // A probe the two tables answer differently ON THIS ENGINE, found at test time: which inputs separate them depends on the engine (a pair
  // that splits Node 25 on arm64 matched the CI runner's x64 Node). Fixed seeded candidates, atan2 first, then sin; at least one must split,
  // or this engine's Math is detmath bit for bit and the switch cannot be observed (then the test fails loudly rather than pass blind).
  // underRecord needs a SYNCHRONOUS run: an async one would put the table back before its awaits (every call site is synchronous).
  let seed = 20260929; const rnd = () => (seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648;
  type Probe = { name: string; native: () => number; det: () => number; viaM: () => number };
  let probe: Probe | undefined;
  for (let k = 0; k < 400000 && !probe; k++) {
    if (k % 2 === 0) { const y = (rnd() - 0.5) * 20, x = (rnd() - 0.5) * 20; if (Math.atan2(y, x) !== atan2(y, x)) probe = { name: `atan2(${y}, ${x})`, native: () => Math.atan2(y, x), det: () => atan2(y, x), viaM: () => M.atan2(y, x) }; }
    else { const v = (rnd() - 0.5) * 2 * 10 ** (rnd() * 4 - 1); if (Math.sin(v) !== sin(v)) probe = { name: `sin(${v})`, native: () => Math.sin(v), det: () => sin(v), viaM: () => M.sin(v) }; }
  }
  assert.ok(probe, 'no candidate separates this engine\'s Math from detmath: the switch cannot be observed here');
  assert.equal(probe.viaM(), probe.det(), `outside a record: detmath (${probe.name})`);
  assert.equal(underRecord({ v: 19 }, probe.viaM), probe.native(), `inside a v19 record: the engine (${probe.name})`);
  assert.equal(underRecord({ v: 20 }, probe.viaM), probe.det(), `inside a v20 record: detmath (${probe.name})`);
  assert.throws(() => underRecord({ v: 19 }, () => { throw Error('boom'); }), /boom/);
  assert.equal(probe.viaM(), probe.det(), `a throwing v19 run puts detmath back (the finally) (${probe.name})`);
});

test('detmath: within 1 ulp of the engine\'s Math on the sim\'s ranges, and the IEEE edge cases', () => {
  const ulps = (a: number, b: number) => { const f = new Float64Array([a, b]), i = new BigInt64Array(f.buffer); return Number(i[0] > i[1] ? i[0] - i[1] : i[1] - i[0]); };
  let s = 12345; const rnd = () => (s = (s * 1103515245 + 12345) % 2147483648) / 2147483648;
  for (let k = 0; k < 20000; k++) {
    const x = (rnd() - 0.5) * 2 * 10 ** (rnd() * 4 - 1), y = (rnd() - 0.5) * 20, z = (rnd() - 0.5) * 20;
    assert.ok(ulps(sin(x), Math.sin(x)) <= 1 && ulps(cos(x), Math.cos(x)) <= 1 && ulps(atan2(y, z), Math.atan2(y, z)) <= 1, `x ${x}, y ${y}, z ${z}`);
  }
  assert.ok(Object.is(sin(-0), -0) && Object.is(atan2(-0, 1), -0) && atan2(0, -1) === Math.PI && atan2(-0, -1) === -Math.PI && atan2(1, 0) === Math.PI / 2);
  assert.equal(hypot(3, 4), 5); assert.equal(hypot(1, 2, 2), 3); assert.equal(hypot(-Infinity, NaN), Infinity); assert.ok(Number.isNaN(sin(Infinity)));
});

test('detmath: pinned bits (any edit to the polynomials or the reduction fails here, and every engine must print these)', () => {
  const bits = (v: number) => { const f = new Float64Array([v]); return new BigUint64Array(f.buffer)[0].toString(16); };
  assert.deepEqual([sin(1), cos(1), sin(100.5), cos(-7.25), atan2(-0.02499974547752328, 1.958676137114927), atan2(3, -4), hypot(0.1, 0.2)].map(bits), PINNED);
});
const PINNED = ['3feaed548f090cee', '3fe14a280fb5068c', 'bf9fb3f833470ff1', '3fe22c6f50dc3fbf', 'bf8a236f7769dfd7', '4003fc176b7a8560', '3fcc9f25c5bfedda'];   // Node 25 (V8 14.1), 2026-09-29; the browser row checks Chromium prints the same
