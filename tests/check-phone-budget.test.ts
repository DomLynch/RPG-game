import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { copyFileSync, mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

// scripts/check-phone-budget.mjs on a fixture tree: a weapon GLB of a given triangle count and primitive count (the JSON chunk alone is enough, the checker reads counts), the real budget table, a chosen allow-list.
const SCRIPT = new URL('../scripts/check-phone-budget.mjs', import.meta.url).pathname, TABLE = new URL('../src/fight/phone-budgets.json', import.meta.url).pathname;
function glb(tris: number, prims: number): Buffer {
  const primitives = Array.from({ length: prims }, () => ({ attributes: { POSITION: 0 }, indices: 1 }));
  const json = Buffer.from(JSON.stringify({ asset: { version: '2.0' }, nodes: [{ mesh: 0 }], meshes: [{ primitives }], accessors: [{ count: (tris / prims) * 3 }, { count: (tris / prims) * 3 }] }));
  const jsonPad = Buffer.concat([json, Buffer.alloc((4 - (json.length % 4)) % 4, 0x20)]), head = Buffer.alloc(12), jh = Buffer.alloc(8), bh = Buffer.alloc(8);
  head.write('glTF', 0); head.writeUInt32LE(2, 4); head.writeUInt32LE(12 + 8 + jsonPad.length + 8, 8); jh.writeUInt32LE(jsonPad.length, 0); jh.write('JSON', 4); bh.writeUInt32LE(0, 0); bh.write('BIN\0', 4);
  return Buffer.concat([head, jh, jsonPad, bh]);
}
type Entry = { file: string; class: string; over: Record<string, number>; figures: Record<string, number> };
function run(tris: number, prims: number, groups: { fix: string; entries: Entry[] }[] | null) {
  const root = mkdtempSync(join(tmpdir(), 'phone-budget-'));
  mkdirSync(join(root, 'src/fight'), { recursive: true }); mkdirSync(join(root, 'public/weapons/shapes'), { recursive: true }); mkdirSync(join(root, 'scripts/phone-budget'), { recursive: true });
  copyFileSync(TABLE, join(root, 'src/fight/phone-budgets.json'));
  writeFileSync(join(root, 'public/weapons/shapes/axe-crafted.glb'), glb(tris, prims));
  if (groups) writeFileSync(join(root, 'scripts/phone-budget/allow.json'), JSON.stringify({ groups }));
  const r = spawnSync(process.execPath, [SCRIPT, '--gate', '--root', root], { encoding: 'utf8' });
  return { code: r.status, out: r.stdout };
}
const FILE = 'public/weapons/shapes/axe-crafted.glb';
const figures = (tris: number, draws = 1) => ({ tris, skinnedVerts: 0, joints: 0, draws, textureSide: 0, gzKb: 1, pngKb: 0 });
const group = (tris: number, draws = 1, fix = 'PR 9999 trims it') => [{ fix, entries: [{ file: FILE, class: 'weapon', over: { tris }, figures: figures(tris, draws) }] }];

test('an asset inside its class budget passes with no allow-list', () => { const r = run(3000, 1, null); assert.equal(r.code, 0, r.out); });
test('a new asset over budget fails and names the file', () => { const r = run(4500, 1, null); assert.equal(r.code, 1); assert.match(r.out, /NEW\s+public\/weapons\/shapes\/axe-crafted\.glb \[weapon\]/); });
test('an allowed offender at its recorded figures passes, and the debt is counted per fix PR', () => { const r = run(4500, 1, group(4500)); assert.equal(r.code, 0, r.out); assert.match(r.out, /debt:\s+1\s+PR 9999 trims it/); });
test('an allowed offender that grows on the metric it is over on fails', () => { const r = run(4800, 1, group(4500)); assert.equal(r.code, 1); assert.match(r.out, /WORSE .*tris 4500 -> 4800/); });
test('an allowed offender that grows on a metric still within budget fails too (the recorded figure is the ceiling)', () => { const r = run(4500, 2, group(4500, 1)); assert.equal(r.code, 1); assert.match(r.out, /WORSE .*draws 1 -> 2/); });
test('an allowed offender that shrinks but stays over passes (the entry can be lowered)', () => { const r = run(4200, 1, group(4500)); assert.equal(r.code, 0, r.out); });
test('an allow entry whose file now passes is stale and fails: the list only shrinks', () => { const r = run(3000, 1, group(4500)); assert.equal(r.code, 1); assert.match(r.out, /STALE .*tris is within budget now/); });
test('an allow group with no fix PR named fails', () => { const r = run(4500, 1, group(4500, 1, 'TODO name the PR that fixes this file')); assert.equal(r.code, 1); assert.match(r.out, /NOFIX/); });
