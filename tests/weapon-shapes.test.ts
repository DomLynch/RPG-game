import assert from 'node:assert/strict';
import test from 'node:test';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import type { WeaponId } from '../src/moves.ts';
import { BANDS, bandOf, byBand, RANK_LEVELS, SHAPE_OVERRIDES, shapeFor, shapesFlag, shapesFor, shapesOn, SHIPPING_SHAPES } from '../src/weapon-shapes.ts';

test('bands follow the brief: PLAIN at rank levels 1–3, CRAFTED 4–7, ORNATE 8–10', () => {
  assert.deepEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(bandOf), ['plain', 'plain', 'plain', 'crafted', 'crafted', 'crafted', 'crafted', 'ornate', 'ornate', 'ornate']);
  assert.deepEqual(BANDS, ['plain', 'crafted', 'ornate']);
});

test('a file resolves by the rank level; an absent rank falls back to the weapon as shipped', () => {
  const table = { maul: byBand('maul', ['plain', 'ornate']) };
  assert.equal(shapeFor('maul', 2, table), '/weapons/shapes/maul-plain.glb');
  assert.equal(shapeFor('maul', 5, table), undefined, 'no crafted maul yet: today\'s part');
  assert.equal(shapeFor('maul', 9, table), '/weapons/shapes/maul-ornate.glb');
  assert.equal(shapeFor('longsword', 9, table), undefined, 'a weapon with no files keeps its own shape');
});

