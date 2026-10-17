// Layers and spatial interest management (docs/specs/origins/one-shard.md §2, §4, §5). Pure: no sockets, no clock of its own, so the rules are
// testable and the load test can drive them. All numbers are the note's *est.* planning figures until the load test replaces them.
import { ENTITY_BYTES, HEAD_BYTES, encodeDown, type Entity, type Pose } from './wire.ts';
import { interestRules } from './presence-rules.ts';
import type { Worn } from '../server/location.ts';
import { LEGACY_SHIFT_CM, SPAWN, TOWN_CM, clearOfTradeAreas, inTownSquare, walkable, zoneRowAt, type ZoneRow } from './zones.ts';

export const RULES = interestRules();
export type Rules = ReturnType<typeof interestRules>;

// legacy: a v1 client (town square only, old frame): clamped to the square, sees only the square, and is sent the old frame (the shim; docs/specs/origins/frontier-presence.md §5). zone: its zone row, kept current by every accepted pose.
export type Player = Pose & { id: number; account: string; layer: Layer; tick: number; movedAt: number; credit: number; seenAt: number; strikes: number; strikeAt: number; legacy: boolean; zone: ZoneRow | null;
  name: string | null; guest: boolean;   // the name tag the page draws (null: none known; guests carry no name)
  worn: Worn;   // {slot: lootId} the writer reads from the ledger for the active character, what others see on it (a guest wears nothing: {})
  told: Map<number, string>; sees: Set<number>;   // viewer state: the id -> identity this viewer has been introduced to (so an `enter` goes out once per sighting), and the ids in range this tick
};
/** One `enter` record: who an id is, sent to a viewer before the first packet that carries that id. */
export type Intro = { id: number; name: string | null; guest: boolean; worn: Worn };
export class Layer {
  readonly players = new Map<number, Player>();
  readonly cells = new Map<number, Set<Player>>();
  emptySince: number | null = null;
  readonly id: number;
  constructor(id: number) { this.id = id; }
}

export type MoveResult = 'ok' | 'snapped' | 'drop';
const TOWN_HALF_CM = TOWN_CM / 2;
const cellOf = (r: Rules, x: number, z: number): number => Math.floor(x / r.cellCm) * 4096 + Math.floor(z / r.cellCm);

export class World {
  readonly layers = new Map<number, Layer>();
  readonly byAccount = new Map<string, Player>();
  readonly memory = new Map<string, { x: number; z: number; at: number }>();   // account -> where it was last seen, in insertion order (oldest first)
  private nextLayer = 1;
  readonly rules: Rules;
  readonly maxLayers: number;
  constructor(rules: Rules = RULES, maxLayers = 8) { this.rules = rules; this.maxLayers = maxLayers; }

