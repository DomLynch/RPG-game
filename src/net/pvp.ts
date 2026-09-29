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
import { fromBase64Url, packRecord, RECORD_VERSION, toBase64Url, unpackRecord } from '../record.ts';
import { delayFor, pvpDuel, quantile, RollbackSession, type Kit, type NetMetrics, type NetPacket } from './rollback.ts';
import { viewAs } from './view.ts';

// On the wire a packet's intents ride the fight record's own 6-byte columns (record.ts packRecord, base64url): the bits a replay reads
// are the bits the peer stepped, and a packet of 15 unacked intents is about 210 characters instead of ~1.3 KB of JSON (the relay caps a room at 64 KB/s).
export type WirePacket = { f: number; a: number; h: [number, string] | null; i: string };
const HEADER = { v: RECORD_VERSION, build: '', opponent: 'pvp' as OpponentId, weapon: 'longsword', level: 1, seed: 0, outcome: 'draw' } as const;
export const packIntents = (intents: Intent[]): string => toBase64Url(packRecord({ ...HEADER, ticks: intents.length, intents }));
export const unpackIntents = (text: string): Intent[] => unpackRecord(fromBase64Url(text)).intents;
export const toWire = (p: NetPacket): WirePacket => ({ f: p.from, a: p.ack, h: p.hash, i: packIntents(p.intents) });
export const fromWire = (w: WirePacket): NetPacket => ({ from: w.f, ack: w.a, hash: w.h, intents: unpackIntents(w.i) });

export type DuelMessage =
  | { k: 'hello'; v: number; kit: Kit }
  | { k: 'ping'; n: number } | { k: 'pong'; n: number }
  | { k: 'go'; delay: number; kits: [Kit, Kit] }
  | { k: 'net'; p: WirePacket };

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
export type Stage = 'waiting' | 'measuring' | 'fighting' | 'refused';
const AI = initialAi(0);   // project() reads the opponent's AI mode for the HUD; a player has none, so a fixed one

export class PvpDuel {
  readonly side: Side; readonly kit: Kit;
  stage: Stage = 'waiting';
  refused: string | null = null;
  session: RollbackSession | null = null;
  practice: Practice;
  private readonly send: (m: DuelMessage) => void;
  private readonly now: () => number;
  private peerKit: Kit | null = null;
  private frames = 0; private measureFrom = 0;
  private readonly sentAt = new Map<number, number>(); private readonly rttMs: number[] = [];
  private heard = false;   // the challenger has the guest's first duel packet: `go` arrived, stop repeating it
  private goDelay = 0;
  kits: [Kit, Kit] | null = null;   // as agreed at `go`: the challenger's first, the guest's second

  constructor(side: Side, kit: Kit, send: (m: DuelMessage) => void, now: () => number) {
    this.side = side; this.kit = cleanKit(kit); this.send = send; this.now = now;   // cleaned as the peer will clean it: both step one duel
    this.practice = project(viewAs(pvpDuel(this.kit, this.kit), side), AI);   // the ring before the peer arrives: both on this side's kit
  }

  // Everything both sides confirmed, for the verifier (§1) and the duel's share: null before the duel starts.
  record(build: string): PvpRecord | null {
    if (!this.session || !this.kits) return null;
    const { log, confirmed } = this.session;
    return { v: RECORD_VERSION, build, delay: this.goDelay, kits: this.kits, ticks: confirmed, intents: [packIntents(log[0]), packIntents(log[1])] };
  }
  // The finish is settled: it is in the confirmed state (both real intents), so no rollback can take it back. Not "confirmed up to the
  // present tick": the side that started first leads its peer by a few frames for the whole duel, so that would never hold.
  get settled(): boolean { return !!this.session?.confirmedDuel().finish; }
  metrics(): NetMetrics | null { return this.session?.metrics() ?? null; }

  receive(m: DuelMessage): void {
    if (this.stage === 'refused') return;
    if (m.k === 'hello') {
      if (m.v !== RECORD_VERSION) { this.refuse(m.v > RECORD_VERSION ? 'Your opponent is on a newer build: reload the page' : 'Your opponent is on an older build: ask them to reload'); return; }
      this.peerKit ??= cleanKit(m.kit);
      if (this.side === 0 && this.stage === 'waiting') { this.stage = 'measuring'; this.measureFrom = this.frames; }
    } else if (m.k === 'ping') this.send({ k: 'pong', n: m.n });
    else if (m.k === 'pong') { const at = this.sentAt.get(m.n); if (at !== undefined) { this.sentAt.delete(m.n); this.rttMs.push(this.now() - at); } }
    else if (m.k === 'go') { if (this.side === 1 && !this.session) this.start(m.delay, [cleanKit(m.kits?.[0]), this.kit]); }   // our own kit as we sent it, never as echoed
    else if (m.k === 'net' && this.session) { this.heard = true; this.session.receive(fromWire(m.p)); }
  }

  // One 60 Hz tick: the lobby's repeats and pings, or one rollback frame. Returns the practice to draw (its events only this tick's).
  frame(intent: Intent): Practice {
    this.frames++;
    if (this.stage === 'refused') return this.quiet();
    if (this.stage !== 'fighting' && this.frames % PING.hello === 1) this.send({ k: 'hello', v: RECORD_VERSION, kit: this.kit });
    if (this.stage === 'measuring') this.measure();
    const session = this.session;
    if (!session) return this.quiet();
    if (this.side === 0 && !this.heard) this.send({ k: 'go', delay: this.goDelay, kits: [this.kit, this.peerKit!] });
    const before = session.duel, { depth } = session.frame(intent);
    this.send({ k: 'net', p: toWire(session.outgoing()) });
    // A rollback re-steps ticks already drawn; only the present tick's events are shown (a blow undone by a repair is not sounded twice).
    return this.practice = session.duel === before && !depth ? this.quiet() : project(viewAs(session.duel, this.side), AI, this.practice);
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
    this.goDelay = delay; this.kits = kits;
    this.session = new RollbackSession(this.side, pvpDuel(kits[0], kits[1]), delay);
    this.stage = 'fighting';
    this.practice = project(viewAs(this.session.duel, this.side), AI);
  }

  private refuse(why: string): void {
    this.stage = 'refused'; this.refused = why;
    this.send({ k: 'hello', v: RECORD_VERSION, kit: this.kit });   // the other page refuses too, on the same check
  }
}
