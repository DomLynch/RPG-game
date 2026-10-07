// Layers and spatial interest management (docs/specs/origins/one-shard.md §2, §4, §5). Pure: no sockets, no clock of its own, so the rules are
// testable and the load test can drive them. All numbers are the note's *est.* planning figures until the load test replaces them.
import { ENTITY_BYTES, HEAD_BYTES, encodeDown, type Entity, type Pose } from './wire.ts';
import { SPAWN, clearOfTradeAreas } from './zones.ts';

export const RULES = {
  zoneCm: 30000,                 // one town zone, 300 m square (u16 centimetres allow up to 655 m)
  cellCm: 1600,                  // 16 m grid cells
  radiusCm: 4000,                // visual radius 40 m
  nearCap: 40,                   // nearest-first cap on other characters drawn at once
  tiers: [[1200, 1], [2500, 2], [4000, 5]] as const,   // [distance cm, send every N ticks]: 10 Hz under 12 m, 5 Hz to 25 m, 2 Hz to 40 m
  tickMs: 100,
  softCap: 80,                   // a layer accepts joins until here, then arrivals go to another layer
  hardCap: 100,                  // the rare friend-join may fill to here
  maxSpeedCmS: 700,              // about 7 m/s, set from the sprint speed
  speedSlack: 1.5,
  strikesToDrop: 5,
  strikeWindowMs: 10_000,
  emptyLayerMs: 5 * 60_000,
  memoryMs: 10 * 60_000,         // a leaver's last server-observed position is kept this long for a reconnect (X2 stage 1; the saved location of stage 2 supersedes it)
  memoryMax: 10_000,             // accounts remembered at once, oldest dropped first
};
export type Rules = typeof RULES;

export type Player = Pose & { id: number; account: string; layer: Layer; tick: number; movedAt: number; strikes: number; strikeAt: number };
export class Layer {
  readonly players = new Map<number, Player>();
  readonly cells = new Map<number, Set<Player>>();
  emptySince: number | null = null;
  readonly id: number;
  constructor(id: number) { this.id = id; }
}

export type MoveResult = 'ok' | 'snapped' | 'drop';
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
  join(account: string, now: number, friend?: string, at?: { x: number; z: number }): Player | null {
    if (this.byAccount.has(account)) return null;
    const { softCap, hardCap, zoneCm } = this.rules;
    let layer: Layer | undefined;
    const pal = friend ? this.byAccount.get(friend) : undefined;
    if (pal && pal.layer.players.size < hardCap) layer = pal.layer;
    if (!layer) for (const l of this.layers.values()) if (l.players.size < softCap && (!layer || l.players.size > layer.players.size)) layer = l;
    if (!layer) {
      if (this.layers.size >= this.maxLayers) return null;
      layer = new Layer(this.nextLayer++); this.layers.set(layer.id, layer);
    }
    let id = 1; while (layer.players.has(id)) id++;
    const from = at ?? this.recall(account, now) ?? SPAWN;
    const x = Math.min(zoneCm, Math.max(0, Math.round(from.x))), z = Math.min(zoneCm, Math.max(0, Math.round(from.z)));
    const p: Player = { id, account, layer, x, z, heading: 0, anim: 0, flags: 0, tick: 0, movedAt: now, strikes: 0, strikeAt: now };
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
    this.memory.delete(p.account); this.memory.set(p.account, { x: p.x, z: p.z, at: now });   // the last position the speed clamp accepted; the oldest entry goes past memoryMax
    if (this.memory.size > this.rules.memoryMax) this.memory.delete(this.memory.keys().next().value!);
  }
  // The remembered position of an account that left at most `memoryMs` ago, moved clear of any trade area; undefined when there is none or it has expired.
  private recall(account: string, now: number): { x: number; z: number } | undefined {
    const m = this.memory.get(account);
    if (!m) return undefined;
    if (now - m.at > this.rules.memoryMs) { this.memory.delete(account); return undefined; }
    return clearOfTradeAreas(m.x, m.z);
  }
  // The client's claimed pose, clamped: inside the zone, at most the sprint speed (with slack). A jump past that keeps the old position
  // ("snapped": the client is told nothing, it simply sees itself pulled back by the next packet) and counts a strike; repeated, the player is dropped.
  move(p: Player, pose: Pose, now: number): MoveResult {
    const { zoneCm, maxSpeedCmS, speedSlack, strikesToDrop, strikeWindowMs } = this.rules;
    if (now - p.strikeAt > strikeWindowMs) { p.strikes = 0; p.strikeAt = now; }
    const dt = Math.max(100, Math.min(1000, now - p.movedAt)) / 1000, reach = maxSpeedCmS * speedSlack * dt;
    const x = Math.min(zoneCm, Math.max(0, pose.x)), z = Math.min(zoneCm, Math.max(0, pose.z));
    p.movedAt = now;
    if (Math.hypot(x - p.x, z - p.z) > reach) {
      if (++p.strikes > strikesToDrop) return 'drop';
      return 'snapped';
    }
    return this.place(p, x, z, pose);
  }
  private place(p: Player, x: number, z: number, pose: Pose): MoveResult {
    const from = cellOf(this.rules, p.x, p.z), to = cellOf(this.rules, x, z);
    if (from !== to) { p.layer.cells.get(from)?.delete(p); this.cellOf(p.layer, { ...p, x, z }).add(p); }
    p.x = x; p.z = z; p.heading = pose.heading; p.anim = pose.anim; p.flags = pose.flags; p.tick++;
    return 'ok';
  }
  private cellOf(layer: Layer, at: { x: number; z: number }): Set<Player> {
    const key = cellOf(this.rules, at.x, at.z);
    let set = layer.cells.get(key);
    if (!set) { set = new Set(); layer.cells.set(key, set); }
    return set;
  }
  // The entities one player is sent this tick: others within the radius, nearest first, capped, each at its distance tier's rate.
  // Entities are spread over the ticks of their period by id, so the 2 Hz and 5 Hz rings do not all fire on the same tick.
  seenBy(p: Player, tickNo: number): Entity[] {
    const { cellCm, radiusCm, nearCap, tiers } = this.rules, near: { e: Player; d: number }[] = [];
    const cx = Math.floor(p.x / cellCm), cz = Math.floor(p.z / cellCm), span = Math.ceil(radiusCm / cellCm);
    for (let i = cx - span; i <= cx + span; i++) for (let j = cz - span; j <= cz + span; j++) {
      if (i < 0 || j < 0) continue;
      const set = p.layer.cells.get(i * 4096 + j);
      if (set) for (const e of set) if (e !== p) { const d = Math.hypot(e.x - p.x, e.z - p.z); if (d <= radiusCm) near.push({ e, d }); }
    }
    near.sort((a, b) => a.d - b.d);
    const out: Entity[] = [];
    for (const { e, d } of near.slice(0, nearCap)) {
      const every = (tiers.find(t => d <= t[0]) ?? tiers[tiers.length - 1])[1];
      if ((tickNo + e.id) % every === 0) out.push({ id: e.id, x: e.x, z: e.z, heading: e.heading, anim: e.anim, flags: e.flags, tick: e.tick });
    }
    return out;
  }
  // One tick: a packet for every player who has anything to be told (never an empty packet).
  tick(tickNo: number): Map<Player, Uint8Array> {
    const out = new Map<Player, Uint8Array>();
    for (const layer of this.layers.values()) for (const p of layer.players.values()) {
      const seen = this.seenBy(p, tickNo);
      if (seen.length) out.set(p, encodeDown(tickNo, seen));
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
