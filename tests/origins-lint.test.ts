// The origins/ eslint ratchet (scripts/origins-lint.mjs): the counting and the judging, without running eslint (CI runs it as `npm run lint:origins`).
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { countLint, DEBT } from '../scripts/origins-lint.mjs';
import { judge } from '../scripts/origins-tsc.mjs';

const root = '/repo', MAIN = 'origins/preview/main.ts', UNUSED = '@typescript-eslint/no-unused-vars';
const msg = (ruleId: string | null, severity = 2) => ({ ruleId, severity, line: 1, column: 1, message: 'x' });

test('eslint json is counted per repo-relative file and per rule, errors only', () => {
  const report = [
    { filePath: join(root, MAIN), messages: [msg(UNUSED), msg(UNUSED), msg('prefer-const', 1)] },
    { filePath: join(root, 'origins/a.ts'), messages: [msg(null)] },
    { filePath: join(root, 'origins/b.ts'), messages: [] },
  ];
  assert.deepEqual(countLint(report, root), { [MAIN]: { [UNUSED]: 2 }, 'origins/a.ts': { parse: 1 } }, 'a warning is not counted; a parse error has no rule');
});

test('today\'s pins pass; a new error, a new file and a new rule in a pinned file fail; a fixed error must lower its pin', () => {
  const today = Object.fromEntries(Object.entries(DEBT).map(([f, { codes }]) => [f, { ...codes }]));
  assert.deepEqual(judge(today, DEBT, 'scripts/origins-lint.mjs'), { over: [], stale: [] });
  assert.equal(judge({ ...today, 'origins/zones/loader.ts': { 'prefer-const': 1 } }, DEBT).over.length, 1, 'a file with no pin');
  const swapped = judge({ ...today, [MAIN]: { [UNUSED]: 7, 'no-undef': 1 } }, DEBT, 'scripts/origins-lint.mjs');
  assert.ok(swapped.over.some((l) => l.includes('no-undef')), 'fixing an unused name does not make room for another rule');
  assert.ok(swapped.stale.some((l) => l.includes('scripts/origins-lint.mjs')), 'and the fixed one asks for its pin in THIS script to come down');
  for (const [file, { owner, codes }] of Object.entries(DEBT)) { assert.ok(owner.trim(), file); assert.ok(Object.values(codes).every((n) => Number.isInteger(n) && n > 0), file); }
});

test('the ratchet runs in every quality gate, next to the origins type-check', () => {
  const scripts = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8')).scripts;
  assert.equal(scripts['lint:origins'], 'node scripts/origins-lint.mjs');
  for (const gate of ['quality', 'quality:ci', 'quality:stop']) assert.match(scripts[gate], /npm run typecheck:origins && npm run lint:origins/, gate);
});