// What ships, by sha256 (each against GPT's manifest: maul-v2/manifest.json, <weapon>-proof/file-sha256.json). A new or swapped file adds or
// changes its line here; the rank table points at it.
const SHA: Record<string, string> = {
  'maul-crafted': '64e4d3ed9f332ca3238d0216636cf9b8822b47b8925264ff9157a69696e728fd',   // v3 Forge Warden (maul-v3/file-sha256.json, Dom via Strategy 2026-09-29)
  'longsword-plain': '28cd817b01d1a139d60a742f379d8288b176b8beb900846b951024de00e7eacf',
  'longsword-crafted': '41bbd0f0d25ce7bb1df5f1c9ebb6cef80ea8f955f2b545703118d8b6ef40b463',
  'longsword-ornate': 'b4e8a3ba78d8578fd8a62173b0c796093253242283b73dbe39e2e75917cc562f',
  'gladius-plain': '7e39180d7e15bf52ef62645fc346899a56c7e8d308728d53f7b34e742f19b437',
  'gladius-crafted': '0a04d3b416cc170abc0624dfc12e6fd96faa59864524ef227af19109e2320e67',
  'gladius-ornate': '44dd49d4f7b1f9a3b963e03597d12a4a77d71cb911bcd6d1ed39bb02b608e0b0',
  'knife-plain': 'a5b5c0375019fcf4bea92b611ae4112464ec64af1e2ec18d11c90be7e013e140',
  'knife-crafted': 'e8e29048ee02a5bdbe62d11d3c8f71b876e5a2723de25d1a089006d3fdb23cdd',
  'knife-ornate': 'e88404733afc19f6d86de3cd1de0b4745203c54bf46c5920c82175ca14538405',
  'estoc-plain': '96401be50ed03ec3d8e69a15e7858f90fd86d76a4433ccab628cc58fd8780d8b',
  'estoc-crafted': '87120e565af56a1baccb269e45e1b233a7aa92f328a5852cc56654aa3e9879a6',
  'estoc-ornate': '770901275fc609ba386c7871669dc6cbf8bd47a3f0b9c00c7d1c2ee5e7f6b13b',
  'cleaver-plain': '83906bc8cd9a01fe8c8c6e90ba40bdb7a81bcf52a2badd37878e3fdc7319351a',
  'cleaver-crafted': '10303947adc08d5113eec137376c2fbad8d3033af90c2ef97d1692f6dd02c8c6',
  'cleaver-ornate': '4d4287fee8ba86f9459333e86dbd5aa8ee7570402511f8845508203b6536959d',
  'scythe-plain': '8b161e89d51df8214f027c48688d5679c675dabc0a9930a831d687b1984c416c',
  'scythe-crafted': '9247725ae00cf6bf63e5086f9b82ea8a7a6863ff996f961b5b5811cb2477a54c',
  'scythe-ornate': '69aa890109615e2f1b2cb69d7053b5df909bd065d2b0526950b856d7b5b69299',
  'trident-plain': 'e89f37cd74a6f413d730aa08777f30e67399aff943e5a333d52110b2d10965c3',
  'trident-crafted': 'cfaf007a5309cf12820105d2c06e521b4ba3ed2316b63ca2cd1f6ff7d9ec3d9c',
  'trident-ornate': '3cc5f9c167a3db821990a4f366651c6f9cf9d1024683d2bb5102b60792e83895',
  'warhammer-plain': '22c4be91ced24fa9cb3d29ce8613cfbfaedebbb7174ec06aa1f26998803f5071',
  'warhammer-crafted': '96f9d0c5267e73b845b51961fb6794e969b4f2561c37bb57af4167c2e354a659',
  'warhammer-ornate': 'ce70bfeaedb2cd52767572e368d06d383fe55d180a4b9b4668be5783dce23fd7',
  'reaper-plain': '9fe86ff7ad69a881e56b88bf2a93112c7c5c2b8ad5094d62387b29982ee0953d',
  'reaper-crafted': 'c07afe0d8adaa12d720fdc5741625c64cffedb0e9b09cd502a7adc16e3f06fd3',
  'reaper-ornate': '43e58370cd67e8b3e8e8df11401f3281b38ffb9797fac02ff5d8ad4b0d232ce1',
  'estoc-cane-plain': 'e0b6934b64792c22d96d3090474700431c8d4f987136b6ab50c83bde50f632c9',
  'estoc-cane-crafted': '2cadfbc617684a60d7d3ef32f3106e7423502f15eff159255ad3ef359455e1b5',
  'estoc-cane-ornate': '68333f00dd26052c887256318cc5f76b6eaddff29e899f7f3dd28fb0a56cfb49',
  'witch-staff-plain': 'f6d1435d9200d05d139991b51b3eedd293e3bd5e72227e938bdc5c2781678884',
  'witch-staff-crafted': 'a1f9eb774807f2415f21d4a4ddcb759060af629c6eb79c315759fd6fab67a5ae',
  'witch-staff-ornate': 'ebff1b400daa953b5f570428fe94b676f2f13475606a55b1b37a0460037b6563',
};
test('the Knight\'s maul: the plain and ornate atlases are flat grey, so ranks 1–3 and 8–10 keep the shipped textured maul; crafted (4–7) is painted', () => {
  // GPT's maul-plain.glb and maul-ornate.glb carry one flat mid-grey base-colour atlas ("Neutral forged grey"), which read as an untextured slab in the
  // Knight's hands on live (2026-09-30, Lead). No file = the weapon as shipped, the rank tint over it (weapon-shapes.ts). Repaint (GPT) is post-beta.
  for (const level of [1, 2, 3, 8, 9, 10]) {
    assert.equal(shapeFor('maul', level, SHIPPING_SHAPES, 'knight'), undefined, `rank ${level} Knight: no shape file, his own textured maul`);
    assert.equal(shapeFor('maul', level), undefined, `rank ${level} player: the shipped maul too`);
  }
  for (const level of [4, 5, 6, 7]) assert.equal(shapeFor('maul', level, SHIPPING_SHAPES, 'knight'), '/weapons/shapes/maul-crafted.glb', `rank ${level}: GPT's painted crafted maul`);
  assert.equal(SHIPPING_SHAPES.maul?.filter(Boolean).length, 4);
});
test('every shipping weapon names a file for EVERY rank 1–10 (Strategy 22:3x: per rank, not per band), each file present and pinned', () => {
  assert.ok(SHIPPING_SHAPES.maul, 'the maul ships');
  for (const [weapon, ranks] of Object.entries(SHIPPING_SHAPES)) {
    assert.equal(ranks?.length, 10, `${weapon}: ten entries, rank 1 at index 0`);
    for (const level of RANK_LEVELS) {
      const file: string | undefined = ranks?.[level - 1];
      if (weapon === 'maul' && !file) continue;   // the maul's flat-grey plain and ornate are out (see the Knight test above)
      assert.ok(file, `${weapon}: rank ${level} has no entry`);
      assert.ok(SHA[file], `${weapon}: rank ${level} names ${file}, which has no sha pin`);
      const bytes: Uint8Array = readFileSync(new URL(`../public/weapons/shapes/${file}.glb`, import.meta.url));
      assert.equal(createHash('sha256').update(bytes).digest('hex'), SHA[file], `${file}.glb is GPT's pinned file`);
    }
  }
});
test('today every rank takes its band\'s file: 1–3 plain, 4–7 crafted, 8–10 ornate; other weapons keep their parts', () => {
  for (const weapon of Object.keys(SHIPPING_SHAPES) as WeaponId[]) {
    if (weapon === 'maul') { assert.deepEqual(SHIPPING_SHAPES.maul, byBand('maul', ['crafted'])); continue; }   // crafted only, see the Knight test
    assert.deepEqual(SHIPPING_SHAPES[weapon], byBand(weapon, BANDS));
    assert.deepEqual([2, 5, 10].map(level => shapeFor(weapon, level)), BANDS.map(band => `/weapons/shapes/${weapon}-${band}.glb`));
  }
  assert.equal(shapeFor('warhammer', 10, SHIPPING_SHAPES, 'dwarf'), '/weapons/shapes/warhammer-ornate.glb', 'the Dwarf\'s warhammer is the painted one');
  assert.deepEqual([2, 5, 10].map(level => shapeFor('trident', level, SHIPPING_SHAPES, 'witch')), BANDS.map(band => `/weapons/shapes/witch-staff-${band}.glb`), 'the Witch carries her staff at every rank, never the painted trident');
  assert.equal(shapeFor('trident', 10, SHIPPING_SHAPES, 'veteran'), '/weapons/shapes/trident-ornate.glb', 'the Centurion\'s trident is the painted one');
  assert.deepEqual([2, 5, 10].map(level => shapeFor('estoc', level, SHIPPING_SHAPES, 'plaguedoctor')), BANDS.map(band => `/weapons/shapes/estoc-cane-${band}.glb`), 'the Plague Doctor carries his cane at every rank, never the painted estoc');
  assert.equal(shapeFor('estoc', 10, SHIPPING_SHAPES, 'nightborn'), '/weapons/shapes/estoc-ornate.glb', 'the Nightborn keeps the painted estoc');
  assert.equal(shapeFor('reaper', 10, SHIPPING_SHAPES, 'wraith'), '/weapons/shapes/reaper-ornate.glb', 'wired for the Wraith (held for beta): ready when he returns');
  assert.equal(shapesOn(SHIPPING_SHAPES), true);
  assert.equal(shapesOn({}), false, 'an empty table: scene.ts reshape() returns before resolving anything');
  assert.equal(shapesOn({ maul: [] }), false);
  assert.equal(shapesOn({ maul: byBand('maul', []) }), false);
});
test('one rank can take its own file with no code change: a table entry', () => {
  const table = { maul: SHIPPING_SHAPES.maul!.map((file, i) => i === 8 ? 'maul-rank9' : file) };
  assert.deepEqual([8, 9, 10].map(level => shapeFor('maul', level, table)), [undefined, '/weapons/shapes/maul-rank9.glb', undefined]);
});

