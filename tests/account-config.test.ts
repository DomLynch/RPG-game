import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
test('release refuses partial account configuration, unsafe keys and missing CSP [slow]', () => {
  const run = (url: string, key: string) => spawnSync(process.execPath, ['scripts/check-account-config.mjs'], {
    encoding: 'utf8', env: { ...process.env, VITE_SUPABASE_URL: url, VITE_SUPABASE_PUBLISHABLE_KEY: key },
  });
  assert.equal(run('', '').status, 0);
  assert.equal(run('https://rxbewmzmovelckzoosss.supabase.co', 'sb_publishable_test').status, 0);
  for (const [url, key, message] of [
    ['https://account-test.supabase.co', '', /both Supabase/],
    ['http://account-test.supabase.co', 'sb_publishable_test', /HTTPS project origin/],
    ['https://account-test.supabase.co', 'sb_secret_test', /publishable key/],
    ['https://account-test.supabase.co', 'sb_publishable_test', /CSP before release/],
  ] as const) {
    const result = run(url, key); assert.equal(result.status, 1); assert.match(result.stderr, message);
  }
});
test('a production bundle without the Supabase origin or with the wrong auth storageKey fails the deploy', async () => {
  const { mkdtempSync, mkdirSync, writeFileSync } = await import('node:fs');
  const { join } = await import('node:path');
  const { tmpdir } = await import('node:os');
  const run = (files: Record<string, string>) => {
    const dist = mkdtempSync(join(tmpdir(), 'built-account-')); mkdirSync(join(dist, 'assets'));
    for (const [name, body] of Object.entries(files)) writeFileSync(join(dist, 'assets', name), body);
    return spawnSync(process.execPath, ['scripts/check-built-account.mjs', dist], { encoding: 'utf8' });
  };
  const origin = 'const u="https://rxbewmzmovelckzoosss.supabase.co";', key = 'auth:{storageKey:"frankendom.auth.v1"}';
  assert.equal(run({ 'index-a.js': origin, 'account-b.js': key }).status, 0);
  for (const [files, message] of [
    [{ 'index-a.js': 'guest', 'account-b.js': key }, /Supabase project origin/],
    [{ 'index-a.js': origin }, /auth storageKey/],
    [{ 'index-a.js': origin, 'account-b.js': 'auth:{storageKey:"frankendom.auth.v2"}' }, /auth storageKey/],
  ] as const) {
    const result = run(files); assert.equal(result.status, 1); assert.match(result.stderr, message);
  }
});
