// The journal's paperdoll layers (scripts/loot-layers.mjs): every loot id the game can drop has a rendered layer in the same frame as the
// figure and a style.css rule that shows it on #slot-<key>[data-loot], and the figure carries one layer element per wearable paperdoll key.
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import test from 'node:test';
import { LOOT, PAPERDOLL, paperdollOf, slotOf } from '../src/loot.ts';

const root = new URL('../', import.meta.url), read = (path: string) => readFileSync(new URL(path, root), 'utf8');
const ids = Object.values(LOOT).flat();

test('every loot id has a rendered layer and its style.css rule', () => {
  const css = read('src/style.css');
  for (const id of ids) {
    assert.ok(existsSync(new URL(`public/game/img/loot/${id}.webp`, root)), `${id}: run node scripts/loot-layers.mjs`);
    assert.ok(css.includes(`#slot-${paperdollOf(slotOf(id))}[data-loot='${id}']`), `${id}: style.css rule missing (regenerate the loot-layers block)`);
  }
});

test('the figure carries one layer per wearable paperdoll key, head drawn last', () => {
  const html = read('index.html'), layers = [...html.matchAll(/<i class="doll-layer" data-layer="(\w+)"><\/i>/g)].map(m => m[1]);
  const wearable = (Object.keys(PAPERDOLL) as (keyof typeof PAPERDOLL)[]).filter(key => PAPERDOLL[key].length);
  assert.deepEqual([...layers].sort(), [...wearable].sort());
  assert.equal(layers.at(-1), 'head');
  assert.match(html, /<div class="doll-figure"><img src="\/game\/img\/fighter\.webp"/);
});
