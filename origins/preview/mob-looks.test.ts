// The Frontier look table covers every hostile in origins/region1/content.ts, agrees with the body that file names, keeps the three goblin mobs and the two witches
// visibly different from each other, and stays inside sane ranges. Pure: no three.js, no DOM.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { FOES } from '../region1/content.ts';
import { ROSTER } from '../../src/roster.ts';
import { MOB_LOOKS, mobLook } from './mob-looks.ts';

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
