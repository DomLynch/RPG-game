// Presence and the writer share a box: neither may default to the other's port, and the writer's default PRESENCE_URL must reach presence's default bind.
import './lib/era-off.ts';   // RV78: the legacy suite runs on trunk's rules; sandbox-era.ts is the one switch (tests/lib/era-off.ts)
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { presenceRule } from '../origins/presence/presence-rules.ts';

const read = (path: string): string => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');

test('presence\'s default port is not the writer\'s, and the writer\'s default PRESENCE_URL points at presence\'s default port', () => {
  assert.match(read('origins/presence/main.ts'), /PRESENCE_PORT \?\? presenceRule\('presencePort'\)/, 'presence binds the presencePort row by default');
  const presence = presenceRule('presencePort');
  const writerOwn = Number(/PORT = '(\d+)'/.exec(read('scripts/origins-writer.mjs'))?.[1]);
  const writerToPresence = Number(/PRESENCE_URL \?\? 'http:\/\/127\.0\.0\.1:(\d+)'/.exec(read('scripts/origins-writer.mjs'))?.[1]);
  assert.ok(presence > 0 && writerOwn > 0 && writerToPresence > 0, 'all three defaults are found');
  assert.notEqual(presence, writerOwn, 'presence must not bind the writer\'s port');
  assert.equal(writerToPresence, presence, 'the writer reaches presence at presence\'s own default');
});
