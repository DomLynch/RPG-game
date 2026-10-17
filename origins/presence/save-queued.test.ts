// (1) With the writer's flusher on (production), POST /internal/location answers {queued:true}. Presence used to read that as a "malformed answer" and counted and logged EVERY save as failed
// although the writer had queued it, which would also hide a real save failure. (2) The per-window stats line and /health now carry how many poses were refused (`strikes`) and kept (`snapped`).
import assert from 'node:assert/strict';
import test from 'node:test';
import { writerSaveLocation } from '../server/location.ts';
import { createPresence } from './server.ts';
import { saveQueue } from './saves.ts';
import { joinBot } from './test-client.ts';

const reply = (body: unknown, status = 200): typeof fetch => (async () => new Response(JSON.stringify(body), { status })) as typeof fetch;
const at = { x: 40_000, z: 40_000, atMs: 1 };

test('writerSaveLocation accepts the flusher\'s {queued:true} and the write-through {character, stored}, and still refuses garbage and non-200', async () => {
  assert.deepEqual(await writerSaveLocation('http://w', 'k', 500, reply({ queued: true }))('a', at), { character: null, stored: false, queued: true });
  assert.deepEqual(await writerSaveLocation('http://w', 'k', 500, reply({ character: 'pc:x', stored: true }))('a', at), { character: 'pc:x', stored: true });
  await assert.rejects(writerSaveLocation('http://w', 'k', 500, reply({ nope: 1 }))('a', at), /malformed answer/);
  await assert.rejects(writerSaveLocation('http://w', 'k', 500, reply({ queued: 'yes' }))('a', at), /malformed answer/);
  await assert.rejects(writerSaveLocation('http://w', 'k', 500, reply({ queued: true }, 503))('a', at), /HTTP 503/);
});

test('through the save queue a flusher-queued save is SENT, not failed, and no failure line is logged; a real failure still counts', async () => {
  const lines: string[] = [], q = saveQueue(writerSaveLocation('http://w', 'k', 500, reply({ queued: true })), (l) => lines.push(l));
  q.push('0b8e2a6c-1f3d-4c5e-9a7b-2c4d6e8f0a1b', at);
  for (let i = 0; i < 50 && !q.idle(); i++) await new Promise((r) => setTimeout(r, 5));
  assert.deepEqual(q.stats(), { queued: 0, sent: 1, failed: 0 });
  assert.equal(lines.length, 0, 'no failure line is logged');
  const bad = saveQueue(writerSaveLocation('http://w', 'k', 500, reply({ queued: true }, 500)), (l) => lines.push(l));
  bad.push('0b8e2a6c-1f3d-4c5e-9a7b-2c4d6e8f0a1b', at);
  for (let i = 0; i < 50 && !bad.idle(); i++) await new Promise((r) => setTimeout(r, 5));
  assert.equal(bad.stats().failed, 1);
  assert.match(lines.join('\n'), /position save for 0b8e2a6c failed \(writer: HTTP 500\)/);
});

test('the stats line carries `snapped` and `strikes` for the window a refused pose landed in', async () => {
  const lines: string[] = [], p = createPresence({ verify: async () => null, log: (l) => lines.push(l), logEveryMs: 100 });
  await new Promise<void>((r) => p.server.listen(0, '127.0.0.1', r));
  try {
    const bot = await joinBot(p.port(), null);
    bot.pose(200, 0);                                                       // a 200 m jump: refused and kept
    for (let i = 0; i < 60 && !lines.some((l) => /snapped [1-9]\d* strikes [1-9]\d*$/.test(l)); i++) await new Promise((r) => setTimeout(r, 20));
    assert.ok(lines.some((l) => /refused \{[^}]*\} snapped 1 strikes 1$/.test(l)), `a stats line ends with snapped 1 strikes 1 (got ${lines.at(-1)})`);
    bot.close();
  } finally { await p.close(); }
});

test('presence counts refused poses: /health carries `snapped` (refused and kept) and `strikes` (every refused pose, including the one that drops the player)', async () => {
  const p = createPresence({ verify: async () => null, log: () => {} });
  await new Promise<void>((r) => p.server.listen(0, '127.0.0.1', r));
  try {
    const bot = await joinBot(p.port(), null);
    bot.pose(0, 0); await new Promise((r) => setTimeout(r, 150)); bot.pose(1, 0);   // honest (a pose 150 ms later, 1 m on): accepted, no strike
    for (let i = 0; i < 3; i++) { bot.pose(200 + i, 0); await new Promise((r) => setTimeout(r, 20)); }   // 200 m jumps: each snapped and kept
    await new Promise((r) => setTimeout(r, 100));
    assert.deepEqual([p.stats().snapped, p.stats().strikes], [3, 3], 'three refused poses: three snapped, three strikes');
    for (let i = 0; i < 12 && bot.closeCode() === null; i++) { bot.pose(300 + i, 0); await new Promise((r) => setTimeout(r, 20)); }
    for (let i = 0; i < 50 && bot.closeCode() === null; i++) await new Promise((r) => setTimeout(r, 20));
    assert.equal(bot.closeCode(), 4009, 'repeated refusals drop the player');
    const s = p.stats();
    assert.equal(s.strikes as number, (s.snapped as number) + 1, 'the dropping pose is a strike but not a snap');
  } finally { await p.close(); }
});
