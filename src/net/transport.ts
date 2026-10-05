// How a duel's packets travel (docs/duel-architecture.md §4; Lead 2026-09-29). Direct first, always: a WebRTC data channel between the
// two phones (unordered, no retransmits: every packet repeats the unacked intents, so a lost one costs nothing), set up over our VPS relay
// with a public STUN server (Google's, free, no account) finding each phone's address. Only when no direct path connects within
// `directMs` do the packets ride the relay itself (scripts/duel-relay.mjs, in Germany: a Dubai↔Dubai duel relayed pays Dubai→Germany→Dubai,
// so it is the fallback, not the plan). The path taken and the ICE candidate type of the selected pair go into duel_metrics.
// Browser-only; imported by nothing in single-player.
import { SILENCE, type DuelMessage } from './pvp.ts';
import { computeBackoffDelay } from './backoff.ts';
import { isFinalClose } from './reconnect-policy.ts';

export type Path = 'direct' | 'relay';
export type Candidate = 'host' | 'srflx' | 'prflx' | 'relay';
export type Transport = {
  path: Path; candidate: Candidate | null;
  reconnects: number;   // how many times this page's relay socket re-opened after a loss (the metrics row's `reconnects`; 0 = never dropped)
  send(message: DuelMessage): void;
  link(): boolean | null;   // this page's own link to the relay: up, down, or unknown (no beat ever heard)
  onMessage: ((raw: string) => void) | null;   // the peer's message as text: pvp.ts parseMessage is the only reader
  onPeer: ((up: boolean) => void) | null;
  close(): void;
};
type Wire = { t: 'beat' } | { t: 'peer'; up: boolean } | { t: 'sig'; sdp?: RTCSessionDescriptionInit; ice?: RTCIceCandidateInit } | { t: 'pkt'; p: string };

export const ICE_SERVERS: RTCIceServer[] = [{ urls: 'stun:stun.l.google.com:19302' }];
export const relayUrl = (origin = location.origin): string => origin.replace(/^http/, 'ws') + '/duel/relay';

// A room is minted by the relay (never invented by a client): one signed token per side, valid 30 minutes. The challenger keeps
// tokens[0] and puts tokens[1] in the challenge link. The token's second field is its side.
export type Room = { room: string; exp: number; tokens: [string, string] };
// Minting is admins-only until duels open (scripts/duel-relay.mjs): `session` is the signed-in account's access token, null for a guest.
// A page on a server with no relay yet (the SPA answers, or nothing does) says so rather than showing a parse error.
export async function mintRoom(session: string | null, origin = location.origin): Promise<Room> {
  const res = await fetch(`${origin}/duel/relay/room`, { method: 'POST', headers: session ? { authorization: `Bearer ${session}` } : {} });
  if (res.status === 401 || res.status === 403) throw new Error('Sign in to challenge a friend');
  if (res.status === 429) throw new Error('Too many duels opened from here; wait a minute');
  if (!res.ok || !(res.headers.get('content-type') ?? '').includes('application/json')) throw new Error('Duels are not open on this server yet');
  return await res.json() as Room;
}
export const sideOf = (token: string): 0 | 1 => (token.split('.')[1] === '1' ? 1 : 0);

