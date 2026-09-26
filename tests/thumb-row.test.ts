// SHARE's thumb-row rule (C1, Dom 2026-09-25; Lead: one negative case so a SHARE moved onto Next fails). The rects are the 375x812
// layout: Next (175, 637, 176x56), the joystick (16, 670, 108x108), SHARE's 60x60 target at (20, 590).
import test from 'node:test';
import assert from 'node:assert/strict';
import { shareFaults } from '../scripts/lib/thumb-row.mjs';

const next = { x: 175, y: 637, w: 176, h: 56 }, joystick = { x: 16, y: 670, w: 108, h: 108 }, share = { x: 20, y: 590, w: 60, h: 60 };

test('SHARE at its C1 place breaks no rule', () => assert.deepEqual(shareFaults(share, next, joystick), []));
test('SHARE moved onto Next fails', () => assert.deepEqual(shareFaults({ ...share, x: 200, y: 640 }, next, joystick), ['over Next']));
test('SHARE moved onto the joystick fails', () => assert.deepEqual(shareFaults({ ...share, y: 700 }, next, joystick), ['over the joystick']));
test('SHARE lifted over the arena fails', () => assert.deepEqual(shareFaults({ ...share, y: 500 }, next, joystick), ['above the thumb row']));
test('no SHARE shown, nothing to check', () => assert.deepEqual(shareFaults(undefined, next, joystick), []));

test('SHARE keeps its label on a phone: its span outranks the rule that hides the cluster buttons\' spans', async () => {
  const { readFileSync } = await import('node:fs');
  const css = readFileSync(new URL('../src/style.css', import.meta.url), 'utf8');
  assert.match(css, /\.actions button span \{\s*display: none;/, 'the phone rule this overrides');
  assert.match(css, /#actions \.share-button span \{ display: block;/);
  assert.match(readFileSync(new URL('../index.html', import.meta.url), 'utf8'), /id="share-button"[^>]*>.*?<span>SHARE<\/span><\/button>/);
});
