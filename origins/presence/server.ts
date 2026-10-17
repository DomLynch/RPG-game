// The presence service (docs/specs/origins/one-shard.md §1-§5): who is where, in memory, rebuilt from nothing after a restart. It writes no rows and
// decides nothing that pays. wss://frankendom.com/origins/presence[?friend=<account id>] (nginx -> 127.0.0.1) with the Supabase access token in the Sec-WebSocket-Protocol header (`frankendom.presence.v1, token.<jwt>`), never in the URL: a URL lands in proxy logs and browser history.
// No npm dependency, like the duel relay: the RFC 6455 subset a browser needs (masked client frames, no fragments, no extensions).
// Skeleton: movement, interest, layers, caps and counts. Names, guild/party lookup and speech arrive with their own PRs; a player is its account id for now.
import { createHash, randomUUID, timingSafeEqual } from 'node:crypto';
import { createServer, type Server } from 'node:http';
import type { Socket } from 'node:net';
import type { Duplex } from 'node:stream';
import { decodeUp } from './wire.ts';
import { RULES, World, type Player, type Rules } from './interest.ts';
import { PROTOCOL, PROTOCOL_V2 } from './frame.ts';
import { CENTRE_CM, FRAME_CM, LEGACY_SHIFT_CM, PORTALS, ZONE_ROWS, fromLegacy, toLegacy, zoneAt } from './zones.ts';
import { SAVE_EVERY_MS, saveQueue, type SaveFn } from './saves.ts';
import { presenceRule } from './presence-rules.ts';
import { warpAllowed, warpPlace } from './warps.ts';
import { sameWorn, wornQueue } from './worn.ts';
import type { Worn } from '../server/location.ts';

const GUID = '258EAFA5-E914-47DA-95CA-C5AB0DC85B11';
export { PROTOCOL, PROTOCOL_V2 };   // defined in ./frame.ts (the page shares them)
const UUID = /^[0-9a-f-]{36}$/;
export const LIMITS = { maxMessage: presenceRule('maxMessage'), perSecond: presenceRule('perSecond'), idleMs: presenceRule('idleMs'), ipSockets: presenceRule('ipSockets'), ipJoinsPerMinute: presenceRule('ipJoinsPerMinute'), beatMs: presenceRule('beatMs') };
export type Limits = typeof LIMITS;
// GET /origins/presence/zones: the zone table the v2 client walks by (hello carries its hash). Corners in world metres.
const ZONE_TABLE = JSON.stringify({ frame: { centreCm: CENTRE_CM, sizeCm: FRAME_CM }, zones: ZONE_ROWS.map(z => ({ id: z.id, corners: z.corners, speed: z.speed, quiet: z.quiet })), portals: PORTALS });
export const ZONE_TABLE_HASH = createHash('sha1').update(ZONE_TABLE).digest('hex').slice(0, 8);
const closeGraceMs = presenceRule('closeGraceMs');   // after our close frame, how long a peer that has not finished the TCP close is waited for before the socket is destroyed
const TICK_RING = presenceRule('tickRing');   // the last 40,000 tick durations (about 66 minutes) are kept for GET /origins/presence/health?ticks=N, the load test's p99

function frame(opcode: number, payload: Uint8Array): Buffer {
  const n = payload.length, head = n < 126 ? Buffer.from([0x80 | opcode, n]) : Buffer.from([0x80 | opcode, 126, n >> 8, n & 255]);
  return Buffer.concat([head, payload]);
}

