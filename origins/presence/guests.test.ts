// Guests (Lead 2026-10-16, Dom: a signed-out player does and fights everything, signing in only saves): a guest joins presence with no token, under an identity the SERVER mints, and nothing it does
// is saved, resolved by the writer, or remembered. Same per-IP rate limits plus a lower guest cap per address and a ceiling; a guest receives everything and sends nothing but a warp.
import test from 'node:test';
import assert from 'node:assert/strict';
import { connect } from 'node:net';
import { LIMITS, createPresence } from './server.ts';
import { RULES } from './interest.ts';
import { presenceRule } from './presence-rules.ts';
import { joinBot } from './test-client.ts';

const A = '00000000-0000-4000-8000-0000000000a1';
const wait = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms));
const until = async (ok: () => boolean, ms = 3000): Promise<void> => { for (let t = 0; t < ms && !ok(); t += 25) await wait(25); };
const start = async (opts: Partial<Parameters<typeof createPresence>[0]> = {}) => {
  const p = createPresence({ verify: async (t) => (t === 'a' ? A : null), log: () => {}, ...opts });
  await new Promise<void>((r) => p.server.listen(0, '127.0.0.1', r));
  return p;
};
// A raw upgrade request so a test can come "from" another address (X-Real-IP, trusted when ipHeader is on) and read the status line.
const upgrade = (port: number, ip: string, protocols: string): Promise<{ status: number; socket: import('node:net').Socket }> => new Promise((resolve, reject) => {
  const s = connect(port, '127.0.0.1');
  s.once('error', reject);
  s.write(`GET /origins/presence HTTP/1.1\r\nHost: x\r\nUpgrade: websocket\r\nConnection: Upgrade\r\nSec-WebSocket-Key: dGhlIHNhbXBsZSBub25jZQ==\r\nSec-WebSocket-Version: 13\r\nSec-WebSocket-Protocol: ${protocols}\r\nX-Real-IP: ${ip}\r\n\r\n`);
  s.once('data', (d) => resolve({ status: Number(/^HTTP\/1\.1 (\d+)/.exec(d.toString('latin1'))?.[1]), socket: s }));
});

test('a guest joins with no token at the spawn, is told it is a guest, and is seen by (and sees) a signed-in player with an enter record guest:true and no name', async () => {
  const p = await start({ nameOf: () => 'Alice' });
  try {
    const a = await joinBot(p.port(), 'a'), g = await joinBot(p.port(), null);
    assert.equal(g.hello.guest, true); assert.equal(a.hello.guest, undefined, 'a signed-in player is not a guest');
    const guest = [...p.world.byAccount.values()].find((x) => x.guest)!;
    assert.ok(guest.account.startsWith('guest-') && !/^[0-9a-f-]{36}$/.test(guest.account), 'a server-minted identity that is not a uuid');
    await until(() => a.entered().length === 1 && g.entered().length === 1);
    assert.deepEqual(a.entered(), [{ id: guest.id, name: null, guest: true }], 'the signed-in player sees a Guest, no name');
    assert.deepEqual(g.entered(), [{ id: p.world.byAccount.get(A)!.id, name: 'Alice', guest: false }], 'the guest sees the signed-in name');
    assert.ok(g.seen().length === 1 && a.seen().length === 1);
    a.close(); g.close();
  } finally { await p.close(); }
});

test('nothing a guest does reaches a saved or resolvable place: no position save, no 10-minute memory, never found by /internal/where or /internal/rejoin, and no locate call', async () => {
  const saved: string[] = [], located: string[] = [];
  const p = await start({ internalKey: 'k', save: async (acct) => { saved.push(acct); return { character: null, stored: false }; }, saveEveryMs: 50, locate: async (acct) => { located.push(acct); return null; } });
  try {
    const g = await joinBot(p.port(), null);
    const guest = [...p.world.byAccount.values()].find((x) => x.guest)!;
    for (let i = 1; i <= 5; i++) { g.pose(i, 0); await wait(150); }
    await wait(300);
    const get = (path: string, init?: RequestInit) => fetch(`http://127.0.0.1:${p.port()}${path}`, { ...init, headers: { authorization: 'Bearer k' } });
    assert.equal((await get(`/internal/where?account=${encodeURIComponent(guest.account)}`)).status, 400, 'the guest id is not an account the writer can resolve');
    assert.equal((await get('/internal/rejoin', { method: 'POST', body: JSON.stringify({ account: guest.account }) })).status, 400);
    g.close(); await until(() => p.world.byAccount.size === 0); await wait(100);
    assert.deepEqual([saved, located], [[], []], 'no save, no locate for a guest');
    assert.equal(p.world.memory.size, 0, 'a guest leaves no 10-minute memory');
  } finally { await p.close(); }
});

