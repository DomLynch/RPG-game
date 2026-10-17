// No database secret on any command line (Lead 2026-10-17: the verifier's password was visible in `ps`). The connection string becomes a 0600 libpq service file
// (origins/server/pg-service.ts); psql is spawned with no connection argument. This pins the helper, the writer's spawn, and guards the source so a URL cannot be put back in argv.
import assert from 'node:assert/strict';
import test from 'node:test';
import { chmodSync, existsSync, mkdtempSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, relative } from 'node:path';
import { pgConn, serviceFileText } from '../origins/server/pg-service.ts';
import { psqlDb } from '../origins/server/db.ts';
import { psqlAdapter as lootAdapter } from '../scripts/verify-loot.mjs';
import { psqlAdapter as dailyAdapter } from '../scripts/verify-daily.mjs';

const SECRET = 'p4ss/w0rd:with@odd#chars';
const URL_WITH_SECRET = `postgresql://frankendom_verifier:${encodeURIComponent(SECRET)}@db.example.com:5432/postgres?sslmode=require`;

test('the service file holds host, port, dbname, user, password and options, decoded', () => {
  assert.equal(serviceFileText(URL_WITH_SECRET), `[fk]\nhost=db.example.com\nport=5432\ndbname=postgres\nuser=frankendom_verifier\npassword=${SECRET}\nsslmode=require\n`);
});

test('the unix-socket form the checks use (empty host, host in the query) is read, not refused', () => {
  assert.equal(serviceFileText('postgresql://frankendom_origins@/postgres?host=/tmp/x'), '[fk]\ndbname=postgres\nuser=frankendom_origins\nhost=/tmp/x\n');
  assert.equal(serviceFileText('postgres://verifier@db/postgres'), '[fk]\nhost=db\ndbname=postgres\nuser=verifier\n');
  assert.equal(serviceFileText('postgres://u@[::1]:5433/d'), '[fk]\nhost=::1\nport=5433\ndbname=d\nuser=u\n');
});

test('a bad URL or a line break in a value is refused, and the message never carries the string', () => {
  for (const bad of ['mysql://u:hunter2@h/d', 'not a url hunter2', `postgres://u:${encodeURIComponent('a\nb')}@h/d`]) {
    assert.throws(() => serviceFileText(bad), (e: Error) => /pg-service/.test(e.message) && !e.message.includes('hunter2') && !e.message.includes('a\nb'));
  }
});

test('the service file is mode 0600 in a private 0700 directory, and one URL gets one file', () => {
  const c = pgConn(URL_WITH_SECRET);
  assert.equal(statSync(c.serviceFile).mode & 0o777, 0o600);
  assert.equal(statSync(dirname(c.serviceFile)).mode & 0o777, 0o700);
  assert.deepEqual(c.env, { PGSERVICEFILE: c.serviceFile, PGSERVICE: 'fk' });
  assert.equal(pgConn(URL_WITH_SECRET).serviceFile, c.serviceFile);
  assert.ok(readFileSync(c.serviceFile, 'utf8').includes(`password=${SECRET}`));
});

test('the writer\'s psql is spawned with no URL and no password in argv, and reads the service file', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'fk-fakepsql-')), out = join(dir, 'seen.json'), bin = join(dir, 'psql');
  writeFileSync(bin, `#!/bin/sh\ncat >/dev/null\nnode -e 'require("fs").writeFileSync(process.argv[1], JSON.stringify({ argv: process.argv.slice(2), svc: process.env.PGSERVICEFILE, name: process.env.PGSERVICE }))' "${out}" "$@"\n`);
  chmodSync(bin, 0o755);
  for (const pool of [0, 1]) {
    const db = psqlDb(URL_WITH_SECRET, bin, 10_000, pool);
    await db.run('select 1').catch(() => undefined);   // the fake prints nothing: only what it was given matters
    const seen = JSON.parse(readFileSync(out, 'utf8')) as { argv: string[]; svc: string; name: string };
    const line = seen.argv.join(' ');
    assert.ok(!line.includes('://') && !line.includes('frankendom_verifier') && !line.includes(SECRET) && !line.includes('db.example.com'), `pool ${pool}: argv is ${line}`);
    assert.equal(seen.name, 'fk');
    assert.ok(existsSync(seen.svc) && readFileSync(seen.svc, 'utf8').includes(`password=${SECRET}`), `pool ${pool}: psql was pointed at the service file`);
  }
});

test('the verifiers\' psql adapters pass no URL in argv either', async () => {
  const U = '11111111-2222-3333-4444-555555555555';
  const calls: { args: string[]; env: Record<string, string> }[] = [];
  const run = ((_c: string, args: string[], opts: { env: Record<string, string> }) => { calls.push({ args, env: opts.env }); return { status: 0, stdout: '14|["goblin.Body"]', stderr: '' }; }) as never;
  await lootAdapter(URL_WITH_SECRET, run).standing(U, 7);
  await dailyAdapter(URL_WITH_SECRET, run).refuse('2026-09-22', U);
  assert.equal(calls.length, 2, 'each adapter spawned psql once');
  for (const c of calls) {
    const line = c.args.join(' ');
    assert.ok(!line.includes('://') && !line.includes(SECRET) && !line.includes('db.example.com'), `argv: ${line}`);
    assert.equal(c.env.PGSERVICE, 'fk');
    assert.ok(readFileSync(c.env.PGSERVICEFILE!, 'utf8').includes(`password=${SECRET}`));
  }
});

// The source guard: no code path may put a connection string in a psql argv again.
const SKIP = new Set(['node_modules', '.git', 'dist', 'artifacts', 'docs']);
function walk(dir: string, out: string[] = []): string[] {
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    if (SKIP.has(e.name)) continue;
    const p = join(dir, e.name);
    if (e.isDirectory()) walk(p, out); else if (/\.(mjs|ts|sh)$/.test(e.name) && !/\.test\.ts$/.test(e.name)) out.push(p);
  }
  return out;
}
test('guard: no source file passes a connection URL as a psql argument', () => {
  const bad: string[] = [];
  for (const root of ['scripts', 'ops', 'origins', 'src']) for (const f of walk(root)) {
    const text = readFileSync(f, 'utf8');
    text.split('\n').forEach((line, i) => {
      const code = line.replace(/^\s*(\/\/|#).*/, '');
      if (/['"]psql['"]\s*,\s*\[\s*(url|databaseUrl|dbUrl|databaseURL|DATABASE_URL|dsn)\b/.test(code) || /\bspawn\w*\(\s*bin\s*,\s*\[\s*(url|databaseUrl|dbUrl)\b/.test(code)
        || /\bpsql\s+"?\$\{?(db|url|DATABASE_URL|dbUrl|databaseUrl)\b/.test(code) || /\bpsql\s+['"]?postgres(ql)?:\/\/[^\s'"]*:[^\s'"@]+@/.test(code)) bad.push(`${relative('.', f)}:${i + 1}: ${code.trim().slice(0, 100)}`);
    });
  }
  assert.deepEqual(bad, [], 'a postgres:// URL (it holds the password) must go through origins/server/pg-service.ts, never argv');
});
