import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
// @ts-expect-error: a plain .mjs script, no types
import { ENVELOPE, fitCheck } from '../scripts/weapon-fit-check.mjs';

// The weapon-variants brief's envelope is measured on the parts that ship today: if one fails, the table is wrong, not the part (Lead
// 2026-09-28). Shipped parts are multi-material by design, so the structure rules report as INFO and only geometry gates.
const SHIPPED: [string, string, string][] = [
  ['longsword', 'warrior.glb', 'SwordDrawn'], ['gladius', 'weapons/player/gladius.glb', 'WeaponDrawn'], ['knife', 'weapons/knife/knife.glb', 'WeaponDrawn'],
  ['estoc', 'weapons/estoc/estoc.glb', 'WeaponDrawn'], ['cleaver', 'weapons/cleaver/cleaver.glb', 'WeaponDrawn'], ['scythe', 'weapons/scythe/scythe.glb', 'WeaponDrawn'],
  ['trident', 'weapons/trident/trident.glb', 'WeaponDrawn'], ['warhammer', 'weapons/warhammer/warhammer.glb', 'WeaponDrawn'], ['maul', 'weapons/player/maul.glb', 'WeaponDrawn'],
];
for (const [weapon, file, root] of SHIPPED) test(`the shipped ${weapon} fits the brief's envelope (${file})`, () => {
  const results = fitCheck(readFileSync(new URL(`../src/assets/${file}`, import.meta.url)), { weapon, shipped: true, root }) as { rule: string; status: string; detail: string }[];
  const failed = results.filter(r => r.status === 'FAIL');
  assert.deepEqual(failed, [], failed.map(r => `${r.rule}: ${r.detail}`).join('; '));
});

test('every weapon the brief names has an envelope row', () => {
  assert.deepEqual(Object.keys(ENVELOPE).sort(), ['cleaver', 'estoc', 'gladius', 'knife', 'longsword', 'maul', 'reaper', 'scythe', 'trident', 'warhammer']);
});
