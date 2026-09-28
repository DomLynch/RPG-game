import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { render, OUT } from '../scripts/game-legends.mjs';

// The /game page reads the legends from public/game/legends.js; it must be exactly what src/legends.ts says today.
test('/game legends.js matches src/legends.ts (run node scripts/game-legends.mjs after editing the legends)', () => {
  assert.equal(readFileSync(OUT, 'utf8'), render());
});

// The page's one hand-written legend line ("the Pitborn at Champion ... Grendel") must still be true of the ladder.
test('/game copy: the Pitborn at Champion is still Grendel', async () => {
  const { LEGENDS } = await import('../src/legends.ts');
  const html = readFileSync(new URL('../public/game/index.html', import.meta.url), 'utf8');
  assert.match(html, /the Pitborn at Champion\. You beat Grendel\./);
  assert.equal(LEGENDS.pitborn[4].name, 'Grendel', 'update the Hundred intro in public/game/index.html');
});

// The Ladder's win counts are the career ladder's own thresholds (src/career.ts rankFor): a retune turns this red, not the page stale.
test('/game ladder: each rank shows the wins rankFor gives it', async () => {
  const { rankFor } = await import('../src/career.ts');
  const html = readFileSync(new URL('../public/game/index.html', import.meta.url), 'utf8');
  const shown = [...html.matchAll(/<b>(\w+)<\/b><span>[^<]*<small>(?:from )?(\d+) wins/g)].map(([, title, wins]) => [title, Number(wins)]);
  const first = new Map<string, number>();
  for (let m = 0; m <= 1000 && first.size < 10; m++) if (!first.has(rankFor(m).title)) first.set(rankFor(m).title, m);
  assert.deepEqual(shown, [...first], 'update the Ladder in public/game/index.html');
});

// The site's CSP is script-src 'self' and default-src 'self': no inline script, no third-party font or script host.
test('/game page: no inline script, no external font or script host', () => {
  const html = readFileSync(new URL('../public/game/index.html', import.meta.url), 'utf8');
  for (const [, attrs] of html.matchAll(/<script([^>]*)>/g)) assert.match(attrs, /src="\/game\//, 'every script is a same-origin file');
  assert.doesNotMatch(html, /fonts\.googleapis|fonts\.gstatic|https?:\/\/[^"']+\.(js|woff2?)\b/);
  for (const [, url] of html.matchAll(/url\((\/game\/fonts\/[^)]+)\)/g)) readFileSync(new URL(`../public${url}`, import.meta.url));
});
