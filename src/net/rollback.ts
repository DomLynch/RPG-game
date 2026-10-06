// Rollback core for live PvP (docs/duel-architecture.md §3, §5). Both phones run the whole duel: each schedules its own quantized
// intent `delay` ticks ahead, predicts the peer's (the last known intent with the edge-triggered press cleared), and when the real one
// arrives and differs, restores the snapshot before that tick and re-steps to the present. No transport, clock or DOM here: the caller
// calls frame() once per 60 Hz tick and moves packets; the fake-link test (tests/net-rollback.test.ts) drives two sessions in one process.
// Snapshots are the Duel objects stepDuel returned: it never writes into its input (tests/net-determinism.test.ts freezes it to prove it).
// Nothing in the fight imports this file; single-player never reaches it.
import { createFighter, idleIntent, stepDuel, type CombatEvent, type Duel, type Intent, type Side } from '../duel.ts';
import { quantizeIntent } from '../record.ts';
import { initialState, TARGET } from '../sim.ts';
import { setPlayScale } from '../play-radius.ts';
import type { SkillId, WeaponId } from '../moves.ts';

// delay: the starting input delay, the same on both sides (the first `delay` ticks are idle by agreement). maxDelay: the ceiling the
// adaptive delay may climb to when the link is slow; past it the session stalls rather than lag further (§3).
export const NET = { delay: 2, maxDelay: 12, maxRollback: 8, hashEvery: 30, redundancy: 64, rttSamples: 120 };

// Two men, both sheathed: the challenger (side 0) where the player stands, the guest (side 1) where the opponent stands.
// `gear`: the equipped piece ids (loot.ts LootId, as text: src/net never imports loot.ts). Duels are gear-based at full power inside the
// gear-stats caps (Dom 2026-09-29 via Lead), so both kits ride the handshake and the PvP record whole (pvp.ts PvpRecord), and the verifier
// re-derives each side's Loadout from these ids itself (gear-stats.ts), never from a number a client sent. The v20 sim steps gear-neutral:
// pvpDuel ignores `gear` until brief 19 d5 wires a Loadout into stepDuel, and the record needs no second format then.
export type Kit = { weapon: WeaponId; skill: SkillId | null; gear?: readonly string[] };
export const pvpDuel = (a: Kit = { weapon: 'longsword', skill: null }, b: Kit = { weapon: 'longsword', skill: null }): Duel => (setPlayScale(1), {   // PvP is not Arena 1: both peers and the verifier pin the original circle at duel start, whatever the page's last Match left (play-radius.ts)
  tick: 0, finish: null, events: [],
  fighters: [{ ...createFighter(initialState(), 'sheathed', a.weapon), skill: a.skill }, { ...createFighter({ ...TARGET, heading: 0, distance: 0 }, 'sheathed', b.weapon), skill: b.skill }],
});

// The desync check's fingerprint: FNV-1a over the canonical JSON of the state, two 32-bit lanes (64 bits, hex). JSON.stringify's number
// text is exactly specified by ECMAScript and both peers build the state through the same code, so equal states give equal strings.
export const hashDuel = (duel: Duel): string => fnv64(JSON.stringify({ t: duel.tick, f: duel.fighters, x: duel.finish }));
export function fnv64(text: string): string {
  let a = 0x811c9dc5, b = 0x5bd1e995;
  for (let i = 0; i < text.length; i++) {
    const c = text.charCodeAt(i);
    a = Math.imul(a ^ c, 0x01000193) >>> 0;
    b = Math.imul(b ^ c, 0x01000195) >>> 0;
  }
  return a.toString(16).padStart(8, '0') + b.toString(16).padStart(8, '0');
}

export const sameIntent = (a: Intent, b: Intent): boolean =>
  a.move.x === b.move.x && a.move.z === b.move.z && a.move.yaw === b.move.yaw && !!a.move.run === !!b.move.run && a.action === b.action
  && !!a.guard === !!b.guard && !!a.lock === !!b.lock && !!a.held === !!b.held && !!a.cancel === !!b.cancel && (a.guardDirection ?? null) === (b.guardDirection ?? null);

