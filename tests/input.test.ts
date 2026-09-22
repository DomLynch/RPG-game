import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import ts from 'typescript';
import { GUARD_DEAD_BAND_DEG, GUARD_SLIDE_PX, guardSide } from '../src/input.ts';
import type { Direction } from '../src/moves.ts';

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
  assert.match(main, /addEventListener\('touchstart'[^\n]*touches\.length > 1[^\n]*preventDefault/, 'the second finger is refused at touchstart, not only touchmove');
  // iOS Safari zooms the page into any focused form control whose font is under 16px and leaves it zoomed after the control
  // closes (owner's phone, 2026-09-21: the journal's 14px opponent select). Every rule that styles a focusable control keeps a 16px floor.
  // Innermost blocks only, with every @media wrapper stripped first: a control rule inside a media query is a rule like any other
  // (the first version of this lock swallowed whole @media blocks as one rule's body and never saw the selectors inside them).
  const controlRules = (sheet: string) => [...sheet.replace(/@media[^{]*\{/g, '').matchAll(/([^{}]+)\{([^{}]*)\}/g)]
    .filter(([, selector]) => /(^|[\s>+~,])(input|select|textarea)\b/.test(selector) && !/type=/.test(selector));   // element selectors only: .menu-select is a label wrapper
  const under16 = (sheet: string) => controlRules(sheet).flatMap(([, selector, body]) => {
    const size = body.match(/font(?:-size)?\s*:[^;]*?(\d+(?:\.\d+)?)px/);
    return size && Number(size[1]) < 16 ? [`${selector.trim()} sets ${size[1]}px`] : [];
  });
  assert.ok(controlRules(css).length >= 2, 'the stylesheet styles the name input and the journal selects');
  assert.deepEqual(under16(css), [], 'focusable controls must be 16px or larger so iOS does not zoom');
  // The lock itself is checked against what it must catch: a 14px select at the top level, inside a media query, and inside a nested one.
  assert.deepEqual(under16('.menu-select select { font: 600 14px/1 sans-serif; }'), ['.menu-select select sets 14px']);
  assert.deepEqual(under16('@media (max-width:700px) { .menu-select select { font-size: 14px; } }'), ['.menu-select select sets 14px']);
  assert.deepEqual(under16('.journal { @media (pointer:coarse) { input { padding: 9px; font-size: 15.5px; } } } select { font-size: 16px; }'), ['input sets 15.5px']);
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
  assert.match(css, /#attack-button \{\s*width: 60px;\s*height: 60px;/, 'Slash -10% (owner)');
  assert.match(button('guard'), /side-overhead" d="M32-6l/, 'v5: the ticks sit outside the rim (apex past the viewBox)'); assert.match(button('guard'), /side-left" d="M-6 32l/); assert.match(button('guard'), /side-right" d="M70 32l/); assert.match(button('guard'), /side-low" d="M32 70l/);
  assert.match(css, /button \.side-marks\{[^}]*overflow: visible/, 'the SVG may draw past the button');
  assert.match(css, /prefers-reduced-motion: reduce[\s\S]*side-marks/, 'the fade respects reduced motion');
});

test('guard side: the thumb still is the straight guard; past the slide threshold the dominant axis picks left, right, overhead or low', () => {
  assert.equal(guardSide(0, 0), null); assert.equal(guardSide(GUARD_SLIDE_PX - 1, 0), null); assert.equal(guardSide(NaN, 4), null, 'a hostile delta is the straight guard');
  assert.equal(guardSide(-GUARD_SLIDE_PX, 0), 'left'); assert.equal(guardSide(40, 12), 'right');
  assert.equal(guardSide(6, -30), 'overhead'); assert.equal(guardSide(-10, 30), 'low');
  assert.equal(guardSide(30, 30), 'low', 'a perfect diagonal is the vertical: up and down are the rarer, deliberate slides');
});

test('guard side hysteresis (brief 7): a held side keeps its axis through a wobble near the diagonal; the thumb must go GUARD_DEAD_BAND_DEG past it to switch; a fresh slide still picks the dominant axis', () => {
  const deg = (angle: number, r = 30) => [r * Math.cos(angle * Math.PI / 180), -r * Math.sin(angle * Math.PI / 180)] as const;   // angle from +x toward up (screen y is down)
  const walk = (angles: number[], start: Direction | null = null) => { let side: Direction | null = start; const seen: (string | null)[] = []; for (const a of angles) { const [dx, dy] = deg(a); side = guardSide(dx, dy, side); seen.push(side); } return seen; };
  assert.equal(GUARD_DEAD_BAND_DEG, 15, 'the band the owner tunes on the phone (12–18°)');
  // a right-hand slide that wobbles across the 45° diagonal between right and overhead: right holds until 45 + band
  assert.deepEqual(walk([10, 40, 50, 55, 44, 58, 62]), ['right', 'right', 'right', 'right', 'right', 'right', 'overhead'], 'right holds through 50–58°, switches past 60°');
  // …and back: overhead now holds until 45 - band
  assert.deepEqual(walk([62, 50, 40, 32, 28], 'overhead'), ['overhead', 'overhead', 'overhead', 'overhead', 'right'], 'overhead holds down to 32°, switches below 30°');
  // no side held: the dominant axis decides at once (44° = right, 46° = overhead), as before
  assert.deepEqual(walk([44]), ['right']); assert.deepEqual(walk([46]), ['overhead']);
  // the other quadrants and signs
  assert.equal(guardSide(...deg(190), 'low'), 'left', 'a held low gives way at 10° from horizontal: that is 35° past the diagonal, far outside the band');
  assert.equal(guardSide(...deg(240), 'left'), 'left', 'left holds to 60° below horizontal'); assert.equal(guardSide(...deg(242), 'left'), 'low', 'past the band: low');
  // the slide threshold and the straight guard are untouched by the band: inside GUARD_SLIDE_PX the side is null whatever was held
  assert.equal(guardSide(5, 5, 'left'), null); assert.equal(guardSide(-GUARD_SLIDE_PX, 0, 'overhead'), 'left', 'a straight-left slide from a held overhead is left: 0° is far outside the band');
});

test('the versus card is a plain still (owner 2026-09-21: no drift), with a large centred loading line above the pair', () => {
  const css = readFileSync(new URL('../src/style.css', import.meta.url), 'utf8');
  assert.doesNotMatch(css, /versus-drift|\.versus img \{[^}]*animation/, 'no card animation');
  const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
  assert.match(html, /<p class="versus-loading">loading…<\/p>/, 'the loading line on the card');
  const loading = css.match(/\.versus-loading \{([^}]*)\}/)![1];
  assert.match(loading, /top: 28%;/); assert.match(loading, /text-align: center;/); assert.match(loading, /font: 22px Arial;/); assert.match(loading, /opacity: 0\.6;/);
});

test('the page carries the release stamp the fight record reads (deploy replaces "dev" with the revision)', () => {
  const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
  assert.match(html, /<html lang="en" data-release="dev">/);
});
