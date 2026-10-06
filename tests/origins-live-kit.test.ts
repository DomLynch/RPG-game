// The Origins preview's Pit duel wears the game's own fight kit (origins/preview/live-kit.mjs): its controls, HUD bars and ☰ menu are cut
// from the game's index.html at build time, never pasted. These pin that the cut finds every piece, that every element the game's input
// and HUD bind to (and the duel's own glue) is on the preview page, that no id is shared with the walk, and that the preview's own
// hand-made pad and bars are gone.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { cutPiece, LIVE_KIT, liveKit } from '../origins/preview/live-kit.mjs';

const read = (path: string) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
const game = read('index.html'), preview = read('origins/preview/index.html'), page = liveKit(game, preview);
const ids = (source: string) => [...source.matchAll(/\belement(?:<[^>]+>)?\('([a-z-]+)'\)/g)].map((m) => m[1]);

test('every piece of the kit is cut whole from the game', () => {
  for (const opening of LIVE_KIT) {
    const piece = cutPiece(game, opening), tag = /^<([a-z]+)/.exec(opening)![1];
    assert.ok(piece.startsWith(opening) && piece.endsWith(`</${tag}>`), opening);
    assert.ok(page.includes(piece), `${opening} lands on the preview page verbatim`);
  }
  assert.match(cutPiece(game, '<section class="combat-hud"'), /id="loot-panel"[\s\S]*<\/section><\/section>$/, 'nested sections are counted');
});

test('the input, the HUD and the duel glue find every element they bind to', () => {
  const wanted = new Set([...ids(read('src/input.ts')), ...ids(read('src/hud.ts')), ...ids(read('origins/preview/pit-duel.ts'))]);
  assert.ok(wanted.size > 25, `${wanted.size} ids read`);
  for (const id of wanted) assert.match(page, new RegExp(`\\sid="${id}"`), `#${id}`);
});

test('no id is on the page twice, and the preview keeps none of its own controls', () => {
  const all = [...page.matchAll(/\sid="([^"]+)"/g)].map((m) => m[1]);
  assert.deepEqual(all.filter((id, i) => all.indexOf(id) !== i), []);
  assert.doesNotMatch(preview, /data-ctl=|class="pad"|class="meters/, 'the hand-made pad, stick and green bars are gone');
  assert.match(preview, /<button id="leave"[^>]*>Leave the Pit<\/button>/, 'Leave the Pit stays');
});

test('a piece the game drops or doubles fails the build', () => {
  assert.throws(() => cutPiece('<div id="a"></div>', '<div id="joystick"'), /no <div id="joystick"/);
  assert.throws(() => cutPiece('<header></header><header></header>', '<header>'), /more than one/);
  assert.throws(() => cutPiece('<section class="combat-hud"><section>', '<section class="combat-hud"'), /never closed/);
  assert.throws(() => liveKit(game, '<body></body>'), /no <!-- live:fight-kit -->/);
  assert.throws(() => liveKit(game, '<div id="stick"></div><!-- live:fight-kit -->'), /share ids: stick/);
});
