import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { layoutTier } from '../src/layout-tier.ts';

test('the tiers at the viewports this game is played on', () => {
  for (const [w, h, tier] of [[375, 812, 'compact'], [390, 694, 'compact'], [360, 640, 'compact'], [844, 390, 'compact'], [932, 430, 'compact'], [1280, 720, 'standard'], [1366, 768, 'tablet'] /* the source's rule: 768 high and over 1000 wide is a tablet, so a 1366x768 laptop is too; inert until CSS reads it */, [1024, 768, 'tablet'], [1920, 1080, 'tablet'], [768, 1024, 'standard']] as const)
    assert.equal(layoutTier(w, h), tier, `${w}x${h}`);
});

test('no viewport (a headless boot) is the baseline, never a throw', () => {
  assert.equal(layoutTier(0, 0), 'standard'); assert.equal(layoutTier(NaN, 800), 'standard'); assert.equal(layoutTier(375, undefined as unknown as number), 'standard');
});

test('main.ts writes the tier to <html data-tier> on load, resize and rotation, and the CSS does not key off it yet', () => {
  const main = readFileSync(new URL('../src/main.ts', import.meta.url), 'utf8'), css = readFileSync(new URL('../src/style.css', import.meta.url), 'utf8');
  assert.match(main, /dataset\.tier = layoutTier\(window\.innerWidth, window\.innerHeight\)/);
  assert.match(main, /addEventListener\('resize', setTier\)/); assert.match(main, /addEventListener\('orientationchange', setTier\)/);
  assert.doesNotMatch(css, /data-tier/, 'no visual change in this PR');
});
