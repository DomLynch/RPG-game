// One live duel on a page (docs/duel-architecture.md §3, §7): the lobby handshake, the wire format, and the driver main.ts steps once
// per 60 Hz tick through Match's 'pvp' mode. No DOM, clock or socket here: the page passes `send` (the transport) and `now` (ms), and
// tests/net-pvp.test.ts drives two of these over a fake link in one process.
//
// The handshake, over a link that may drop or reorder anything (the direct path is unordered with no retransmits):
//   1. Both sides repeat `hello` (this build's record version and the side's kit) until the duel starts. A different version refuses the
//      duel on both pages ("reload"): two builds would step two different fights, and the first hash check would call it a desync.
//   2. The challenger (side 0), once it has the guest's hello, pings every PING.every frames; the guest answers each. After PING.samples
//      round trips (or PING.maxFrames with at least one), it picks the delay the 90th-percentile round trip needs (rollback.ts delayFor).
//   3. The challenger starts and repeats `go` (the delay and both kits) until the guest's first duel packet arrives; the guest starts on the
//      first `go` it hears. Both begin at tick 0 on the same delay: the first `delay` ticks are idle by agreement, so the one-way trip
//      between the two starts is absorbed like any other late packet.
import { initialAi } from '../ai.ts';
import { project, type Practice } from '../combat.ts';
import type { Intent, Side } from '../duel.ts';
import { PLAYER_WEAPONS, SKILL_MOVE, type OpponentId } from '../moves.ts';
import { fromBase64Url, MAX_RECORD_TICKS, packRecord, RECORD_VERSION, toBase64Url, unpackRecord } from '../record.ts';
import { delayFor, NET, pvpDuel, quantile, RollbackSession, type Kit, type NetMetrics, type NetPacket } from './rollback.ts';
import { viewAs } from './view.ts';

// On the wire a packet's intents ride the fight record's own 6-byte columns (record.ts packRecord, base64url): the bits a replay reads
// are the bits the peer stepped, and a packet of 15 unacked intents is about 210 characters instead of ~1.3 KB of JSON (the relay caps a room at 64 KB/s).
export type WirePacket = { f: number; a: number; h: [number, string] | null; i: string };
const HEADER = { v: RECORD_VERSION, build: '', opponent: 'pvp' as OpponentId, weapon: 'longsword', level: 1, seed: 0, outcome: 'draw' } as const;
export const packIntents = (intents: Intent[]): string => toBase64Url(packRecord({ ...HEADER, ticks: intents.length, intents }));
export const unpackIntents = (text: string): Intent[] => unpackRecord(fromBase64Url(text)).intents;
export const toWire = (p: NetPacket): WirePacket => ({ f: p.from, a: p.ack, h: p.hash, i: packIntents(p.intents) });
export const fromWire = (w: WirePacket): NetPacket => ({ from: w.f, ack: w.a, hash: w.h, intents: unpackIntents(w.i) });

// Every message names its room (`r`, the relay room both tokens share): a message for another duel is refused.
type Body =
  | { k: 'hello'; v: number; kit: Kit }
  | { k: 'ping'; n: number } | { k: 'pong'; n: number }
  | { k: 'go'; delay: number; kits: [Kit, Kit] }
  | { k: 'net'; p: WirePacket };
export type DuelMessage = Body & { r: string };

// The one door for anything a peer sends (Code Quality's gate 1, 2026-09-29): raw data from another machine becomes a DuelMessage or
// null, never an exception and never a half-read message. Over MESSAGE_CAP characters, another room, an unknown kind, a number that is
// not a small whole one, a delay outside the adaptive range, or intents the record columns cannot decode (an unknown action or guard
// side, a truncated column) are all refused. RollbackSession.accepts then checks the packet's ticks against this duel.
export const MESSAGE_CAP = 4096, INTENTS_CAP = 1024;   // characters: a whole message, and one packet's intent columns (64 intents ≈ 560)
const whole = (v: unknown, max: number): v is number => Number.isSafeInteger(v) && (v as number) >= 0 && (v as number) <= max;
// `raw`: the transport's text, or a message already parsed (the in-process tests' fake links).
export function parseMessage(raw: unknown, room: string): DuelMessage | null {
  try {
    if (typeof raw === 'string' && raw.length > MESSAGE_CAP) return null;
    const m: unknown = typeof raw === 'string' ? JSON.parse(raw) : raw;
    if (!m || typeof m !== 'object' || Array.isArray(m)) return null;
    const { k, r, v, n, delay, kits, kit, p } = m as Record<string, unknown>;
    if ((r ?? '') !== room) return null;
    if (k === 'hello') return whole(v, 255) ? { k, r: room, v, kit: cleanKit(kit as Partial<Kit>) } : null;
    if (k === 'ping' || k === 'pong') return whole(n, 1_000_000) ? { k, r: room, n } : null;
    if (k === 'go') {
      if (!whole(delay, NET.maxDelay) || delay < NET.delay || !Array.isArray(kits) || kits.length !== 2) return null;
      return { k, r: room, delay, kits: [cleanKit(kits[0] as Partial<Kit>), cleanKit(kits[1] as Partial<Kit>)] };
    }
    if (k !== 'net' || !p || typeof p !== 'object') return null;
    const { f, a, h, i } = p as Record<string, unknown>;
    if (!whole(f, MAX_RECORD_TICKS) || !whole(a, MAX_RECORD_TICKS) || typeof i !== 'string' || i.length > INTENTS_CAP || !/^[\w-]*$/.test(i)) return null;
    let hash: [number, string] | null = null;
    if (h !== null) {
      if (!Array.isArray(h) || h.length !== 2) return null;
      const [at, text]: unknown[] = h;
      if (!whole(at, MAX_RECORD_TICKS) || typeof text !== 'string' || !/^[0-9a-f]{16}$/.test(text)) return null;
      hash = [at, text];
    }
    if (unpackIntents(i).length > NET.redundancy) return null;   // throws on anything the record columns cannot decode: caught below
    return { k, r: room, p: { f, a, h: hash, i } };
  } catch { return null; }
}

