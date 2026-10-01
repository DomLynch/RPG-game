import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

// Dom via Strategy 2026-10-01 (GPT concepts 01 + 04): the app tab bar is at the TOP under the header, Stats and Settings are the header's corner
// icons, and the Stats screen is built from the real scorecard (scripts/stats-screen-check.mjs reads it in a browser).
const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8'), css = readFileSync(new URL('../src/style.css', import.meta.url), 'utf8'), main = readFileSync(new URL('../src/main.ts', import.meta.url), 'utf8');

test('the tab bar sits at the top, sticky, and the bottom bar is gone', () => {
  assert.match(css, /#journal \.app-nav \{ order: -1; position: sticky; top: 0; bottom: auto;/);
  assert.doesNotMatch(css, /#journal \.app-nav \{[^}]*position: sticky; bottom: 0/);
  assert.match(css, /#journal \.tab-strip \{ position: absolute; top: 6px; right: 8px;/, 'Stats and Settings ride in the header corner');
  assert.match(html, /<nav id="app-nav"[^>]*>(?:<button[^>]*id="nav-pit">The Pit<\/button><button[^>]*id="nav-gear"[^>]*>Gear &amp; pack<\/button><button[^>]*id="nav-arena">Arena<\/button>)/);
});

test('the Gear stage is its own window, with Main hand and Off hand as two wide tiles under it', () => {
  assert.match(html, /<div id="gear-window" class="gear-window" aria-hidden="true"><\/div>/);
  assert.match(main, /enterGearRoom\(view\.pitStage\(pitLoot\), element\('gear-window'\)/, 'the mannequin frames in the window, not the whole doll');
  assert.match(css, /#journal \.doll \[data-slot='main'\] \{ grid-column: 1; \} #journal \.doll \[data-slot='off'\] \{ grid-column: 2; \}/);
});

test('the Stats screen reads the scorecard and the loot, and its foot button follows the Pit door', () => {
  for (const id of ['stat-fights', 'stat-wins', 'stat-losses', 'opponent-list', 'stats-gear-name', 'stats-gear-view', 'stats-return']) assert.match(html, new RegExp(`id="${id}"`));
  assert.match(main, /const all = totals\(scorecard\);/); assert.match(main, /'Unfought'/);
  assert.match(main, /pitButton\.hidden \? 'Back to the arena' : 'Return to the Pit'/);
});
