// The journal's paperdoll layers (scripts/loot-layers.mjs): every loot id the game can drop has a rendered layer in the same frame as the
// figure and a style.css rule that shows it on #slot-<key>[data-loot], and the figure carries one layer element per wearable paperdoll key.
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import test from 'node:test';
import { LOOT, PAPERDOLL, isWeaponLoot, paperdollOf, slotOf } from '../src/loot.ts';

const root = new URL('../', import.meta.url), read = (path: string) => readFileSync(new URL(path, root), 'utf8');
// Armour only: weapon ids (Weapons' PAPERDOLL.main slots) have no loot.glb draw; their visual is the equip file, a separate render path.
// The off hand IS drawn (the Shield is armour in scripts/loot-layers.mjs); leaving it out here is how #slot-undefined went unseen.
const armour = (key: string) => key !== 'main';
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
  assert.deepEqual(layers.slice(-2), ['head', 'crest']);   // the helmet over everything, the crest over the helmet
  assert.match(html, /<div class="doll-figure"><img src="\/game\/img\/fighter\.webp"/);
});

test('every generated paperdoll rule names a real slot and a real layer', () => {
  const css = read('src/style.css'), html = read('index.html');
  const block = css.slice(css.indexOf('/* loot-layers:start'), css.indexOf('/* loot-layers:end */'));
  const rules = [...block.matchAll(/#slot-(\w+)\[data-loot='([\w.]+)'\]\) \.doll-layer\[data-layer='(\w+)'\]/g)];
  assert.ok(rules.length > 0, 'loot-layers block is empty');
  for (const [, slot, id, layer] of rules) {
    assert.equal(slot, paperdollOf(slotOf(id as never)), `${id}: rule keys #slot-${slot}`);
    assert.equal(layer, slot, `${id}: layer ${layer} is not its slot's`);
    assert.ok(html.includes(`id="slot-${slot}"`) && html.includes(`data-layer="${slot}"`), `${id}: #slot-${slot} or its layer is not in index.html`);
  }
  assert.ok(rules.some(([, slot]) => slot === 'off'), 'the Shield maps to the off hand');
});

// Each paperdoll slot is drawn ONCE: one row and one layer per key. A piece is one mesh per material (shieldmaiden.Body = Steel +
// Leather), so a list built from worn meshes repeats slots ("Body, Helmet, Helmet" in #709's captions); the paperdoll is keyed, not listed.
test('the paperdoll renders each slot once', () => {
  const html = read('index.html');
  for (const key of Object.keys(PAPERDOLL)) {
    assert.equal(html.split(`id="slot-${key}"`).length - 1, 1, `#slot-${key} appears once`);
    assert.ok(html.split(`data-layer="${key}"`).length - 1 <= 1, `layer ${key} appears at most once`);
  }
  assert.equal([...html.matchAll(/class="slot(?: on)?" id="slot-/g)].length, Object.keys(PAPERDOLL).length, 'one row per paperdoll key, no extras');
});

// The kill screen's Take-one panel (src/loot-panel.ts): its ids in the HUD band under the rank line, outside the endgame fade group, and
// the old drop line + Wear/Store row gone (one loot UI).
test('the Take-one panel is in the HUD under the rank line and the old drop line is gone', () => {
  const html = read('index.html'), css = read('src/style.css');
  const hud = html.slice(html.indexOf('<section class="combat-hud"'), html.indexOf('</section></section>'));
  for (const id of ['loot-panel', 'loot-panel-head', 'loot-panel-hero', 'loot-panel-title', 'loot-panel-name', 'loot-panel-pieces', 'loot-panel-note']) assert.ok(hud.includes(`id="${id}"`), id);
  // Take / Leave it belong to the bottom thumb row, not the top band: the first touch after a kill stops the arena-cam tour, and a
  // decision button under that thumb declines the loot by accident (deploy #102's quiet-one rows).
  const actions = html.slice(html.indexOf('<div class="actions" id="actions"'), html.indexOf('</footer>'));
  for (const id of ['loot-panel-actions', 'loot-take', 'loot-decline']) { assert.ok(actions.includes(`id="${id}"`), `${id} must sit in #actions`); assert.ok(!hud.includes(`id="${id}"`), `${id} must not sit in the top band`); }
  assert.ok(!html.includes('id="loot-take"'), 'the Take button is gone: a tap on a tile is the take (Dom, 2026-09-22)');
  assert.match(css, /\.loot-panel \{[^}]*pointer-events: none/);   // the card lets an arena touch through; only its tiles take pointers
  assert.ok(hud.indexOf('id="fight-rank"') < hud.indexOf('id="loot-panel"'));
  assert.ok(!html.includes('id="autopsy"'), 'the death-screen autopsy is gone (Dom 2026-09-23): the rank line took its place');
  for (const gone of ['loot-drop', 'loot-choice', 'loot-wear', 'loot-store']) { assert.ok(!html.includes(gone), `${gone} in index.html`); assert.ok(!css.includes(gone), `${gone} in style.css`); }
  assert.ok(!/endgame-fade #loot-panel/.test(css), 'the panel must not fade with the tour');
  assert.ok(!/endgame-(fade|hush) #fight-rank/.test(css), 'the rank row is permanent with the meters (Dom 2026-09-24): it never fades');
  assert.ok(hud.indexOf('id="fight-rank"') < hud.indexOf('id="combat-status"'), 'the event line sits under the rank row');
  assert.ok(!/data-threat=true/.test(css), 'the red threat banner is gone');
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

// Every id the Take panel can offer has a picture (live defect 2026-09-25: the Nightborn's Estoc tile showed its name alone). Weapons are
// rendered from their equip files by scripts/weapon-thumbs.mjs, armour by scripts/loot-layers.mjs.
test('every loot id, weapons included, has a kill-screen thumbnail', () => {
  for (const id of Object.values(LOOT).flat())
    assert.ok(existsSync(new URL(`public/game/img/loot/${id}.thumb.webp`, root)), `${id}: thumbnail missing (${isWeaponLoot(id) ? 'node scripts/weapon-thumbs.mjs' : 'node scripts/loot-layers.mjs'})`);
});

// The layers are a pure function of loot.glb and warrior.glb (two renders of one file diff byte-identical, Armour 2026-09-26) and they are
// committed, so a loot.glb PR that forgets to re-render ships stale layers: trunk carried twelve that day. The generated block carries a stamp.
test('loot-layers: the committed Profile layers were rendered from the shipped loot.glb and warrior.glb (else run node scripts/loot-layers.mjs)', () => {
  const css = readFileSync(new URL('../src/style.css', import.meta.url), 'utf8');
  const stamp = css.match(/\/\* loot-layers: rendered from (.*?) \*\//)?.[1];
  assert.ok(stamp, 'style.css carries a loot-layers stamp inside the generated block');
  const now = ['loot.glb', 'warrior.glb'].map((f) => `${f} ${createHash('sha256').update(readFileSync(new URL(`../src/assets/${f}`, import.meta.url))).digest('hex').slice(0, 12)}`).join(' ');
  assert.equal(stamp, now, 'the layers are stale for the shipped rig or loot file: run node scripts/loot-layers.mjs and commit public/game/img and src/style.css');
});
