// An unlisted zone (zone 90) opens only on a build made with VITE_UNLISTED_ZONES=1. The live game is the /preview/origins/ bundle, also published at /zone1/, so the flag must never be set by a script
// or env file that builds what the public gets (Deploy's sandbox previews for Dom set it on their own command line). The server never reads the flag: it passes opens=false to loadZone and zoneIds.
import assert from 'node:assert/strict';
import test from 'node:test';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { loadZone } from '../origins/zones/loader.ts';

const FLAG = 'VITE_UNLISTED_ZONES';

test('no publish or deploy script and no .env.production* sets VITE_UNLISTED_ZONES', () => {
  const scripts = ['scripts/publish-origins-preview.sh', 'scripts/deploy.sh'], files = [...scripts, ...readdirSync('.').filter((f) => f.startsWith('.env.production'))];   // an env file is checked when it exists (a local one is untracked)
  assert.ok(scripts.every((f) => existsSync(f)), `the guarded scripts exist: ${scripts.join(', ')}`);
  for (const f of files) assert.ok(!readFileSync(f, 'utf8').includes(FLAG), `${f} must not set ${FLAG}: it would open unlisted zones on the live site`);
});

test('the server asks for the listed zones only: every loadZone and zoneIds call in origins/server passes opens=false', () => {
  const src = readdirSync('origins/server').filter((f) => f.endsWith('.ts') && !f.endsWith('.test.ts'));
  let calls = 0;
  for (const f of src) for (const [i, line] of readFileSync(`origins/server/${f}`, 'utf8').split('\n').entries()) {
    for (const m of line.matchAll(/\b(loadZone|zoneIds)\(([^()]*)\)/g)) {
      calls++;
      assert.ok(/\bfalse\b/.test(m[2]!), `origins/server/${f}:${i + 1}: ${m[0]} must pass opens=false`);
    }
  }
  assert.ok(calls >= 6, `${calls} server calls checked`);
  assert.throws(() => loadZone('90', false), /no zone 90/, 'and with opens=false zone 90 does not exist');
});
