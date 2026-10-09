import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

// Dom's player-visible rulings in Web's area (HUD, layout, menu), each pinned by name (rule 2026-10-08: every visual ruling gets a named test the same day).
const main = readFileSync(new URL('./main.ts', import.meta.url), 'utf8'), html = readFileSync(new URL('./index.html', import.meta.url), 'utf8');
const css = readFileSync(new URL('../../src/style.css', import.meta.url), 'utf8');

test('Dom 2026-10-07: Pit controls in the world, the camera lock is ON by default and the ☰ menu toggles it (saved in the page\'s own key)', () => {
  assert.match(main, /camLock = true/, 'locked until the player turns it off');
  assert.match(main, /camLock = localStorage\.getItem\(CAMLOCK_KEY\) !== 'off'/, 'only an explicit "off" frees it');
  assert.match(main, /chip\.textContent = camLock \? 'Camera locked' : 'Camera free'/, 'the chip names the state');
  assert.match(main, /chip\?\.addEventListener\('click', \(\) => \{ camLock = !camLock;/, 'the chip toggles it');
});

test('Dom / Lead 2026-10-07: the main screen is the combat HUD and the ☰ only; the preview\'s own floating sticks and extra buttons leave it', () => {
  assert.match(html, /body\.kit #move-stick, body\.kit #look-stick \{ display: none; \}/, 'the Pit\'s controls replace the preview\'s sticks');
  assert.match(html, /body\.kit #walk-journal, body\.kit #allegiance \{ display: none; \}/, 'Journal and Allegiance are in the ☰, not on the main screen');
});

test('Web 2026-10-07 (#1724): the take-one offer takes the end-screen column slot above Next, and DUEL is never in the hidden set (display:none is the only way it leaves)', () => {
  const offer = /:root:has\(#loot-panel-actions:not\(\[hidden\]\)\) \.actions\[data-gestures=cluster\] \.loot-panel-actions \{[^}]*bottom: calc\(var\(--end-base\) \+ 56px\)[^}]*\}/.exec(css);
  assert.ok(offer, 'the offer sits at end-base + 56 px, above Next, in the right-hand column');
  const hidden = /:root:has\(#loot-panel-actions:not\(\[hidden\]\)\) \.actions\[data-gestures=cluster\] :is\(([^)]*)\) \{ visibility: hidden; \}/.exec(css);
  assert.ok(hidden, 'the rest of the column waits while the offer is up');
  assert.doesNotMatch(hidden![1], /#duel-button/, 'DUEL is display:none or shown, never an empty slot (tests/duel-share.test.ts)');
  assert.doesNotMatch(hidden![1], /#reset-button/, 'Next is never hidden by the offer: it must stay tappable');
});