// The peer's intent for a tick not yet heard: the last one heard, holding its levels (stick, guard, hold, lock) and dropping its
// edges (a press and a cancel happen once; repeating them would invent presses the peer never made).
const predictFrom = (last: Intent): Intent => {
  const out: Intent = { move: last.move, action: null, guard: last.guard, lock: last.lock };
  if (last.held) out.held = true;
  if (last.guardDirection) out.guardDirection = last.guardDirection;
  return out;
};

// On the wire: this side's intents from tick `from` on (every one the peer has not acked: redundancy instead of retransmits), the
// highest tick of the peer's this side has contiguously, and this side's latest confirmed fingerprint.
export type NetPacket = { from: number; intents: Intent[]; ack: number; hash: [number, string] | null };

export type NetStats = { rollbacks: number; resimTicks: number; maxDepth: number; depths: number[]; stalls: number; desyncs: number[]; maxDelay: number; frames: number };

export type NetMetrics = { tooSlow: boolean; frames: number; rollbacksPerMin: number; depthP95: number; maxDepth: number; stallsPerMin: number; delay: number; maxDelay: number; rttP50Ms: number; rttP95Ms: number; desyncs: number };
// "Playable" (Lead, 2026-09-29), the fake-link bar and the go/no-go row, met at 250 ms ROUND TRIP + 30 ms jitter + 10 % loss (Lead's
// ruling: the Dubai→Germany→Dubai relay case): the fight rarely freezes (under a second of stalls a minute), the input lag stays under
// 200 ms (maxDelay 12), and rollbacks stay inside the window at the 95th percentile. Slower links are reported, not held to it: the
// session says `tooSlow` (the page shows "connection too slow") and degrades by stalling, never by desyncing or lagging past the cap.
export const PLAYABLE = { stallsPerMin: 60, maxDelay: NET.maxDelay, depthP95: NET.maxRollback };
export const playable = (m: NetMetrics): boolean => m.stallsPerMin <= PLAYABLE.stallsPerMin && m.maxDelay <= PLAYABLE.maxDelay && m.depthP95 <= PLAYABLE.depthP95;

// The input delay a round trip needs (frames, 90th percentile): the peer's intent for tick T leaves it `delay` ticks before T and lands a
// one-way trip later, and this side predicts at most maxRollback ticks past what it knows, so no stall needs oneWay + 1 - maxRollback,
// +1 for jitter. The lobby calls it on its pre-duel pings so both sides start at the delay the link needs (the first ticks are idle by
// agreement, so both must pass the same value); adapt() keeps calling it during the duel.
export const neededDelay = (rttFrames: number, maxRollback = NET.maxRollback): number => Math.ceil(rttFrames / 2) + 2 - maxRollback;
export const delayFor = (rttFrames: number, maxRollback = NET.maxRollback): number => Math.max(NET.delay, Math.min(NET.maxDelay, neededDelay(rttFrames, maxRollback)));

// The p-th fraction of a sample (nearest rank), 0 when empty.
export const quantile = (values: number[], p: number): number => {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.min(sorted.length - 1, Math.max(0, Math.ceil(p * sorted.length) - 1))];
};

