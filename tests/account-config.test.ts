import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
test('release refuses partial account configuration, unsafe keys and missing CSP', () => {
  const run = (url: string, key: string) => spawnSync(process.execPath, ['scripts/check-account-config.mjs'], {
    encoding: 'utf8', env: { ...process.env, VITE_SUPABASE_URL: url, VITE_SUPABASE_PUBLISHABLE_KEY: key },
  });
  assert.equal(run('', '').status, 0);
  for (const [url, key, message] of [
    ['https://account-test.supabase.co', '', /both Supabase/],
    ['http://account-test.supabase.co', 'sb_publishable_test', /HTTPS project origin/],
    ['https://account-test.supabase.co', 'sb_secret_test', /publishable key/],
    ['https://account-test.supabase.co', 'sb_publishable_test', /CSP before release/],
  ] as const) {
    const result = run(url, key); assert.equal(result.status, 1); assert.match(result.stderr, message);
  }
});
