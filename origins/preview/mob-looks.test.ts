// The Frontier look table covers every hostile in origins/region1/content.ts, agrees with the body that file names, keeps the three goblin mobs and the two witches
// visibly different from each other, and stays inside sane ranges. Pure: no three.js, no DOM.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { FOES } from '../region1/content.ts';
import { ROSTER } from '../../src/roster.ts';
import { MOB_LOOKS, MOB_SPREAD, VARIANTS, mobLook, mobVariant, variantLook } from './mob-looks.ts';

test('every Frontier foe has exactly one look, on the body content.ts names', () => {
  const foes = FOES as unknown as { id: string; encounterForms: { opponent: string }[] }[];
  assert.deepEqual(Object.keys(MOB_LOOKS).sort(), foes.map(f => f.id).sort());
  for (const f of foes) {
    const look = MOB_LOOKS[f.id]!;
    assert.ok(f.encounterForms.every(e => e.opponent === look.opponent), `${f.id}: look body ${look.opponent} != ${f.encounterForms.map(e => e.opponent)}`);
    assert.ok(look.opponent in ROSTER, `${f.id}: ${look.opponent} is not a roster body`);
  }
});

test('ranges: scale, dressing and tint are sane; a friendly figure has no look', () => {
  for (const [id, l] of Object.entries(MOB_LOOKS)) {
    assert.ok(l.scale >= .7 && l.scale <= 1.6, `${id} scale ${l.scale}`);
    for (const v of [l.dressing.soot, l.dressing.burnt]) assert.ok(v >= 0 && v <= 1, `${id} dressing ${v}`);
    assert.ok(Number.isInteger(l.tint) && l.tint >= 0 && l.tint <= 0xffffff, `${id} tint`);
  }
  assert.equal(mobLook('character:warden-brannoc'), null);
});

test('figures that share a body differ in tint and in height', () => {
  const share = (body: string) => Object.entries(MOB_LOOKS).filter(([, l]) => l.opponent === body && !l.later);
  for (const body of ['witch', 'goblin']) {
    const group = share(body);
    assert.ok(group.length >= 2, body);
    for (let i = 0; i < group.length; i++) for (let j = i + 1; j < group.length; j++) {
      const [a, b] = [group[i]![1], group[j]![1]];
      assert.ok(Math.abs(a.scale - b.scale) >= .1, `${group[i]![0]} vs ${group[j]![0]}: scale ${a.scale} / ${b.scale}`);
      assert.notEqual(a.tint, b.tint, `${group[i]![0]} vs ${group[j]![0]} share a tint`);
    }
  }
});

test('visual spread: variant 0 is the table look, the others are distinct, stable and inside the kind\'s ranges', () => {
  for (const [id, spread] of Object.entries(MOB_SPREAD)) {
    const base = MOB_LOOKS[id]!;
    assert.equal(variantLook(id, 0), base, `${id}: variant 0 IS the table look, so a lone figure is unchanged`);
    const seen = new Set<string>();
    for (let v = 0; v < VARIANTS; v++) {
      const l = variantLook(id, v)!;
      assert.equal(variantLook(id, v), l, `${id}#${v}: the same object every call (the cloth-clone cache is keyed on it)`);
      assert.equal(l.opponent, base.opponent, `${id}#${v}: same body`);
      assert.ok(Math.abs(l.scale / base.scale - 1) <= spread.scale + 1e-3, `${id}#${v}: scale ${l.scale} inside +-${spread.scale} of ${base.scale}`);
      assert.ok(Math.abs(l.dressing.soot - base.dressing.soot) <= spread.soot + 1e-9 && Math.abs(l.dressing.burnt - base.dressing.burnt) <= spread.burnt + 1e-9, `${id}#${v}: dressing`);
      for (const n of [l.dressing.soot, l.dressing.burnt]) assert.ok(n >= 0 && n <= 1);
      assert.ok([base.tint, ...spread.tints].includes(l.tint), `${id}#${v}: the tint comes from the pool`);
      seen.add(`${l.tint}/${l.scale}`);
    }
    assert.equal(seen.size, VARIANTS, `${id}: ${VARIANTS} variants, all different`);
  }
});

test('visual spread: a creature always gets the same variant, a camp of four mostly differs, kinds stay apart by height', () => {
  const id = 'character:cinder-scavenger';
  assert.equal(mobVariant(id, 'zone1-mob-3'), mobVariant(id, 'zone1-mob-3'));
  const camp = new Set([0, 1, 2, 3, 4, 5].map((i) => mobVariant(id, `scavengers-${i}`)));
  assert.ok(camp.size >= 4, `six creatures wear ${camp.size} different looks`);
  assert.equal(mobVariant('character:hrungnir', 'x'), MOB_LOOKS['character:hrungnir'], 'a named foe has no spread');
  assert.equal(mobVariant('character:warden-brannoc', 'x'), null, 'a friendly figure has no look');
  const band = (id: string) => { const h = Array.from({ length: VARIANTS }, (_, v) => variantLook(id, v)!.scale); return [Math.min(...h), Math.max(...h)]; };
  const [scav, brood, ghoul] = ['character:cinder-scavenger', 'character:mere-brood', 'character:ruin-ghoul'].map(band) as [number[], number[], number[]];
  assert.ok(scav[0]! - brood[1]! >= .01 && ghoul[0]! - scav[1]! >= .01, `the three goblin kinds keep their height order: ${brood} < ${scav} < ${ghoul}`);
});

// Dom 2026-10-07 (the Ash Wolf): a creature is the same size walking and fighting, or it shrinks or grows when the fight starts. The walk draws the roster
// body x look.scale (mobs-view.ts dressMob); the duel draws the roster body as built (main.ts dress: dressMob(root, look, false)), so any scale but 1 changes
// size at the fight. These were drawn that way before the ruling and each needs one (match the fight to the walk in the sim, or the walk to 1); the list
// may only shrink, and a new look cannot join it.
const SIZE_CHANGES_AT_FIGHT: Readonly<Record<string, number>> = { 'character:mere-mother': 1.35, 'character:hrungnir': 1.5, 'character:peg-powler': .95, 'character:cinder-scavenger': .9,
  'character:mere-brood': .75, 'character:ruin-ghoul': 1.1, 'character:lambton-worm': 1.2 };
test('every look is the same size walking and fighting (Dom 2026-10-07), apart from the listed ones awaiting a ruling', () => {
  for (const [id, look] of Object.entries(MOB_LOOKS)) assert.equal(look.scale, SIZE_CHANGES_AT_FIGHT[id] ?? 1, `${id} walks at ${look.scale}x its fight body (the duel draws it at 1)`);
  for (const id of Object.keys(SIZE_CHANGES_AT_FIGHT)) assert.ok(MOB_LOOKS[id], `${id} is gone: drop it from the list`);
});
