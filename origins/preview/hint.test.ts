import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const main = readFileSync(new URL('./main.ts', import.meta.url), 'utf8'), html = readFileSync(new URL('./index.html', import.meta.url), 'utf8');

test('the first-load hint card: gone after the first thumb move, hidden while the Journal is open, back after it if unspent (Lead 2026-10-07)', () => {
  assert.match(main, /if \(forward \|\| turn \|\| strafe \|\| pitch\) \{ hint\.hidden = true; hintMoved = true; \}/, 'any move, look or tilt spends the hint');
  assert.match(main, /if \(kind === 'journal'\) hint\.hidden = true; else if \(was === 'journal' && !hintMoved\) hint\.hidden = false;/, 'the Journal and the hint never stack; closing the Journal gives an unspent hint back');
});

test('the preview header is one short line at 375: the controls live in the hint card, not twice', () => {
  const line = /<small class="walk-only">([^<]*)<\/small>/.exec(html)?.[1] ?? '';
  assert.equal(line, 'Greybox preview · not the game'); assert.ok(line.length <= 32, 'fits the ~239 px header column at 12 px');
});

test('the health and stamina bars sit under the hint and creature card, never over their text (Lead 2026-10-07, 375 wide)', () => {
  assert.match(main, /setProperty\('--hud-bottom'/, 'main.ts measures the HUD stack');
  assert.match(html, /#duel\.world \.combat-hud \{ top: max\([^;]*var\(--hud-bottom/, 'the bars start below that measure');
});

// Dom/Lead rulings 2026-10-07 on the world duel's chrome (Web's sweep, #1750): at fight-camera distance nothing may cover the foe or the status lines. Pinned by name so it cannot drift back.
test('world duel chrome: the wordmark, the hint, the creature card and the empty #art-status box are off during a fight; the duel\'s own bars and Leave stay', () => {
  assert.match(html, /#duel\.world header \.brand \{ visibility: hidden; \}/, 'the FRANKENDOM / ORIGINS wordmark is hidden (visibility, not display, so the menu button stays put)');
  assert.match(html, /body\.infight #hint, body\.infight #creature-card \{ display: none; \}/, 'the walk hint and the creature card are off during a fight');
  const revert = /#duel\.world\.infight #opponent-name[^{]*\{ display: revert !important; \}/.exec(html)?.[0] ?? '';
  assert.match(revert, /#target-health/); assert.match(revert, /#leave/);
  assert.doesNotMatch(revert, /#art-status/, 'the empty status box drew as a dark slate rectangle mid-screen');
  assert.match(main, /document\.body\.classList\.add\('infight'\)/); assert.match(main, /document\.body\.classList\.remove\('infight'\)/);
});
