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
// - Minting is admins-only until Dom opens duels (Lead 2026-09-29): POST /duel/relay/room must carry the caller's own Supabase session
//   (Authorization: Bearer <access token>); the relay asks Supabase for that caller's row in public.admins with it (RLS lets a user read
//   only its own row, so one row back means an admin, and a forged or expired token gets nothing). No secret for this on the box: the
//   project URL and anon key are the public ones the page ships. A guest joins with a token from an admin's link and needs no account.
//   DUEL_RELAY_OPEN=1 mints for anyone (CI and local runs; later, Dom's call).
// - Players (Strategy 2026-10-02): DUEL_RELAY_PLAYERS=1 lets any signed-in account mint too (supabaseUser asks Supabase who the bearer
//   token is), capped per user: 3 rooms a minute, 20 an hour, tracked for 5,000 users; admins stay uncapped and the per-IP cap still
//   applies to all. OFF by default: only Dom turns it on, after gate 4. A socket is closed (4001) graceMs after its token expires (30 min + 5), so a room has a hard lifetime
//   whatever its sockets say; the other bounds are maxRooms, ipSockets and roomBytesPerSecond.
// - Logs counts only, once a minute: rooms, sockets, messages and bytes forwarded, refusals by reason. Never a payload, token or IP.
//
// wss://frankendom.com/duel/relay?token=… (ops/nginx/frankendom-duel-relay.conf → 127.0.0.1:$DUEL_RELAY_PORT). A side hears its peer
// arrive and leave as {"t":"peer","up":true|false}. GET /duel/relay/health → the counts. Run: node scripts/duel-relay.mjs.
import { createHash, createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import { createServer } from 'node:http';
import { pathToFileURL } from 'node:url';

export const RELAY = {
  maxMessage: 16 * 1024, perSecond: 240, roomBytesPerSecond: 64 * 1024, idleMs: 60_000, maxRooms: 2000,
  userMintsPerMinute: 3, userMintsPerHour: 20, maxUsers: 5000,
  ipMintsPerMinute: 10, ipJoinsPerMinute: 30, ipSockets: 8, tokenMs: 30 * 60_000, graceMs: 5 * 60_000, beatMs: 2000,
};
const BEAT = Buffer.from('{"t":"beat"}'), GUID = '258EAFA5-E914-47DA-95CA-C5AB0DC85B11', ROOM = /^[a-z0-9]{16}$/;
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

// The admins-only mint check: true only when Supabase returns the caller's own admins row for the bearer token it sent.
export const supabaseAdmin = (url, anonKey, fetchFn = fetch) => async (authorization) => {
  if (typeof authorization !== 'string' || !/^Bearer [\w.-]{20,4096}$/.test(authorization)) return false;
  try {
    const res = await fetchFn(`${url}/rest/v1/admins?select=user_id&limit=1`, { headers: { apikey: anonKey, authorization }, signal: AbortSignal.timeout(5000) });
    if (!res.ok) return false;
    const rows = await res.json();
    return Array.isArray(rows) && rows.length === 1;
  } catch { return false; }
};
// The player mint check: the signed-in account's id when Supabase knows the bearer token (a forged or expired one gets nothing), else null. An anonymous Supabase user is nobody: it would be a free new account for every script.
export const supabaseUser = (url, anonKey, fetchFn = fetch) => async (authorization) => {
  if (typeof authorization !== 'string' || !/^Bearer [\w.-]{20,4096}$/.test(authorization)) return null;
  try {
    const res = await fetchFn(`${url}/auth/v1/user`, { headers: { apikey: anonKey, authorization }, signal: AbortSignal.timeout(5000) });
    if (!res.ok) return null;
    const user = await res.json();
    return user?.is_anonymous !== true && typeof user?.id === 'string' && /^[\w-]{8,64}$/.test(user.id) ? user.id : null;
  } catch { return null; }
};
// `admit`: the mint check (supabaseAdmin), or null for an open relay. `players`: supabaseUser, or null (the default) for admins only.
export function startRelay({ port = Number(process.env.DUEL_RELAY_PORT ?? 8787), host = '127.0.0.1', secret = process.env.DUEL_RELAY_SECRET, log = console.log, logEveryMs = 60_000, admit = /** @type {((authorization: string | undefined) => Promise<boolean>) | null} */ (null), players = /** @type {((authorization: string | undefined) => Promise<string | null>) | null} */ (null) } = {}) {
  if (typeof secret !== 'string' || secret.length < 32) throw new Error('DUEL_RELAY_SECRET (32+ chars) is required');
  const rooms = new Map();   // room -> { pair: [socket | null, socket | null], windowStart, bytes }
  const perIp = new Map();   // ip -> { windowStart, mints, joins, sockets }
  const perUser = new Map();   // account id -> mint times in the last hour
  const ipOfSocket = new WeakMap();   // socket -> the IP whose socket count it holds
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
    for (const [id, times] of perUser) if (!times.some((t) => Date.now() - t < 3_600_000)) perUser.delete(id);
    for (const [ip, b] of perIp) if (!b.sockets && Date.now() - b.windowStart >= 60_000) perIp.delete(ip);
  }, logEveryMs);
  ticker.unref();
  // A page cannot tell a healthy link with a silent peer from a dead link of its own, and only the first earns a forfeit win. So every
  // connected socket hears a `beat` each beatMs: a page that hears them is connected to the relay (src/net/transport.ts `link`).
  const beats = setInterval(() => { for (const e of rooms.values()) for (const sock of e.pair) if (sock && !sock.destroyed) sock.write(frame(1, BEAT)); }, RELAY.beatMs);
  beats.unref();

  const server = createServer(async (req, res) => {
    const json = (code, body) => { res.writeHead(code, { 'content-type': 'application/json', 'cache-control': 'no-store' }); res.end(JSON.stringify(body)); };
    if (req.method === 'GET' && req.url === '/duel/relay/health') return json(200, { rooms: rooms.size, sockets });
    if (req.method === 'POST' && req.url === '/duel/relay/room') {
      const b = bucket(ipOf(req));
      if (++b.mints > RELAY.ipMintsPerMinute) { refusedAs('mint-rate'); return json(429, { error: 'too many rooms' }); }
      if (admit && !req.headers.authorization) { refusedAs('mint-auth'); return json(401, { error: 'sign in' }); }
      if (admit && !(await admit(req.headers.authorization))) {
        const id = players ? await players(req.headers.authorization) : null;   // not an admin: a signed-in player mints only when the switch is on
        if (!id) { refusedAs('mint-admin'); return json(403, { error: players ? 'sign in' : 'admins only' }); }
        const now = Date.now(), times = (perUser.get(id) ?? []).filter((t) => now - t < 3_600_000);
        if (!perUser.has(id) && perUser.size >= RELAY.maxUsers) { refusedAs('mint-users'); return json(429, { error: 'too many rooms' }); }
        if (times.length >= RELAY.userMintsPerHour || times.filter((t) => now - t < 60_000).length >= RELAY.userMintsPerMinute) { perUser.set(id, times); refusedAs('mint-user-rate'); return json(429, { error: 'too many rooms' }); }
        perUser.set(id, [...times, now]);
      }
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
    // A side's token is that player's secret, so its holder coming back (a phone that switched networks leaves a half-open socket the relay
    // cannot tell is dead for up to idleMs) takes the side over: the old socket is dropped without a peer-down notice, and the peer hears
    // the new arrival below as a fresh `up` (the challenger re-offers WebRTC on it).
    const old = entry.pair[side];
    if (old) { entry.pair[side] = null; sockets--; const oldBucket = perIp.get(ipOfSocket.get(old)); if (oldBucket) oldBucket.sockets--; old.destroy(); }
    ipOfSocket.set(socket, ip);
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
    const expiry = setTimeout(() => close(4001, 'expired'), Math.min(2 ** 31 - 1, Math.max(0, Number(String(url.searchParams.get('token')).split('.')[2]) + RELAY.graceMs - Date.now())));  expiry.unref();   // a room is hard-capped at its token's expiry plus a grace: a duel that talks forever still ends
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
      clearTimeout(idle); clearTimeout(expiry);   // before the takeover check: a replaced socket's timers must go too, or they hold the process open
      if (entry.pair[side] !== socket) return;
      entry.pair[side] = null; sockets--; b.sockets--;
      if (other()) send(other(), 1, notice(false)); else rooms.delete(room);
    };
    socket.on('close', gone); socket.on('error', gone);
  });

  return new Promise((resolve) => server.listen(port, host, () => resolve({
    port: server.address().port,
    stats: () => ({ rooms: rooms.size, sockets }),
    kick: (room, side) => { const sock = rooms.get(room)?.pair[side]; if (sock) sock.destroy(); return !!sock; },   // test hook: cut one side's socket as a network drop would
    close: () => new Promise((done) => { clearInterval(ticker); clearInterval(beats); for (const e of rooms.values()) for (const s of e.pair) s?.destroy(); server.close(() => done()); }),
  })));
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  const open = process.env.DUEL_RELAY_OPEN === '1', { SUPABASE_URL: url, SUPABASE_ANON_KEY: anonKey } = process.env;
  if (!open && !(url && anonKey)) throw new Error('set SUPABASE_URL and SUPABASE_ANON_KEY (admins-only minting) or DUEL_RELAY_OPEN=1');
  const everyone = !open && process.env.DUEL_RELAY_PLAYERS === '1';   // OFF unless the env file says so (ops/install-duel-relay.sh never writes it)
  const relay = await startRelay({ admit: open ? null : supabaseAdmin(url, anonKey), players: everyone ? supabaseUser(url, anonKey) : null });
  console.log(`duel-relay listening on 127.0.0.1:${relay.port}, minting ${open ? 'for anyone' : everyone ? 'for signed-in players (capped) and admins' : 'for admins only'}`);
}
