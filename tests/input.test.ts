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

test('the fight surface refuses every browser gesture: page zoom locked, touch-action none everywhere but the scrolling panels (owner, 2026-09-17 and 2026-09-24)', () => {
  // Owner's call, overriding the earlier pinch-zoom accessibility rule: an accidental pinch cost the HUD mid-fight;
  // the trade (low-vision players cannot zoom the UI) was stated and accepted. iOS Safari ignores the meta, so
  // main.ts also blocks the gesture itself; this test locks both so the decision is not silently reverted.
  const css = readFileSync(new URL('../src/style.css', import.meta.url), 'utf8');
  // 2026-09-24, the third page zoom mid-fight (stick held, fast taps on a button, rain arena): `manipulation` on the root still lets a
  // pinch through wherever the HUD or a gap is under a finger. The fight frame is a game surface: the root and body refuse every gesture,
  // a rule may only say `none`, and only a rule that scrolls (the journal dialog, the debug pane) takes back vertical pan. Structural, so
  // a new HUD element or a new button cannot drift the policy back the way the 09-13 and 09-17 guards drifted.
  const rules = [...css.replace(/\/\*[\s\S]*?\*\//g, '').replace(/@media[^{]*\{/g, '').matchAll(/([^{}]+)\{([^{}]*)\}/g)].map(m => ({ selector: m[1].trim(), body: m[2] }));
  const touch = (body: string) => body.match(/(?:^|;)\s*touch-action\s*:\s*([^;]+)/)?.[1].trim();
  assert.equal(touch(rules.find(r => r.selector === ':root')!.body), 'none', 'the root refuses pinch, pan and double-tap');
  assert.equal(touch(rules.find(r => r.selector === 'body')!.body), 'none');
  for (const rule of rules) {
    const value = touch(rule.body), scrolls = /overflow(?:-[xy])?\s*:[^;]*(?:auto|scroll)/.test(rule.body);
    if (scrolls) assert.equal(value, 'pan-y', `${rule.selector} scrolls: it takes back vertical pan and nothing else`);
    else if (value !== undefined) assert.equal(value, 'none', `${rule.selector}: off a scrolling panel only \`none\` is allowed (found ${value})`);
  }
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
  for (const id of ['damage-mode', 'tempo-mode', 'debug-mode']) assert.match(tools![1], new RegExp(`id="${id}"`));
  // The Finisher pick moved to the Options tab (Dom 2026-09-26, "why is it in Settings?"): its own row, shipped hidden like Arena.
  assert.doesNotMatch(tools![1], /finisher-select/);
  assert.match(html, /<div id="finisher-row"[^>]*\bhidden\b[^>]*><label class="menu-select">Finisher <select id="finisher-select"/);
  assert.doesNotMatch(tools![1], /opponent-select/);
  assert.match(html.replace(tools![0], ''), /id="opponent-select"/);
  // The Arena pick sits beside Opponent on the Options tab (Dom 2026-09-24) but is a test tool: its row ships hidden.
  assert.match(html, /<label id="arena-row"[^>]*\bhidden\b[^>]*>Arena <select id="arena-select"/);
  // So does the signature-effect preview beside it (docs/briefs/signature-effects.md), and it defaults to Shipped: what players see (SHIPPED).
  assert.match(html, /<label id="signature-row"[^>]*\bhidden\b[^>]*>Signature <select id="signature-select"[^>]*><option value="ship">Shipped<\/option><option value="off">Off</);
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
  // Owner 2026-09-22 (second look, presentation lane, #420): the four ticks rest brighter at .55, and the centre ring is invisible at
  // rest (opacity 0) — "remove the inner circle" — but stays in the DOM and still lights to .95 through the rule above.
  assert.match(css, /button \.side\{ vector-effect: non-scaling-stroke; opacity: \.55;/, 'the four ticks rest at .55, same weight on every button size');
  assert.match(css, /button \.side-straight\{ opacity: 0; \}/, 'the centre ring rests invisible, never removed');
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

test('the versus card is a plain still (owner 2026-09-21: no drift); the loading line above the pair is the caption\'s twin with pulsing dots (owner 2026-09-22)', () => {
  const css = readFileSync(new URL('../src/style.css', import.meta.url), 'utf8');
  assert.doesNotMatch(css, /versus-drift|\.versus img \{[^}]*animation/, 'no card animation');
  const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
  assert.match(html, /<p class="versus-loading">loading<span class="versus-dots" aria-hidden="true"><i>\.<\/i><i>\.<\/i><i>\.<\/i><\/span><\/p>/, 'the loading line on the card, dots as three spans');
  const loading = css.match(/\.versus-loading \{([^}]*)\}/)![1], caption = css.match(/\.versus-caption \{([^}]*)\}/)![1];
  assert.match(loading, /top: 28%;/); assert.match(loading, /text-align: center;/); assert.doesNotMatch(loading, /opacity/, 'same brightness as the caption');
  for (const rule of ['color: #e9ddc5;', 'font: 15px Arial;', 'letter-spacing: 3px;', 'text-transform: uppercase;', 'text-shadow: 0 1px 6px #000c;']) { assert.ok(caption.includes(rule) && loading.includes(rule), `caption and loading share ${rule}`); }
  assert.match(css, /\.versus-dots i \{[^}]*animation: versus-dot 1\.6s ease-in-out infinite;/, 'the dots pulse');
  assert.match(css, /@keyframes versus-dot \{\s*0%, 60%, 100% \{ opacity: 0\.25; \}/, 'never fully off');
  assert.match(css, /prefers-reduced-motion: reduce\) \{ \.versus-dots i \{ animation: none; \}/, 'reduced motion stills them');
});

test('the page carries the release stamp the fight record reads (deploy replaces "dev" with the revision)', () => {
  const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
  assert.match(html, /<html lang="en" data-release="dev">/);
});

// SKILL (Dom 2026-09-24; Strategy's brief): the seventh button of the cluster family, placement A, HEAVY's diameter, and a gap to STAB
// wider than any of the six's gaps to its nearest neighbour (so a fast Stab never catches it); the six keep their trunk places, so
// SKILL sits up and right of STAB, above the cluster box rather than widening it (Dom 2026-09-25: spaced like the six, not wider).
test('SKILL sits top-right of STAB at STAB\'s own neighbour spacing, HEAVY-sized, overlapping nothing, inside the cluster', () => {
  const css = readFileSync(new URL('../src/style.css', import.meta.url), 'utf8');
  const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
  const box = (sel: string) => {
    const r = css.match(new RegExp(`\\.actions\\[data-gestures=cluster\\] ${sel} \\{([^}]*)\\}`))![1];
    const n = (k: string) => Number(r.match(new RegExp(`(?:^|\\s)${k}: (-?[\\d.]+)(?:px)?;`))![1]);
    return { r: n('width') / 2, cx: n('left') + n('width') / 2, cy: n('top') + n('height') / 2, right: n('left') + n('width') };
  };
  const six = { stab: box('#thrust-button:not\\(\\[hidden\\]\\)'), slash: box('#attack-button'), heavy: box('#heavy-button'), kick: box('#kick-button'), step: box('#dodge-button'), guard: box('#guard-button') };
  const skill = box('#skill-button');
  const gap = (a: typeof skill, b: typeof skill) => Math.hypot(a.cx - b.cx, a.cy - b.cy) - a.r - b.r;
  const nearest = Math.max(...Object.values(six).map(a => Math.min(...Object.values(six).filter(b => b !== a).map(b => gap(a, b)))));
  assert.equal(skill.r, six.heavy.r, 'HEAVY\'s diameter');
  const centre = (a: typeof skill, b: typeof skill) => Math.hypot(a.cx - b.cx, a.cy - b.cy);
  const spacing = (centre(six.stab, six.slash) + centre(six.stab, six.heavy)) / 2;   // STAB's own neighbour spacing, measured, not eyeballed
  assert.ok(Math.abs(centre(skill, six.stab) - spacing) <= 1, `SKILL–STAB centres ${centre(skill, six.stab).toFixed(1)} px must equal STAB's neighbour spacing ${spacing.toFixed(1)} px (±1)`);
  assert.ok(gap(skill, six.stab) <= nearest, `so its rim gap to STAB (${gap(skill, six.stab).toFixed(1)} px) is no wider than the six's own (${nearest.toFixed(1)} px)`);
  assert.ok(Math.min(...Object.values(six).map(b => gap(skill, b))) > 0, 'and it overlaps none of the six');
  assert.ok(skill.cx > six.stab.cx && skill.cy < six.heavy.cy, 'placement A: right of STAB, above HEAVY');
  const width = Number(css.match(/\.actions\[data-gestures=cluster\] \{[^}]*width: (\d+)px/)![1]);
  assert.equal(width, 184, 'the six keep their trunk places: the cluster box is not widened for SKILL');
  assert.ok(skill.right <= width, `SKILL (right edge ${skill.right}) within the ${width} px cluster's width: the six do not move and the button stays on-screen`);
  const button = html.match(/<button\b[^>]*id="skill-button"[^>]*>([^<]*)<svg class="side-marks"/)!;
  assert.match(button[0], /data-mobile="Skill"/, 'text only: SKILL, the same label rule as the six');
  assert.match(css, /#thrust-button,\n#skill-button \{\n  display: none;/, 'cluster-only: hidden in the desktop row');
  assert.doesNotMatch(css, /#skill-button\[data-cooling\]/, 'cooling is the cluster\'s own dim only: no ring, no countdown, no style of its own');
});
