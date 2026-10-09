// Origins: the Zone 1 preview JOINS the presence service (origins/presence/server.ts, docs/specs/origins/one-shard.md). Presence saves the place itself from what it sees
// (origins/server/location.ts: on leave and every 60 s), so the page never says "save": it opens the socket, adopts the server's `hello` place, and poses at presence's tick.
// Donor: AzerothCore / ModernUO / EQEmu / 2004Scape all keep the save on the server and the client only moves; the reconnect schedule is World of Claudecraft's (src/net/backoff.ts, MIT).
// Everything fails quiet: no token (signed out), no service (it is OFF unless ORIGINS_PRESENCE=1), a refused or dropped socket all leave the page playing exactly as before.
// No DOM, storage or clock read here: the socket, the clock and the timers are injected.
import { computeBackoffDelay } from '../../src/net/backoff.ts';
import { decodeDown, encodeUp, type Entity } from '../presence/wire.ts';

export const PROTOCOL = 'frankendom.presence.v1';
export const POSE_EVERY_MS = 100;       // presence's tick (RULES.tickMs): one pose a tick is all it reads
export const CENTRE_CM = 15000;         // presence centimetres of the Concord frame's origin (origins/presence/zones.ts CENTRE_CM): world (0, 0) is the Pit yard's centre
export const GIVE_UP_AFTER = 6;         // consecutive sockets that never reached `hello`: the service is off or refusing us, stop trying until the page reloads
export const presenceWanted = (search: string): boolean => !/[?&]presence=0(?:&|$)/.test(search);   // on for a signed-in page; ?presence=0 is the kill switch
export const presenceUrl = (origin: string): string => `${origin.replace(/^http/, 'ws')}/origins/presence`;   // https://frankendom.com -> wss://frankendom.com/origins/presence

const cm = (metres: number): number => Math.min(30000, Math.max(0, Math.round(CENTRE_CM + metres * 100)));
const metres = (centi: number): number => (centi - CENTRE_CM) / 100;
export const headingByte = (radians: number): number => Math.round((((radians % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI)) / (2 * Math.PI) * 256) & 255;

export type Pose = { x: number; z: number; heading: number; anim?: number; flags?: number };   // metres in the Concord frame, heading in radians
export type Other = { id: number; x: number; z: number; heading: number; anim: number; flags: number };
export type Socket = { binaryType: string; readyState: number; send(data: Uint8Array): void; close(code?: number): void; onopen: (() => void) | null; onmessage: ((e: { data: unknown }) => void) | null; onclose: (() => void) | null; onerror: (() => void) | null };
export type Deps = {
  token: string | null; url: string; open: (url: string, protocols: string[]) => Socket;
  pose: () => Pose | null;                              // where the hero stands now; null while the page has no hero to show
  onHello?: (at: { x: number; z: number; layer: number }) => void;   // where the server placed us (metres): fires on every (re)connect, before the first pose
  onOthers?: (others: Other[]) => void;
  setTimer?: (fn: () => void, ms: number) => unknown; clearTimer?: (id: unknown) => void; every?: (fn: () => void, ms: number) => unknown; clearEvery?: (id: unknown) => void;
  rng?: () => number;
};
export type Presence = { stop(): void; flush(): void; state(): 'connecting' | 'live' | 'retrying' | 'off' };   // flush: a pose now (a zone change, so the saved place is fresh)

const OPEN = 1;
export function joinPresence(d: Deps): Presence | null {
  if (!d.token) return null;
  const setTimer = d.setTimer ?? ((fn, ms) => setTimeout(fn, ms)), clearTimer = d.clearTimer ?? ((id) => clearTimeout(id as never));
  const every = d.every ?? ((fn, ms) => setInterval(fn, ms)), clearEvery = d.clearEvery ?? ((id) => clearInterval(id as never)), rng = d.rng ?? Math.random;
  let socket: Socket | null = null, poseTimer: unknown, retryTimer: unknown, stopped = false, failures = 0, welcomed = false, status: ReturnType<Presence['state']> = 'connecting';
  const send = (): void => {
    const p = d.pose();
    if (!p || !socket || socket.readyState !== OPEN || !welcomed) return;   // never pose before the server's hello: a first pose from the page's own spawn would look like a teleport
    socket.send(encodeUp({ x: cm(p.x), z: cm(p.z), heading: headingByte(p.heading), anim: p.anim ?? 0, flags: p.flags ?? 0 }));
  };
  const connect = (): void => {
    if (stopped) return;
    welcomed = false; status = failures ? 'retrying' : 'connecting';
    let s: Socket;
    try { s = d.open(d.url, [PROTOCOL, `token.${d.token}`]); } catch { return void lost(); }   // the token rides the subprotocol header, never the URL (the service refuses a token in the URL)
    socket = s; s.binaryType = 'arraybuffer';
    s.onmessage = (e) => {
      if (s !== socket) return;
      if (typeof e.data === 'string') {
        let hello: { t?: unknown; x?: unknown; z?: unknown; layer?: unknown } | null;
        try { hello = JSON.parse(e.data); } catch { hello = null; }
        if (hello?.t !== 'hello' || typeof hello.x !== 'number' || typeof hello.z !== 'number') return;
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
    state: () => status,
  };
}
