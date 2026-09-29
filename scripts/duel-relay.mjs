// The live-PvP relay (docs/duel-architecture.md §4; Lead 2026-09-29: our VPS, no Cloudflare for beta). Two jobs, one socket per side:
// it carries the WebRTC signalling that sets up the direct peer-to-peer path, and it forwards the duel's packets when no direct path
// connects. It forwards bytes between the two sides of a room and nothing else: it never reads a packet, runs the sim or decides a result
// (the verifier replays the record for that, §1). No npm dependency: the VPS runs plain Node (like the verifier), so the RFC 6455
// subset a browser client needs is here — the handshake, masked client frames, text/binary, ping/pong, close; no extensions, no fragments.
//
// wss://frankendom.com/duel/relay?room=<8–32 [a-z0-9]>&side=<0|1>, proxied by nginx (ops/nginx/frankendom-duel-relay.conf) to
// 127.0.0.1:$DUEL_RELAY_PORT (8787). A side learns its peer's arrival and departure as {"t":"peer","up":true|false}. Bounds: 16 KB a
// message, 240 messages a second a socket, 60 s idle, 2,000 rooms; a second socket for a taken side is refused (close 4009).
// GET /duel/relay/health: {"rooms":n,"sockets":n}. Run: node scripts/duel-relay.mjs (ops/frankendom-duel-relay.service).
import { createHash } from 'node:crypto';
import { createServer } from 'node:http';
import { pathToFileURL } from 'node:url';

export const RELAY = { maxMessage: 16 * 1024, perSecond: 240, idleMs: 60_000, maxRooms: 2000 };
const GUID = '258EAFA5-E914-47DA-95CA-C5AB0DC85B11', ROOM = /^[a-z0-9]{8,32}$/;

function frame(opcode, payload) {
  const n = payload.length, head = n < 126 ? Buffer.from([0x80 | opcode, n]) : n < 65536 ? Buffer.from([0x80 | opcode, 126, n >> 8, n & 255]) : null;
  if (!head) throw new Error('frame too large');
  return Buffer.concat([head, payload]);
}

export function startRelay({ port = Number(process.env.DUEL_RELAY_PORT ?? 8787), host = '127.0.0.1' } = {}) {
  const rooms = new Map();   // room -> [socket | null, socket | null]
  let sockets = 0;
  const server = createServer((req, res) => {
    if (req.url === '/duel/relay/health') { res.writeHead(200, { 'content-type': 'application/json' }); res.end(JSON.stringify({ rooms: rooms.size, sockets })); return; }
    res.writeHead(404); res.end();
  });

  server.on('upgrade', (req, socket) => {
    const url = new URL(req.url ?? '/', 'http://relay'), room = url.searchParams.get('room') ?? '', side = Number(url.searchParams.get('side'));
    const key = req.headers['sec-websocket-key'];
    const refuse = (code) => { socket.end(`HTTP/1.1 ${code} Refused\r\nConnection: close\r\n\r\n`); };
    if (url.pathname !== '/duel/relay' || !ROOM.test(room) || (side !== 0 && side !== 1) || typeof key !== 'string') return refuse(400);
    if (!rooms.has(room) && rooms.size >= RELAY.maxRooms) return refuse(503);
    const accept = createHash('sha1').update(key + GUID).digest('base64');
    socket.write(`HTTP/1.1 101 Switching Protocols\r\nUpgrade: websocket\r\nConnection: Upgrade\r\nSec-WebSocket-Accept: ${accept}\r\n\r\n`);
    socket.setNoDelay(true);
    const pair = rooms.get(room) ?? [null, null];
    const send = (to, opcode, payload) => { if (to && !to.destroyed) to.write(frame(opcode, payload)); };
    const close = (code) => { if (!socket.destroyed) { const p = Buffer.alloc(2); p.writeUInt16BE(code); socket.end(frame(8, p)); } };
    if (pair[side]) { close(4009); return; }
    pair[side] = socket; rooms.set(room, pair); sockets++;
    const other = () => pair[side === 0 ? 1 : 0];
    const notice = (up) => Buffer.from(JSON.stringify({ t: 'peer', up }));
    if (other()) { send(other(), 1, notice(true)); send(socket, 1, notice(true)); }

    let buffered = Buffer.alloc(0), windowStart = Date.now(), count = 0, idle;
    const touch = () => { clearTimeout(idle); idle = setTimeout(() => close(4000), RELAY.idleMs); };
    touch();
    socket.on('data', (chunk) => {
      buffered = Buffer.concat([buffered, chunk]);
      for (;;) {
        if (buffered.length < 2) return;
        const b0 = buffered[0], b1 = buffered[1], opcode = b0 & 0x0f;
        let length = b1 & 0x7f, at = 2;
        if (!(b0 & 0x80) || !(b1 & 0x80) || opcode === 0) { close(1002); return; }   // fragments and unmasked client frames are protocol errors
        if (length === 126) { if (buffered.length < 4) return; length = buffered.readUInt16BE(2); at = 4; }
        else if (length === 127) { close(1009); return; }
        if (length > RELAY.maxMessage) { close(1009); return; }
        if (buffered.length < at + 4 + length) return;
        const mask = buffered.subarray(at, at + 4), payload = Buffer.from(buffered.subarray(at + 4, at + 4 + length));
        for (let i = 0; i < payload.length; i++) payload[i] ^= mask[i & 3];
        buffered = buffered.subarray(at + 4 + length);
        touch();
        if (opcode === 8) { close(1000); return; }
        if (opcode === 9) { send(socket, 10, payload); continue; }
        if (opcode === 10) continue;
        if (opcode !== 1 && opcode !== 2) { close(1003); return; }
        const now = Date.now();
        if (now - windowStart >= 1000) { windowStart = now; count = 0; }
        if (++count > RELAY.perSecond) { close(4008); return; }
        send(other(), opcode, payload);
      }
    });
    const gone = () => {
      if (pair[side] !== socket) return;
      clearTimeout(idle); pair[side] = null; sockets--;
      if (other()) send(other(), 1, notice(false)); else rooms.delete(room);
    };
    socket.on('close', gone); socket.on('error', gone);
  });

  return new Promise((resolve) => server.listen(port, host, () => resolve({
    port: server.address().port,
    stats: () => ({ rooms: rooms.size, sockets }),
    close: () => new Promise((done) => { for (const pair of rooms.values()) for (const s of pair) s?.destroy(); server.close(() => done()); }),
  })));
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  const relay = await startRelay();
  console.log(`duel-relay listening on 127.0.0.1:${relay.port}`);
}
