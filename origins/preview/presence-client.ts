// Origins: the Zone 1 preview JOINS the presence service (origins/presence/server.ts, docs/specs/origins/one-shard.md). Presence saves the place itself from what it sees
// (origins/server/location.ts: on leave and every 60 s), so the page never says "save": it opens the socket, adopts the server's `hello` place, and poses at presence's tick.
// Donor: AzerothCore / ModernUO / EQEmu / 2004Scape all keep the save on the server and the client only moves; the reconnect schedule is World of Claudecraft's (src/net/backoff.ts, MIT).
// Everything fails quiet: no token (signed out), no service (it is OFF unless ORIGINS_PRESENCE=1), a refused or dropped socket all leave the page playing exactly as before.
// No DOM, storage or clock read here: the socket, the clock and the timers are injected.
import { computeBackoffDelay } from '../../src/net/backoff.ts';
import { decodeDown, encodeUp, type Entity } from '../presence/wire.ts';
import { RULES } from '../presence/interest.ts';
import { LEGACY_CENTRE_CM, LEGACY_SPAN_CM, PROTOCOL, PROTOCOL_V2 } from '../presence/frame.ts';
import { previewRule } from './preview-rules.ts';

export { PROTOCOL, PROTOCOL_V2 };   // the page offers v2 (the whole-world frame, Zone 1 included) and v1 (the town-only fallback); the hello says which one the server chose
export const POSE_EVERY_MS: number = RULES.tickMs;       // presence's tick (interest.ts RULES.tickMs, a row): one pose a tick is all it reads
export const GIVE_UP_AFTER = previewRule('presenceGiveUp');        // consecutive sockets that never reached `hello`: the service is off or refusing us, stop trying until the page reloads
export const presenceWanted = (search: string): boolean => !/[?&]presence=0(?:&|$)/.test(search);   // on for a signed-in page; ?presence=0 is the kill switch
export const presenceUrl = (origin: string): string => `${origin.replace(/^http/, 'ws')}/origins/presence`;   // https://frankendom.com -> wss://frankendom.com/origins/presence