// Resolves once the peer is present and the path is decided: `direct` as soon as the data channel opens, `relay` if it has not within
// `directMs` of the peer arriving. Rejects if the relay itself cannot be reached. After that the relay socket is kept alive: a drop (a
// phone switching networks) is retried with jittered exponential backoff from `retryMs` for up to `reconnectMs`: capped at `fastMaxMs` until SILENCE.rejoinMs has passed since the loss (the page forfeits then, so a link that is back at 8 s must be heard by 10 s), at `maxRetryMs` after, unless the relay closed it for good (reconnect-policy.ts), with the same token (the relay lets its holder take the
// side back), and the challenger re-offers WebRTC when the peer reappears. `direct: false` never builds a peer connection (a test, or a
// browser with no WebRTC): everything rides the relay.
export const RECONNECT = { retryMs: 500, fastMaxMs: 1000, maxRetryMs: 4000, reconnectMs: 30_000, beatStaleMs: 5000, directQuietMs: 1500 };
export function connectDuel(token: string, { url = relayUrl(), iceServers = ICE_SERVERS, directMs = 5000, direct = true } = {}): Promise<Transport> {
  const side = sideOf(token);
  return new Promise((resolve, reject) => {
    let ws: WebSocket, pc: RTCPeerConnection | null = null, channel: RTCDataChannel | null = null, decided = false, closing = false;
    let timer: ReturnType<typeof setTimeout> | undefined, retry: ReturnType<typeof setTimeout> | undefined;
    let beatAt = 0, heardAt = 0, lostAt = 0, attempt = 0;   // the last relay beat, the last thing the peer sent by either path, when the relay socket was lost
    const signal = (message: Wire) => { if (!closing && ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify(message)); };
    const transport: Transport = {
      path: 'relay', candidate: null, reconnects: 0, onMessage: null, onPeer: null,
      // Our own link, as the relay tells it: true while its beats arrive, false once the socket is lost or the beats stop, null when no
      // beat has ever come (an older relay: unknown, so the page never claims a forfeit it cannot back).
      link() { return ws.readyState !== WebSocket.OPEN ? false : beatAt === 0 ? null : Date.now() - beatAt < RECONNECT.beatStaleMs; },
      send(message) {
        if (closing) return;
        const text = JSON.stringify(message);
        if (transport.path === 'direct' && channel?.readyState === 'open') {
          channel.send(text);
          if (Date.now() - heardAt > RECONNECT.directQuietMs) signal({ t: 'pkt', p: text });   // a direct path that has gone quiet may be black-holed: the relay carries a copy
        } else signal({ t: 'pkt', p: text });
      },
      close() { closing = true; clearTimeout(timer); clearTimeout(retry); channel?.close(); pc?.close(); ws.close(); },
    };
    const heard = (text: string) => { heardAt = Date.now(); transport.onMessage?.(text); };
    const decide = (path: Path) => { if (decided || closing) return; decided = true; clearTimeout(timer); transport.path = path; resolve(transport); };
    // Both sides bound the initial decision from peer arrival, even if the challenger cannot produce an offer.
    const waitForDirect = () => { if (!closing && !decided && timer === undefined) timer = setTimeout(() => decide('relay'), directMs); };
    const current = (connection: RTCPeerConnection | null) => !closing && pc === connection;
    const fallback = (connection: RTCPeerConnection | null) => {
      if (!current(connection)) return;
      clearTimeout(timer);
      pc = null; channel?.close(); channel = null; connection?.close();
      transport.path = 'relay'; transport.candidate = null;
      decide('relay');
    };
    const open = async (connection: RTCPeerConnection, dc: RTCDataChannel) => {
      if (!current(connection) || channel !== dc || dc.readyState !== 'open') return;
      const candidate = await selectedCandidate(connection).catch(() => null);
      if (!current(connection) || channel !== dc || dc.readyState !== 'open') return;
      transport.candidate = candidate;
      if (decided) transport.path = 'direct';   // a channel rebuilt after a reconnect takes the packets back from the relay
      else decide('direct');
    };
    const wire = (connection: RTCPeerConnection, dc: RTCDataChannel) => {
      if (!current(connection)) return;
      channel = dc;
      dc.onopen = () => { void open(connection, dc); };
      dc.onmessage = (e) => { if (current(connection) && channel === dc && typeof e.data === 'string') heard(e.data); };
      dc.onclose = () => { if (current(connection) && channel === dc) { transport.path = 'relay'; transport.candidate = null; } };
    };
    const offer = async (connection: RTCPeerConnection) => {
      try {
        const description = await connection.createOffer();
        if (!current(connection)) return;
        await connection.setLocalDescription(description);
        if (!current(connection)) return;
        signal({ t: 'sig', sdp: connection.localDescription!.toJSON() });
      } catch { fallback(connection); }
    };
    const peer = () => {
      if (closing) return null;
      const previous = pc;
      pc = null; channel?.close(); channel = null; previous?.close();
      transport.path = 'relay'; transport.candidate = null;
      waitForDirect();
      try {
        const connection = new RTCPeerConnection({ iceServers });
        pc = connection;
        connection.onicecandidate = (e) => { if (current(connection) && e.candidate) signal({ t: 'sig', ice: e.candidate.toJSON() }); };
        if (side === 0) {
          wire(connection, connection.createDataChannel('duel', { ordered: false, maxRetransmits: 0 }));
          void offer(connection);
        } else connection.ondatachannel = (e) => wire(connection, e.channel);
        return connection;
      } catch { fallback(pc); return null; }
    };
    // Every setup continuation owns one connection. A replaced/closed peer cannot publish SDP, switch paths, or retire its successor.
    const onMessage = async (e: MessageEvent) => {
      let message: Wire;
      try { message = JSON.parse(String(e.data)) as Wire; } catch { return; }
      if (!message || typeof message !== 'object') return;
      if (message.t === 'beat') beatAt = Date.now();
      else if (message.t === 'pkt') { if (typeof message.p === 'string') heard(message.p); }
      else if (message.t === 'peer') {
        transport.onPeer?.(message.up);
        if (!direct) { if (message.up) decide('relay'); }
        else if (message.up) { waitForDirect(); if (side === 0) peer(); }
      } else if (message.t === 'sig' && direct) {
        const connection = side === 1 && message.sdp?.type === 'offer' ? peer() : pc;
        if (!connection) return;
        try {
          if (message.sdp) {
            if (side === 1 && message.sdp.type === 'offer') {
              await connection.setRemoteDescription(message.sdp);
              if (!current(connection)) return;
              const answer = await connection.createAnswer();
              if (!current(connection)) return;
              await connection.setLocalDescription(answer);
              if (!current(connection)) return;
              signal({ t: 'sig', sdp: connection.localDescription!.toJSON() });
            } else if (side === 0 && message.sdp.type === 'answer') await connection.setRemoteDescription(message.sdp);
          } else if (message.ice) await connection.addIceCandidate(message.ice).catch(() => undefined);   // a late candidate after close is harmless
        } catch { fallback(connection); }
      }
    };
    const join = () => {
      const socket = new WebSocket(`${url}?token=${encodeURIComponent(token)}`);
      ws = socket;
      socket.onmessage = (e) => { if (!closing && ws === socket) void onMessage(e); };
      socket.onopen = () => { if (lostAt) transport.reconnects++; lostAt = 0; attempt = 0; };   // beatAt is kept: after a reconnect link() stays false until the first fresh beat, never a hopeful null
      // Lost before the first decision: the relay is unreachable. Lost after: keep trying until reconnectMs, then leave it to the page's silence rules.
      let counted = false;   // a failed connect fires error then close: one backoff step per socket, not two
      const lost = (e?: Event) => {
        if (ws !== socket || closing) return;
        if (!decided) { transport.close(); reject(new Error('duel relay unreachable')); return; }
        lostAt ||= Date.now();
        if (isFinalClose((e as CloseEvent | undefined)?.code)) { counted = true; clearTimeout(retry); return; }   // an error's retry is withdrawn by the close that follows it
        if (counted) return;
        counted = true;
        const since = Date.now() - lostAt;
        if (since < RECONNECT.reconnectMs) retry = setTimeout(join, computeBackoffDelay(++attempt, RECONNECT.retryMs, since < SILENCE.rejoinMs ? RECONNECT.fastMaxMs : RECONNECT.maxRetryMs, Math.random));
      };
      socket.onerror = lost; socket.onclose = lost;
    };
    join();
  });
}

// The local candidate type of the pair ICE selected: host (same network), srflx (through NAT, found by STUN), relay (a TURN server).
async function selectedCandidate(pc: RTCPeerConnection): Promise<Candidate | null> {
  // RTCStatsReport is a maplike; this lib types only its forEach, so read it into a Map.
  const stats = new Map<string, RTCStats & Record<string, unknown>>();
  (await pc.getStats()).forEach((s: RTCStats & Record<string, unknown>) => stats.set(s.id, s));
  let pair: (RTCStats & Record<string, unknown>) | undefined;
  for (const s of stats.values()) if (s.type === 'transport' && typeof s.selectedCandidatePairId === 'string') pair = stats.get(s.selectedCandidatePairId);
  pair ??= [...stats.values()].find((s) => s.type === 'candidate-pair' && s.nominated === true && s.state === 'succeeded');
  const local = typeof pair?.localCandidateId === 'string' ? stats.get(pair.localCandidateId) : undefined;
  const type = local?.candidateType;
  return type === 'host' || type === 'srflx' || type === 'prflx' || type === 'relay' ? type : null;
}

