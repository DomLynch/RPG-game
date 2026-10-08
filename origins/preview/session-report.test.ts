import test from 'node:test';
import assert from 'node:assert/strict';
import { monitoringOptions } from '../../src/monitoring.ts';
import { SIGNED_OUT_EVENT, signedOutEvent, type SignedOutReason } from './session-report.ts';

test('the stale-session event carries a fixed message and an enum tag, and nothing identifying survives beforeSend', () => {
  const opts = monitoringOptions('https://k@o.ingest.sentry.io/1', 'rel', 'production'), beforeSend = opts.beforeSend as (e: Record<string, unknown>) => Record<string, unknown> | null;
  assert.equal(opts.sendDefaultPii, false);
  for (const reason of ['no-client', 'timeout', 'refused'] as SignedOutReason[]) {
    // what Sentry adds around our event: user, request (url with a query), breadcrumbs, extra
    const out = beforeSend({ ...signedOutEvent(reason), user: { id: 'u', email: 'a@b.c' }, request: { url: 'https://frankendom.com/preview/origins/?x=eyJhbGciOiJIUzI1NiJ9.eyJzdWIi.sig' }, breadcrumbs: [{ message: 'tap' }], extra: { token: 'abc' } })!;
    for (const gone of ['user', 'request', 'breadcrumbs', 'extra']) assert.equal(gone in out, false, gone);
    const json = JSON.stringify(out);
    assert.equal(out.message, SIGNED_OUT_EVENT); assert.deepEqual(out.tags, { reason });
    assert.doesNotMatch(json, /eyJ[A-Za-z0-9_-]{5,}/, 'no JWT'); assert.doesNotMatch(json, /[0-9a-f]{32,}/i, 'no 32+ hex id');
  }
});
