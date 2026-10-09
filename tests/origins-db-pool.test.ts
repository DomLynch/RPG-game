// The writer's pooled psql sessions (origins/server/db.ts pooledDb) against a stand-in psql that speaks just enough of the protocol: a script on stdin, a marker echoed at
// the end, and `ERROR:  <code>: <text>` + exit 3 on a refusal (ON_ERROR_STOP on a pipe). No database. The real-psql half is scripts/origins-writer-check.mjs, which runs pooled.
import test from 'node:test';
import assert from 'node:assert/strict';
import { chmodSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { AddressInfo } from 'node:net';
import { DbError, psqlDb } from '../origins/server/db.ts';
import { createWriter } from '../origins/server/server.ts';
import type { Handler } from '../origins/server/handlers.ts';

const dir = mkdtempSync(join(tmpdir(), 'origins-pool-'));
const log = join(dir, 'log');
const fake = join(dir, 'psql');
writeFileSync(log, '');
writeFileSync(fake, `#!/usr/bin/env node
const fs = require('node:fs');
const vars = {}; let buf = '';
const out = (s) => process.stdout.write(s + '\\n');
const lines = []; let busy = false;
const run = async () => {
  if (busy) return; busy = true;
  while (lines.length) {
    const l = lines.shift(); let m;
    if ((m = /^\\\\set (\\w+) '(.*)'$/.exec(l))) vars[m[1]] = m[2];
    else if (/^\\\\unset /.test(l)) delete vars[l.slice(7)];
    else if (l === 'select pid;') out(String(process.pid));
    else if (l === 'select var;') out(String(vars.a));
    else if (l === 'select die;') { process.stderr.write('psql:<stdin>:1: ERROR:  O0002: stale\\n'); process.exit(3); }
    else if (l === 'select hang;') await new Promise(() => {});
    else if ((m = /^select slow (\\d+);$/.exec(l))) { fs.appendFileSync(${JSON.stringify(log)}, 'start ' + vars.a + ' ' + process.pid + '\\n'); await new Promise((r) => setTimeout(r, Number(m[1]))); fs.appendFileSync(${JSON.stringify(log)}, 'end ' + vars.a + ' ' + process.pid + '\\n'); out('slow'); }
    else if ((m = /^\\\\echo ?(.*)$/.exec(l))) out(m[1]);
  }
  busy = false;
};
process.stdin.on('data', (d) => { buf += d; const p = buf.split('\\n'); buf = p.pop(); lines.push(...p); run(); });
`);
chmodSync(fake, 0o755);
const pooled = (n: number, timeout = 30_000) => psqlDb('postgresql://x', fake, timeout, n);

test('sessions are reused: many ops, at most pool-size processes; variables are per op', async () => {
  const db = pooled(2);
  const pids = new Set<string>();
  for (let i = 0; i < 6; i++) pids.add(await db.run('select pid;'));
  assert.ok(pids.size <= 2, `reused: ${[...pids].join(',')}`);
  assert.equal(await db.run('select var;', { a: 'plain' }), 'plain');
  assert.equal(await db.run('select var;'), 'undefined', 'the previous op\'s variable is unset');
});

test('a refusal is the same DbError as before and the next op gets a fresh session', async () => {
  const db = pooled(1);
  const before = await db.run('select pid;');
  await assert.rejects(db.run('select die;'), (e: DbError) => e instanceof DbError && e.code === 'O0002' && e.message === 'stale');
  const after = await db.run('select pid;');
  assert.notEqual(after, before, 'the refused session is gone');
});

test('kill -9 on a busy pooled session errors that op cleanly, replaces the session, and loses no other op', async () => {
  const db = pooled(2);
  const pid = Number(await db.run('select pid;'));
  const slow = db.run('select slow 300;', { a: 'x' });
  await new Promise((r) => setTimeout(r, 100));
  const started = readFileSync(log, 'utf8').trim().split('\n').pop()!.split(' ');
  process.kill(Number(started[2]), 'SIGKILL');
  await assert.rejects(slow, (e: DbError) => e instanceof DbError && /psql exit/.test(e.message));
  assert.equal(await db.run('select var;', { a: 'ok' }), 'ok', 'the pool still answers');
  void pid;
});

test('a hung op is killed at the timeout, errors, and its session is replaced', async () => {
  const db = pooled(1, 300);
  const before = await db.run('select pid;');
  await assert.rejects(db.run('select hang;'), (e: DbError) => e instanceof DbError);
  assert.notEqual(await db.run('select pid;'), before);
});

test('an idle session that dies is dropped, not handed to the next op', async () => {
  const db = pooled(1);
  const pid = Number(await db.run('select pid;'));
  process.kill(pid, 'SIGKILL');
  await new Promise((r) => setTimeout(r, 100));
  assert.notEqual(Number(await db.run('select pid;')), pid);
});

test('#1833 holds with 4 sessions: one account\'s writes never interleave, other accounts overlap and use other sessions', async () => {
  writeFileSync(log, '');
  const db = pooled(4);
  const slow: Handler = async ({ db: d, account }) => d.run('select slow 80;', { a: account });
  const writer = createWriter({ db, verify: async (t) => ({ a1: 'acct-a', a2: 'acct-a', a3: 'acct-a', b1: 'acct-b', c1: 'acct-c' } as Record<string, string>)[t] ?? null, where: async () => null as never, handlers: { slow } });
  await new Promise<void>((ok) => writer.listen(0, '127.0.0.1', ok));
  const base = `http://127.0.0.1:${(writer.address() as AddressInfo).port}/origins/`;
  try {
    const res = await Promise.all(['a1', 'a2', 'a3', 'b1', 'c1'].map((t) => fetch(base + 'slow', { method: 'POST', headers: { authorization: `Bearer ${t}`, 'content-type': 'application/json' }, body: '{}' }).then((r) => r.status)));
    assert.deepEqual(res, [200, 200, 200, 200, 200]);
  } finally { await new Promise<void>((ok) => writer.close(() => ok())); }
  const rows = readFileSync(log, 'utf8').trim().split('\n').map((l) => l.split(' '));
  const a = rows.filter((r) => r[1] === 'acct-a').map((r) => r[0]);
  assert.deepEqual(a, ['start', 'end', 'start', 'end', 'start', 'end'], `acct-a never overlaps: ${a.join(' ')}`);
  const firstEndA = rows.findIndex((r) => r[0] === 'end' && r[1] === 'acct-a');
  assert.ok(rows.slice(0, firstEndA).some((r) => r[0] === 'start' && r[1] !== 'acct-a'), 'another account starts while acct-a runs');
  assert.ok(new Set(rows.map((r) => r[2])).size > 1, 'more than one pooled session did the work');
});