test('a socket that outlives the 60 s join window still frees its place when it closes (the per-address count must not leak, or an address is locked out until a restart)', async () => {
  let t = 1_000_000;
  const p = await start({ ipHeader: true, now: () => t });
  try {
    const perIp = presenceRule('guestIpSockets'), open: import('node:net').Socket[] = [];
    for (let i = 0; i < perIp; i++) { const r = await upgrade(p.port(), '10.5.5.5', 'frankendom.presence.v2, guest'); assert.equal(r.status, 101); open.push(r.socket); }
    t += 61_000;   // the address's window rolls while both sockets are still open
    assert.equal((await upgrade(p.port(), '10.5.5.5', 'frankendom.presence.v2, guest')).status, 429, 'still full after the roll: the two open guests count');
    for (const s of open) s.destroy();
    await until(() => p.world.byAccount.size === 0, 4000);
    for (let i = 0; i < perIp; i++) assert.equal((await upgrade(p.port(), '10.5.5.5', 'frankendom.presence.v2, guest')).status, 101, `guest ${i + 1} after both closed: the address is empty again`);
  } finally { await p.close(); }
});

// Every way a socket's place can end must give the per-address count back. A leak shows as a refusal that the cap alone could not cause: repeated attempts beyond the cap keep their own status (503/403), never turn into 429.
const G = 'frankendom.presence.v2, guest', TOKEN_A = 'frankendom.presence.v2, token.a', BAD = 'frankendom.presence.v2, token.bad', BOOM = 'frankendom.presence.v2, token.boom';
const joinAndDrop = async (p: Awaited<ReturnType<typeof start>>, ip: string, proto: string, n: number, drop: (s: import('node:net').Socket) => void): Promise<void> => {
  const open: import('node:net').Socket[] = [];
  for (let i = 0; i < n; i++) { const r = await upgrade(p.port(), ip, proto); assert.equal(r.status, 101, `join ${i + 1} of ${n} from ${ip}`); open.push(r.socket); }
  for (const s of open) drop(s);
  await until(() => p.world.byAccount.size === 0, 4000);
};
test('a guest socket gives its place back on every exit: a clean close, a reset (socket error), the idle timeout, and a refusal after the identity is minted (world-full)', async () => {
  const cap = presenceRule('guestIpSockets');
  const p = await start({ ipHeader: true, limits: { ...LIMITS, idleMs: 300 } });
  try {
    await joinAndDrop(p, '10.4.0.1', G, cap, (s) => s.destroy());
    await joinAndDrop(p, '10.4.0.1', G, cap, (s) => s.resetAndDestroy());   // ECONNRESET on the server's socket
    await joinAndDrop(p, '10.4.0.1', G, cap, () => {});                      // the client says nothing: the server's idle timer ends it
    await joinAndDrop(p, '10.4.0.1', G, cap, (s) => s.destroy());            // and the address still holds the full cap afterwards
  } finally { await p.close(); }
  const full = await start({ ipHeader: true, rules: { ...RULES, softCap: 1, hardCap: 1 } });
  try {
    const first = await upgrade(full.port(), '10.4.1.1', G); assert.equal(first.status, 101);   // fills the one place
    for (let i = 0; i < cap + 2; i++) assert.equal((await upgrade(full.port(), '10.4.2.2', G)).status, 503, `attempt ${i + 1}: world-full every time, never a guest-ip 429 (the refusal gave its place back)`);
    first.socket.destroy();
  } finally { await full.close(); }
});
test('a signed-in socket gives its place back on every exit: a bad token, a verify that throws, already-in, world-full, a clean close (ipSockets counted the same way)', async () => {
  const p = await start({ ipHeader: true, limits: { ...LIMITS, ipSockets: 2 }, verify: async (t) => { if (t === 'boom') throw new Error('verify down'); return t === 'a' ? A : null; } });
  try {
    for (let i = 0; i < 4; i++) assert.equal((await upgrade(p.port(), '10.4.3.3', BAD)).status, 403, `bad token ${i + 1}`);
    for (let i = 0; i < 4; i++) assert.equal((await upgrade(p.port(), '10.4.3.3', BOOM)).status, 403, `verify throws ${i + 1}`);
    const held = await upgrade(p.port(), '10.4.3.3', TOKEN_A); assert.equal(held.status, 101);
    for (let i = 0; i < 4; i++) assert.equal((await upgrade(p.port(), '10.4.3.3', TOKEN_A)).status, 503, `already-in ${i + 1}`);   // 4 refusals after verify, ipSockets is 2
    held.socket.destroy(); await until(() => p.world.byAccount.size === 0, 4000);
    await joinAndDrop(p, '10.4.3.3', TOKEN_A, 1, (s) => s.destroy());
  } finally { await p.close(); }
  const full = await start({ ipHeader: true, limits: { ...LIMITS, ipSockets: 2 }, rules: { ...RULES, softCap: 1, hardCap: 1 }, verify: async (t) => (t === 'a' ? A : t === 'b' ? '00000000-0000-4000-8000-0000000000b2' : null) });
  try {
    const first = await upgrade(full.port(), '10.4.4.4', TOKEN_A); assert.equal(first.status, 101);
    for (let i = 0; i < 4; i++) assert.equal((await upgrade(full.port(), '10.4.5.5', 'frankendom.presence.v2, token.b')).status, 503, `world-full ${i + 1}`);
    first.socket.destroy();
  } finally { await full.close(); }
});

