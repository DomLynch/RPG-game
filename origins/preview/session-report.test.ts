import test from 'node:test';
import assert from 'node:assert/strict';
import { monitoringOptions } from '../../src/monitoring.ts';
import { beacon, beaconPath, SIGNED_OUT_EVENT, signedOutEvent, type SignedOutReason } from './session-report.ts';

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

test('beacons are a bodyless GET to a fixed path: no query, no headers, no credentials, no referrer; never throw, never awaited', () => {
  const seen: Array<[string, RequestInit]> = [];
  for (const kind of ['zone1-stale-session', 'zone1-prefetch-hit', 'zone1-prefetch-miss'] as const) beacon(kind, ((u: string, init: RequestInit) => (seen.push([u, init]), Promise.resolve(new Response(null, { status: 404 })))) as never);
  assert.deepEqual(seen.map(([u]) => u), ['/_e/zone1-stale-session', '/_e/zone1-prefetch-hit', '/_e/zone1-prefetch-miss']);
  for (const [u, init] of seen) { assert.doesNotMatch(u, /[?#]/); assert.deepEqual(Object.keys(init).sort(), ['cache', 'credentials', 'keepalive', 'method', 'referrerPolicy']); assert.equal(init.method, 'GET'); assert.equal(init.credentials, 'omit'); assert.equal(init.referrerPolicy, 'no-referrer'); assert.equal(init.body, undefined); assert.equal(init.headers, undefined); }
  assert.equal(beaconPath('zone1-prefetch-hit'), '/_e/zone1-prefetch-hit');
  beacon('zone1-stale-session', (() => { throw new Error('boom'); }) as never); beacon('zone1-stale-session', (() => Promise.reject(new Error('net'))) as never); beacon('zone1-stale-session', undefined);
});
