// Unlisted zones stay shut on live. The live Origins game IS the /preview/origins/ bundle (also served at /zone1/), so a base-path check cannot tell live from a sandbox preview: only an explicit
// VITE_UNLISTED_ZONES=1 opt-in may open an unlisted zone (zone 90). Deploy's sandbox previews for Dom pass it on their own build command; nothing that builds what the public gets may set it.
// Three locks: (1) the live build line clears it and no script assigns it, (2) a runtime refusal before the build when any .env* sets it (vite's loadEnv reads those files; `env -u` cannot clear them),
// (3) the server reaches the registry only through origins/zones/listed.ts, which has the flag hard-wired off.
import assert from 'node:assert/strict';
import test from 'node:test';
import { existsSync, mkdtempSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const FLAG = 'VITE_UNLISTED_ZONES', PUBLISH = 'scripts/publish-origins-preview.sh', DEPLOY = 'scripts/deploy.sh', REFUSE = 'scripts/refuse-unlisted-zones-env.sh';
const assigns = (text: string): boolean => new RegExp(`(^|[\\s;(])(export\\s+)?${FLAG}\\s*=`, 'm').test(text);   // an assignment or an export with a value; `env -u FLAG` and `unset FLAG` are not
const read = (f: string): string => readFileSync(f, 'utf8');
const liveBuildLine = (): string => { const l = read(PUBLISH).split('\n').find((x) => /npx vite build --config origins\/preview\/vite\.config\.mjs/.test(x)); assert.ok(l, 'the live Origins build line exists'); return l!; };
const refuse = (files: Record<string, string>): { status: number | null; stderr: string } => {
  const dir = mkdtempSync(join(tmpdir(), 'unl-')); for (const [n, t] of Object.entries(files)) writeFileSync(join(dir, n), t);
  const r = spawnSync('sh', [REFUSE, dir], { encoding: 'utf8' }); return { status: r.status, stderr: r.stderr };
};

test('unlisted zones stay shut on live (the live Origins game IS the /preview/origins/ bundle, also served at /zone1/, so only an explicit VITE_UNLISTED_ZONES opt-in may open them): the live build line clears the flag and no publish or deploy script or .env.production* assigns it', () => {
  assert.ok([PUBLISH, DEPLOY, REFUSE].every((f) => existsSync(f)), 'the guarded scripts exist');
  const line = liveBuildLine();
  assert.match(line, new RegExp(`env -u ${FLAG}\\s+npx vite build`), `the live build line runs vite as \`env -u ${FLAG} npx vite build\``);
  assert.ok(line.indexOf('. ./.env.production.local') > -1 && line.indexOf('. ./.env.production.local') < line.indexOf(`env -u ${FLAG}`), 'cleared AFTER the env file is sourced');
  for (const f of [PUBLISH, DEPLOY, ...readdirSync('.').filter((n) => n.startsWith('.env.production'))]) assert.ok(!assigns(read(f)), `${f} must not set ${FLAG}`);   // an untracked local env file is checked when present
  // behaviour: the real build line with vite swapped for a printout, the flag exported in the shell AND written in the env file
  const dir = mkdtempSync(join(tmpdir(), 'unl-')); writeFileSync(join(dir, '.env.production.local'), `${FLAG}=1\n`);
  const probe = line.replace(/npx vite build --config origins\/preview\/vite\.config\.mjs >\/dev\/null/, `sh -c 'printf "flag=[%s]" "$${FLAG}"'`).replace(/\s+#.*$/, '');
  const out = spawnSync('bash', ['-c', probe], { cwd: dir, env: { ...process.env, [FLAG]: '1' }, encoding: 'utf8' });
  assert.equal(out.stdout, 'flag=[]', `with ${FLAG}=1 in the shell and the env file, vite still sees it unset (${out.stderr})`);
});

test('unlisted zones stay shut on live (the live game IS the /preview/origins/ bundle): the publish script refuses to build when any .env* sets VITE_UNLISTED_ZONES, before it builds', () => {
  const text = read(PUBLISH), call = text.indexOf(`sh ${REFUSE}`), build = text.indexOf('npx vite build');
  assert.ok(call > -1 && call < build, 'publish-origins-preview.sh runs the refusal BEFORE the vite build');
  assert.match(text.slice(call, call + 80), /\|\| exit 1/, 'and stops when it refuses');
  for (const n of ['.env', '.env.local', '.env.production', '.env.production.local']) {
    const r = refuse({ [n]: `VITE_SUPABASE_URL=x\n${FLAG}=1\n` }); assert.equal(r.status, 1, `${n} setting the flag is refused`); assert.match(r.stderr, /VITE_UNLISTED_ZONES.*live/s, 'and says why');
  }
  assert.equal(refuse({ '.env': `  export ${FLAG}=1\n` }).status, 1, 'an export is refused');
  assert.equal(refuse({ '.env': `${FLAG} = 1\n` }).status, 1, 'spaces around = do not get past it');
  assert.equal(refuse({ '.env': `# ${FLAG}=1 is how a sandbox preview opens zone 90\nVITE_SUPABASE_URL=x\n`, '.env.production.local': 'VITE_SENTRY_DSN=y\n' }).status, 0, 'a comment or no mention is fine');
});

test('unlisted zones stay shut on the server: it reaches the registry only through origins/zones/listed.ts (flag hard-wired off), never loadZone or zoneIds directly', async () => {
  const bad = readdirSync('origins/server').filter((f) => f.endsWith('.ts') && !f.endsWith('.test.ts')).filter((f) => /import\s*(type\s*)?\{[^}]*\b(loadZone|zoneIds)\b[^}]*\}\s*from\s*['"][^'"]*zones\/loader/.test(read(`origins/server/${f}`)));
  assert.deepEqual(bad, [], 'origins/server files import loadZone or zoneIds from the loader');
  assert.ok(readdirSync('origins/server').some((f) => /listedZone/.test(read(`origins/server/${f}`))), 'the server does use the listed wrapper');
  process.env[FLAG] = '1';   // even a flagged environment must not open it for the server
  try {
    const { listedZone, listedZoneIds } = await import('../origins/zones/listed.ts');
    assert.ok(!listedZoneIds().includes('90') && listedZoneIds().includes('1'));
    assert.throws(() => listedZone('90'), /no zone 90/);
    assert.equal(listedZone('1').id, '1');
  } finally { delete process.env[FLAG]; }
});
