// The presence service (docs/specs/origins/one-shard.md §1-§5): who is where, in memory, rebuilt from nothing after a restart. It writes no rows and
// decides nothing that pays. wss://frankendom.com/origins/presence[?friend=<account id>] (nginx -> 127.0.0.1) with the Supabase access token in the Sec-WebSocket-Protocol header (`frankendom.presence.v1, token.<jwt>`), never in the URL: a URL lands in proxy logs and browser history.
// No npm dependency, like the duel relay: the RFC 6455 subset a browser needs (masked client frames, no fragments, no extensions).
// Skeleton: movement, interest, layers, caps and counts. Names, guild/party lookup and speech arrive with their own PRs; a player is its account id for now.
import { createHash, timingSafeEqual } from 'node:crypto';
import { createServer, type Server } from 'node:http';
import type { Socket } from 'node:net';
import type { Duplex } from 'node:stream';
import { decodeUp } from './wire.ts';
import { RULES, World, type Player, type Rules } from './interest.ts';

const GUID = '258EAFA5-E914-47DA-95CA-C5AB0DC85B11';
export const PROTOCOL = 'frankendom.presence.v1';   // the one subprotocol the client offers next to `token.<jwt>`; the server echoes this one, never the token
const UUID = /^[0-9a-f-]{36}$/;
export const LIMITS = { maxMessage: 64, perSecond: 30, idleMs: 30_000, ipSockets: 8, ipJoinsPerMinute: 30, beatMs: 2000 };
export type Limits = typeof LIMITS;

function frame(opcode: number, payload: Uint8Array): Buffer {
  const n = payload.length, head = n < 126 ? Buffer.from([0x80 | opcode, n]) : Buffer.from([0x80 | opcode, 126, n >> 8, n & 255]);
  return Buffer.concat([head, payload]);
}

export type PresenceOptions = {
  verify: (token: string) => Promise<string | null>;   // the client's access token -> its account id (origins/server/auth.ts supabaseVerify)
  rules?: Rules; limits?: Limits; maxLayers?: number;
  now?: () => number; log?: (line: string) => void; logEveryMs?: number; sweepEveryMs?: number; ipHeader?: boolean;   // ipHeader: trust nginx's X-Real-IP (only behind nginx on 127.0.0.1)
  internalKey?: string;   // the shared secret of GET /internal/where (the writer asks where an account stands); unset: that route does not exist
};
export type Presence = { server: Server; world: World; port: () => number; stats: () => Record<string, unknown>; close: () => Promise<void> };

