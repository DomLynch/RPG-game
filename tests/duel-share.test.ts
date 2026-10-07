// The end-of-fight share row (Strategy 2026-10-02): DUEL, LINK, CLIP in that order, and a duel link previews as the challenge's share text.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = (path: string) => readFileSync(new URL(path, import.meta.url), 'utf8');
const html = read('../index.html'), conf = read('../deploy/frankendom.com.conf'), main = read('../src/main.ts');
const TEXT = '1v1 me in Frankendom ⚔️';

test('the share row reads DUEL, LINK, CLIP in the DOM, one word each', () => {
  const labels = [...html.matchAll(/id="(duel-button|share-link|clip-button)"[^>]*>.*?<span[^>]*>(\w+)<\/span>/g)].map((m) => [m[1], m[2]]);
  assert.deepEqual(labels, [['duel-button', 'DUEL'], ['share-link', 'LINK'], ['clip-button', 'CLIP']]);
});

test('the duel share text is one string in main.ts and the og:title nginx gives a ?duel link', () => {
  assert.ok(main.includes(`const DUEL_TEXT = '${TEXT}'`), 'main.ts shares the exact line');
  assert.ok(conf.includes(`"~^[\\w.-]{3,200}$" "${TEXT}";`), 'a well-formed ?duel token maps to the line');
  const target = '<meta property="og:title" content="Frankendom: watch this fight">';
  assert.equal(html.split(target).length - 1, 1, 'index.html carries the og:title nginx rewrites, once');
  assert.ok(conf.includes(`sub_filter '${target}' '<meta property="og:title" content="$frankendom_og_title">';`));
  assert.match(conf, /default "Frankendom: watch this fight";/, 'anything else keeps the page title');
});

test('DUEL leaves for ?duel=new with the rest of the query dropped', () => {
  assert.match(main, /duelButton\.addEventListener\('click'[^\n]*u\.search = ''[^\n]*searchParams\.set\('duel', 'new'\)[^\n]*location\.assign/);
});

test('DUEL is hidden from a guest, and shown to any signed-in player and with the admin tools (account.ts, main.ts, style.css)', () => {
  const css = read('../src/style.css'), account = read('../src/account.ts');
  assert.match(css, /:root:not\(\[data-duel-tools='true'\]\) #duel-button \{ display: none !important; \}/, 'no data-duel-tools, no DUEL: a guest or a non-admin never sees it');
  assert.match(account, /tools\.hidden = !admin && tools\.dataset\.debug !== 'true'; if \(document\.documentElement\) document\.documentElement\.dataset\.duelTools = String\(!tools\.hidden \|\| !!userId\)/, 'a signed-in player or the test tools (roster / ?debug) set it; a guest never does (Dom opened duels 2026-10-02)');
  assert.match(main, /document\.documentElement\.dataset\.duelTools = 'true'/, 'a local ?debug build keeps it for the release checks');
  assert.ok(!/data-duel/.test(html), 'the page starts without it: hidden until the roster says admin');
  // Re-pinned 2026-10-02 with the pair centring: LINK and CLIP now have :root:not([data-duel-tools]) rules, but only to move (left), never to hide.
  for (const line of css.split('\n').filter((l) => /:root:not\(\[data-duel-tools[^\n]*(share-link|clip-button)/.test(l))) assert.doesNotMatch(line, /display:\s*none|visibility|hidden|opacity:\s*0/, `LINK and CLIP are never hidden by the DUEL gate: ${line.trim()}`);
});

test('the DUEL gate has its own attribute: lobby.ts writes its two-page probe JSON into dataset.duel, so the gate never shares it', () => {
  assert.match(read('../src/net/lobby.ts'), /document\.documentElement\.dataset\.duel = JSON\.stringify/, 'the probe keeps dataset.duel');
  for (const [name, text] of [['account.ts', read('../src/account.ts')], ['main.ts', main], ['style.css', read('../src/style.css')]]) assert.doesNotMatch(text.replace(/duel-tools|duelTools/g, ''), /(dataset\.duel\s*=\s*(String|'true')|\[data-duel=)/, `${name} does not gate DUEL on the probe's attribute`);
});

test('the end screen is one bottom-anchored right-hand column: LINK + CLIP above Enter the Pit above Next, no loot-panel override', () => {
  const css = read('../src/style.css');
  assert.match(css, /\.actions\[data-gestures=cluster\] \.clip-pick \{ position: fixed; top: auto; left: auto; bottom: calc\(var\(--end-base\) \+ 112px\); \}/, 'the icon row sits 112 px above the base, on the column');
  assert.doesNotMatch(css, /:root:has\(#loot-panel\[data-on='1'\]\)[^{]*\.clip-pick/, 'no loot-panel override moves LINK/CLIP mid-screen any more');
  assert.match(css, /#duel-button \{ top: auto; left: auto; bottom: calc\(var\(--end-base\) \+ 180px\); right: var\(--end-gutter\); \}/, 'DUEL (admin) is a third row of the column, clear of the 128 px pad');
  assert.match(css, /--end-width: min\(220px, calc\(100vw - 190px\)\)/, 'the column\'s left edge stays right of the pad (column left = vw - 16 - (vw - 190) = 174 up to 410 wide; the pad ends at 158)');
  assert.ok(html.includes('id="loot-panel"'), 'the loot panel exists above the column');
});

test('without DUEL the portrait pair sits on the same column: LINK and CLIP leave no empty slot', () => {
  const css = read('../src/style.css');
  assert.match(css, /:root:not\(\[data-duel-tools='true'\]\) \.actions\[data-gestures=cluster\] #share-link \{ left: auto; right: calc\(var\(--end-gutter\) \+ 66px\); \}/);
  assert.match(css, /:root:not\(\[data-duel-tools='true'\]\) \.actions\[data-gestures=cluster\] #clip-button \{ left: auto; right: var\(--end-gutter\); \}/);
  assert.match(css, /:root:not\(\[data-duel-tools='true'\]\) #duel-button \{ display: none !important; \}/, 'DUEL is out of the layout (display:none), not visibility:hidden');
  assert.doesNotMatch(css, /#duel-button[^{]*\{[^}]*visibility: hidden/);
});
