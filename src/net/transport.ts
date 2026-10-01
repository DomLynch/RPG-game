// How a duel's packets travel (docs/duel-architecture.md §4; Lead 2026-09-29). Direct first, always: a WebRTC data channel between the
// two phones (unordered, no retransmits: every packet repeats the unacked intents, so a lost one costs nothing), set up over our VPS relay
// with a public STUN server (Google's, free, no account) finding each phone's address. Only when no direct path connects within
// `directMs` do the packets ride the relay itself (scripts/duel-relay.mjs, in Germany: a Dubai↔Dubai duel relayed pays Dubai→Germany→Dubai,
// so it is the fallback, not the plan). The path taken and the ICE candidate type of the selected pair go into duel_metrics.
// Browser-only; imported by nothing in single-player.
import type { DuelMessage } from './pvp.ts';

export type Path = 'direct' | 'relay';
export type Candidate = 'host' | 'srflx' | 'prflx' | 'relay';
export type Transport = {
  path: Path; candidate: Candidate | null;
  send(message: DuelMessage): void;
  onMessage: ((raw: string) => void) | null;   // the peer's message as text: pvp.ts parseMessage is the only reader
  onPeer: ((up: boolean) => void) | null;
  close(): void;
};
type Wire = { t: 'peer'; up: boolean } | { t: 'sig'; sdp?: RTCSessionDescriptionInit; ice?: RTCIceCandidateInit } | { t: 'pkt'; p: string };

export const ICE_SERVERS: RTCIceServer[] = [{ urls: 'stun:stun.l.google.com:19302' }];
export const relayUrl = (origin = location.origin): string => origin.replace(/^http/, 'ws') + '/duel/relay';

// A room is minted by the relay (never invented by a client): one signed token per side, valid 30 minutes. The challenger keeps
// tokens[0] and puts tokens[1] in the challenge link. The token's second field is its side.
export type Room = { room: string; exp: number; tokens: [string, string] };
// Minting is admins-only until duels open (scripts/duel-relay.mjs): `session` is the signed-in account's access token, null for a guest.
// A page on a server with no relay yet (the SPA answers, or nothing does) says so rather than showing a parse error.
export async function mintRoom(session: string | null, origin = location.origin): Promise<Room> {
  const res = await fetch(`${origin}/duel/relay/room`, { method: 'POST', headers: session ? { authorization: `Bearer ${session}` } : {} });
  if (res.status === 401 || res.status === 403) throw new Error('Duels are open to admins only for now: sign in with an admin account');
  if (res.status === 429) throw new Error('Too many duels opened from here; wait a minute');
  if (!res.ok || !(res.headers.get('content-type') ?? '').includes('application/json')) throw new Error('Duels are not open on this server yet');
  return await res.json() as Room;
}
export const sideOf = (token: string): 0 | 1 => (token.split('.')[1] === '1' ? 1 : 0);

// Resolves once the peer is present and the path is decided: `direct` as soon as the data channel opens, `relay` if it has not within
// `directMs` of the peer arriving. Rejects if the relay itself cannot be reached.
export function connectDuel(token: string, { url = relayUrl(), iceServers = ICE_SERVERS, directMs = 5000 } = {}): Promise<Transport> {
  const side = sideOf(token);
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(`${url}?token=${encodeURIComponent(token)}`);
    let pc: RTCPeerConnection | null = null, channel: RTCDataChannel | null = null, decided = false, timer: ReturnType<typeof setTimeout> | undefined;
    const signal = (message: Wire) => { if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify(message)); };
    const transport: Transport = {
      path: 'relay', candidate: null, onMessage: null, onPeer: null,
      send(message) {
        const text = JSON.stringify(message);
        if (transport.path === 'direct' && channel?.readyState === 'open') channel.send(text);
        else signal({ t: 'pkt', p: text });
      },
      close() { clearTimeout(timer); channel?.close(); pc?.close(); ws.close(); },
    };
    const decide = (path: Path) => { if (decided) return; decided = true; clearTimeout(timer); transport.path = path; resolve(transport); };
    const open = async () => {
      transport.candidate = await selectedCandidate(pc!);
      decide('direct');
    };
    const wire = (dc: RTCDataChannel) => {
      channel = dc;
      dc.onopen = () => { void open(); };
      dc.onmessage = (e) => { if (typeof e.data === 'string') transport.onMessage?.(e.data); };
      dc.onclose = () => { if (transport.path === 'direct') transport.path = 'relay'; };   // a dropped direct path falls back mid-duel
    };
    const peer = () => {
      pc?.close();
      pc = new RTCPeerConnection({ iceServers });
      pc.onicecandidate = (e) => { if (e.candidate) signal({ t: 'sig', ice: e.candidate.toJSON() }); };
      if (side === 0) {
        wire(pc.createDataChannel('duel', { ordered: false, maxRetransmits: 0 }));
        void pc.createOffer().then((offer) => pc!.setLocalDescription(offer)).then(() => signal({ t: 'sig', sdp: pc!.localDescription!.toJSON() }));
      } else pc.ondatachannel = (e) => wire(e.channel);
      clearTimeout(timer);
      timer = setTimeout(() => decide('relay'), directMs);
    };
    ws.onerror = () => { if (!decided) reject(new Error('duel relay unreachable')); };
    ws.onclose = () => { if (!decided) reject(new Error('duel relay closed')); };
    // The relay forwards the peer's bytes verbatim, so everything here is the peer's data: parsed without throwing, and a malformed
    // signal is dropped (a bad SDP or candidate fails inside the try, never as an unhandled rejection).
    ws.onmessage = async (e) => {
      let message: Wire;
      try { message = JSON.parse(String(e.data)) as Wire; } catch { return; }
      if (!message || typeof message !== 'object') return;
      if (message.t === 'pkt') { if (typeof message.p === 'string') transport.onMessage?.(message.p); }
      else if (message.t === 'peer') { transport.onPeer?.(message.up); if (message.up && side === 0) peer(); }
      else if (message.t === 'sig') {
        if (message.sdp) {
          if (side === 1 && message.sdp.type === 'offer') {
            peer();
            await pc!.setRemoteDescription(message.sdp);
            const answer = await pc!.createAnswer();
            await pc!.setLocalDescription(answer);
            signal({ t: 'sig', sdp: pc!.localDescription!.toJSON() });
          } else if (side === 0 && message.sdp.type === 'answer') await pc?.setRemoteDescription(message.sdp);
        } else if (message.ice) await pc?.addIceCandidate(message.ice).catch(() => undefined);   // a late candidate after close is harmless
      }
    };
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