test('the dev flag names the band files present; junk entries are dropped', () => {
  assert.equal(shapesFlag(''), undefined);
  assert.deepEqual(shapesFlag('?shapes=maul-plain,maul-ornate,../x-plain,maul-gold,trident-crafted'), { maul: byBand('maul', ['plain', 'ornate']), trident: byBand('trident', ['crafted']) });
});

test('the Plague Doctor\'s estoc is a cane sword (estoc-cane-<band>) and only that: no cane file = today\'s estoc, never the generic painted one', () => {
  assert.equal(SHAPE_OVERRIDES.plaguedoctor?.estoc, 'estoc-cane');
  const both = { 'estoc-cane': byBand('estoc-cane', ['ornate']), estoc: byBand('estoc', ['plain', 'ornate']) };
  assert.equal(shapeFor('estoc', 9, both, 'plaguedoctor'), '/weapons/shapes/estoc-cane-ornate.glb');
  assert.equal(shapeFor('estoc', 2, both, 'plaguedoctor'), undefined, 'no plain cane yet: today\'s estoc, not the painted estoc-plain (Lead 2026-09-29)');
  assert.equal(shapeFor('estoc', 5, both, 'plaguedoctor'), undefined, 'neither has crafted: today\'s estoc');
  assert.equal(shapeFor('estoc', 9, both, 'nightborn'), '/weapons/shapes/estoc-ornate.glb', 'another opponent\'s estoc stays the stock shape');
  assert.equal(shapeFor('estoc', 9, both), '/weapons/shapes/estoc-ornate.glb', 'the player\'s estoc stays the stock shape');
  assert.equal(shapeFor('maul', 9, both, 'plaguedoctor'), undefined, 'the override is per weapon');
  assert.deepEqual(shapesFlag('?shapes=estoc-cane-ornate'), { 'estoc-cane': byBand('estoc-cane', ['ornate']) });
});

test('the player\'s own weapon takes the band of HIS rung; the opponent\'s takes the rung he is met at (Lead 2026-09-28: the bug the stills found)', () => {
  const table = { maul: byBand('maul', BANDS), 'estoc-cane': byBand('estoc-cane', ['ornate']) };
  // A Recruit player (level 1) facing an opponent pinned or met at Origin (rung level 10 → band ornate): his maul stays plain.
  assert.deepEqual(shapesFor({ player: 'maul', opponent: 'maul', opponentId: 'knight', playerLevel: 1, opponentLevel: 10 }, table),
    { player: '/weapons/shapes/maul-plain.glb', opponent: '/weapons/shapes/maul-ornate.glb' });
  // An Origin player facing a Recruit-rung opponent: his is ornate, the opponent's plain.
  assert.deepEqual(shapesFor({ player: 'maul', opponent: 'maul', opponentId: 'knight', playerLevel: 10, opponentLevel: 1 }, table),
    { player: '/weapons/shapes/maul-ornate.glb', opponent: '/weapons/shapes/maul-plain.glb' });
  // The per-opponent override is his alone: the player's estoc never becomes the Plague Doctor's cane.
  assert.deepEqual(shapesFor({ player: 'estoc', opponent: 'estoc', opponentId: 'plaguedoctor', playerLevel: 10, opponentLevel: 10 }, table),
    { player: undefined, opponent: '/weapons/shapes/estoc-cane-ornate.glb' });
  assert.deepEqual(shapesFor({ opponentId: 'goblin', playerLevel: 1, opponentLevel: 1 }), { player: undefined, opponent: undefined }, 'no weapons yet (rigs loading): nothing');
});
