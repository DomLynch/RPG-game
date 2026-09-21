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
  // Free-camera orbit + a second finger still zoomed the page on iPhone (owner, 2026-09-21): two-finger moves are refused at the document.
  assert.match(main, /addEventListener\('touchmove', \(event\) => \{ if \(event\.touches\.length > 1\) event\.preventDefault\(\); \}, \{ passive: false \}\)/);
});

test('the journal test tools ship hidden behind the admins roster; opponent choice stays open to everyone', () => {
  const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
  const tools = html.match(/<section id="test-tools"[^>]*>([\s\S]*?)<\/section>/);
  assert.ok(tools, 'a test-tools section wraps the tools');
  assert.match(tools![0], /<section id="test-tools"[^>]*\bhidden\b/);
  for (const id of ['finisher-select', 'damage-mode', 'tempo-mode', 'debug-mode']) assert.match(tools![1], new RegExp(`id="${id}"`));
  assert.doesNotMatch(tools![1], /opponent-select/);
  assert.match(html.replace(tools![0], ''), /id="opponent-select"/);
});

test('the thumb cluster is the one touch layout: the markup carries it and nothing offers another scheme', () => {
  const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
  assert.match(html, /<div class="actions" id="actions" data-gestures="cluster">/);
  assert.doesNotMatch(html, /controls-mode|strike circle|guard ring/);
  for (const file of ['main.ts', 'input.ts', 'hud.ts', 'style.css']) assert.doesNotMatch(readFileSync(new URL(`../src/${file}`, import.meta.url), 'utf8'), /ring8|data-gestures=(?!cluster)/, `${file} still knows the retired scheme`);
});

test('side hints v3 (owner 2026-09-21 "apply that everywhere consistently"): every combat button carries the same five marks; all rest at the same faint weight; one lights only while pressed — Slash the next cut (data-next), Stab the ring, Heavy up, Kick down, Guard the held side (aria-pressed + data-side)', () => {
  const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8'), css = readFileSync(new URL('../src/style.css', import.meta.url), 'utf8');
  const button = (id: string) => html.match(new RegExp(`<button id="${id}-button"[\\s\\S]*?<\\/button>`))![0];
  const compass = button('guard').match(/<svg class="[^"]*side-marks[^"]*"[\s\S]*?<\/svg>/)![0].replace(/class="[^"]*side-marks[^"]*"/, '');
  for (const id of ['guard', 'attack', 'thrust', 'heavy', 'kick']) {
    const b = button(id);
    for (const side of ['overhead', 'low', 'left', 'right', 'straight']) assert.match(b, new RegExp(`class="side side-${side}"`), `${id}: ${side} mark`);
    assert.match(b, /<svg class="[^"]*side-marks[^"]*"[^>]*aria-hidden="true"/, `${id}: decorative, hidden from the accessibility tree`);
    assert.equal(b.match(/<svg[\s\S]*?<\/svg>/)![0].replace(/class="[^"]*side-marks[^"]*"/, ''), compass, `${id}: the same compass as Guard`);
  }
  const rule = css.match(/\/\* one lit mark per button[\s\S]*?\*\/([\s\S]*?)\{ opacity: \.95; stroke-width: 2; \}/)![1];
  for (const sel of ['#attack-button[data-held][data-next=left] .side-left', '#attack-button[data-held][data-next=right] .side-right', '#thrust-button[data-held] .side-straight', '#heavy-button[data-held] .side-overhead', '#kick-button[data-held] .side-low',
    ...['left', 'right', 'overhead', 'low', 'straight'].map((s) => `#guard-button[aria-pressed=true][data-side=${s}] .side-${s}`), '#guard-button[aria-pressed=true]:not([data-side]) .side-straight'])
    assert.ok(rule.includes(sel), `${sel} lights`);
  assert.match(css, /button \.side\{ vector-effect: non-scaling-stroke; opacity: \.3;/, 'the other four rest at .3, same weight on every button size');
  assert.match(css, /#attack-button:not\(\[data-next\]\) \.side-marks\{ opacity: 0; \}/, 'sheathed: no cut is next');
  assert.match(css, /#heavy-button \{\s*width: 58px;\s*height: 58px;/, 'Heavy is wide enough for its label (owner: smaller than Slash, bigger than 50)');
  assert.match(css, /#thrust-button:not\(\[hidden\]\) \{\s*display: block;\s*width: 56px;\s*height: 56px;/, 'Stab ~10% bigger, spacing kept');
  assert.match(css, /prefers-reduced-motion: reduce[\s\S]*side-marks/, 'the fade respects reduced motion');
});

test('guard side: the thumb still is the straight guard; past the slide threshold the dominant axis picks left, right, overhead or low', () => {
  assert.equal(guardSide(0, 0), null); assert.equal(guardSide(GUARD_SLIDE_PX - 1, 0), null); assert.equal(guardSide(NaN, 4), null, 'a hostile delta is the straight guard');
  assert.equal(guardSide(-GUARD_SLIDE_PX, 0), 'left'); assert.equal(guardSide(40, 12), 'right');
  assert.equal(guardSide(6, -30), 'overhead'); assert.equal(guardSide(-10, 30), 'low');
  assert.equal(guardSide(30, 30), 'low', 'a perfect diagonal is the vertical: up and down are the rarer, deliberate slides');
});

test('the versus card is a plain still (owner 2026-09-21: no drift), with a large centred loading line above the pair', () => {
  const css = readFileSync(new URL('../src/style.css', import.meta.url), 'utf8');
  assert.doesNotMatch(css, /versus-drift|\.versus img \{[^}]*animation/, 'no card animation');
  const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
  assert.match(html, /<p class="versus-loading">loading…<\/p>/, 'the loading line on the card');
  const loading = css.match(/\.versus-loading \{([^}]*)\}/)![1];
  assert.match(loading, /top: 28%;/); assert.match(loading, /text-align: center;/); assert.match(loading, /font: 22px Arial;/); assert.match(loading, /opacity: 0\.6;/);
});