// A peer's kit is data from another machine: an unknown weapon or skill becomes the plain longsword / none (the rig carries player
// weapons only), and gear keeps only well-formed ids (at most 16), so nothing a peer sends can break this page or bloat the record.
export function cleanKit(kit: Partial<Kit> | null | undefined): Kit {
  const weapon = kit?.weapon, skill = kit?.skill, gear: unknown = kit?.gear;
  return {
    weapon: weapon && PLAYER_WEAPONS.includes(weapon) ? weapon : 'longsword',
    skill: typeof skill === 'string' && Object.hasOwn(SKILL_MOVE, skill) ? skill : null,
    gear: Array.isArray(gear) ? gear.filter((id): id is string => typeof id === 'string' && /^[\w.-]{1,64}$/.test(id)).slice(0, 16) : [],
  };
}

// The PvP record (docs/duel-architecture.md §1): what the VPS verifier replays, both streams from pvpDuel(kits[0], kits[1]) on the
// record's version. Both kits ride it whole, gear included: that is where the Loadout lives (as the piece ids it is derived from).
export type PvpRecord = { v: number; build: string; delay: number; kits: [Kit, Kit]; ticks: number; intents: [string, string] };

export const PING = { every: 6, samples: 10, maxFrames: 300, hello: 30 };
export type Stage = 'waiting' | 'measuring' | 'fighting' | 'refused' | 'abandoned';
// Disconnects, backgrounding and pauses (Code Quality's gate 3; the rules are in #1110's body). A page that stops framing (tab hidden,
// journal open, graphics lost) is silent to its peer, like a lost link. The peer silent for `waitMs`: the page says so (the rollback
// window has already frozen the fight). Silent for `abandonMs` with nothing left to confirm here: the duel is abandoned, No contest,
// no result and no reward, and this page stops sending, so the other page abandons too. Heard again before that: the fight goes on.
export const SILENCE = { waitMs: 3000, abandonMs: 15000 };
const AI = initialAi(0);   // project() reads the opponent's AI mode for the HUD; a player has none, so a fixed one

export class PvpDuel {
  readonly side: Side; readonly kit: Kit;
  stage: Stage = 'waiting';
  refused: string | null = null;
  session: RollbackSession | null = null;
  practice: Practice;
  private readonly send: (m: Body) => void;
  private readonly now: () => number;
  private peerKit: Kit | null = null;
  private frames = 0; private measureFrom = 0;
  private readonly sentAt = new Map<number, number>(); private readonly rttMs: number[] = [];
  private heard = false;   // the challenger has the guest's first duel packet: `go` arrived, stop repeating it
  private goDelay = 0;
  kits: [Kit, Kit] | null = null;   // as agreed at `go`: the challenger's first, the guest's second

  readonly room: string;
  rejected = 0;   // peer messages refused by parseMessage or RollbackSession.accepts
  private lastHeard = 0;
  private finishTick: number | null = null;   // the confirmed tick at which the confirmed state first held the finish
  private latched = false;

  constructor(side: Side, kit: Kit, send: (m: DuelMessage) => void, now: () => number, room = '') {
    this.side = side; this.kit = cleanKit(kit); this.room = room; this.now = now;   // cleaned as the peer will clean it: both step one duel
    this.send = (m) => send({ ...m, r: room });
    this.practice = project(viewAs(pvpDuel(this.kit, this.kit), side), AI);   // the ring before the peer arrives: both on this side's kit
  }

