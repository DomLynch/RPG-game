import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { init, captureException, type Envelope } from '@sentry/browser';
import { monitoringOptions } from '../src/monitoring.ts';

test('production CSP permits one explicit HTTPS ingest origin, not a wildcard', () => {
  const config = readFileSync(new URL('../deploy/frankendom.com.conf', import.meta.url), 'utf8');
  const sources = config.match(/connect-src ([^;]+);/)![1].split(' ');
  assert.equal(sources.length, 3);
  assert.equal(sources[0], "'self'");
  assert.equal(sources[1], 'blob:');
  assert.match(sources[2], /^https:\/\/o\d+\.ingest\.us\.sentry\.io$/);
});

test('monitoring is disabled without a DSN and excludes high-volume integrations', () => {
  const options = monitoringOptions(undefined, undefined, 'development');
  assert.equal(options.enabled, false);
  assert.equal(options.defaultIntegrations, false);
  assert.equal(options.sendDefaultPii, false);
  assert.equal(options.tracesSampleRate, 0);
  assert.deepEqual((options.integrations as { name: string }[]).map(i => i.name), ['GlobalHandlers', 'BrowserApiErrors', 'Dedupe']);
});

test('real SDK sends error and release but strips guest identity and request details', async () => {
  const envelopes: Envelope[] = [];
  const client = init({
    ...monitoringOptions('https://public@example.com/1', 'test-revision', 'test'),
    transport: () => ({ send: async envelope => { envelopes.push(envelope); return { statusCode: 200 }; }, flush: async () => true }),
  });
  client?.addEventProcessor(event => ({ ...event,
    request: { url: 'https://example.com/?token=private-value', headers: { Cookie: 'private-value' } },
    breadcrumbs: [{ message: 'private-name' }],
  }));
  captureException(new Error('monitoring regression probe'), {
    user: { id: 'private-id', username: 'private-name' },
    extra: { secret: 'private-value' },
  });
  await client?.flush(2000);
  const events = envelopes.flatMap(([, items]) => items.filter(([header]) => header.type === 'event').map(([, payload]) => payload));
  assert.equal(events.length, 1);
  const event = events[0] as Record<string, unknown>;
  assert.equal(event.release, 'test-revision');
  assert.equal(event.environment, 'test');
  assert.match(JSON.stringify(event.exception), /monitoring regression probe/);
  for (const key of ['user', 'request', 'breadcrumbs', 'extra']) assert.equal(event[key], undefined);
  assert.doesNotMatch(JSON.stringify(event), /private-id|private-name|private-value/);
  await client?.close();
});
