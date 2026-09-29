// The live-PvP relay (docs/duel-architecture.md §4; Lead 2026-09-29: our VPS, no Cloudflare for beta). Two jobs: it carries the WebRTC
// signalling that sets up the direct peer-to-peer path, and it forwards the duel's packets when no direct path connects. It forwards
// bytes between the two sides of a room and nothing else: it never reads a packet, runs the sim or decides a result (the verifier
// replays the record, §1). No npm dependency: the VPS runs plain Node (like the verifier), so the RFC 6455 subset a browser needs is
// here — handshake, masked client frames, text/binary, ping/pong, close; no extensions, no fragments.
//
// Not an open relay (Lead's bar, 2026-09-29):
// - A room exists only as a signed token pair. POST /duel/relay/room mints a random room and one token per side, each
//   `<room>.<side>.<expiry>.<HMAC-SHA256>` under DUEL_RELAY_SECRET, which lives in /etc/frankendom/duel-relay.env on the box and never
//   ships to a client. A socket joins with ?token= only; a forged, altered or expired token is refused before the upgrade. Two sockets a
//   room at most, one per side.
// - Caps: per IP 10 mints and 30 joins a minute and 8 open sockets; per socket 16 KB a message and 240 messages a second; per room
//   64 KB a second; 60 s idle; 2,000 rooms. A malformed, fragmented or unmasked frame closes its socket. The client IP is nginx's
//   X-Real-IP (the relay listens on 127.0.0.1 only, so nothing reaches it except through nginx, which overwrites that header).
// - Logs counts only, once a minute: rooms, sockets, messages and bytes forwarded, refusals by reason. Never a payload, token or IP.
//
// wss://frankendom.com/duel/relay?token=… (ops/nginx/frankendom-duel-relay.conf → 127.0.0.1:$DUEL_RELAY_PORT). A side hears its peer
// arrive and leave as {"t":"peer","up":true|false}. GET /duel/relay/health → the counts. Run: node scripts/duel-relay.mjs.
import { createHash, createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import { createServer } from 'node:http';
import { pathToFileURL } from 'node:url';

export const RELAY = {
  maxMessage: 16 * 1024, perSecond: 240, roomBytesPerSecond: 64 * 1024, idleMs: 60_000, maxRooms: 2000,
  ipMintsPerMinute: 10, ipJoinsPerMinute: 30, ipSockets: 8, tokenMs: 30 * 60_000,
};
const GUID = '258EAFA5-E914-47DA-95CA-C5AB0DC85B11', ROOM = /^[a-z0-9]{16}$/;
const b64url = (buf) => buf.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

export const signToken = (secret, room, side, exp) => `${room}.${side}.${exp}.${b64url(createHmac('sha256', secret).update(`${room}.${side}.${exp}`).digest())}`;
// The room and side a token grants, or null for a forged, altered, malformed or expired one.
export function readToken(secret, token, now = Date.now()) {
  const parts = typeof token === 'string' ? token.split('.') : [];
  if (parts.length !== 4) return null;
  const [room, sideText, expText, sig] = parts, side = Number(sideText), exp = Number(expText);
  if (!ROOM.test(room) || (sideText !== '0' && sideText !== '1') || !/^\d{13}$/.test(expText)) return null;
  const want = Buffer.from(signToken(secret, room, side, exp).split('.')[3]), got = Buffer.from(sig);
  if (want.length !== got.length || !timingSafeEqual(want, got) || exp <= now) return null;
  return { room, side };
}

function frame(opcode, payload) {
  const n = payload.length, head = n < 126 ? Buffer.from([0x80 | opcode, n]) : Buffer.from([0x80 | opcode, 126, n >> 8, n & 255]);
  return Buffer.concat([head, payload]);
}

export function startRelay({ port = Number(process.env.DUEL_RELAY_PORT ?? 8787), host = '127.0.0.1', secret = process.env.DUEL_RELAY_SECRET, log = console.log, logEveryMs = 60_000 } = {}) {
  if (typeof secret !== 'string' || secret.length < 32) throw new Error('DUEL_RELAY_SECRET (32+ chars) is required');
  const rooms = new Map();   // room -> { pair: [socket | null, socket | null], windowStart, bytes }
  const perIp = new Map();   // ip -> { windowStart, mints, joins, sockets }
  const counts = { messages: 0, bytes: 0, minted: 0, refused: {} };
  let sockets = 0;
  const refusedAs = (why) => { counts.refused[why] = (counts.refused[why] ?? 0) + 1; };
  const ipOf = (req) => String(req.headers['x-real-ip'] ?? req.socket.remoteAddress ?? '?');
  const bucket = (ip) => {
    const now = Date.now(), b = perIp.get(ip) ?? { windowStart: now, mints: 0, joins: 0, sockets: 0 };
    if (now - b.windowStart >= 60_000) { b.windowStart = now; b.mints = 0; b.joins = 0; }
    perIp.set(ip, b); return b;
  };
  const ticker = setInterval(() => {
    log(`duel-relay: rooms ${rooms.size} sockets ${sockets} messages ${counts.messages} bytes ${counts.bytes} minted ${counts.minted} refused ${JSON.stringify(counts.refused)}`);
    counts.messages = 0; counts.bytes = 0; counts.minted = 0; counts.refused = {};
    for (const [ip, b] of perIp) if (!b.sockets && Date.now() - b.windowStart >= 60_000) perIp.delete(ip);
  }, logEveryMs);
  ticker.unref();

  const server = createServer((req, res) => {
    const json = (code, body) => { res.writeHead(code, { 'content-type': 'application/json', 'cache-control': 'no-store' }); res.end(JSON.stringify(body)); };
    if (req.method === 'GET' && req.url === '/duel/relay/health') return json(200, { rooms: rooms.size, sockets });
    if (req.method === 'POST' && req.url === '/duel/relay/room') {
      const b = bucket(ipOf(req));
      if (++b.mints > RELAY.ipMintsPerMinute) { refusedAs('mint-rate'); return json(429, { error: 'too many rooms' }); }
      const room = [...randomBytes(16)].map((x) => 'abcdefghijklmnopqrstuvwxyz0123456789'[x % 36]).join(''), exp = Date.now() + RELAY.tokenMs;
      counts.minted++;
      return json(200, { room, exp, tokens: [signToken(secret, room, 0, exp), signToken(secret, room, 1, exp)] });
    }
    res.writeHead(404); res.end();
  });

  server.on('upgrade', (req, socket) => {
    const url = new URL(req.url ?? '/', 'http://relay'), key = req.headers['sec-websocket-key'], ip = ipOf(req), b = bucket(ip);
    const refuse = (code, why) => { refusedAs(why); socket.end(`HTTP/1.1 ${code} Refused\r\nConnection: close\r\n\r\n`); };
    if (url.pathname !== '/duel/relay' || typeof key !== 'string') return refuse(400, 'bad-request');
    if (++b.joins > RELAY.ipJoinsPerMinute) return refuse(429, 'join-rate');
    if (b.sockets >= RELAY.ipSockets) return refuse(429, 'ip-sockets');
    const grant = readToken(secret, url.searchParams.get('token'));
    if (!grant) return refuse(403, 'token');
    const { room, side } = grant;
    if (!rooms.has(room) && rooms.size >= RELAY.maxRooms) return refuse(503, 'rooms-full');
    const entry = rooms.get(room) ?? { pair: [null, null], windowStart: Date.now(), bytes: 0 };
    if (entry.pair[side]) return refuse(409, 'side-taken');
    socket.write(`HTTP/1.1 101 Switching Protocols\r\nUpgrade: websocket\r\nConnection: Upgrade\r\nSec-WebSocket-Accept: ${createHash('sha1').update(key + GUID).digest('base64')}\r\n\r\n`);
    socket.setNoDelay(true);
    entry.pair[side] = socket; rooms.set(room, entry); sockets++; b.sockets++;
    const send = (to, opcode, payload) => { if (to && !to.destroyed) to.write(frame(opcode, payload)); };
    const close = (code, why) => { if (why) refusedAs(why); if (!socket.destroyed) { const p = Buffer.alloc(2); p.writeUInt16BE(code); socket.end(frame(8, p)); } };
    const other = () => entry.pair[side === 0 ? 1 : 0];
    const notice = (up) => Buffer.from(JSON.stringify({ t: 'peer', up }));
    if (other()) { send(other(), 1, notice(true)); send(socket, 1, notice(true)); }

    let buffered = Buffer.alloc(0), windowStart = Date.now(), count = 0, idle;
    const touch = () => { clearTimeout(idle); idle = setTimeout(() => close(4000, 'idle'), RELAY.idleMs); };
    touch();
    socket.on('data', (chunk) => {
      buffered = Buffer.concat([buffered, chunk]);
      for (;;) {
        if (buffered.length < 2) return;
        const b0 = buffered[0], b1 = buffered[1], opcode = b0 & 0x0f;
        let length = b1 & 0x7f, at = 2;
        if (!(b0 & 0x80) || !(b1 & 0x80) || opcode === 0 || (b0 & 0x70)) { close(1002, 'malformed'); return; }   // fragments, unmasked frames, reserved bits
        if (length === 126) { if (buffered.length < 4) return; length = buffered.readUInt16BE(2); at = 4; }
        else if (length === 127) { close(1009, 'size'); return; }
        if (length > RELAY.maxMessage) { close(1009, 'size'); return; }
        if (buffered.length < at + 4 + length) return;
        const mask = buffered.subarray(at, at + 4), payload = Buffer.from(buffered.subarray(at + 4, at + 4 + length));
        for (let i = 0; i < payload.length; i++) payload[i] ^= mask[i & 3];
        buffered = buffered.subarray(at + 4 + length);
        touch();
        if (opcode === 8) { close(1000); return; }
        if (opcode === 9) { send(socket, 10, payload); continue; }
        if (opcode === 10) continue;
        if (opcode !== 1 && opcode !== 2) { close(1003, 'malformed'); return; }
        const now = Date.now();
        if (now - windowStart >= 1000) { windowStart = now; count = 0; }
        if (now - entry.windowStart >= 1000) { entry.windowStart = now; entry.bytes = 0; }
        if (++count > RELAY.perSecond) { close(4008, 'message-rate'); return; }
        if ((entry.bytes += payload.length) > RELAY.roomBytesPerSecond) { close(4008, 'room-bytes'); return; }
        counts.messages++; counts.bytes += payload.length;
        send(other(), opcode, payload);
      }
    });
    const gone = () => {
      if (entry.pair[side] !== socket) return;
      clearTimeout(idle); entry.pair[side] = null; sockets--; b.sockets--;
      if (other()) send(other(), 1, notice(false)); else rooms.delete(room);
    };
    socket.on('close', gone); socket.on('error', gone);
  });

  return new Promise((resolve) => server.listen(port, host, () => resolve({
    port: server.address().port,
    stats: () => ({ rooms: rooms.size, sockets }),
    close: () => new Promise((done) => { clearInterval(ticker); for (const e of rooms.values()) for (const s of e.pair) s?.destroy(); server.close(() => done()); }),
  })));
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  const relay = await startRelay();
  console.log(`duel-relay listening on 127.0.0.1:${relay.port}`);
}