export function createPresence(opts: PresenceOptions): Presence {
  const { verify, rules = RULES, limits = LIMITS, now = Date.now, log = console.log, logEveryMs = 60_000, sweepEveryMs = 60_000 } = opts;
  const world = new World(rules, opts.maxLayers ?? 8);
  const sockets = new Map<Player, Duplex>();
  const perIp = new Map<string, { sockets: number; windowStart: number; joins: number }>();
  const counts = { packets: 0, bytes: 0, up: 0, joined: 0, refused: {} as Record<string, number>, maxTickMs: 0, ticks: 0 };
  const perLayerOut = new Map<number, { packets: number; bytes: number }>();
  const refused = (why: string): void => { counts.refused[why] = (counts.refused[why] ?? 0) + 1; };
  let tickNo = 0;

  // The tick is aimed at the wall clock (not setInterval's drift) so a slow tick does not stretch every later one; the time each took is reported.
  let next = now() + rules.tickMs;
  const ticker = setInterval(() => {
    if (now() < next) return;
    next += rules.tickMs;
    const started = performance.now();
    tickNo = (tickNo + 1) & 0xffff;
    for (const [p, packet] of world.tick(tickNo)) {
      const sock = sockets.get(p);
      if (!sock || sock.destroyed) continue;
      sock.write(frame(2, packet));
      counts.packets++; counts.bytes += packet.length;
      const l = perLayerOut.get(p.layer.id) ?? { packets: 0, bytes: 0 }; l.packets++; l.bytes += packet.length; perLayerOut.set(p.layer.id, l);
    }
    const took = performance.now() - started;
    counts.ticks++; if (took > counts.maxTickMs) counts.maxTickMs = took;
  }, Math.max(5, Math.floor(rules.tickMs / 4)));
  const beats = setInterval(() => { world.sweep(now()); for (const s of sockets.values()) if (!s.destroyed) s.write(frame(1, Buffer.from('{"t":"beat"}'))); }, limits.beatMs);
  const reporter = setInterval(() => {
    log(`presence: ${JSON.stringify(world.stats())} packets ${counts.packets} bytes ${counts.bytes} up ${counts.up} joined ${counts.joined} maxTickMs ${counts.maxTickMs.toFixed(1)} refused ${JSON.stringify(counts.refused)}`);
    counts.packets = 0; counts.bytes = 0; counts.up = 0; counts.joined = 0; counts.refused = {}; counts.maxTickMs = 0; counts.ticks = 0; perLayerOut.clear();
  }, logEveryMs);
  // perIp must not grow with every address ever seen: an entry with no socket whose join window has passed holds nothing, so it goes.
  const sweeper = setInterval(() => { const t = now(); for (const [ip, b] of perIp) if (b.sockets <= 0 && t - b.windowStart >= 60_000) perIp.delete(ip); }, sweepEveryMs);
  for (const t of [ticker, beats, reporter, sweeper]) t.unref();

  const stats = (): Record<string, unknown> => ({ ...world.stats(), sockets: sockets.size, ips: perIp.size, ...counts, perLayerOut: Object.fromEntries(perLayerOut) });
  const server = createServer((req, res) => {
    if (req.method === 'GET' && req.url === '/origins/presence/health') { res.writeHead(200, { 'content-type': 'application/json', 'cache-control': 'no-store' }); return void res.end(JSON.stringify(stats())); }
    if (req.method === 'GET' && req.url?.startsWith('/internal/where?')) return void where(req, res);
    res.writeHead(404); res.end();
  });
  // GET /internal/where?account=<uuid> (Authorization: Bearer <internalKey>): where the service holds this account, for the Origins writer, which must derive a player's place
  // from here and never from a request body. Not under /origins/presence, so the public nginx route does not reach it, and it needs the key and a loopback caller besides. The answer
  // is the service's own state: a player never placed by a first pose is `placed: false` with no position, and `ageMs` is the time since its last pose was handled.
  const loopback = (a: string | undefined): boolean => a === '127.0.0.1' || a === '::1' || a === '::ffff:127.0.0.1';
  const where = (req: import('node:http').IncomingMessage, res: import('node:http').ServerResponse): void => {
    const key = opts.internalKey, sent = /^Bearer (.+)$/.exec(String(req.headers.authorization ?? ''))?.[1];
    const reply = (code: number, body: unknown): void => { res.writeHead(code, { 'content-type': 'application/json', 'cache-control': 'no-store' }); res.end(JSON.stringify(body)); };
    if (!key) { res.writeHead(404); return void res.end(); }
    const a = Buffer.from(sent ?? ''), b = Buffer.from(key);
    if (!loopback(req.socket.remoteAddress) || a.length !== b.length || !timingSafeEqual(a, b)) return reply(401, { error: 'unauthorised' });
    const account = new URL(req.url ?? '/', 'http://presence').searchParams.get('account')?.toLowerCase();
    if (!account || !UUID.test(account)) return reply(400, { error: 'account: a uuid' });
    const p = world.byAccount.get(account);
    if (!p) return reply(200, { online: false });
    if (!p.placed) return reply(200, { online: true, layer: p.layer.id, placed: false });
    reply(200, { online: true, layer: p.layer.id, placed: true, x: p.x, z: p.z, ageMs: Math.max(0, now() - p.movedAt) });
  };

  server.on('upgrade', (req, socket: Duplex) => {
    const url = new URL(req.url ?? '/', 'http://presence'), key = req.headers['sec-websocket-key'];
    const ip = String((opts.ipHeader ? req.headers['x-real-ip'] : null) ?? req.socket.remoteAddress ?? '?'), t = now();
    const refuse = (code: number, why: string): void => { refused(why); socket.end(`HTTP/1.1 ${code} Refused\r\nConnection: close\r\n\r\n`); };
    if (url.pathname !== '/origins/presence' || typeof key !== 'string') return refuse(400, 'bad-request');
    let b = perIp.get(ip); if (!b || t - b.windowStart >= 60_000) { b = { sockets: b?.sockets ?? 0, windowStart: t, joins: 0 }; perIp.set(ip, b); }
    if (++b.joins > limits.ipJoinsPerMinute) return refuse(429, 'join-rate');
    if (b.sockets >= limits.ipSockets) return refuse(429, 'ip-sockets');
    if (url.searchParams.has('token')) return refuse(400, 'token-in-url');   // a token in the URL is already in a log: refuse it loudly rather than accept it
    const offered = String(req.headers['sec-websocket-protocol'] ?? '').split(',').map(x => x.trim()), friend = url.searchParams.get('friend')?.toLowerCase();
    const token = offered.find(x => x.startsWith('token.'))?.slice(6);
    if (!offered.includes(PROTOCOL) || !token || token.length > 4096 || (friend && !UUID.test(friend))) return refuse(400, 'bad-request');
    const bucket = b; bucket.sockets++;   // held while the token is being checked, so a burst of slow checks cannot overshoot the cap
    socket.on('error', () => {});
    void verify(token).then(account => {
      if (!account || socket.destroyed) { bucket.sockets--; return refuse(403, 'token'); }
      const player = world.join(account, now(), friend);
      if (!player) { bucket.sockets--; return refuse(503, world.byAccount.has(account) ? 'already-in' : 'world-full'); }
      sockets.set(player, socket); counts.joined++;
      socket.write(`HTTP/1.1 101 Switching Protocols\r\nUpgrade: websocket\r\nConnection: Upgrade\r\nSec-WebSocket-Accept: ${createHash('sha1').update(key + GUID).digest('base64')}\r\nSec-WebSocket-Protocol: ${PROTOCOL}\r\n\r\n`);
      (socket as Socket).setNoDelay(true);
      socket.write(frame(1, Buffer.from(JSON.stringify({ t: 'hello', id: player.id, layer: player.layer.id }))));
      let buffered = Buffer.alloc(0), windowStart = now(), count = 0, idle: NodeJS.Timeout;
      const close = (code: number, why?: string): void => { if (why) refused(why); if (!socket.destroyed) { const p = Buffer.alloc(2); p.writeUInt16BE(code); socket.end(frame(8, p)); } };
      const touch = (): void => { clearTimeout(idle); idle = setTimeout(() => close(4000, 'idle'), limits.idleMs); };
      touch();
      socket.on('data', (chunk: Buffer) => {
        buffered = Buffer.concat([buffered, chunk]);
        for (;;) {
          if (buffered.length < 2) return;
          const b0 = buffered[0], b1 = buffered[1], opcode = b0 & 0x0f;
          let length = b1 & 0x7f, at = 2;
          if (!(b0 & 0x80) || !(b1 & 0x80) || opcode === 0 || (b0 & 0x70)) return close(1002, 'malformed');   // fragments, unmasked frames, reserved bits
          if (length === 126) { if (buffered.length < 4) return; length = buffered.readUInt16BE(2); at = 4; } else if (length === 127) return close(1009, 'size');
          if (length > limits.maxMessage) return close(1009, 'size');
          if (buffered.length < at + 4 + length) return;
          const mask = buffered.subarray(at, at + 4), payload = Buffer.from(buffered.subarray(at + 4, at + 4 + length));
          for (let i = 0; i < payload.length; i++) payload[i] ^= mask[i & 3];
          buffered = buffered.subarray(at + 4 + length);
          touch();
          if (opcode === 8) return close(1000);
          if (opcode === 9) { socket.write(frame(10, payload)); continue; }
          if (opcode === 10) continue;
          if (opcode !== 2) return close(1003, 'malformed');
          const nowMs = now();
          if (nowMs - windowStart >= 1000) { windowStart = nowMs; count = 0; }
          if (++count > limits.perSecond) return close(4008, 'message-rate');
          const pose = decodeUp(payload);
          if (!pose) return close(1003, 'malformed');
          counts.up++;
          if (world.move(player, pose, nowMs) === 'drop') return close(4009, 'teleport');
        }
      });
      const gone = (): void => { clearTimeout(idle); if (sockets.get(player) !== socket) return; sockets.delete(player); world.leave(player, now()); bucket.sockets--; };
      socket.on('close', gone); socket.on('error', gone);
    }, () => { bucket.sockets--; refuse(403, 'token'); });
  });

  return {
    server, world, stats, port: () => (server.address() as { port: number }).port,
    close: () => new Promise(done => { for (const t of [ticker, beats, reporter, sweeper]) clearInterval(t); for (const s of sockets.values()) s.destroy(); server.close(() => done()); }),
  };
}
