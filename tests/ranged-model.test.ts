import assert from 'node:assert/strict';
import test from 'node:test';
import { createHash } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { RANGED_MODELS, rangedModelOf, rangedModelUrl } from '../src/fight/ranged-model-rows.ts';

// The painted bow (CS23). The file ships byte for byte as the sandbox's (public/weapons/ranged/PROVENANCE.txt); a swapped file changes this pin and its provenance line.
const SHA: Record<string, string> = { 'weapons/ranged/bow-v1.glb': '79dd891035c0201ac916173276efffcac32a4eceb5442f53d234d2a1862a8edd' };
const glbJson = (file: string) => { const b = readFileSync(new URL(`../public/${file}`, import.meta.url)); return JSON.parse(b.subarray(20, 20 + b.readUInt32LE(12)).toString()) as { nodes: { name: string; extras?: { hand?: string; weapon?: string } }[] }; };

test('the shipped ranged model files are the pinned ones, and the provenance names each', () => {
  const provenance = readFileSync(new URL('../public/weapons/ranged/PROVENANCE.txt', import.meta.url), 'utf8');
  for (const [file, sha] of Object.entries(SHA)) {
    assert.equal(createHash('sha256').update(readFileSync(new URL(`../public/${file}`, import.meta.url))).digest('hex'), sha, `${file} is the sandbox's pinned file`);
    assert.ok(provenance.includes(sha) && provenance.includes(file.split('/').pop()!), `${file}: PROVENANCE.txt names the file and its sha256`);
  }
});

test('the ranged model rows: one per shipped file, the model is where the row says, and the row agrees with the model\'s own node', () => {
  assert.deepEqual(RANGED_MODELS.map((m) => m.file).sort(), Object.keys(SHA).sort(), 'a row per pinned file and no row without one');
  for (const m of RANGED_MODELS) {
    assert.ok(existsSync(new URL(`../public/${m.file}`, import.meta.url)), `${m.id}: public/${m.file} exists`);
    assert.equal(rangedModelUrl(m), `/${m.file}`);
    const node = glbJson(m.file).nodes.find((n) => n.name === m.node);
    assert.ok(node, `${m.id}: the file has the node ${m.node}`);
    assert.equal(node!.extras?.hand, m.hand, `${m.id}: the row's hand is the model's own userData.hand`);
    assert.equal(node!.extras?.weapon, `${m.id}-v1`, `${m.id}: the model names its own kind`);
    assert.ok(m.holdDeg.every((d) => Number.isFinite(d) && Math.abs(d) <= 180), `${m.id}: the hold is three angles in degrees`);
    assert.ok(m.metalness >= 0 && m.metalness <= 1 && m.roughness >= 0 && m.roughness <= 1, `${m.id}: the matte is a pair of 0-1 values`);
  }
});

test('the bow is the only ranged model: the crossbow was dropped by Dom (CS22) and a kind with no row keeps what the game draws', () => {
  assert.deepEqual(RANGED_MODELS.map((m) => m.id), ['bow']);
  assert.deepEqual(rangedModelOf('bow')?.holdDeg, [-1.9, 34.6, 114.3], 'the sandbox\'s own hold');
  assert.equal(rangedModelOf('crossbow'), undefined);
  assert.equal(rangedModelOf('staff'), undefined, 'the staff stays the sandbox\'s procedural model: not ported here');
});
