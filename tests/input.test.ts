import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import ts from 'typescript';
import { CUT_PUSH, GUARD_DEAD_BAND_DEG, GUARD_SLIDE_PX, cutAction, cutSideOf, guardSide } from '../src/input.ts';
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
  const main = readFileSync(new URL('../src/main.ts', import.meta.url), 'utf8') + readFileSync(new URL('../src/zoom-guard.ts', import.meta.url), 'utf8');   // the guard lives in zoom-guard.ts, main.ts calls it with its fight surface
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
  // A double tap on/near an attack button zoomed the page ~2x on iPhone (owner, 2026-09-26): the second quick touchend is refused at the document.
  assert.match(main, /addEventListener\('touchend', \(event\) => \{[^]*?timeStamp - lastTouchEnd < 350[^]*?event\.preventDefault\(\)[^]*?\}, \{ passive: false \}\)/);
  assert.match(main, /DOUBLE_TAP_SURFACE = '#world, #joystick, #actions'/, 'the refusal is scoped to the fight surface, so click-driven controls keep both taps (Lead, 2026-09-26)');
  // The Origins preview zoomed on Dom's iPhone (2026-10-07): it had no guard. Every entry calls the one helper.
  for (const entry of ['../src/main.ts', '../origins/preview/main.ts']) assert.match(readFileSync(new URL(entry, import.meta.url), 'utf8'), /\blockPageZoom\(\{ surface: /, `${entry} locks page zoom`);
});

