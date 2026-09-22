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
  for (const id of ['loot-panel', 'loot-panel-title', 'loot-panel-pieces', 'loot-panel-note']) assert.ok(hud.includes(`id="${id}"`), id);
  // Take / Leave it belong to the bottom thumb row, not the top band: the first touch after a kill stops the arena-cam tour, and a
  // decision button under that thumb declines the loot by accident (deploy #102's quiet-one rows).
  const actions = html.slice(html.indexOf('<div class="actions" id="actions"'), html.indexOf('</footer>'));
  for (const id of ['loot-panel-actions', 'loot-take', 'loot-decline']) { assert.ok(actions.includes(`id="${id}"`), `${id} must sit in #actions`); assert.ok(!hud.includes(`id="${id}"`), `${id} must not sit in the top band`); }
  assert.match(css, /\.loot-panel \{[^}]*pointer-events: none/);   // the card lets an arena touch through; only its tiles take pointers
  assert.ok(hud.indexOf('id="autopsy"') < hud.indexOf('id="loot-panel"'));
  for (const gone of ['loot-drop', 'loot-choice', 'loot-wear', 'loot-store']) { assert.ok(!html.includes(gone), `${gone} in index.html`); assert.ok(!css.includes(gone), `${gone} in style.css`); }
  assert.ok(!/endgame-fade #loot-panel/.test(css), 'the panel must not fade with the tour');
});

// Decline (the lead's shape, 2026-09-22): a refused offer is the kill recorded with no piece, newest last and capped, and it survives a
// round trip through the stored profile.
test('a declined offer is recorded as a kill with no piece, capped and round-tripped', async () => {
  const { DECLINED_KEPT, cleanLoot, decline, emptyLoot } = await import('../src/loot.ts');
  const kill = { opponent: 'veteran' as const, attempt: 3, healthLeft: 12, recordId: null, day: '2026-09-22' };
  let loot = decline(emptyLoot(), kill);
  assert.deepEqual(loot.declined, [kill]);
  assert.deepEqual(loot.owned, []);
  for (let i = 0; i < DECLINED_KEPT + 5; i++) loot = decline(loot, { ...kill, attempt: i + 1 });
  assert.equal(loot.declined!.length, DECLINED_KEPT);
  assert.equal(loot.declined!.at(-1)!.attempt, DECLINED_KEPT + 5);
  assert.deepEqual(cleanLoot(JSON.parse(JSON.stringify(loot))).declined, loot.declined);
  assert.equal(cleanLoot({ owned: [], equipped: {}, declined: [{ opponent: 'nobody' }] }).declined, undefined);
});
