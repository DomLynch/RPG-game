// Kill-link previews with the legend's face (Lead 2026-09-28, option c): the nginx whitelist in deploy/frankendom.com.conf is exactly
// the 100 face names (legends.ts PORTRAIT_KEYS), each has its face file, and every string the /s/ sub_filters look for is in index.html
// once, so a changed tag fails here instead of silently keeping og.jpg.
import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { PORTRAIT_KEYS, portraitKey } from '../src/legends.ts';
import { shortLink } from '../src/share-store.ts';

const conf = readFileSync(new URL('../deploy/frankendom.com.conf', import.meta.url), 'utf8');
const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');

test('legend og: the nginx whitelist is exactly the 100 face names, each mapping to itself, default empty', () => {
  const block = /map \$arg_l \$frankendom_og_face \{\n([\s\S]*?)\n\}/.exec(conf)?.[1];
  assert.ok(block, 'the $arg_l map');
  const lines = block.split('\n').map((l) => l.trim());
  assert.equal(lines[0], 'default "";', 'anything unlisted maps to nothing: og.jpg stays');
  assert.deepEqual(lines.slice(1), PORTRAIT_KEYS.map((k) => `${k} ${k};`), 'regenerate from legends.ts PORTRAIT_KEYS');
  assert.equal(PORTRAIT_KEYS.length, 100);
  for (const k of PORTRAIT_KEYS) assert.match(k, /^[a-z]+-(10|[1-9])$/, 'plain names only: no quote, space or slash can reach the tag');
  for (const k of PORTRAIT_KEYS) assert.ok(existsSync(new URL(`../public/legends/${k}.webp`, import.meta.url)), `${k}.webp is served`);
});

test('legend og: every /s/ sub_filter target is in index.html exactly once, and a face swaps to a 512 square with the small card', () => {
  const location = /location \^~ \/s\/ \{([\s\S]*?)\n {4}\}/.exec(conf)?.[1] ?? '';
  const targets = [...location.matchAll(/sub_filter '([^']+)' '\$(\w+)';/g)].map((m) => [m[1]!, m[2]!] as const);
  assert.equal(targets.length, 4, 'image, size, alt, card');
  for (const [text, variable] of targets) {
    assert.equal(html.split(text).length - 1, 1, `index.html carries "${text}" once`);
    const map = new RegExp(`map \\$frankendom_og_face \\$${variable} \\{\\n\\s*"" ["']([^\\n]*)["'];\\n\\s*default ["']([^\\n]*)["'];`).exec(conf);
    assert.ok(map, `$${variable} maps "" and default`);
    assert.equal(map[1], text, `no face: $${variable} is the text it replaces`);
  }
  assert.match(conf, /default "https:\/\/frankendom\.com\/legends\/\$frankendom_og_face\.webp";/);
  assert.match(conf, /default '<meta property="og:image:width" content="512"><meta property="og:image:height" content="512">';/);
  assert.match(conf, /default "summary";/, 'the square is not cropped by the large card');
});

test('legend og: a legend fight\'s link names its face; any other link is the plain short shape', () => {
  assert.equal(shortLink('https://frankendom.com', '1a', portraitKey('goblin', 1)), 'https://frankendom.com/s/1a?l=goblin-1');
  assert.ok(PORTRAIT_KEYS.includes(portraitKey('knight', 46)), 'the top of the dial is a listed face');
  assert.equal(shortLink('https://frankendom.com', '1a'), 'https://frankendom.com/s/1a');
});
