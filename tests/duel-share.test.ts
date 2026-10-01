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

test('DUEL is hidden from a player who is not on the admins roster, and shown with the admin tools (account.ts, main.ts, style.css)', () => {
  const css = read('../src/style.css'), account = read('../src/account.ts');
  assert.match(css, /:root:not\(\[data-duel='true'\]\) #duel-button \{ display: none !important; \}/, 'no data-duel, no DUEL: a guest or a non-admin never sees it');
  assert.match(account, /tools\.hidden = !admin && tools\.dataset\.debug !== 'true'; document\.documentElement\.dataset\.duel = String\(!tools\.hidden\)/, 'the roster read sets it, the same switch as the test tools');
  assert.match(main, /document\.documentElement\.dataset\.duel = 'true'/, 'a local ?debug build keeps it for the release checks');
  assert.ok(!/data-duel/.test(html), 'the page starts without it: hidden until the roster says admin');
  assert.doesNotMatch(css, /:root:not\(\[data-duel[^\n]*(share-link|clip-button)/, 'LINK and CLIP are never hidden by it');
});