export type Frame = { centreCm: number; sizeCm: number };   // the hello's frame: world (0,0) at centreCm, positions 0..sizeCm (u16 centimetres)
export const LEGACY_FRAME: Frame = { centreCm: LEGACY_CENTRE_CM, sizeCm: LEGACY_SPAN_CM };   // a v1 server, or a hello with no frame
const LEGACY_EDGE_M = LEGACY_SPAN_CM / 200 - 1;   // v1 only knows the town square: a pose beyond this is withheld, never clamped onto the edge
export const headingByte = (radians: number): number => Math.round((((radians % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI)) / (2 * Math.PI) * 256) & 255;

export type Pose = { x: number; z: number; heading: number; anim?: number; flags?: number };   // metres in the Concord frame, heading in radians
export type Other = { id: number; x: number; z: number; heading: number; anim: number; flags: number };
export type Socket = { binaryType: string; readyState: number; send(data: Uint8Array | string): void; close(code?: number): void; onopen: (() => void) | null; onmessage: ((e: { data: unknown }) => void) | null; onclose: (() => void) | null; onerror: (() => void) | null };
export type Deps = {
  token: string | null; url: string;
  guest?: boolean;   // signed out and still in the shared world: with no token, offer `guest` (v2 only; nothing is saved, the server mints the identity) open: (url: string, protocols: string[]) => Socket;
  pose: () => Pose | null;                              // where the hero stands now; null while the page has no hero to show
  onHello?: (at: { x: number; z: number; layer: number }) => void;   // where the server placed us (metres): fires on every (re)connect, before the first pose
  onOthers?: (others: Other[]) => void;
  onEnter?: (who: { id: number; name: string | null; guest: boolean }) => void;   // an id came into range: its name tag (null name + guest = "Guest"); sent again each time it re-enters range
  setTimer?: (fn: () => void, ms: number) => unknown; clearTimer?: (id: unknown) => void; every?: (fn: () => void, ms: number) => unknown; clearEvery?: (id: unknown) => void;
  rng?: () => number;
};
export type Presence = { stop(): void; flush(): void; warp(landmark: string): boolean; guest(): boolean; state(): 'connecting' | 'live' | 'retrying' | 'off' };   // flush: a pose now (a zone change, so the saved place is fresh)

const OPEN = 1;
export function joinPresence(d: Deps): Presence | null {
  if (!d.token && !d.guest) return null;   // signed out and not a guest: nothing is opened
  const setTimer = d.setTimer ?? ((fn, ms) => setTimeout(fn, ms)), clearTimer = d.clearTimer ?? ((id) => clearTimeout(id as never));
  const every = d.every ?? ((fn, ms) => setInterval(fn, ms)), clearEvery = d.clearEvery ?? ((id) => clearInterval(id as never)), rng = d.rng ?? Math.random;
  let isGuest = false, frame: Frame = LEGACY_FRAME, socket: Socket | null = null, poseTimer: unknown, retryTimer: unknown, stopped = false, failures = 0, welcomed = false, status: ReturnType<Presence['state']> = 'connecting';
  const send = (): void => {
    const p = d.pose(), legacy = frame === LEGACY_FRAME;
    if (!p || (legacy && (Math.abs(p.x) >= LEGACY_EDGE_M || Math.abs(p.z) >= LEGACY_EDGE_M)) || !socket || socket.readyState !== OPEN || !welcomed) return;   // never pose before the server's hello: a first pose from the page's own spawn would look like a teleport
    socket.send(encodeUp({ x: cm(p.x), z: cm(p.z), heading: headingByte(p.heading), anim: p.anim ?? 0, flags: p.flags ?? 0 }));
  };
  const cm = (m: number): number => Math.min(frame.sizeCm, Math.max(0, Math.round(frame.centreCm + m * 100)));
  const metres = (centi: number): number => (centi - frame.centreCm) / 100;
  const connect = (): void => {
    if (stopped) return;
    welcomed = false; status = failures ? 'retrying' : 'connecting';
    let s: Socket;
    try { s = d.open(d.url, d.token ? [PROTOCOL_V2, PROTOCOL, `token.${d.token}`] : [PROTOCOL_V2, 'guest']); } catch { return void lost(); }   // the token rides the subprotocol header, never the URL (the service refuses a token in the URL)
    socket = s; s.binaryType = 'arraybuffer';
    s.onmessage = (e) => {
      if (s !== socket) return;
      if (typeof e.data === 'string') {
        let hello: { t?: unknown; x?: unknown; z?: unknown; layer?: unknown; id?: unknown; name?: unknown; guest?: unknown; frame?: { centreCm?: unknown; sizeCm?: unknown } } | null;
        try { hello = JSON.parse(e.data); } catch { hello = null; }
        if (hello?.t === 'enter') {   // who an id is, sent once when it comes into range (before its first packet)
          if (typeof hello.id === 'number') d.onEnter?.({ id: hello.id, name: typeof hello.name === 'string' ? hello.name : null, guest: hello.guest === true });
          return;
        }
        if (hello?.t !== 'hello' || typeof hello.x !== 'number' || typeof hello.z !== 'number') return;
        const f = hello.frame;   // a v2 hello names its frame; a v1 hello has none
        frame = typeof f?.centreCm === 'number' && typeof f.sizeCm === 'number' ? { centreCm: f.centreCm, sizeCm: f.sizeCm } : LEGACY_FRAME;
        isGuest = hello.guest === true;   // the server says whether it admitted us as a guest (nothing is saved): Web's "Sign in to keep it" nudge reads this
        welcomed = true; failures = 0; status = 'live';
        d.onHello?.({ x: metres(hello.x), z: metres(hello.z), layer: typeof hello.layer === 'number' ? hello.layer : 0 });
        return;
      }
      const down = e.data instanceof ArrayBuffer ? decodeDown(new Uint8Array(e.data)) : null;
      if (down && d.onOthers) d.onOthers(down.entities.map((o: Entity) => ({ id: o.id, x: metres(o.x), z: metres(o.z), heading: o.heading / 256 * 2 * Math.PI, anim: o.anim, flags: o.flags })));
    };
    s.onopen = () => { if (poseTimer === undefined) poseTimer = every(send, POSE_EVERY_MS); };
    s.onerror = () => { /* the close that follows is the signal */ };
    s.onclose = () => { if (s === socket) lost(); };
  };
  const lost = (): void => {
    if (poseTimer !== undefined) { clearEvery(poseTimer); poseTimer = undefined; }
    socket = null; if (stopped) return;
    if (!welcomed) failures++;
    welcomed = false;
    if (failures >= GIVE_UP_AFTER) { status = 'off'; return; }
    status = 'retrying';
    retryTimer = setTimer(connect, computeBackoffDelay(Math.max(1, failures), 1000, 30_000, rng));
  };
  connect();
  return {
    stop() { stopped = true; status = 'off'; if (poseTimer !== undefined) clearEvery(poseTimer); if (retryTimer !== undefined) clearTimer(retryTimer); poseTimer = retryTimer = undefined; const s = socket; socket = null; try { s?.close(1000); } catch { /* already closed */ } },
    flush: send,
    guest: () => isGuest,
    // The page teleports the hero (death respawn, the way back, the Zone 1 start): presence must be told WHICH landmark, never where (origins/presence/warps.ts). Needs a v2 server; false when not live.
    warp(landmark) {
      if (!socket || socket.readyState !== OPEN || !welcomed || frame === LEGACY_FRAME) return false;
      socket.send(JSON.stringify({ t: 'warp', to: landmark })); return true;
    },
    state: () => status,
  };
}