test('the caps: the per-address guest cap is lower than a signed-in player\'s; the global ceiling refuses with 503; the kill switch refuses guests; a guest cannot ride v1; a token beats `guest`', async () => {
  const p = await start({ ipHeader: true });
  try {
    const perIp = presenceRule('guestIpSockets'), ceiling = presenceRule('guestCeiling'), open: import('node:net').Socket[] = [];
    for (let i = 0; i < perIp; i++) { const r = await upgrade(p.port(), '10.9.9.9', 'frankendom.presence.v2, guest'); assert.equal(r.status, 101); open.push(r.socket); }
    assert.equal((await upgrade(p.port(), '10.9.9.9', 'frankendom.presence.v2, guest')).status, 429, `the ${perIp + 1}th guest from one address is refused (guestIpSockets)`);
    assert.equal((await upgrade(p.port(), '10.9.9.9', 'frankendom.presence.v2, frankendom.presence.v1, token.zzz')).status, 403, 'the signed-in path still runs its own check (a bad token), and is not a guest');
    assert.equal((await upgrade(p.port(), '10.8.8.8', 'frankendom.presence.v1, guest')).status, 400, 'a v1 client cannot join as a guest');
    // fill the ceiling from distinct addresses, then one more
    for (let i = open.length; i < ceiling; i++) { const r = await upgrade(p.port(), `10.1.${i >> 8}.${i & 255}`, 'frankendom.presence.v2, guest'); assert.equal(r.status, 101, `guest ${i + 1}`); open.push(r.socket); }
    assert.equal((await upgrade(p.port(), '10.7.7.7', 'frankendom.presence.v2, guest')).status, 503, 'the ceiling: guest-full');
    assert.equal((await upgrade(p.port(), '10.7.7.7', 'frankendom.presence.v2, frankendom.presence.v1, token.zzz')).status, 403, 'a signed-in player is never refused for the guest ceiling');
    for (const s of open) s.destroy();
    await until(() => p.world.byAccount.size === 0, 4000);
    assert.equal((await upgrade(p.port(), '10.6.6.6', 'frankendom.presence.v2, guest')).status, 101, 'closing frees the room');
  } finally { await p.close(); }
  const off = await start({ guests: false });
  try { await assert.rejects(() => joinBot(off.port(), null), /refused|closed/); }
  finally { await off.close(); }
});

test('a guest receives everything and sends nothing but a warp: speech (any text frame) closes the socket; a warp works; guests are not in the signed-in rejoin map', async () => {
  const p = await start();
  try {
    const g = await joinBot(p.port(), null), talker = await joinBot(p.port(), null);
    g.warp('town-respawn'); await until(() => g.hellos() === 2);
    assert.equal(g.hellos(), 2, 'a guest may warp (its death respawn)');
    talker.raw(JSON.stringify({ t: 'say', text: 'hello' }));
    await until(() => talker.closeCode() !== null); assert.equal(talker.closeCode(), 1003, 'a guest\'s speech is refused until S4\'s filter lets guests speak');
    assert.equal(g.closeCode(), null);
    g.close();
  } finally { await p.close(); }
});
