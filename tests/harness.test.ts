import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, rmSync, existsSync } from 'node:fs';
import { PHONE, serveDist, writeReceipt } from '../scripts/lib/harness.mjs';

test('harness: QA_URL points a gate at a deployed site without starting a server, and close is still safe', async () => {
  const site = await serveDist({ QA_URL: 'https://example.invalid/' });
  assert.equal(site.url, 'https://example.invalid/');
  await site.close();
});

test('harness: the gates share one phone viewport', () => {
  assert.deepEqual(PHONE, { width: 393, height: 852 });
});

test('harness: writeReceipt creates the directory and pretty-prints the receipt', async () => {
  const dir = new URL('../artifacts/.harness-test/', import.meta.url), path = new URL('receipt.json', dir);
  rmSync(dir, { recursive: true, force: true });
  await writeReceipt(path.pathname, { passed: true, errors: [] });
  assert.ok(existsSync(path));
  assert.equal(readFileSync(path, 'utf8'), JSON.stringify({ passed: true, errors: [] }, null, 2));
  rmSync(dir, { recursive: true, force: true });
});
