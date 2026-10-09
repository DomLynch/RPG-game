// scripts/publish-origins-preview.sh: the /preview/origins/ publish step. A guest-only build (no VITE_SUPABASE_* in the build's environment)
// would make the session refresh a silent no-op in production, so the account check must run on the build BEFORE anything is copied, and
// the script must refuse a checkout that is not the live revision. No build, no browser, no network beyond a loopback stub.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawn, spawnSync } from 'node:child_process';
import { createServer } from 'node:http';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const script = join(process.cwd(), 'scripts', 'publish-origins-preview.sh');
const text = readFileSync(script, 'utf8');
// A checkout without .git (the VPS work copies) cannot resolve HEAD: the refusal test skips there and stays strict in CI and on the Mac.
const noGit = spawnSync('git', ['rev-parse', '--verify', 'HEAD'], { stdio: 'ignore' }).status !== 0 && 'no git history in this checkout (HEAD cannot be resolved)';

test('the account check runs on the build before the copy, and the build gets the env through the process environment', () => {
  const at = (needle: string) => { const i = text.indexOf(needle); assert.ok(i >= 0, `${needle} is in the script`); return i; };
  assert.ok(at('check-built-account.mjs artifacts/origins-preview') < at('rsync -a --delete'), 'the check comes before the copy');
  assert.ok(at('set -a; . ./.env.production.local; set +a') < at('npx vite build'), 'the env is exported before the build');
  assert.match(text, /^set -euo pipefail$/m, 'a failed check aborts the script');
  assert.equal(spawnSync('bash', ['-n', script]).status, 0, 'the script parses');
});

test('a checkout that is not the live revision is refused before any build', { skip: noGit }, async () => {
  const server = createServer((_, res) => { res.setHeader('content-type', 'application/json'); res.end('{"revision":"0000000000000000000000000000000000000000","phase":"x"}'); });
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const port = (server.address() as { port: number }).port;
  try {
    // Async spawn: spawnSync would block this process's event loop, and the stub server could not answer the script's curl.
    const run = await new Promise<{ status: number | null; stderr: string }>((resolve) => {
      const child = spawn('bash', [script, '--dry-run'], { env: { ...process.env, PUBLISH_SITE: `http://127.0.0.1:${port}` }, timeout: 20000 });
      let stderr = '';
      child.stderr.on('data', (chunk) => { stderr += chunk; });
      child.on('close', (status) => resolve({ status, stderr }));
    });
    assert.equal(run.status, 1, 'refused');
    assert.match(run.stderr, /is not the live revision/);
  } finally { server.close(); }
});
