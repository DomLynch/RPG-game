// An unlisted zone (zone 90) opens only on a build made with VITE_UNLISTED_ZONES=1. The live game is the /preview/origins/ bundle, also published at /zone1/, so the flag must never be set by a script
// or env file that builds what the public gets (Deploy's sandbox previews for Dom set it on their own command line). The server never reads the flag: it passes opens=false to loadZone and zoneIds.
import assert from 'node:assert/strict';
import test from 'node:test';
import { existsSync, mkdtempSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { loadZone } from '../origins/zones/loader.ts';

const FLAG = 'VITE_UNLISTED_ZONES';

const PUBLISH = 'scripts/publish-origins-preview.sh';
const sets = (text: string): boolean => new RegExp(`(^|[\\s;(])(export\\s+)?${FLAG}=`, 'm').test(text);   // an assignment or an export of the flag
const liveBuildLine = (): string => { const l = readFileSync(PUBLISH, 'utf8').split('\n').find((x) => /npx vite build --config origins\/preview\/vite\.config\.mjs/.test(x)); assert.ok(l, 'the live Origins build line exists'); return l!; };

test('unlisted zones stay shut on live: the live Origins game IS the /preview/origins/ bundle (also served at /zone1/), so only an explicit VITE_UNLISTED_ZONES opt-in may open them, and no publish or deploy script and no .env.production* sets it', () => {
  const scripts = [PUBLISH, 'scripts/deploy.sh'], files = [...scripts, ...readdirSync('.').filter((f) => f.startsWith('.env.production'))];   // an env file is checked when it exists (a local one is untracked)
  assert.ok(scripts.every((f) => existsSync(f)), `the guarded scripts exist: ${scripts.join(', ')}`);
  for (const f of files) assert.ok(!sets(readFileSync(f, 'utf8')), `${f} must not set ${FLAG}: it would open unlisted zones on the live site`);
});

test('unlisted zones stay shut on live: the live Origins build line clears VITE_UNLISTED_ZONES itself, after the env file (the live game IS the /preview/origins/ bundle, so a base-path check would not do), so a stray shell export or an env-file line cannot open zone 90', () => {
  const line = liveBuildLine();
  assert.match(line, new RegExp(`(unset ${FLAG}|env -u ${FLAG})[^;)]*[;]?[^]*npx vite build`), 'the build line unsets the flag before vite runs');
  assert.ok(line.indexOf('. ./.env.production.local') < line.search(new RegExp(`unset ${FLAG}|env -u ${FLAG}`)), 'the unset comes AFTER the env file is sourced');
  // behaviour: run the real line with vite swapped for a printout, the flag exported in the shell AND written in the env file
  const dir = mkdtempSync(join(tmpdir(), 'unl-')); writeFileSync(join(dir, '.env.production.local'), `${FLAG}=1\n`);
  const probe = line.replace(/npx vite build --config origins\/preview\/vite\.config\.mjs >\/dev\/null/, `printf "flag=[%s]" "$${FLAG}"`).replace(/\s+#.*$/, '');
  const out = spawnSync('bash', ['-c', probe], { cwd: dir, env: { ...process.env, [FLAG]: '1' }, encoding: 'utf8' });
  assert.equal(out.stdout, 'flag=[]', `with ${FLAG}=1 in the shell and the env file, vite still sees it unset (${out.stderr})`);
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
