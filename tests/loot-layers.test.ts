// The journal's paperdoll layers (scripts/loot-layers.mjs): every loot id the game can drop has a rendered layer in the same frame as the
// figure and a style.css rule that shows it on #slot-<key>[data-loot], and the figure carries one layer element per wearable paperdoll key.
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import test from 'node:test';
import { LOOT, PAPERDOLL, paperdollOf, slotOf } from '../src/loot.ts';

const root = new URL('../', import.meta.url), read = (path: string) => readFileSync(new URL(path, root), 'utf8');
// Armour only: weapon ids (Weapons' PAPERDOLL.main slots) have no loot.glb draw; their visual is the equip file, a separate render path.
const armour = (key: string) => key !== 'main' && key !== 'off';
const ids = Object.values(LOOT).flat().filter(id => armour(paperdollOf(slotOf(id))));

test('every armour loot id has a rendered layer and its style.css rule', () => {
  const css = read('src/style.css');
  for (const id of ids) {
    assert.ok(existsSync(new URL(`public/game/img/loot/${id}.webp`, root)), `${id}: run node scripts/loot-layers.mjs`);
    assert.ok(existsSync(new URL(`public/game/img/loot/${id}.thumb.webp`, root)), `${id}: kill-screen thumbnail missing (run node scripts/loot-layers.mjs)`);
    assert.ok(css.includes(`#slot-${paperdollOf(slotOf(id))}[data-loot='${id}']`), `${id}: style.css rule missing (regenerate the loot-layers block)`);
  }
});

test('the figure carries one layer per wearable paperdoll key, head drawn last', () => {
  const html = read('index.html'), layers = [...html.matchAll(/<i class="doll-layer" data-layer="(\w+)"><\/i>/g)].map(m => m[1]);
  const wearable = (Object.keys(PAPERDOLL) as (keyof typeof PAPERDOLL)[]).filter(key => armour(key) && PAPERDOLL[key].length);
  assert.deepEqual([...layers].sort(), [...wearable].sort());
  assert.equal(layers.at(-1), 'head');
  assert.match(html, /<div class="doll-figure"><img src="\/game\/img\/fighter\.webp"/);
});

// The kill screen's Take-one panel (src/loot-panel.ts): its ids in the HUD band under the autopsy, outside the endgame fade group, and
// the old drop line + Wear/Store row gone (one loot UI).
test('the Take-one panel is in the HUD under the autopsy and the old drop line is gone', () => {
  const html = read('index.html'), css = read('src/style.css');
  const hud = html.slice(html.indexOf('<section class="combat-hud"'), html.indexOf('</section></section>'));
  for (const id of ['loot-panel', 'loot-panel-title', 'loot-panel-pieces', 'loot-take', 'loot-decline', 'loot-panel-note']) assert.ok(hud.includes(`id="${id}"`), id);
  assert.ok(hud.indexOf('id="autopsy"') < hud.indexOf('id="loot-panel"'));
  for (const gone of ['loot-drop', 'loot-choice', 'loot-wear', 'loot-store']) { assert.ok(!html.includes(gone), `${gone} in index.html`); assert.ok(!css.includes(gone), `${gone} in style.css`); }
  assert.ok(!/endgame-fade #loot-panel/.test(css), 'the panel must not fade with the tour');
  assert.match(css, /\.loot-panel \{[^}]*pointer-events: auto/);
});
