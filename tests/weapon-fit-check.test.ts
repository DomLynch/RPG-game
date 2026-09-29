import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { ENVELOPE, fitCheck } from '../scripts/weapon-fit-check.mjs';
import { SHAPE_OVERRIDES, SHIPPING_SHAPES } from '../src/weapon-shapes.ts';

// The weapon-variants brief's envelope is measured on the parts that ship today: if one fails, the table is wrong, not the part (Lead
// 2026-09-28; Strategy corrected the rows to the shipped measurements). They run on the `legacy` profile: envelope only, grandfathered.
const SHIPPED: [string, string, string][] = [
  ['longsword', 'warrior.glb', 'SwordDrawn'], ['gladius', 'weapons/player/gladius.glb', 'WeaponDrawn'], ['knife', 'weapons/knife/knife.glb', 'WeaponDrawn'],
  ['estoc', 'weapons/estoc/estoc.glb', 'WeaponDrawn'], ['cleaver', 'weapons/cleaver/cleaver.glb', 'WeaponDrawn'], ['scythe', 'weapons/scythe/scythe.glb', 'WeaponDrawn'],
  ['trident', 'weapons/trident/trident.glb', 'WeaponDrawn'], ['warhammer', 'weapons/warhammer/warhammer.glb', 'WeaponDrawn'], ['maul', 'weapons/player/maul.glb', 'WeaponDrawn'],
];
for (const [weapon, file, root] of SHIPPED) test(`the shipped ${weapon} fits the brief's envelope (${file})`, () => {
  const results = fitCheck(readFileSync(new URL(`../src/assets/${file}`, import.meta.url)), { weapon, profile: 'legacy', root }) as { rule: string; status: string; detail: string }[];
  const failed = results.filter(r => r.status === 'FAIL');
  assert.deepEqual(failed, [], failed.map(r => `${r.rule}: ${r.detail}`).join('; '));
});

test('every weapon the brief names has an envelope row', () => {
  assert.deepEqual(Object.keys(ENVELOPE).sort(), ['cleaver', 'estoc', 'gladius', 'knife', 'longsword', 'maul', 'reaper', 'scythe', 'trident', 'warhammer']);
});

test('the new profile holds a delivered shape to the full contract; legacy only to the envelope', () => {
  const bytes = readFileSync(new URL('../src/assets/weapons/cleaver/cleaver.glb', import.meta.url));   // 2 materials: fails one-material on new
  const status = (profile: string) => Object.fromEntries((fitCheck(bytes, { weapon: 'cleaver', profile }) as { rule: string; status: string }[]).map(r => [r.rule, r.status]));
  assert.equal(status('new')['one node, one mesh, one material'], 'FAIL');
  assert.equal(status('legacy')['one node, one mesh, one material'], 'INFO');
  assert.equal(status('legacy')['extent Y (reach)'], 'PASS');
  assert.throws(() => fitCheck(bytes, { weapon: 'cleaver', profile: 'shipped' }), /unknown profile/);
});

// The shipped band shapes hold to the full contract (--profile=new): the checker is GPT intake's gate row, and it proves the reach is unchanged.
// Every file the rank table ships, once (a band name in the file picks its triangle budget; a per-rank file without one takes the weapon's envelope;
// an opponent's own row takes the envelope of the weapon it overrides in SHAPE_OVERRIDES: `estoc-cane` the estoc's, `witch-staff` the trident's).
const envelopeOf = (stem: string): string => Object.values(SHAPE_OVERRIDES).flatMap(own => Object.entries(own)).find(([, shape]) => shape === stem)?.[0] ?? stem;
for (const [weapon, files] of Object.entries(SHIPPING_SHAPES)) for (const file of new Set(files)) if (file) test(`the shipped ${file}.glb passes the new profile`, () => {
  const band = /-(plain|crafted|ornate)$/.exec(file)?.[1];
  const results = fitCheck(readFileSync(new URL(`../public/weapons/shapes/${file}.glb`, import.meta.url)), { weapon: envelopeOf(weapon), band }) as { rule: string; status: string; detail: string }[];
  const failed = results.filter(r => r.status === 'FAIL');
  assert.deepEqual(failed, [], failed.map(r => `${r.rule}: ${r.detail}`).join('; '));
  assert.equal(results.find(r => r.rule === 'extent Y (reach)')?.status, 'PASS', `the reach is the ${weapon}'s`);
});