export class RollbackSession {
  readonly side: Side; readonly peer: Side; readonly maxRollback: number;
  delay: number;          // the current input delay in ticks: adapted to the measured round trip (adapt())
  duel: Duel;
  confirmed = 0;          // every tick up to here was stepped on both real intents
  readonly log: [Intent[], Intent[]] = [[], []];   // both sides' real intents for ticks 1..confirmed (index tick - 1): the PvP record
  readonly hashes = new Map<number, string>();     // confirmed fingerprints every NET.hashEvery ticks
  readonly stats: NetStats = { rollbacks: 0, resimTicks: 0, maxDepth: 0, depths: [], stalls: 0, desyncs: [], maxDelay: 0, frames: 0 };
  readonly rtt: number[] = [];   // recent round trips in frames: an intent scheduled here until the peer's ack of it arrived
  private readonly inputs: [Map<number, Intent>, Map<number, Intent>] = [new Map(), new Map()];   // by the tick they step INTO
  private readonly used = new Map<number, Intent>();    // the peer intent each stepped tick used, real or predicted
  private readonly states = new Map<number, Duel>();    // snapshots by tick, from `confirmed` on
  private readonly peerHashes = new Map<number, string>();
  agreed = 0;   // newest confirmed checkpoint whose fingerprint matches the peer's
  finishedAt: number | null = null;   // the first confirmed tick whose state holds the finish: the same tick on both pages, however late each one notices (confirmed jumps)
  private localNext: number;   // the tick the next local intent is scheduled for
  private peerKnown: number;   // the peer's intents are known for every tick up to here
  private peerAcked: number;   // the peer has every one of ours up to here
  private dirty: number | null = null;   // the earliest stepped tick whose predicted peer intent was wrong
  private readonly scheduledAt = new Map<number, number>();   // the frame each local tick was scheduled on (for the round trip)
  private pending: Intent | null = null;   // a press this side could not schedule yet (a stall, or the delay just shrank): it rides the next tick
  private steady = 0;   // frames the measured round trip has asked for less delay than the current one
  tooSlow = false;       // the measured round trip needs the whole NET.maxDelay or more: the page says "connection too slow" (it still plays)
  private fresh: CombatEvent[] = [];   // events of ticks confirmed since the last takeConfirmedEvents(): the only ones the page may sound or show

  constructor(side: Side, initial: Duel, delay = NET.delay, maxRollback = NET.maxRollback) {
    this.side = side; this.peer = side === 0 ? 1 : 0; this.delay = delay; this.maxRollback = maxRollback;
    this.duel = initial; this.states.set(initial.tick, initial);
    // The first `delay` ticks carry no press on either side: both peers know that without a packet.
    for (let t = 1; t <= delay; t++) { this.inputs[0].set(t, idleIntent()); this.inputs[1].set(t, idleIntent()); }
    this.localNext = delay + 1; this.peerKnown = delay; this.peerAcked = delay; this.stats.maxDelay = delay;
  }

  // The newest state stepped on both real intents: no rollback can change it, so a finish here is final. (The present state is ahead of
  // it by the one-way trip whenever this side leads, which with a peer that started a few frames later is always.)
  confirmedDuel(): Duel { return this.states.get(this.confirmed)!; }
  // The peer's intents are known up to here, and the peer has this side's up to here (from its ack).
  get known(): number { return this.peerKnown; }
  get acked(): number { return this.peerAcked; }
  // Events of the ticks confirmed since the last call, in tick order: sounds, blood, numbers and finishers come only from these, never
  // from a predicted tick a rollback could take back (Code Quality's gate 2, 2026-09-29).
  takeConfirmedEvents(): CombatEvent[] { const out = this.fresh; this.fresh = []; return out; }

  // One duel's row for duel_metrics (§8): per minute of frames, so a stalled minute counts as a minute.
  metrics(): NetMetrics {
    const minutes = Math.max(1, this.stats.frames) / 3600, depths: number[] = [];
    this.stats.depths.forEach((n, depth) => { for (let i = 0; i < (n ?? 0); i++) depths.push(depth); });
    return {
      tooSlow: this.tooSlow, frames: this.stats.frames, rollbacksPerMin: this.stats.rollbacks / minutes, depthP95: quantile(depths, 0.95), maxDepth: this.stats.maxDepth,
      stallsPerMin: this.stats.stalls / minutes, delay: this.delay, maxDelay: this.stats.maxDelay,
      rttP50Ms: quantile(this.rtt, 0.5) * 1000 / 60, rttP95Ms: quantile(this.rtt, 0.95) * 1000 / 60, desyncs: this.stats.desyncs.length,
    };
  }

