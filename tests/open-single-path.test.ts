// One universal "your character exists" rule: the writer's `open` is asked in ONE place (src/fight/open.ts). No page entry (the Pit src/main.ts, the zone page origins/preview/main.ts) and no
// screen (src/gear-server.ts) may POST `open` itself, or a first page could skip the door that makes the account's first character.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

const walk = (dir: string): string[] => readdirSync(dir).flatMap((n) => { const p = join(dir, n); return statSync(p).isDirectory() ? walk(p) : p.endsWith('.ts') && !p.endsWith('.test.ts') ? [p] : []; });
// call('open' ...), a literal /open endpoint, or a `${base}/open` URL
const OPEN_CALL = /\bcall(?:<[^>]*>)?\(\s*['"`]open['"`]|\/open['"`]|\/open\b\s*`|\$\{[^}]*\}\/open\b/;

test('only src/fight/open.ts calls the writer\'s open', () => {
  const found = [...walk('src'), ...walk('origins/preview')].filter((f) => f !== join('src', 'fight', 'open.ts') && OPEN_CALL.test(readFileSync(f, 'utf8')));
  assert.deepEqual(found, [], `these call open themselves: ${found.join(', ')}`);
});

test('the Pit, the zone page and the gear sheet all go through it', () => {
  for (const f of ['src/main.ts', 'origins/preview/save.ts', 'src/gear-server.ts']) assert.match(readFileSync(f, 'utf8'), /fight\/open\.ts/, `${f} imports src/fight/open.ts`);
});