  // Everything both sides confirmed, for the verifier (§1) and the duel's share: null before the duel starts.
  record(build: string): PvpRecord | null {
    if (!this.session || !this.kits) return null;
    const { log, confirmed } = this.session;
    return { v: RECORD_VERSION, build, delay: this.goDelay, kits: this.kits, ticks: confirmed, intents: [packIntents(log[0]), packIntents(log[1])] };
  }
  // The finish is settled: it is in the confirmed state (both real intents, so no rollback can take it back) AND the peer has acked this
  // side's intents through that tick, so the peer holds everything it needs to confirm the same finish with no further packet. Latched.
  // Not "confirmed up to the present tick": the side that started first leads its peer by a few frames all duel, so that never holds.
  // (One gap no two-party protocol closes: a link that dies one way inside that last round trip leaves one page settled and the other
  // abandoned. The verifier's replay of both streams is the authority for results; PVP_REWARDS stays false until it is.)
  get settled(): boolean {
    const s = this.session;
    if (this.latched || !s) return this.latched;
    if (this.finishTick === null && s.confirmedDuel().finish) this.finishTick = s.confirmed;
    return this.latched = this.finishTick !== null && s.acked >= this.finishTick;
  }
  // The peer has been silent long enough for the page to say so.
  get silent(): boolean { return this.stage === 'fighting' && this.now() - this.lastHeard > SILENCE.waitMs; }
  metrics(): NetMetrics | null { return this.session?.metrics() ?? null; }

  // Raw data from the transport: parsed and checked here; anything refused changes nothing but the `rejected` count.
  receive(raw: unknown): void {
    if (this.stage === 'refused' || this.stage === 'abandoned') return;
    const m = parseMessage(raw, this.room);
    const packet = m?.k === 'net' && this.session ? fromWire(m.p) : null;
    if (!m || (packet && !this.session!.accepts(packet))) { this.rejected++; return; }
    this.lastHeard = this.now();
    if (m.k === 'hello') {
      if (m.v !== RECORD_VERSION) { this.refuse(m.v > RECORD_VERSION ? 'Your opponent is on a newer build: reload the page' : 'Your opponent is on an older build: ask them to reload'); return; }
      this.peerKit ??= cleanKit(m.kit);
      if (this.side === 0 && this.stage === 'waiting') { this.stage = 'measuring'; this.measureFrom = this.frames; }
    } else if (m.k === 'ping') this.send({ k: 'pong', n: m.n });
    else if (m.k === 'pong') { const at = this.sentAt.get(m.n); if (at !== undefined) { this.sentAt.delete(m.n); this.rttMs.push(this.now() - at); } }
    else if (m.k === 'go') { if (this.side === 1 && !this.session) this.start(m.delay, [m.kits[0], this.kit]); }   // our own kit as we sent it, never as echoed
    else if (packet) { this.heard = true; this.session!.receive(packet); }
  }

  // One 60 Hz tick: the lobby's repeats and pings, or one rollback frame. Returns the practice to draw.
  frame(intent: Intent): Practice {
    this.frames++;
    if (this.stage === 'refused' || this.stage === 'abandoned') return this.quiet();
    if (this.stage !== 'fighting' && this.frames % PING.hello === 1) this.send({ k: 'hello', v: RECORD_VERSION, kit: this.kit });
    if (this.stage === 'measuring') this.measure();
    const session = this.session;
    if (!session) return this.quiet();
    if (this.side === 0 && !this.heard) this.send({ k: 'go', delay: this.goDelay, kits: [this.kit, this.peerKit!] });
    const { advanced, depth } = session.frame(intent);
    this.send({ k: 'net', p: toWire(session.outgoing()) });
    // Silence: abandoned only once nothing is left to confirm here (a finish the peer's intents already decide still settles first).
    if (!this.settled && this.now() - this.lastHeard > SILENCE.abandonMs && session.known <= session.confirmed) { this.stage = 'abandoned'; return this.quiet(); }
    // Predicted vs confirmed (Code Quality's gate 2): bodies move on the predicted state, so this side's own presses answer at once, but
    // every event the page sounds or shows (hits, blood, numbers, the finisher's trigger) is a CONFIRMED tick's. A kill that is only
    // predicted is held at the confirmed state until the peer's intents confirm or undo it: no finisher plays for a kill a rollback takes back.
    const events = session.takeConfirmedEvents(), confirmed = session.confirmedDuel();
    const shown = session.duel.finish && !confirmed.finish ? confirmed : session.duel;
    if (!advanced && !depth && !events.length) return this.quiet();
    return this.practice = project(viewAs({ ...shown, events }, this.side), AI, this.practice);
  }

  private quiet(): Practice { return this.practice.events.length ? this.practice = { ...this.practice, events: [] } : this.practice; }

  private measure(): void {
    const since = this.frames - this.measureFrom;
    if (this.rttMs.length >= PING.samples || (since >= PING.maxFrames && this.rttMs.length)) {
      this.goDelay = delayFor(quantile(this.rttMs, 0.9) * 60 / 1000);
      this.start(this.goDelay, [this.kit, this.peerKit!]);
      return;
    }
    if (since % PING.every === 0) { const n = since / PING.every; this.sentAt.set(n, this.now()); this.send({ k: 'ping', n }); }
  }

  private start(delay: number, kits: [Kit, Kit]): void {
    this.goDelay = delay; this.kits = kits; this.lastHeard = this.now();
    this.session = new RollbackSession(this.side, pvpDuel(kits[0], kits[1]), delay);
    this.stage = 'fighting';
    this.practice = project(viewAs(this.session.duel, this.side), AI);
  }

  private refuse(why: string): void {
    this.stage = 'refused'; this.refused = why;
    this.send({ k: 'hello', v: RECORD_VERSION, kit: this.kit });   // the other page refuses too, on the same check
  }
}