  // One 60 Hz frame: schedule this frame's local intent, repair any misprediction, and step one tick when the window allows.
  // `stalled`: the peer is more than maxRollback ticks behind, so this side waits rather than predict further (the lookahead bound, §6).
  frame(intent: Intent): { advanced: boolean; depth: number } {
    this.stats.frames++;
    this.adapt();
    this.schedule(intent);
    const depth = this.repair();
    const next = this.duel.tick + 1;
    if (next - this.peerKnown > this.maxRollback || !this.inputs[this.side].has(next)) { this.stats.stalls++; return { advanced: false, depth }; }
    this.step(next);
    this.confirm();
    return { advanced: true, depth };
  }

  // A packet that could not have come from a peer running this code is refused whole, with nothing changed (Code Quality's gate 1):
  // ticks not whole numbers, more intents than one packet carries, a start past the first tick this side has not heard (the peer always
  // repeats from what it last heard acked), intents further ahead than the lookahead lets a peer schedule, an ack of a tick this side
  // never sent, or a malformed fingerprint. The wire layer (pvp.ts) has already refused unknown actions and oversized messages.
  accepts(packet: NetPacket): boolean {
    const { from, intents, ack, hash } = packet, tick = (v: unknown): v is number => Number.isSafeInteger(v) && (v as number) >= 0;
    if (!tick(from) || from < 1 || !tick(ack) || !Array.isArray(intents) || intents.length > NET.redundancy) return false;
    if (from > this.peerKnown + 1 || from + intents.length - 1 > this.localNext + this.maxRollback + NET.maxDelay || ack >= this.localNext) return false;
    return hash === null || (Array.isArray(hash) && hash.length === 2 && tick(hash[0]) && hash[0] % NET.hashEvery === 0 && typeof hash[1] === 'string' && /^[0-9a-f]{16}$/.test(hash[1]));
  }

  receive(packet: NetPacket): boolean {
    if (!this.accepts(packet)) return false;
    if (packet.ack > this.peerAcked) {
      const at = this.scheduledAt.get(packet.ack);
      if (at !== undefined) { this.rtt.push(this.stats.frames - at); if (this.rtt.length > NET.rttSamples) this.rtt.shift(); }
      for (let t = this.peerAcked; t <= packet.ack; t++) this.scheduledAt.delete(t);
      this.peerAcked = packet.ack;
    }
    packet.intents.forEach((intent, i) => {
      const t = packet.from + i, known = this.inputs[this.peer];
      if (t <= this.peerKnown || known.has(t)) return;
      known.set(t, intent);
      const used = this.used.get(t);
      if (used && !sameIntent(used, intent)) this.dirty = this.dirty === null ? t : Math.min(this.dirty, t);
    });
    while (this.inputs[this.peer].has(this.peerKnown + 1)) this.peerKnown++;
    if (packet.hash) { this.peerHashes.set(packet.hash[0], packet.hash[1]); this.checkHash(packet.hash[0]); }
    return true;
  }

  outgoing(): NetPacket {
    const from = this.peerAcked + 1, intents: Intent[] = [], mine = this.inputs[this.side];
    // A tick confirmed here may still be unacked there (its packet was lost): the log keeps what confirm() pruned from the map.
    for (let t = from; t < this.localNext && intents.length < NET.redundancy; t++) intents.push(mine.get(t) ?? this.log[this.side][t - 1]!);
    let hash: [number, string] | null = null;
    const last = this.confirmed - (this.confirmed % NET.hashEvery);
    if (last > 0 && this.hashes.has(last)) hash = [last, this.hashes.get(last)!];
    return { from, intents, ack: this.peerKnown, hash };
  }

