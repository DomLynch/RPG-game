// Zone 1 shows ONE set of bars (Lead 2026-10-10): the shared meters (src/fight/hud.ts createMeters, src/fight/meters.css). The Pit's own bars (.combat-hud) are Pit-only and hidden on the zone page.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = (p: string): string => readFileSync(new URL(p, import.meta.url), 'utf8');

test('the zone page hides the Pit\'s combat-hud bars (the shared meters are the only bars)', () => {
  assert.match(read('./index.html'), /#duel\.world \.combat-hud \{ display: none !important; \}/);
});

test('the shared meters sit under the HUD stack, and the name-tag floor follows them, not the hidden Pit bars', () => {
  assert.match(read('../../src/fight/meters.css'), /\.fm-meters \{[^}]*top: max\(calc\(env\(safe-area-inset-top\) \+ 12px\), calc\(var\(--hud-bottom, 0px\) \+ 8px\)\)/);
  const main = read('./main.ts');
  assert.match(main, /labelFloor = Math\.max\(bottom, Math\.ceil\(document\.querySelector\('\.fm-meters'\)/);
  assert.doesNotMatch(main, /querySelector\('\.combat-hud'\)/);
  assert.match(main, /hudWatch\.observe\(document\.querySelector\('\.fm-meters'\)!\)/);
});
