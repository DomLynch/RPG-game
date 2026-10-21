// The relay's shards (top-30 item 25; scripts/duel-relay.mjs shardOf): one process per row of ops/duel-relay.json, a room's shard fixed at
// mint in its first character, nginx routing a socket by that character. Both sides of a room meet on one process, a mis-routed socket
// is refused, the committed nginx snippet is exactly what the rows generate, and (where nginx is installed) a real nginx does the routing.
import assert from 'node:assert/strict';
import { spawn, spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { createServer } from 'node:net';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { nginxSnippet, relayShards, ROOM_CHARS, shardOf, startRelay } from '../scripts/duel-relay.mjs';

const SECRET = 'test-secret-that-is-at-least-32-characters-long';
const ROWS = relayShards(JSON.parse(readFileSync(new URL('../ops/duel-relay.json', import.meta.url), 'utf8')));
type Minted = { room: string; tokens: [string, string] };
const mint = async (base: string) => (await (await fetch(`${base}/duel/relay/room`, { method: 'POST', headers: { 'x-real-ip': '203.0.113.9' } })).json()) as Minted;
const join2 = (base: string, token: string) => {
  const ws = new WebSocket(`${base.replace('http', 'ws')}/duel/relay?token=${token}`), messages: string[] = [];
  ws.onmessage = (e) => messages.push(String(e.data));
  const opened = new Promise<boolean>((r) => { ws.onopen = () => r(true); ws.onerror = () => r(false); });
  return { ws, messages, opened };
};
const until = async (check: () => boolean, ms = 3000) => { const end = Date.now() + ms; while (!check() && Date.now() < end) await new Promise((r) => setTimeout(r, 10)); return check(); };
// The character class each nginx `if` routes, by shard (shard 0 is the default: every character no `if` names).
const routed = (snippet: string, rows: readonly { port: number }[]) => [...ROOM_CHARS].map((c) => {
  const hit = [...snippet.matchAll(/if \(\$arg_token ~ "\^\[([a-z0-9]+)\]"\) \{ set \$duel_relay_port (\d+); \}/g)].find((m) => m[1]!.includes(c));
  return rows.findIndex((r) => r.port === (hit ? Number(hit[2]) : rows[0]!.port));
});
const freePort = () => new Promise<number>((r) => { const s = createServer().listen(0, '127.0.0.1', () => { const p = (s.address() as { port: number }).port; s.close(() => r(p)); }); });

test('relay shards: nginx routes every room character to the shard shardOf names, for 1 to 6 shards and for the committed rows', () => {
  for (let n = 1; n <= 6; n++) {
    const rows = Array.from({ length: n }, (_, i) => ({ port: 9000 + i }));
    assert.deepEqual(routed(nginxSnippet(rows), rows), [...ROOM_CHARS].map((c) => shardOf(c, n)), `${n} shards`);
  }
  assert.deepEqual(routed(nginxSnippet(ROWS), ROWS), [...ROOM_CHARS].map((c) => shardOf(c, ROWS.length)));
  assert.ok(ROWS.length >= 2, 'the relay runs as more than one process (the point of item 25)');
  for (const bad of ['', 'A234567890123456', '-abc', '.0.123']) for (let n = 1; n <= 3; n++) assert.equal(shardOf(bad, n), -1, `${JSON.stringify(bad)} belongs to no shard, so every shard refuses it (fails closed; readToken already rejects such a room)`);
});

test('relay shards: ops/nginx/frankendom-duel-relay.conf is exactly what ops/duel-relay.json generates (run `node scripts/duel-relay.mjs --nginx`)', () => {
  assert.equal(readFileSync(new URL('../ops/nginx/frankendom-duel-relay.conf', import.meta.url), 'utf8'), nginxSnippet(ROWS));
});

test('relay shards: the rows refuse no shards, a shared port, a privileged port and more shards than room characters; no row takes the writer\'s or presence\'s port', () => {
  for (const bad of [{}, { shards: [] }, { shards: [{ port: 8787 }, { port: 8787 }] }, { shards: [{ port: 80 }] }, { shards: [{ port: '8787' }] }, { shards: Array.from({ length: 37 }, (_, i) => ({ port: 9000 + i })) }])
    assert.throws(() => relayShards(bad), /ops\/duel-relay\.json/, JSON.stringify(bad).slice(0, 60));
  const writer = Number(/PORT = '(\d+)'/.exec(readFileSync(new URL('../scripts/origins-writer.mjs', import.meta.url), 'utf8'))![1]);
  const presence = Number(/^PRESENCE_PORT=(\d+)/m.exec(readFileSync(new URL('../ops/presence.env.example', import.meta.url), 'utf8'))![1]);
  for (const row of ROWS) assert.ok(row.port !== writer && row.port !== presence, `shard port ${row.port} collides with the writer (${writer}) or presence (${presence})`);
  assert.equal(ROWS[0]!.port, 8787, 'shard 0 keeps the pre-shard port: it mints and answers health');
  assert.throws(() => startRelay({ port: 0, secret: SECRET, shard: 2, shards: 2 }), /not a shard/);
});

test('relay shards: shard 0 mints rooms for every shard; each side joins its room\'s shard and meets its peer; the other shard refuses it (wrong-shard)', async () => {
  const lines: string[] = [];
  const zero = await startRelay({ port: 0, secret: SECRET, shard: 0, shards: 2, log: (l: string) => lines.push(l), logEveryMs: 50 });
  const one = await startRelay({ port: 0, secret: SECRET, shard: 1, shards: 2, log: () => {} });
  const at = [zero, one].map((r) => `http://127.0.0.1:${r.port}`);
  try {
    const rooms: Minted[] = [];
    for (let i = 0; i < 9; i++) rooms.push(await mint(at[0]!));
    const owners = rooms.map((m) => shardOf(m.room, 2));
    assert.ok(rooms.every((m) => /^[ab][a-z0-9]{15}$/.test(m.room)), 'a two-shard mint names shard 0 or 1 in the first character');
    assert.ok(owners.includes(0) && owners.includes(1), `nine mints land on both shards (${owners.join('')})`);
    for (const m of rooms.slice(0, 4)) {
      const home = at[shardOf(m.room, 2)]!, a = join2(home, m.tokens[0]), b = join2(home, m.tokens[1]);
      assert.ok(await a.opened && await b.opened);
      assert.ok(await until(() => a.messages.includes('{"t":"peer","up":true}') && b.messages.includes('{"t":"peer","up":true}')), `room ${m.room}: both sides meet on shard ${shardOf(m.room, 2)}`);
      a.ws.send('{"t":"pkt","n":1}');
      assert.ok(await until(() => b.messages.includes('{"t":"pkt","n":1}')));
      a.ws.close(); b.ws.close();
      const away = join2(at[1 - shardOf(m.room, 2)]!, m.tokens[0]);
      assert.equal(await away.opened, false, 'the shard that does not own the room refuses it');
    }
    const health = await (await fetch(`${at[1]}/duel/relay/health`)).json() as { shard: number };
    assert.equal(health.shard, 1);
    assert.ok(await until(() => lines.some((l) => l.startsWith('duel-relay shard 0: rooms '))), 'shard 0 names itself in its count line (the shards share one log file)');
  } finally { await zero.close(); await one.close(); }
});

const nginx = spawnSync('nginx', ['-v']).status === 0 ? 'nginx' : spawnSync('/usr/sbin/nginx', ['-v']).status === 0 ? '/usr/sbin/nginx' : null;
test('relay shards through a real nginx: the generated snippet sends both sides of every room to its own shard, and the mint and health to shard 0', { skip: nginx ? false : 'no nginx binary here' }, async () => {
  const zero = await startRelay({ port: 0, secret: SECRET, shard: 0, shards: 2, log: () => {} });
  const one = await startRelay({ port: 0, secret: SECRET, shard: 1, shards: 2, log: () => {} });
  const dir = mkdtempSync(join(tmpdir(), 'relay-nginx-')), port = await freePort();
  writeFileSync(join(dir, 'relay.conf'), nginxSnippet([{ port: zero.port }, { port: one.port }]));
  const temp = ['client_body', 'proxy', 'fastcgi', 'uwsgi', 'scgi'].map((t) => `${t}_temp_path ${dir}/${t};`).join(' ');
  writeFileSync(join(dir, 'nginx.conf'), `pid ${dir}/nginx.pid; error_log ${dir}/error.log; events {} http { access_log off; ${temp} server { listen 127.0.0.1:${port}; server_name frankendom.com; include ${dir}/relay.conf; } }`);
  const proc = spawn(nginx!, ['-p', dir, '-e', `${dir}/error.log`, '-c', join(dir, 'nginx.conf'), '-g', 'daemon off;'], { stdio: 'ignore' });
  const base = `http://127.0.0.1:${port}`;
  try {
    let up = false;
    for (const end = Date.now() + 5000; !up && Date.now() < end; await new Promise((r) => setTimeout(r, 50))) up = await fetch(`${base}/duel/relay/health`).then((r) => r.ok, () => false);
    assert.ok(up, 'nginx is up');
    assert.equal(((await (await fetch(`${base}/duel/relay/health`)).json()) as { shard: number }).shard, 0, 'health is shard 0');
    const seen = new Set<number>();
    for (let i = 0; i < 8; i++) {
      const m = await mint(base), a = join2(base, m.tokens[0]), b = join2(base, m.tokens[1]);
      assert.ok(await a.opened && await b.opened, `room ${m.room} opens through nginx`);
      assert.ok(await until(() => a.messages.includes('{"t":"peer","up":true}') && b.messages.includes('{"t":"peer","up":true}')), `room ${m.room}: both sides meet through nginx`);
      seen.add(shardOf(m.room, 2));
      assert.equal([zero, one][shardOf(m.room, 2)]!.stats().rooms, 1, `room ${m.room} lives on shard ${shardOf(m.room, 2)}`);
      a.ws.close(); b.ws.close();
      assert.ok(await until(() => zero.stats().rooms + one.stats().rooms === 0), 'the room is gone once both sides leave');
    }
    assert.deepEqual([...seen].sort(), [0, 1], 'eight rooms through nginx used both shards');
  } finally { proc.kill(); await zero.close(); await one.close(); rmSync(dir, { recursive: true, force: true }); }
});
