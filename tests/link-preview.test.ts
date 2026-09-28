// A pasted kill link (/s/<id>, served as index.html by deploy/frankendom.com.conf) previews inline: a crawler runs no script, so the
// title and the kill-frame still must be static tags in index.html, the image absolute and present in public/.
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import test from 'node:test';

const root = new URL('../', import.meta.url);
const meta = (html: string, property: string) => new RegExp(`<meta property="${property}" content="([^"]+)">`).exec(html)?.[1];

test('index.html carries the link-preview tags a kill link needs', () => {
  const html = readFileSync(new URL('index.html', root), 'utf8');
  assert.ok(meta(html, 'og:title'), 'og:title');
  const image = meta(html, 'og:image');
  assert.match(image ?? '', /^https:\/\/frankendom\.com\//, 'og:image is absolute');
  assert.ok(existsSync(new URL('public' + new URL(image!).pathname, root)), `${image} ships in public/`);
  assert.equal(meta(html, 'og:url'), undefined, 'no og:url: a pasted /s/<id> keeps its own link');
  assert.ok(html.includes('<meta name="twitter:card" content="summary_large_image">'));
  // The /s/ block also rewrites the og tags to the legend's face since 2026-09-28 (tests/legend-og.test.ts); it still serves index.html uncached.
  const s = /location \^~ \/s\/ \{([\s\S]*?)\n {4}\}/.exec(readFileSync(new URL('deploy/frankendom.com.conf', root), 'utf8'))?.[1] ?? '';
  assert.match(s, /^\s*expires -1;$/m, '/s/ is never cached');
  assert.match(s, /^\s*try_files \/index\.html =404;$/m, '/s/ serves index.html');
});
