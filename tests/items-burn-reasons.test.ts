// Burn reasons are ROWS (src/core/items/burn-reasons.json): a new reason is one row and no code; an unknown reason still refuses; the story-item rule is a row flag.
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { cpSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import test from 'node:test';
import { BURN_REASONS, loadBurnReasons } from '../src/core/items/inventory.ts';

const rows = JSON.parse(readFileSync(new URL('../src/core/items/burn-reasons.json', import.meta.url), 'utf8')) as { reasons: { id: string; consumesStoryItem: boolean }[] };

test('the two reasons the code emits or accepts today are rows, and only the quest hand-in may spend a story piece', () => {
  assert.deepEqual(BURN_REASONS.map((r) => [r.id, r.consumesStoryItem]), [['quest-handin', true], ['upgrade-cost', false]]);
});

test('the loader refuses a duplicate id, a missing or mistyped flag, and a table without the reason applyUpgrade emits', () => {
  assert.throws(() => loadBurnReasons({ reasons: [...rows.reasons, { id: 'quest-handin', consumesStoryItem: false }] }));
  assert.throws(() => loadBurnReasons({ reasons: [...rows.reasons, { id: 'craft' }] }));
  assert.throws(() => loadBurnReasons({ reasons: [...rows.reasons, { id: 'craft', consumesStoryItem: 'no' }] }));
  assert.throws(() => loadBurnReasons({ reasons: [rows.reasons[0]!] }), /upgrade-cost/);
  assert.equal(loadBurnReasons({ reasons: [...rows.reasons, { id: 'craft', consumesStoryItem: false }] }).length, 3);
});

test('a new burn reason is ONE row in a copy of the tree, no code; an unknown reason still refuses', () => {
  const dir = mkdtempSync(join(tmpdir(), 'burn-reasons-'));
  try {
    cpSync('origins', join(dir, 'origins'), { recursive: true });
    cpSync('src', join(dir, 'src'), { recursive: true });
    for (const link of ['scripts', 'package.json', 'node_modules']) symlinkSync(resolve(link), join(dir, link));
    const file = join(dir, 'src/core/items/burn-reasons.json'), table = JSON.parse(readFileSync(file, 'utf8')) as typeof rows;
    table.reasons.push({ id: 'salvage', consumesStoryItem: false });
    writeFileSync(file, JSON.stringify(table));
    writeFileSync(join(dir, 'probe.ts'), `import { consume, receive } from './src/core/items/inventory.ts';
import { PC, empty, lookup, oreStack } from './tests/items-testkit.ts';
const inv = (() => { const r = receive(empty(), oreStack('inst:ore-a', 9, 'a'), lookup); if (!r.ok) throw Error('setup'); return r.value; })();
const go = (reason: string) => consume({ inventory: inv, ledger: [] }, { op: 'quest:salvage:0001', owner: PC, reason, qty: 2, itemId: 'item:exchange-ore' as never }, lookup);
const a = go('salvage'), b = go('scrap');
console.log(JSON.stringify({ salvage: a.ok, scrap: b.ok, scrapCode: b.ok ? null : b.issues[0]!.code }));`);
    const out = spawnSync(process.execPath, ['probe.ts'], { cwd: dir, encoding: 'utf8' });
    assert.equal(out.status, 0, out.stderr);
    assert.deepEqual(JSON.parse(out.stdout.trim().split('\n').pop()!), { salvage: true, scrap: false, scrapCode: 'wrong-type' });
  } finally { rmSync(dir, { recursive: true, force: true }); }
});
