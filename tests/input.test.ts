import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import ts from 'typescript';
import { GUARD_SLIDE_PX, guardSide } from '../src/input.ts';

test('combat buttons stay DOM hit targets during cooldown so repeated touches are consumed', () => {
  const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
  for (const id of ['attack-button', 'dodge-button', 'guard-button']) {
    const button = html.match(new RegExp(`<button\\b[^>]*id="${id}"[^>]*>`))![0];
    assert.doesNotMatch(button, /\sdisabled(?:\s|=|>)/);
  }
  for (const file of ['main.ts', 'input.ts']) {   // the button grammar lives in input.ts; the entry point keeps the fallback disables
    const source = ts.createSourceFile(file, readFileSync(new URL(`../src/${file}`, import.meta.url), 'utf8'), ts.ScriptTarget.Latest, true);
    function visit(node: ts.Node) {
      if (ts.isPropertyAccessExpression(node) && ['attackButton', 'dodgeButton', 'guardButton'].includes(node.expression.getText(source))) assert.notEqual(node.name.getText(source), 'disabled', 'buttons stay hit targets; use aria-disabled');
      ts.forEachChild(node, visit);
    }
    visit(source);
  }
});

test('page declares double-tap suppression and locks page zoom (owner, 2026-09-17)', () => {
  // Owner's call, overriding the earlier pinch-zoom accessibility rule: an accidental pinch cost the HUD mid-fight;
  // the trade (low-vision players cannot zoom the UI) was stated and accepted. iOS Safari ignores the meta, so
  // main.ts also blocks the gesture itself; this test locks both so the decision is not silently reverted.
  const css = readFileSync(new URL('../src/style.css', import.meta.url), 'utf8');
  assert.match(css.match(/:root\s*\{([^}]+)\}/)![1], /(?:^|;)\s*touch-action\s*:\s*manipulation\s*(?:;|$)/);
  const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
  assert.match(html, /user-scalable\s*=\s*no/);
  assert.match(html, /maximum-scale\s*=\s*1(?:[,"\s])/);
  const main = readFileSync(new URL('../src/main.ts', import.meta.url), 'utf8');
  assert.match(main, /gesturestart/);
});

test('the thumb cluster is the one touch layout: the markup carries it and nothing offers another scheme', () => {
  const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
  assert.match(html, /<div class="actions" id="actions" data-gestures="cluster">/);
  assert.doesNotMatch(html, /controls-mode|strike circle|guard ring/);
  for (const file of ['main.ts', 'input.ts', 'hud.ts', 'style.css']) assert.doesNotMatch(readFileSync(new URL(`../src/${file}`, import.meta.url), 'utf8'), /ring8|data-gestures=(?!cluster)/, `${file} still knows the retired scheme`);
});

test('guard side hint (owner 2026-09-21): the Guard button carries five marks — four rim ticks and the straight ring — and the CSS lights the held side from aria-pressed + data-side', () => {
  const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8'), css = readFileSync(new URL('../src/style.css', import.meta.url), 'utf8');
  const button = html.match(/<button id="guard-button"[\s\S]*?<\/button>/)![0];
  for (const side of ['overhead', 'low', 'left', 'right', 'straight']) assert.match(button, new RegExp(`class="side side-${side}"`), `${side} mark in the markup`);
  assert.match(button, /<svg class="guard-sides"[^>]*aria-hidden="true"/, 'decorative: hidden from the accessibility tree');
  for (const side of ['left', 'right', 'overhead', 'low']) assert.match(css, new RegExp(`#guard-button\\[aria-pressed=true\\]\\[data-side=${side}\\] \\.side-${side}`), `${side} lights while held`);
  assert.match(css, /#guard-button\[aria-pressed=true\]\[data-side=straight\] \.side-straight/); assert.match(css, /#guard-button\[aria-pressed=true\]:not\(\[data-side\]\) \.side-straight/, 'Q on the keyboard lights straight');
  assert.match(css, /prefers-reduced-motion: reduce[\s\S]*guard-sides/, 'the fade respects reduced motion');
});

test('guard side: the thumb still is the straight guard; past the slide threshold the dominant axis picks left, right, overhead or low', () => {
  assert.equal(guardSide(0, 0), null); assert.equal(guardSide(GUARD_SLIDE_PX - 1, 0), null); assert.equal(guardSide(NaN, 4), null, 'a hostile delta is the straight guard');
  assert.equal(guardSide(-GUARD_SLIDE_PX, 0), 'left'); assert.equal(guardSide(40, 12), 'right');
  assert.equal(guardSide(6, -30), 'overhead'); assert.equal(guardSide(-10, 30), 'low');
  assert.equal(guardSide(30, 30), 'low', 'a perfect diagonal is the vertical: up and down are the rarer, deliberate slides');
});

test('the versus card drifts after a second (owner: like the arena cam), and holds still under reduced motion', () => {
  const css = readFileSync(new URL('../src/style.css', import.meta.url), 'utf8');
  assert.match(css, /\.versus img \{[^}]*animation: versus-drift 14s ease-in-out 1s infinite alternate;/, 'one second still, then a slow alternating drift');
  assert.match(css, /@keyframes versus-drift \{[\s\S]{0,300}?scale\(1\.06\)/, 'a gentle push-in, never a cut');
  assert.match(css, /prefers-reduced-motion: reduce\) \{\s*\.versus img \{ animation: none; \}/, 'reduced motion keeps the still');
});