test('the journal test tools ship hidden behind the admins roster; the Sparring tab holds the overrides and ships hidden', () => {
  const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
  const tools = html.match(/<section id="test-tools"[^>]*>([\s\S]*?)<\/section>/);
  assert.ok(tools, 'a test-tools section wraps the tools');
  assert.match(tools![0], /<section id="test-tools"[^>]*\bhidden\b/);
  for (const id of ['damage-mode', 'tempo-mode', 'debug-mode']) assert.match(tools![1], new RegExp(`id="${id}"`));
  // Options → admin Sparring, Daily removed (Dom 2026-09-29): ONE tab, shipped hidden (admins and ?debug open it), holding Opponent, Difficulty,
  // Stage, independent Your/Opponent special moves, Weapon, Finisher and Start sparring. The admin ladder overrides (Move/Weapon for ladder fights) are retired.
  assert.match(html, /<label for="journal-tab-arena" class="tab-arena" id="sparring-tab" hidden>Sparring<\/label>/);
  const pane = html.slice(html.indexOf('class="tab-pane pane-arena"'), html.indexOf('class="tab-pane pane-settings"'));
  for (const id of ['opponent-select', 'difficulty-select', 'arena-select', 'spar-skill', 'spar-special', 'spar-weapon', 'finisher-select', 'spar-start']) { assert.match(pane, new RegExp(`id="${id}"`), id); assert.doesNotMatch(tools![1], new RegExp(id)); }
  assert.match(pane, /<label id="arena-row"[^>]*>Stage <select id="arena-select"/); assert.match(pane, />Your special move <select id="spar-skill"/);
  assert.doesNotMatch(html, /signature-select|id="dev-tools"|id="move-select"|id="weapon-select"|id="mode-sparring/);
  assert.doesNotMatch(html, /id="(legend|spar)-(prev|next)"/, "no ◀ Prev / Next ▶ in the tab or on the kill screen (Dom 2026-09-29: never asked for)");
  assert.equal(html.match(/id="opponent-select"/g)?.length, 1, 'no Opponent picker outside the Sparring tab');
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
  // Dom 2026-10-07 ("yes slash and guard"): the compass lives on SLASH (left/right ticks only) and GUARD (all five marks); no other fight button carries one.
  for (const id of ['guard', 'attack']) {
    const b = button(id);
    for (const side of id === 'guard' ? ['overhead', 'low', 'left', 'right', 'straight'] : ['left', 'right']) assert.match(b, new RegExp(`class="side side-${side}"`), `${id}: ${side} mark`);
    assert.match(b, /<svg class="[^"]*side-marks[^"]*"[^>]*aria-hidden="true"/, `${id}: decorative, hidden from the accessibility tree`);
  }
  for (const side of ['left', 'right']) assert.match(button('attack'), new RegExp(`class="arc arc-${side}"`), `Slash: ${side} arc`);
  for (const side of ['left', 'right', 'overhead', 'low']) assert.match(button('guard'), new RegExp(`class="arc arc-${side}"`), `Guard: ${side} arc`);
  assert.match(css, /button \.arc\{[^}]*opacity: 0;/, 'no slide, no arc'); assert.doesNotMatch(css, /\.arc[^{}]*::(after|before)/, 'the arc never uses a pseudo-element (the Slash label is #attack-button::after)');
  const src = readFileSync(new URL('../src/input.ts', import.meta.url), 'utf8');
  assert.match(src, /const cutLateral = \(\) => Number\(keys\.has\('KeyD'\)/, 'the on-screen stick is movement only: the cut side never reads moveX'); assert.doesNotMatch(src.match(/const cutLateral[^\n]*/)![0], /moveX/);
  for (const side of ['overhead', 'low', 'straight']) assert.doesNotMatch(button('attack'), new RegExp(`side-${side}`), `Slash has no ${side} mark`);
  for (const id of ['thrust', 'heavy', 'kick', 'skill']) assert.doesNotMatch(button(id), /side-marks/, `${id}: no compass (it reads as a swipe hint on a tap button)`);
  const rule = css.match(/\/\* one lit mark per button[\s\S]*?\*\/([\s\S]*?)\{ opacity: \.95; stroke-width: 2; \}/)![1];
  for (const sel of ['#attack-button[data-held][data-next=left] .side-left', '#attack-button[data-held][data-next=right] .side-right',
    ...['left', 'right', 'overhead', 'low', 'straight'].map((s) => `#guard-button[aria-pressed=true][data-side=${s}] .side-${s}`), '#guard-button[aria-pressed=true]:not([data-side]) .side-straight'])
    assert.ok(rule.includes(sel), `${sel} lights`);
  // Owner 2026-09-22 (second look, presentation lane, #420): the four ticks rest brighter at .55, and the centre ring is invisible at
  // rest (opacity 0) — "remove the inner circle" — but stays in the DOM and still lights to .95 through the rule above.
  assert.match(css, /button \.side\{ vector-effect: non-scaling-stroke; opacity: \.55;/, 'the four ticks rest at .55, same weight on every button size');
  assert.match(css, /button \.side-straight\{ opacity: 0; \}/, 'the centre ring rests invisible, never removed');
  assert.match(css, /#attack-button:not\(\[data-next\]\) \.side-marks\{ opacity: 0; \}/, 'sheathed: no cut is next');
  // Desktop (2026-09-27): outside the cluster the unstyled SVG drew a black disc; the hints are hidden there and shown in the cluster.
  assert.match(css, /\n\.actions button \.side-marks \{ display: none; \}\n@media \(max-width:900px\),\(pointer:coarse\) \{/, 'no side hints outside the cluster');
  assert.match(css, /\.actions\[data-gestures=cluster\] button \.side-marks\{\s*display: block;/, 'the cluster shows them');
  assert.match(css, /#heavy-button \{\s*width: 58px;\s*height: 58px;/, 'Heavy is wide enough for its label (owner: smaller than Slash, bigger than 50)');
  assert.match(css, /#thrust-button:not\(\[hidden\]\) \{\s*display: block;\s*width: 56px;\s*height: 56px;/, 'Stab ~10% bigger, spacing kept');
  assert.match(css, /#attack-button \{\s*width: 60px;\s*height: 60px;/, 'Slash -10% (owner)');
  assert.match(button('guard'), /side-overhead" d="M32-6l/, 'v5: the ticks sit outside the rim (apex past the viewBox)'); assert.match(button('guard'), /side-left" d="M-6 32l/); assert.match(button('guard'), /side-right" d="M70 32l/); assert.match(button('guard'), /side-low" d="M25 69h14"/, 'Guard low is a short flat line under the button, not an arrow pointing away');
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

// Desktop pass (Lead 2026-09-28): the card's contents sit in one .versus-frame; on desktop it is the phone card as a centred 9:16 column
// (the still's own shape) instead of a cropped band of it, and the card still passes clicks through (the header stays usable while it loads).
test('the versus card: one frame for its contents, a centred 9:16 column on desktop, clicks still pass through', () => {
  const css = readFileSync(new URL('../src/style.css', import.meta.url), 'utf8'), html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
  assert.match(html, /<div id="versus" class="versus" hidden aria-hidden="true"><div class="versus-frame"><img id="versus-still"/);
  assert.match(css, /@media \(min-width: 901px\) and \(not \(pointer: coarse\)\) \{\n {2}\.versus-frame \{ width: min\(100vw, 46\.15vh\); margin-inline: auto; \}/, 'desktop only, the still\'s 1006x2180 aspect');
  assert.match(css, /\.versus \{[^}]*pointer-events: none;/, 'pass-through as on the phone');
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
  const button = html.match(/<button\b[^>]*id="skill-button"[^>]*>([^<]*)<\/button>/)!;
  assert.match(button[0], /data-mobile="Skill"/, 'text only: SKILL, the same label rule as the six');
  assert.match(css, /#thrust-button,\n#skill-button \{\n {2}display: none;/, 'cluster-only: hidden in the desktop row');
  assert.doesNotMatch(css, /#skill-button\[data-cooling\]/, 'cooling is the cluster\'s own dim only: no ring, no countdown, no style of its own');
});

// Strategy's follow-up (2026-09-29, the #1073 stills): at 375 the journal's rank row (nowrap) widened the fighter card's 1fr column and pushed
// Rename past the sheet's edge. The column may shrink, the journal's bar segments give way, and the next class ellipsizes.
test('the fighter card keeps Rename on the sheet: the rank row shrinks its bar, never the column past the edge', () => {
  const css = readFileSync(new URL('../src/style.css', import.meta.url), 'utf8');
  assert.match(css, /\.fighter \{\s*display: grid;\s*grid-template-columns: auto 1fr auto;/, 'sigil | name and rank | Rename');
  assert.match(css, /\.fighter > div \{ min-width: 0; \}/, 'the middle column may shrink below its nowrap content');
  assert.match(css, /#journal-rank \.rank-now, #journal-rank \.rank-next \{ flex-shrink: 0; \}/, 'the class names never shrink');
  assert.match(css, /#journal-rank \.rank-bar \{ min-width: 0; overflow: hidden; \}/, 'the bar takes the shrink');
  assert.match(css, /#journal-rank \.rank-seg \{ flex: 0 1 14px; min-width: 4px; \}/, 'its segments narrow to 4 px');
  assert.doesNotMatch(css, /#journal-rank[^{]*\{[^}]*text-overflow/, 'no ellipsis on a class name');
});

test('directional cuts (Dom GO 2026-10-07): LIGHT with the stick or A/D held to a side cuts that side, neutral keeps the alternating light', () => {
  assert.equal(cutAction(0), 'light'); assert.equal(cutAction(0.12), 'light'); assert.equal(cutAction(CUT_PUSH - 0.01), 'light', 'a wobble is not a cut');
  assert.equal(cutAction(-CUT_PUSH), 'light_left'); assert.equal(cutAction(-1), 'light_left');
  assert.equal(cutAction(CUT_PUSH), 'light_right'); assert.equal(cutAction(1.4), 'light_right');
  const src = readFileSync(new URL('../src/input.ts', import.meta.url), 'utf8');
  assert.match(src, /take\(isHeavy \? 'heavy' : cutAction\(cutLateral\(\)\)\)/, 'the LIGHT press reads the keyboard side (the on-screen stick is movement only) and goes through take()');
  assert.match(src, /const arrowKey = \(code: string\) => !keys\.has\('KeyQ'\)/, 'Q + an arrow is the guard side, never a cut');
  assert.match(src, /attackButton\.dataset\.cut = cutSide/, 'the button shows the chosen side');
  const css = readFileSync(new URL('../src/style.css', import.meta.url), 'utf8');
  assert.match(css, /#attack-button\[data-cut=left\]:not\(\[data-held\]\) \.side-left/, 'the lit side tick still marks the chosen side');
  assert.doesNotMatch(css.replace(/\/\*[\s\S]*?\*\//g, ''), /#attack-button\[data-cut[^\]]*\][^,{]*::after/, 'Dom 2026-10-07: the arc is removed (it also replaced the Slash label)');
});

test('a refusal card over a stalled page quiets the fight controls behind it, and PLAY NOW stays (Lead 2026-10-07)', () => {
  const main = readFileSync(new URL('../src/main.ts', import.meta.url), 'utf8'), css = readFileSync(new URL('../src/style.css', import.meta.url), 'utf8');
  assert.match(main, /classList\.toggle\('card-up', match\.stalled && replayBanner\.dataset\.stale === '1'\)/, 'set from the stalled page and the stale banner');
  const rule = /:root\.card-up #joystick,[^{]*#actions button:not\(#reset-button\)\s*\{[^}]*visibility: hidden !important; pointer-events: none !important;/.exec(css);
  assert.ok(rule, 'the stick, hint, run toggle and every action but #reset-button are hidden and inert');
  assert.doesNotMatch(rule![0], /#reset-button\s*[,{]\s*$/m, 'PLAY NOW is exempt');
});

test('the Slash label survives every directional-cut state: nothing may repaint the attack button\'s ::after, which IS the mobile label', () => {
  const css = readFileSync(new URL('../src/style.css', import.meta.url), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
  const rules = [...css.matchAll(/([^{}]+)\{([^{}]*)\}/g)].map((m) => ({ selector: m[1].trim(), body: m[2] }));
  const label = rules.filter((r) => /button\[data-mobile\]::after/.test(r.selector) && /content:\s*attr\(data-mobile\)/.test(r.body));
  assert.ok(label.length >= 1, 'the label is drawn by button[data-mobile]::after (content: attr(data-mobile))');
  const clobbers = rules.filter((r) => /#attack-button[^,]*::after/.test(r.selector) && /\bcontent\s*:/.test(r.body));
  assert.deepEqual(clobbers.map((r) => r.selector), [], 'an #attack-button ::after rule with its own content would replace the label (it did, with data-cut set: no text, only the arc)');
  assert.ok(!/#attack-button\[data-cut[^\]]*\][^,{]*::after/.test(css), 'the directional-cut arc is gone (Dom 2026-10-07); the cut stays in input.ts (data-cut) and the lit tick');
  const input = readFileSync(new URL('../src/input.ts', import.meta.url), 'utf8');
  assert.match(input, /cutAction\(cutLateral\(\)\)/, 'the cut itself reads the keyboard side only'); assert.match(input, /attackButton\.dataset\.cut = cutSide/);
});

test('the cut flash fires only for a taken side cut, at the press, on ::before, and never touches the label (Dom 2026-10-07)', () => {
  assert.equal(cutSideOf('light_left'), 'left'); assert.equal(cutSideOf('light_right'), 'right');
  assert.equal(cutSideOf('light'), null, 'a neutral LIGHT flashes nothing'); assert.equal(cutSideOf('heavy'), null, 'Heavy has no side'); assert.equal(cutSideOf('thrust'), null);
  const src = readFileSync(new URL('../src/input.ts', import.meta.url), 'utf8');
  assert.match(src, /function take\(next: Action\) \{\s*request\(next\);\s*if \(action === next\) flashCut\(next\);/, 'one guard: flash only once the press was taken');
  assert.match(src, /function fireSlash[\s\S]*?take\(side === 'left' \? 'light_left' : 'light_right'\)/, 'the thumb slide (fireSlash) goes through the same guard, so a touch cut flashes too');
  const intentBody = src.slice(src.indexOf('intent(): ControlIntent {')); assert.ok(intentBody.length > 200 && !/flashCut/.test(intentBody.slice(0, intentBody.indexOf('return {'))), 'the held-stick intent never flashes: the indicator comes with the press, not before');
  const css = readFileSync(new URL('../src/style.css', import.meta.url), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
  const rules = [...css.matchAll(/([^{}]+)\{([^{}]*)\}/g)].map((m) => ({ selector: m[1].trim(), body: m[2] }));
  const flash = rules.filter((r) => /#attack-button\[data-flash=(left|right)\]::before/.test(r.selector));
  assert.equal(flash.length, 2, 'one rule per side, on ::before'); for (const r of flash) assert.match(r.body, /animation:\s*cut-flash 2[0-5]\dms/, '~200-250 ms');
  assert.match(css, /@keyframes cut-flash\{\s*from\{\s*opacity: \.[1-6]/, 'faint: starts at 60% or less');
  assert.deepEqual(rules.filter((r) => /#attack-button\[data-flash[^\]]*\][^,]*::after/.test(r.selector)).map((r) => r.selector), [], 'the flash never styles the label (::after)');
  assert.ok(!/data-flash/.test(readFileSync(new URL('../src/hud.ts', import.meta.url), 'utf8')), 'hud.ts (which writes the label) never touches the flash');
});
