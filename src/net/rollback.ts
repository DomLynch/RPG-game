// Rollback core for live PvP (docs/duel-architecture.md §3, §5). Both phones run the whole duel: each schedules its own quantized
// intent `delay` ticks ahead, predicts the peer's (the last known intent with the edge-triggered press cleared), and when the real one
// arrives and differs, restores the snapshot before that tick and re-steps to the present. No transport, clock or DOM here: the caller
// calls frame() once per 60 Hz tick and moves packets; the fake-link test (tests/net-rollback.test.ts) drives two sessions in one process.
// Snapshots are the Duel objects stepDuel returned: it never writes into its input (tests/net-determinism.test.ts freezes it to prove it).
// Nothing in the fight imports this file; single-player never reaches it.
import { createFighter, idleIntent, stepDuel, type Duel, type Intent, type Side } from '../duel.ts';
import { quantizeIntent } from '../record.ts';
import { initialState, TARGET } from '../sim.ts';
import type { SkillId, WeaponId } from '../moves.ts';

export const NET = { delay: 2, maxRollback: 8, hashEvery: 30, redundancy: 64 };

// Two men, both sheathed: the challenger (side 0) where the player stands, the guest (side 1) where the opponent stands.
export type Kit = { weapon: WeaponId; skill: SkillId | null };
export const pvpDuel = (a: Kit = { weapon: 'longsword', skill: null }, b: Kit = { weapon: 'longsword', skill: null }): Duel => ({
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

export type NetStats = { rollbacks: number; resimTicks: number; maxDepth: number; depths: number[]; stalls: number; desyncs: number[] };

export class RollbackSession {
  readonly side: Side; readonly peer: Side; readonly delay: number; readonly maxRollback: number;
  duel: Duel;
  confirmed = 0;          // every tick up to here was stepped on both real intents
  readonly log: [Intent[], Intent[]] = [[], []];   // both sides' real intents for ticks 1..confirmed (index tick - 1): the PvP record
  readonly hashes = new Map<number, string>();     // confirmed fingerprints every NET.hashEvery ticks
  readonly stats: NetStats = { rollbacks: 0, resimTicks: 0, maxDepth: 0, depths: [], stalls: 0, desyncs: [] };
  private readonly inputs: [Map<number, Intent>, Map<number, Intent>] = [new Map(), new Map()];   // by the tick they step INTO
  private readonly used = new Map<number, Intent>();    // the peer intent each stepped tick used, real or predicted
  private readonly states = new Map<number, Duel>();    // snapshots by tick, from `confirmed` on
  private readonly peerHashes = new Map<number, string>();
  private localNext: number;   // the tick the next local intent is scheduled for
  private peerKnown: number;   // the peer's intents are known for every tick up to here
  private peerAcked: number;   // the peer has every one of ours up to here
  private dirty: number | null = null;   // the earliest stepped tick whose predicted peer intent was wrong

  constructor(side: Side, initial: Duel, delay = NET.delay, maxRollback = NET.maxRollback) {
    this.side = side; this.peer = side === 0 ? 1 : 0; this.delay = delay; this.maxRollback = maxRollback;
    this.duel = initial; this.states.set(initial.tick, initial);
    // The first `delay` ticks carry no press on either side: both peers know that without a packet.
    for (let t = 1; t <= delay; t++) { this.inputs[0].set(t, idleIntent()); this.inputs[1].set(t, idleIntent()); }
    this.localNext = delay + 1; this.peerKnown = delay; this.peerAcked = delay;
  }

  // One 60 Hz frame: schedule this frame's local intent, repair any misprediction, and step one tick when the window allows.
  // `stalled`: the peer is more than maxRollback ticks behind, so this side waits rather than predict further (the lookahead bound, §6).
  frame(intent: Intent): { advanced: boolean; depth: number } {
    if (this.localNext <= this.duel.tick + 1 + this.delay) this.inputs[this.side].set(this.localNext++, quantizeIntent(intent));
    const depth = this.repair();
    const next = this.duel.tick + 1;
    if (next - this.peerKnown > this.maxRollback || !this.inputs[this.side].has(next)) { this.stats.stalls++; return { advanced: false, depth }; }
    this.step(next);
    this.confirm();
    return { advanced: true, depth };
  }

  receive(packet: NetPacket): void {
    this.peerAcked = Math.max(this.peerAcked, packet.ack);
    packet.intents.forEach((intent, i) => {
      const t = packet.from + i, known = this.inputs[this.peer];
      if (t <= this.peerKnown || known.has(t)) return;
      known.set(t, intent);
      const used = this.used.get(t);
      if (used && !sameIntent(used, intent)) this.dirty = this.dirty === null ? t : Math.min(this.dirty, t);
    });
    while (this.inputs[this.peer].has(this.peerKnown + 1)) this.peerKnown++;
    if (packet.hash) { this.peerHashes.set(packet.hash[0], packet.hash[1]); this.checkHash(packet.hash[0]); }
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
      if (t % NET.hashEvery === 0) { this.hashes.set(t, hashDuel(this.states.get(t)!)); this.checkHash(t); }
      this.states.delete(t - 1); this.used.delete(t); this.inputs[0].delete(t - 1); this.inputs[1].delete(t - 1);
    }
    this.confirmed = Math.max(this.confirmed, upTo);
  }

  private checkHash(t: number): void {
    const mine = this.hashes.get(t), theirs = this.peerHashes.get(t);
    if (mine && theirs && mine !== theirs && !this.stats.desyncs.includes(t)) this.stats.desyncs.push(t);
  }
}
