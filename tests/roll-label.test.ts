import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

// Dom 2026-09-25: the dodge button is a roll, so every player-facing name for it says Roll (the tap is still a step back).
// Internal ids (dodge-button, the 'step' intent, records) are untouched.
const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');

test('the dodge button is labelled Roll on every surface', () => {
  const button = html.match(/<button id="dodge-button"[^>]*>[^<]*</)?.[0] ?? '';
  assert.match(button, /data-mobile="Roll"/, 'phone label');
  assert.match(button, /aria-label="Roll, tap to step back"/, 'screen-reader label');
  assert.match(button, />Roll · tap to step back</, 'desktop label');
  assert.doesNotMatch(button, /\bStep\b/, 'no Step name on the button');
});

test('the how-to and key help name the button Roll', () => {
  assert.match(html, /Kick inside, Roll and Guard below\./);
  assert.match(html, /Tap Roll to step back \(no invulnerability\); hold it to roll\./);
  assert.match(html, /<kbd>E<\/kbd> roll \(tap: step back\)/);
  assert.doesNotMatch(html, /Step and Guard below|Tap dodge to step back|<kbd>E<\/kbd> step\/roll/);
});