export type PresenceOptions = {
  verify: (token: string) => Promise<string | null>;   // the client's access token -> its account id (origins/server/auth.ts supabaseVerify)
  rules?: Rules; limits?: Limits; maxLayers?: number;
  now?: () => number; log?: (line: string) => void; logEveryMs?: number; sweepEveryMs?: number; ipHeader?: boolean;   // ipHeader: trust nginx's X-Real-IP (only behind nginx on 127.0.0.1)
  guests?: boolean;   // a signed-out player joins as a guest (no token, nothing saved); default ON, `false` is the kill switch (main.ts: ORIGINS_PRESENCE_GUESTS=0)
  nameOf?: (account: string) => string | null;   // the display name of the active character the `locate` answer just carried (read once at join and at a rejoin); unset or null: no name tag
  wornOf?: (account: string) => Worn;   // the worn set the `locate` answer just carried (read once at join and at a rejoin, like nameOf); unset: nothing worn shown
  readWorn?: (account: string) => Promise<Worn>; wornEveryMs?: number;   // the refresh: every wornEveryMs (rule row) each signed-in player's set is read again through one bounded queue; a failed read keeps the last set; unset, no refresh
  locate?: (account: string) => Promise<{ x: number; z: number } | null>;   // where a rejoining account should stand (the writer's saved spot of its now-active character); any error or null: the default placement
  save?: SaveFn; saveEveryMs?: number;   // the position save (origins/presence/saves.ts): presence's observation goes to the writer on leave, zone change and every saveEveryMs; unset, nothing is saved
  internalKey?: string;   // the shared secret of GET /internal/where (the writer asks where an account stands); unset: that route does not exist
};
export type Presence = { server: Server; world: World; port: () => number; stats: () => Record<string, unknown>; close: () => Promise<void> };

