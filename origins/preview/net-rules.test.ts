// The zone page's client-plumbing numbers are rows (net-rules.json), and every default is the literal the code held before.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { netRule } from './net-rules.ts';
import { GIVE_UP_AFTER } from './presence-client.ts';
import { RENEW_TIMEOUT_MS } from './save.ts';
import { OUTBOX_TRIES, SPENT_MS, TOUCH_EVERY_MS } from './spawn-net.ts';

test('every row holds the value the code held before', () => {
  assert.deepEqual(
    { give: netRule('presence-give-up-after'), renew: netRule('save-renew-timeout-ms'), touch: netRule('spawn-touch-every-ms'), spent: netRule('spawn-spent-ms'), tries: netRule('spawn-outbox-tries') },
    { give: 6, renew: 3000, touch: 30_000, spent: 10_000, tries: 12 },
  );
});

test('the three files export the row values, not their own', () => {
  assert.deepEqual([GIVE_UP_AFTER, RENEW_TIMEOUT_MS, TOUCH_EVERY_MS, SPENT_MS, OUTBOX_TRIES], [6, 3000, 30_000, 10_000, 12]);
});

test('a missing row throws instead of answering NaN', () => {
  assert.throws(() => netRule('no-such-row'), /no row/);
});
