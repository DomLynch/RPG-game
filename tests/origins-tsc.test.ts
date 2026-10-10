// The origins/ type-check ratchet (scripts/origins-tsc.mjs): the counting and the judging, without running tsc (CI runs it as `npm run typecheck:origins`).
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { countErrors, judge, DEBT } from '../scripts/origins-tsc.mjs';

const MAIN = 'origins/preview/main.ts';

test('tsc lines are counted per file and per code', () => {
  const out = `${MAIN}(16,1): error TS6133: 'mobVariant' is declared but its value is never read.\n${MAIN}(522,15): error TS18047: 'mobs' is possibly 'null'.\n${MAIN}(529,10): error TS6133: 'pressEngage' is declared but its value is never read.\nsrc/a.ts(1,1): error TS2304: Cannot find name 'x'.\n  a continuation line\n`;
  assert.deepEqual(countErrors(out), { [MAIN]: { TS6133: 2, TS18047: 1 }, 'src/a.ts': { TS2304: 1 } });
});

test('today\'s pins pass; a new error, a new file and a new code in a pinned file fail', () => {
  const today = Object.fromEntries(Object.entries(DEBT).map(([file, { codes }]) => [file, { ...codes }]));
  assert.deepEqual(judge(today), { over: [], stale: [] });
  assert.equal(judge({ ...today, 'origins/zones/loader.ts': { TS2322: 1 } }).over.length, 1, 'a file with no pin');
  assert.equal(judge({ ...today, [MAIN]: { ...today[MAIN], TS6133: 9 } }).over.length, 1, 'one more of a pinned code');
});

test('the walkCam miss: fixing an unused name does not make room for a "cannot find name"', () => {
  const swapped = { ...Object.fromEntries(Object.entries(DEBT).map(([f, { codes }]) => [f, { ...codes }])), [MAIN]: { TS6133: 7, TS18047: 1, TS2304: 1 } };
  const { over, stale } = judge(swapped);
  assert.ok(over.some((l) => l.includes('TS2304')), 'the new code fails');
  assert.ok(stale.some((l) => l.includes('TS6133')), 'and the fixed one asks for its pin to come down');
});

test('a fixed error must lower its pin, so the debt only shrinks; every pin names an owner', () => {
  assert.equal(judge({}).stale.length, Object.values(DEBT).reduce((n, { codes }) => n + Object.keys(codes).length, 0));
  for (const [file, { owner, codes }] of Object.entries(DEBT)) { assert.ok(owner.trim(), `${file}: an owner lane`); assert.ok(Object.values(codes).every((n) => Number.isInteger(n) && n > 0), file); }
});

test('the ratchet checks origins/ and runs in the CI gate', () => {
  assert.deepEqual(JSON.parse(readFileSync(new URL('../tsconfig.origins.json', import.meta.url), 'utf8')).include, ['src', 'origins']);
  const scripts = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8')).scripts;
  assert.equal(scripts['typecheck:origins'], 'node scripts/origins-tsc.mjs');
  for (const gate of ['quality', 'quality:ci']) assert.match(scripts[gate], /npm run typecheck:origins/, gate);
});