export function createPresence(opts: PresenceOptions): Presence {
  const { verify, rules = RULES, limits = LIMITS, now = Date.now, log = console.log, logEveryMs = 60_000, sweepEveryMs = 60_000 } = opts;
  const world = new World(rules, opts.maxLayers ?? 8);
  const sockets = new Map<Player, Duplex>();
  const perIp = new Map<string, { sockets: number; windowStart: number; joins: number; guests: number }>();
  let guestCount = 0;   // guest sockets open now, all addresses (the ceiling keeps guests from crowding signed-in players out of the world)
  const counts = { packets: 0, bytes: 0, up: 0, snapped: 0, strikes: 0, joined: 0, warped: 0, refused: {} as Record<string, number>, maxTickMs: 0, ticks: 0 };
  const perLayerOut = new Map<number, { packets: number; bytes: number }>();
  const refused = (why: string): void => { counts.refused[why] = (counts.refused[why] ?? 0) + 1; };
  let tickNo = 0;
  const tickRing = new Float64Array(TICK_RING); let tickRingN = 0;   // every tick's duration in ms, newest overwrites oldest

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
      for (const who of world.intros.get(p) ?? []) sock.write(frame(1, Buffer.from(JSON.stringify({ t: 'enter', id: who.id, name: who.name, guest: who.guest, worn: who.worn }))));   // who an id is, once per sighting, before the packet that first carries it
      sock.write(frame(2, packet));
      counts.packets++; counts.bytes += packet.length;
      const l = perLayerOut.get(p.layer.id) ?? { packets: 0, bytes: 0 }; l.packets++; l.bytes += packet.length; perLayerOut.set(p.layer.id, l);
    }
    const took = performance.now() - started;
    counts.ticks++; if (took > counts.maxTickMs) counts.maxTickMs = took;
    tickRing[tickRingN++ % TICK_RING] = took;
  }, Math.max(5, Math.floor(rules.tickMs / 4)));
  // seenAt on the heartbeat: a connected player standing still is still here.
  const beats = setInterval(() => { world.sweep(now()); for (const [p, s] of sockets) if (!s.destroyed) { p.seenAt = now(); s.write(frame(1, Buffer.from('{"t":"beat"}'))); } }, limits.beatMs);
  const reporter = setInterval(() => {
    log(`presence: ${JSON.stringify(world.stats())} packets ${counts.packets} bytes ${counts.bytes} up ${counts.up} joined ${counts.joined} maxTickMs ${counts.maxTickMs.toFixed(1)} refused ${JSON.stringify(counts.refused)} snapped ${counts.snapped} strikes ${counts.strikes}`);   // snapped: a pose refused and kept; strikes: every refused pose (snapped + the one that drops the player)
    counts.packets = 0; counts.bytes = 0; counts.up = 0; counts.snapped = 0; counts.strikes = 0; counts.joined = 0; counts.refused = {}; counts.maxTickMs = 0; counts.ticks = 0; perLayerOut.clear();
  }, logEveryMs);
  // perIp must not grow with every address ever seen: an entry with no socket whose join window has passed holds nothing, so it goes.
  const sweeper = setInterval(() => { const t = now(); for (const [ip, b] of perIp) if (b.sockets <= 0 && t - b.windowStart >= 60_000) perIp.delete(ip); }, sweepEveryMs);
  // Position save: the newest observed place per account, through one bounded queue (never awaited here). A checkpoint skips a player who has not moved since its last save.
  const saves = opts.save ? saveQueue(opts.save, log) : null, lastSaved = new WeakMap<Player, { x: number; z: number }>();
  // Nothing a guest does is ever saved (savePlace skips a guest).
  // The saved-location columns are in the old frame and hold the town square only (the 0..30000 check): a Frontier position is not saved until they widen, the last town spot stands.
  const savePlace = (p: Player): void => { if (!saves || p.guest) return; lastSaved.set(p, { x: p.x, z: p.z }); const at = toLegacy(p); if (at) saves.push(p.account, { ...at, atMs: now() }); };
  const checkpoint = setInterval(() => { for (const p of sockets.keys()) { const l = lastSaved.get(p); if (!l || l.x !== p.x || l.z !== p.z) savePlace(p); } }, opts.saveEveryMs ?? SAVE_EVERY_MS);
  // Worn refresh: a changed set reaches the players who see it as a fresh `enter` (interest.ts tick). Never awaited by the tick; a guest has none; the read lands on the account's CURRENT player.
  const worns = opts.readWorn ? wornQueue(opts.readWorn, (account, worn) => { const p = world.byAccount.get(account); if (p && !p.guest && !sameWorn(p.worn, worn)) p.worn = worn; }, log) : null;
  const wornTimer = setInterval(() => { if (worns) for (const p of sockets.keys()) if (!p.guest) worns.push(p.account); }, opts.wornEveryMs ?? presenceRule('wornEveryMs'));
  for (const t of [ticker, beats, reporter, sweeper, checkpoint, wornTimer]) t.unref();

  const stats = (): Record<string, unknown> => ({ ...world.stats(), sockets: sockets.size, ips: perIp.size, ...counts, perLayerOut: Object.fromEntries(perLayerOut), ...(saves ? { saves: saves.stats() } : {}) });
  // The hello carries where the server placed the player, so a client adopts it before its first pose (a rejoin or a recalled spot must not look like a teleport).
  const hello = (p: Player): Buffer => frame(1, Buffer.from(JSON.stringify(p.legacy ? { t: 'hello', id: p.id, layer: p.layer.id, x: p.x - LEGACY_SHIFT_CM, z: p.z - LEGACY_SHIFT_CM }
    : { t: 'hello', id: p.id, layer: p.layer.id, x: p.x, z: p.z, frame: { centreCm: CENTRE_CM, sizeCm: FRAME_CM }, zones: ZONE_TABLE_HASH, ...(p.guest ? { guest: true } : {}) })));
  const rejoiners = new Map<string, () => Promise<boolean>>();   // account -> re-place that connected account (set per socket, removed when it goes)
  // The last `n` tick durations (ms), oldest first, at most what the ring holds.
  const recentTicks = (n: number): number[] => {
    const have = Math.min(tickRingN, TICK_RING, Math.max(0, Math.floor(n))), out: number[] = [];
    for (let i = tickRingN - have; i < tickRingN; i++) out.push(tickRing[i % TICK_RING]!);
    return out;
  };
  const server = createServer((req, res) => {
    if (req.method === 'GET' && req.url?.split('?')[0] === '/origins/presence/health') {
      // The tick samples (up to ~700 KB) are for the load test only: honoured for a DIRECT loopback caller, never for a proxied one (behind nginx the socket peer is 127.0.0.1 too, so a
      // proxy header, which nginx sets, means "not direct"). The ops nginx snippet does not proxy this path at all; this is the second lock.
      const direct = (req.socket.remoteAddress === '127.0.0.1' || req.socket.remoteAddress === '::1' || req.socket.remoteAddress === '::ffff:127.0.0.1') && !req.headers['x-real-ip'] && !req.headers['x-forwarded-for'];
      const n = direct ? Number(new URL(req.url, 'http://presence').searchParams.get('ticks') ?? 0) : 0;
      res.writeHead(200, { 'content-type': 'application/json', 'cache-control': 'no-store' });
      return void res.end(JSON.stringify(n > 0 ? { ...stats(), tickMs: recentTicks(n) } : stats()));
    }
    if (req.method === 'GET' && req.url?.split('?')[0] === '/origins/presence/zones') { res.writeHead(200, { 'content-type': 'application/json', 'cache-control': 'public, max-age=300' }); return void res.end(ZONE_TABLE); }
    if (req.method === 'GET' && req.url?.startsWith('/internal/where?')) return void where(req, res);
    if (req.method === 'POST' && req.url?.split('?')[0] === '/internal/rejoin') return void rejoin(req, res);
    if (req.method === 'POST' && req.url?.split('?')[0] === '/internal/worn') return void wornRoute(req, res);
    res.writeHead(404); res.end();
  });
  // GET /internal/where?account=<uuid> (Authorization: Bearer <internalKey>): where the service holds this account, for the Origins writer, which must derive a player's place
  // from here and never from a request body. Not under /origins/presence, so the public nginx route does not reach it, and it needs the key and a loopback caller besides. The answer
  // is the service's own state: every player has a position (a fresh join starts at the spawn, never at a client's first pose), and `ageMs` is the time since the player was last seen: a pose, or the socket heartbeat while it stays connected (a player standing still is still here).
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
    reply(200, { online: true, layer: p.layer.id, placed: true, x: p.x, z: p.z, zone: zoneAt(p.x, p.z), ageMs: Math.max(0, now() - p.seenAt) });
  };

  // POST /internal/rejoin {account} (Bearer <internalKey>, loopback): the writer says this account's ACTIVE CHARACTER changed (create or switch). Presence drops the old
  // character's presence and places the new one where `locate` says it was left (default placement if that fails), on the same socket with a fresh hello. Same guards as /internal/where.
  const rejoin = (req: import('node:http').IncomingMessage, res: import('node:http').ServerResponse): void => {
    const key = opts.internalKey, sent = /^Bearer (.+)$/.exec(String(req.headers.authorization ?? ''))?.[1];
    const reply = (code: number, body: unknown): void => { res.writeHead(code, { 'content-type': 'application/json', 'cache-control': 'no-store' }); res.end(JSON.stringify(body)); };
    if (!key) { req.resume(); res.writeHead(404); return void res.end(); }
    const a = Buffer.from(sent ?? ''), b = Buffer.from(key);
    if (!loopback(req.socket.remoteAddress) || a.length !== b.length || !timingSafeEqual(a, b)) { req.resume(); return reply(401, { error: 'unauthorised' }); }
    let size = 0; const parts: Buffer[] = [];
    req.on('data', (c: Buffer) => { size += c.length; if (size <= 1024) parts.push(c); });
    req.on('end', () => {
      let account = ''; try { account = String((JSON.parse(size <= 1024 ? Buffer.concat(parts).toString('utf8') : '{}') as { account?: unknown }).account ?? '').toLowerCase(); } catch { /* 400 below */ }
      if (!UUID.test(account)) return reply(400, { error: 'account: a uuid' });
      const again = rejoiners.get(account);
      if (!again) return reply(200, { rejoined: false });
      again().then(ok => reply(200, { rejoined: ok }), () => reply(200, { rejoined: false }));
    });
  };

  // POST /internal/worn {account} (Bearer <internalKey>, loopback): the writer says a gear op just succeeded for this account, so its worn set may have changed. Presence reads it again NOW
  // (the same one-in-flight queue as the refresh, so the writer sees no burst) and the viewers get the new enter within a tick. Reads for one account are spaced by wornPokeGapMs (a row): a
  // poke inside the gap schedules ONE trailing read at the gap's end, so the last change always shows. The refresh every wornEveryMs stays as the fallback (a lost poke costs up to that).
  const pokeGap = presenceRule('wornPokeGapMs'), lastPoke = new Map<string, number>(), pokeTimers = new Map<string, NodeJS.Timeout>();
  const pokeWorn = (account: string): 'queued' | 'scheduled' | 'ignored' => {
    const p = world.byAccount.get(account);
    if (!worns || !p || p.guest) return 'ignored';
    if (pokeTimers.has(account)) return 'scheduled';   // a trailing read is already waiting: it will see this change too
    const wait = Math.max(0, (lastPoke.get(account) ?? -Infinity) + pokeGap - now());
    const go = (): void => { lastPoke.set(account, now()); pokeTimers.delete(account); worns.push(account); };
    if (wait === 0) { go(); return 'queued'; }
    pokeTimers.set(account, setTimeout(go, wait).unref());
    return 'scheduled';
  };
  const wornRoute = (req: import('node:http').IncomingMessage, res: import('node:http').ServerResponse): void => {
    const key = opts.internalKey, sent = /^Bearer (.+)$/.exec(String(req.headers.authorization ?? ''))?.[1];
    const reply = (code: number, body: unknown): void => { res.writeHead(code, { 'content-type': 'application/json', 'cache-control': 'no-store' }); res.end(JSON.stringify(body)); };
    if (!key) { req.resume(); res.writeHead(404); return void res.end(); }
    const a = Buffer.from(sent ?? ''), b = Buffer.from(key);
    if (!loopback(req.socket.remoteAddress) || a.length !== b.length || !timingSafeEqual(a, b)) { req.resume(); return reply(401, { error: 'unauthorised' }); }
    let size = 0; const parts: Buffer[] = [];
    req.on('data', (c: Buffer) => { size += c.length; if (size <= 1024) parts.push(c); });
    req.on('end', () => {
      let account = ''; try { account = String((JSON.parse(size <= 1024 ? Buffer.concat(parts).toString('utf8') : '{}') as { account?: unknown }).account ?? '').toLowerCase(); } catch { /* 400 below */ }
      if (!UUID.test(account)) return reply(400, { error: 'account: a uuid' });
      reply(200, { poke: pokeWorn(account) });
    });
  };

  server.on('upgrade', (req, socket: Duplex) => {
    const url = new URL(req.url ?? '/', 'http://presence'), key = req.headers['sec-websocket-key'];
    const ip = String((opts.ipHeader ? req.headers['x-real-ip'] : null) ?? req.socket.remoteAddress ?? '?'), t = now();
    const refuse = (code: number, why: string): void => { refused(why); socket.end(`HTTP/1.1 ${code} Refused\r\nConnection: close\r\n\r\n`); };
    if (url.pathname !== '/origins/presence' || typeof key !== 'string') return refuse(400, 'bad-request');
    // ONE bucket object per address for as long as it lives: a window roll resets the join count in place. (It used to be replaced with a copy, so a socket opened before the roll
    // released the OLD object and the copy kept its count for ever: after a minute's session a guest address was locked out at guestIpSockets until presence restarted.)
    let b = perIp.get(ip); if (!b) { b = { sockets: 0, windowStart: t, joins: 0, guests: 0 }; perIp.set(ip, b); } else if (t - b.windowStart >= 60_000) { b.windowStart = t; b.joins = 0; }
    if (++b.joins > limits.ipJoinsPerMinute) return refuse(429, 'join-rate');
    if (b.sockets >= limits.ipSockets) return refuse(429, 'ip-sockets');
    if (url.searchParams.has('token')) return refuse(400, 'token-in-url');   // a token in the URL is already in a log: refuse it loudly rather than accept it
    const offered = String(req.headers['sec-websocket-protocol'] ?? '').split(',').map(x => x.trim()), friend = url.searchParams.get('friend')?.toLowerCase();
    const token = offered.find(x => x.startsWith('token.'))?.slice(6);
    const speaks = offered.includes(PROTOCOL_V2) ? PROTOCOL_V2 : offered.includes(PROTOCOL) ? PROTOCOL : null, legacy = speaks === PROTOCOL;
    // A GUEST (docs/specs/origins/guests.md, Lead 2026-10-16: a signed-out player shares the world, nothing is saved): no token, the page offers `guest` instead. The identity is minted HERE, never
    // read from the client, and is not a uuid, so it can never be an account the writer resolves (/internal/where and /internal/rejoin refuse it) or a row anywhere. ORIGINS_PRESENCE_GUESTS=0 is the kill switch.
    const isGuest = !token && offered.includes('guest') && opts.guests !== false && speaks === PROTOCOL_V2;
    if (!speaks || (!token && !isGuest) || (token && token.length > 4096) || (friend && !UUID.test(friend))) return refuse(400, 'bad-request');
    if (isGuest && b.guests >= presenceRule('guestIpSockets')) return refuse(429, 'guest-ip');   // a lower per-address cap than a signed-in player's, on top of the join rate and ip-sockets above
    if (isGuest && guestCount >= presenceRule('guestCeiling')) return refuse(503, 'guest-full');
    const bucket = b; bucket.sockets++;   // held while the token is being checked, so a burst of slow checks cannot overshoot the cap
    if (isGuest) { bucket.guests++; guestCount++; }
    const release = (): void => { bucket.sockets--; if (isGuest) { bucket.guests--; guestCount--; } };
    socket.on('error', () => {});
    void (isGuest ? Promise.resolve(`guest-${randomUUID()}`) : verify(token!)).then(async account => {
      if (!account || socket.destroyed) { release(); return refuse(403, 'token'); }
      // A fresh join starts where `locate` says (a server-held state, else the saved place, trade areas already moved to their edge); with none, presence's own
      // 10-minute memory, else the spawn (World.join). Any locate error or timeout is the same as "none": never the client's first pose.
      const placed = isGuest || world.byAccount.has(account) ? undefined :   // a guest has no saved place: it starts at the spawn
 await (opts.locate?.(account) ?? Promise.resolve(null)).catch(() => null) ?? undefined, saved = placed && fromLegacy(placed);   // locate answers in the saved (old) frame
      if (socket.destroyed) { release(); return refused('gone'); }   // closed while the saved place was read
      const first = world.join(account, now(), friend, saved, legacy);
      if (first) { first.guest = isGuest; first.name = isGuest ? null : opts.nameOf?.(account) ?? null; first.worn = isGuest ? {} : opts.wornOf?.(account) ?? {}; }   // a guest carries no name: the page shows "Guest"
      if (!first) { release(); return refuse(503, world.byAccount.has(account) ? 'already-in' : 'world-full'); }
      let player: Player = first;   // re-pointed by a rejoin
      sockets.set(player, socket); counts.joined++;
      const me = account;
      socket.write(`HTTP/1.1 101 Switching Protocols\r\nUpgrade: websocket\r\nConnection: Upgrade\r\nSec-WebSocket-Accept: ${createHash('sha1').update(key + GUID).digest('base64')}\r\nSec-WebSocket-Protocol: ${speaks}\r\n\r\n`);
      (socket as Socket).setNoDelay(true);
      socket.write(hello(player));
      let warpWindow = 0, warpCount = 0;   // a minute's count of warps on this socket (warpPerMin)
      let buffered = Buffer.alloc(0), windowStart = now(), count = 0, idle: NodeJS.Timeout, zone = zoneAt(player.x, player.z);
      // Every way this socket is closed (the peer's close frame, our idle/rate/teleport/malformed closes) removes the player NOW: `gone` used to run only on the TCP 'close' event, which needs the peer's
      // FIN too, so a peer that sent a close frame and then dawdled stayed in the world, and in every watcher's packets, until it finished (the HL "Bob left and is still drawn" ghost). The socket is
      // destroyed after closeGraceMs if the peer still has not finished. `gone` is idempotent (the sockets.get check), so the later 'close' event is a no-op.
      const close = (code: number, why?: string): void => {
        if (why) refused(why);
        if (!socket.destroyed) { const p = Buffer.alloc(2); p.writeUInt16BE(code); socket.end(frame(8, p)); setTimeout(() => socket.destroy(), closeGraceMs).unref(); }
        gone();
      };
      const touch = (): void => { clearTimeout(idle); idle = setTimeout(() => close(4000, 'idle'), limits.idleMs); };
      touch();
      if (!isGuest) rejoiners.set(me, async () => {   // a guest has no active character to switch
        if (socket.destroyed || sockets.get(player) !== socket) return false;
        const was = await (opts.locate?.(me) ?? Promise.resolve(null)).catch(() => null) ?? undefined, at = was && fromLegacy(was);
        if (socket.destroyed || sockets.get(player) !== socket) return false;
        const old = player; sockets.delete(old); world.leave(old, now()); saves?.drop(me);   // the old character's queued place must not land on the new one (Auditor M1)
        world.memory.delete(me);   // a rejoin is a different character: with no saved spot it starts at the spawn, never where the old one left
        const fresh = world.join(me, now(), friend, at, legacy);
        if (fresh) { fresh.name = opts.nameOf?.(me) ?? null; fresh.worn = opts.wornOf?.(me) ?? {}; }   // the new active character's name and worn set (the locate above asked the writer again)
        if (!fresh) { release(); rejoiners.delete(me); close(1013, 'world-full'); return false; }
        player = fresh; sockets.set(fresh, socket); zone = zoneAt(fresh.x, fresh.z);   // the old character's place is NOT saved here: the writer's active character is already the new one
        socket.write(hello(fresh));
        return true;
      });
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
          if (opcode !== 2 && opcode !== 1) return close(1003, 'malformed');
          const nowMs = now();
          if (nowMs - windowStart >= 1000) { windowStart = nowMs; count = 0; }
          if (++count > limits.perSecond) return close(4008, 'message-rate');
          if (opcode === 1) {   // a warp: {"t":"warp","to":"<landmark id>"}. The client names a landmark, never a coordinate; the place comes from the warp table (warps.ts)
            let to: unknown; try { const m = JSON.parse(payload.toString('utf8')) as { t?: unknown; to?: unknown }; to = m.t === 'warp' ? m.to : undefined; } catch { to = undefined; }
            const at = typeof to === 'string' && !player.legacy ? warpPlace(to) : null;
            // A guest sends NOTHING but a warp: any other text frame (speech, when it exists) closes the socket until S4's filter lets guests speak (Lead 2026-10-16: guests receive chat and send none).
            if (!at) return close(1003, player.guest ? 'guest-frame' : 'warp-id');   // a forged id, a guest's speech, or a v1 client that cannot hold the frame
            if (!warpAllowed(to as string, player.x, player.z)) { refused('warp-door'); continue; }   // a door's end is reached by walking to the other end, never by asking from afar
            if (nowMs - warpWindow >= 60_000) { warpWindow = nowMs; warpCount = 0; }
            if (++warpCount > presenceRule('warpPerMin')) { refused('warp-rate'); continue; }   // over the rate: ignored, the client keeps its place
            world.warp(player, at.x, at.z, nowMs); zone = zoneAt(player.x, player.z); counts.warped++;
            socket.write(hello(player));   // the fresh hello is the client's cue to adopt the place
            continue;
          }
          const up = decodeUp(payload);
          if (!up) return close(1003, 'malformed');
          const pose = player.legacy ? { ...up, x: up.x + LEGACY_SHIFT_CM, z: up.z + LEGACY_SHIFT_CM } : up;
          counts.up++;
          const moved = world.move(player, pose, nowMs);
          if (moved !== 'ok') { counts.strikes++; if (moved === 'snapped') counts.snapped++; }
          if (moved === 'drop') return close(4009, 'teleport');
          const into = zoneAt(player.x, player.z);
          if (into !== zone) { zone = into; savePlace(player); }   // a zone change saves at once (EverQuest's save on zoning)
        }
      });
      const gone = (): void => { clearTimeout(idle); rejoiners.delete(me); if (sockets.get(player) !== socket) return; sockets.delete(player); world.leave(player, now()); savePlace(player); release(); };
      socket.on('close', gone); socket.on('error', gone);
    }, () => { release(); refuse(403, 'token'); });
  });

  return {
    server, world, stats, port: () => (server.address() as { port: number }).port,
    close: () => new Promise(done => { for (const t of [ticker, beats, reporter, sweeper, checkpoint, wornTimer]) clearInterval(t); for (const t of pokeTimers.values()) clearTimeout(t); for (const s of sockets.values()) s.destroy(); server.close(() => done()); }),
  };
}