  // This frame's intent goes to the next free tick, `delay` ahead. When the delay just grew, the ticks it opened carry this intent's
  // levels without its press (the press happens once). When nothing can be scheduled (a stall, a shrinking delay), a press waits in
  // `pending` for the next tick instead of being lost.
  private schedule(intent: Intent): void {
    const merged: Intent = { ...intent };
    if (!merged.action && this.pending?.action) merged.action = this.pending.action;
    if (this.pending?.cancel) merged.cancel = true;
    if (this.localNext > this.duel.tick + 1 + this.delay) { if (merged.action || merged.cancel) this.pending = merged; return; }
    this.pending = null;
    const q = quantizeIntent(merged), mine = this.inputs[this.side];
    mine.set(this.localNext, q); this.scheduledAt.set(this.localNext++, this.stats.frames);
    for (const fill = predictFrom(q); this.localNext <= this.duel.tick + 1 + this.delay;) { mine.set(this.localNext, fill); this.scheduledAt.set(this.localNext++, this.stats.frames); }
  }

  // Follow the measured round trip: rise at once (every frame, as soon as eight samples exist), fall one tick after two seconds of
  // asking for less, so a jitter spike does not see-saw the delay.
  private adapt(): void {
    if (this.rtt.length < 8) return;
    const rtt = quantile(this.rtt, 0.9), want = delayFor(rtt, this.maxRollback);
    this.tooSlow = neededDelay(rtt, this.maxRollback) >= NET.maxDelay;   // at the cap: no headroom left for jitter
    if (want > this.delay) { this.delay = want; this.steady = 0; }
    else if (want < this.delay) { if (++this.steady >= 120) { this.delay--; this.steady = 0; } }
    else this.steady = 0;
    this.stats.maxDelay = Math.max(this.stats.maxDelay, this.delay);
  }

  private peerIntent(t: number): Intent {
    const known = this.inputs[this.peer].get(t);
    if (known) return known;
    for (let s = t - 1; s >= 1; s--) { const last = this.inputs[this.peer].get(s); if (last) return predictFrom(last); }
    return idleIntent();
  }

  private step(t: number): void {
    const peer = this.peerIntent(t), mine = this.inputs[this.side].get(t)!;
    this.used.set(t, peer);
    this.duel = stepDuel(this.duel, this.side === 0 ? [mine, peer] : [peer, mine]);
    this.states.set(t, this.duel);
  }

  // Restore the snapshot before the first wrong tick and re-step to the present on the intents known now.
  private repair(): number {
    if (this.dirty === null) return 0;
    const from = this.dirty, to = this.duel.tick, depth = to - from + 1;
    this.dirty = null;
    this.duel = this.states.get(from - 1)!;
    for (let t = from; t <= to; t++) this.step(t);
    this.stats.rollbacks++; this.stats.resimTicks += depth; this.stats.maxDepth = Math.max(this.stats.maxDepth, depth);
    this.stats.depths[depth] = (this.stats.depths[depth] ?? 0) + 1;
    return depth;
  }

  // Ticks stepped on both real intents become final: logged, fingerprinted, and their older snapshots dropped.
  private confirm(): void {
    const upTo = Math.min(this.peerKnown, this.duel.tick);
    if (this.dirty !== null) return;
    for (let t = this.confirmed + 1; t <= upTo; t++) {
      this.log[0].push(this.inputs[0].get(t)!); this.log[1].push(this.inputs[1].get(t)!);
      this.fresh.push(...this.states.get(t)!.events);
      if (this.finishedAt === null && this.states.get(t)!.finish) this.finishedAt = t;
      if (t % NET.hashEvery === 0) { this.hashes.set(t, hashDuel(this.states.get(t)!)); this.checkHash(t); }
      this.states.delete(t - 1); this.used.delete(t); this.inputs[0].delete(t - 1); this.inputs[1].delete(t - 1);
    }
    this.confirmed = Math.max(this.confirmed, upTo);
  }

  private checkHash(t: number): void {
    const mine = this.hashes.get(t), theirs = this.peerHashes.get(t);
    if (mine && theirs) {
      if (mine === theirs) this.agreed = Math.max(this.agreed, t);
      else if (!this.stats.desyncs.includes(t)) this.stats.desyncs.push(t);
    }
  }
}
