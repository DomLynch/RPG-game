// Zone 1 shows ONE set of bars, and it is the Pit's own (Dom 2026-10-14: "the original ones look better"; reverses Lead 2026-10-10, e2d3e3c3d, which hid the Pit's .combat-hud and kept the shared plate). createZoneBars (src/fight/hud.ts)
// paints the Pit's #opponent-name / #target-health / #player-health / #stamina from the open-world loop; there is no second plate (createMeters and .fm-meters are gone).
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = (p: string): string => readFileSync(new URL(p, import.meta.url), 'utf8');

test('the zone page shows the Pit\'s combat-hud bars when createZoneBars says so (body.zone-bars), and they are the only bars', () => {
  const html = read('./index.html');
  assert.match(html, /#duel\.world \.combat-hud \{ display: none !important; \}/, 'hidden by default: no bars while the hero is whole and nothing is in reach');
  assert.match(html, /body\.zone-bars #duel\.world \.combat-hud \{ display: revert !important;/, 'the Pit\'s own style.css draws it once shown');
  assert.doesNotMatch(html, /fm-meters/, 'no second plate');
  assert.match(read('../../src/fight/meters.css'), /^[^]*\.fm-flash/, 'the hit vignette stays');
  assert.doesNotMatch(read('../../src/fight/meters.css'), /fm-meters|fm-bar|fm-foe|fm-hp|fm-st\b|fm-name/, 'the old plate\'s rules are gone');
  assert.doesNotMatch(read('../../src/fight/hud.ts'), /createMeters|fm-meters/, 'createMeters is gone');
});

test('the Pit\'s posture bars, rank line and status line stay Pit-only on the zone page', () => {
  const html = read('./index.html');
  for (const id of ['#target-posture', '#posture', '#fight-rank', '#combat-status']) assert.ok(html.includes(`#duel.world ${id}`), `${id} hidden in the zone`);
});

test('the Pit\'s bars sit under the HUD stack, and the name-tag floor follows them (the Pit\'s .combat-hud bottom)', () => {
  assert.match(read('./index.html'), /body\.zone-bars #duel\.world \.combat-hud \{[^}]*top: max\(calc\(env\(safe-area-inset-top\) \+ 12px\), calc\(var\(--hud-bottom, 0px\) \+ 8px\)\)/);
  const main = read('./main.ts');
  assert.match(main, /labelFloor = Math\.max\(bottom, Math\.ceil\(document\.querySelector\('\.combat-hud'\)/);
  assert.doesNotMatch(main, /querySelector\('\.fm-meters'\)/);
  assert.match(main, /hudWatch\.observe\(document\.querySelector\('\.combat-hud'\)!\)/);
  assert.match(main, /if \(!duelLayer\.classList\.contains\('infight'\)\) meters\.feed\(wc\)/, 'the duel\'s own createHud paints its bars when a Practice drives them');
});