  // Join: the friend's layer if they are online and it has room, else the fullest layer under the soft cap (fill first), else a new layer.
  // Where it starts (X2 stage 1): `at` when given, else the position this account was last seen at here (kept `memoryMs` after it left, moved clear of any trade area),
  // else SPAWN, the Pit yard's centre. A client's first pose never places anyone: it is one more move through the speed clamp. Null when every layer is at its cap and no more may open (the capacity decision, §5), or the account is already in.
  join(account: string, now: number, friend?: string, at?: { x: number; z: number }, legacy = false): Player | null {
    if (this.byAccount.has(account)) return null;
    const { softCap, hardCap } = this.rules;
    let layer: Layer | undefined;
    const pal = friend ? this.byAccount.get(friend) : undefined;
    if (pal && pal.layer.players.size < hardCap) layer = pal.layer;
    if (!layer) for (const l of this.layers.values()) if (l.players.size < softCap && (!layer || l.players.size > layer.players.size)) layer = l;
    if (!layer) {
      if (this.layers.size >= this.maxLayers) return null;
      layer = new Layer(this.nextLayer++); this.layers.set(layer.id, layer);
    }
    let id = 1; while (layer.players.has(id)) id++;
    const wanted = at ?? this.recall(account, now) ?? SPAWN, fits = legacy ? inTownSquare : walkable;
    const from = fits(Math.round(wanted.x), Math.round(wanted.z)) ? wanted : SPAWN;   // a remembered or saved spot the clamp would refuse (or a v1 client cannot see) starts at the spawn
    const x = Math.round(from.x), z = Math.round(from.z);
    const p: Player = { id, account, layer, x, z, heading: 0, anim: 0, flags: 0, tick: 0, movedAt: now, credit: 0, seenAt: now, strikes: 0, strikeAt: now, legacy, zone: zoneRowAt(x, z), name: null, guest: false, worn: {}, told: new Map(), sees: new Set() };
    layer.players.set(id, p); layer.emptySince = null; this.byAccount.set(account, p);
    this.cellOf(layer, p).add(p);
    return p;
  }
  leave(p: Player, now: number): void {
    const layer = p.layer;
    if (layer.players.get(p.id) !== p) return;
    layer.cells.get(cellOf(this.rules, p.x, p.z))?.delete(p);
    layer.players.delete(p.id); this.byAccount.delete(p.account);
    if (!layer.players.size) layer.emptySince = now;
    this.memory.delete(p.account); if (p.guest) return;   // a guest leaves no 10-minute memory: a reconnect is a new guest at the spawn
    this.memory.set(p.account, { x: p.x, z: p.z, at: now });   // the last position the speed clamp accepted; the oldest entry goes past memoryMax
    if (this.memory.size > this.rules.memoryMax) this.memory.delete(this.memory.keys().next().value!);
  }
  // The remembered position of an account that left at most `memoryMs` ago, moved clear of any trade area; undefined when there is none or it has expired.
  private recall(account: string, now: number): { x: number; z: number } | undefined {
    const m = this.memory.get(account);
    if (!m) return undefined;
    if (now - m.at > this.rules.memoryMs) { this.memory.delete(account); return undefined; }
    return clearOfTradeAreas(m.x, m.z);
  }
  // The client's claimed pose, clamped: somewhere walkable (the town square, a Frontier zone, the west road; a v1 client: the square, clamped to its edge), at most the sprint speed times the speed of
  // the zone it is leaving (with slack). A pose off the walkable ground or a jump past the speed keeps the old position ("snapped": the client is told nothing, it simply sees itself pulled back
  // by the next packet) and counts a strike; repeated, the player is dropped.
  // The reach is a CREDIT, not a per-packet window (Lead 2026-10-17): it accrues in real time at the speed limit, is capped at one second plus the jitter row, and each accepted step spends what it
  // moved. So packets that bunch on a jittery link draw on what the walker earned while they were in flight, a refused pose spends nothing (and the clock still runs, so one hiccup cannot snowball),
  // and a speed hack still cannot average more than the limit: the cap bounds any burst.
  move(p: Player, pose: Pose, now: number): MoveResult {
    const { strikesToDrop, strikeWindowMs, jitterMs } = this.rules;
    if (now - p.strikeAt > strikeWindowMs) { p.strikes = 0; p.strikeAt = now; }
    const rate = this.creditRate(p.zone);
    p.credit = Math.min(rate * (1000 + jitterMs), p.credit + rate * Math.max(0, now - p.movedAt));
    const lo = SPAWN.x - TOWN_HALF_CM, hi = SPAWN.x + TOWN_HALF_CM;
    const x = p.legacy ? Math.min(hi, Math.max(lo, pose.x)) : pose.x, z = p.legacy ? Math.min(hi, Math.max(lo, pose.z)) : pose.z;
    p.movedAt = now; p.seenAt = now;
    const step = Math.hypot(x - p.x, z - p.z);
    if (!(p.legacy || walkable(x, z)) || step > p.credit) {
      if (++p.strikes > strikesToDrop) return 'drop';
      return 'snapped';
    }
    p.credit -= step;
    return this.place(p, x, z, pose);
  }
  // cm of reach earned per ms in a zone: the sprint speed times the zone's speed row, with slack (a joiner or a warped player starts with none and earns from there).
  private creditRate(zone: ZoneRow | null): number { return (this.rules.maxSpeedCmS * (zone?.speed ?? 1) * this.rules.speedSlack) / 1000; }
  // A server-decided jump (origins/presence/warps.ts: the landmark table, never a client coordinate): the player stands at (x, z) now, the speed clamp restarts from there and no strike is counted.
  warp(p: Player, x: number, z: number, now: number): void {
    p.movedAt = now; p.seenAt = now; p.strikes = 0;
    this.place(p, x, z, { x, z, heading: p.heading, anim: p.anim, flags: p.flags });
    p.credit = 0;   // the credit restarts from the warp like the clock does
  }
  private place(p: Player, x: number, z: number, pose: Pose): MoveResult {
    const from = cellOf(this.rules, p.x, p.z), to = cellOf(this.rules, x, z);
    if (from !== to) { p.layer.cells.get(from)?.delete(p); this.cellOf(p.layer, { ...p, x, z }).add(p); }
    p.x = x; p.z = z; p.zone = zoneRowAt(x, z); p.heading = pose.heading; p.anim = pose.anim; p.flags = pose.flags; p.tick++;
    return 'ok';
  }
  private cellOf(layer: Layer, at: { x: number; z: number }): Set<Player> {
    const key = cellOf(this.rules, at.x, at.z);
    let set = layer.cells.get(key);
    if (!set) { set = new Set(); layer.cells.set(key, set); }
    return set;
  }
  // Who can be seen by whom: a v1 viewer sees only the town square; a quiet zone (the Pit) is seen by, and sees, only its own.
  private canSee(viewer: Player, e: Player): boolean {
    if (viewer.legacy && !inTownSquare(e.x, e.z)) return false;
    return viewer.zone === e.zone || !(viewer.zone?.quiet || e.zone?.quiet);
  }
  // The entities one player is sent this tick: others within the radius, nearest first, capped, each at its distance tier's rate.
  // Entities are spread over the ticks of their period by id, so the 2 Hz and 5 Hz rings do not all fire on the same tick.
  seenBy(p: Player, tickNo: number): Entity[] {
    const { cellCm, radiusCm, nearCap, tiers } = this.rules, near: { e: Player; d: number }[] = [];
    const cx = Math.floor(p.x / cellCm), cz = Math.floor(p.z / cellCm), span = Math.ceil(radiusCm / cellCm);
    for (let i = cx - span; i <= cx + span; i++) for (let j = cz - span; j <= cz + span; j++) {
      if (i < 0 || j < 0) continue;
      const set = p.layer.cells.get(i * 4096 + j);
      if (set) for (const e of set) if (e !== p && this.canSee(p, e)) { const d = Math.hypot(e.x - p.x, e.z - p.z); if (d <= radiusCm) near.push({ e, d }); }
    }
    near.sort((a, b) => a.d - b.d);
    const out: Entity[] = [], inRange = near.slice(0, nearCap);
    p.sees = new Set(inRange.map(({ e }) => e.id));
    for (const { e, d } of inRange) {
      const every = (tiers.find(t => d <= t[0]) ?? tiers[tiers.length - 1])[1];
      if ((tickNo + e.id) % every === 0) out.push({ id: e.id, x: e.x, z: e.z, heading: e.heading, anim: e.anim, flags: e.flags, tick: e.tick });
    }
    return out;
  }
  // One tick: a packet for every player who has anything to be told (never an empty packet).
  // `intros` is filled by the same call: per viewer, the `enter` records for ids it is about to be sent for the first time since they came into range (a v1 viewer is sent none).
  readonly intros = new Map<Player, Intro[]>();
  tick(tickNo: number): Map<Player, Uint8Array> {
    const out = new Map<Player, Uint8Array>();
    this.intros.clear();
    for (const layer of this.layers.values()) for (const p of layer.players.values()) {
      const seen = this.seenBy(p, tickNo);
      for (const id of p.told.keys()) if (!p.sees.has(id)) p.told.delete(id);   // out of range: introduce again when it comes back
      if (seen.length) out.set(p, encodeDown(tickNo, p.legacy ? seen.map(e => ({ ...e, x: e.x - LEGACY_SHIFT_CM, z: e.z - LEGACY_SHIFT_CM })) : seen));
      if (p.legacy) continue;
      for (const e of seen) {
        const o = layer.players.get(e.id);
        if (!o) continue;
        const who = `${o.account}|${o.name ?? ''}|${o.guest}|${JSON.stringify(o.worn)}`;   // a changed worn set is a new identity: the viewer is introduced again with the new set
        if (p.told.get(e.id) === who) continue;
        p.told.set(e.id, who);
        const list = this.intros.get(p); const intro: Intro = { id: e.id, name: o.guest ? null : o.name, guest: o.guest, worn: o.guest ? {} : o.worn };
        if (list) list.push(intro); else this.intros.set(p, [intro]);
      }
    }
    return out;
  }
  // Layers with nobody in them for a while are closed.
  sweep(now: number): number {
    let closed = 0;
    for (const [id, l] of this.layers) if (!l.players.size && l.emptySince !== null && now - l.emptySince >= this.rules.emptyLayerMs) { this.layers.delete(id); closed++; }
    return closed;
  }
  stats(): { layers: number; players: number; perLayer: Record<number, number> } {
    const perLayer: Record<number, number> = {}; let players = 0;
    for (const l of this.layers.values()) { perLayer[l.id] = l.players.size; players += l.players.size; }
    return { layers: this.layers.size, players, perLayer };
  }
}
export const maxPacketBytes = (rules: Rules = RULES): number => HEAD_BYTES + rules.nearCap * ENTITY_BYTES;
