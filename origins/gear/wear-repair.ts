// Wear and repair as rows (top-30 item 14). Donor: AzerothCore durability (cost rises with the damage, 10% loss per death; we take the cost-by-condition idea, not the death tax)
// and ModernUO (hit points on the item, the smith repairs it, max hit points shrink on repair; we take that shrink and the "never below a floor" rule).
// A piece is `{ worn, max }`: points lost out of its wearMax. Wear bites the 25 quality points of a set; the quality share falls from 100% to the floor and never past it.
import { loadRegistry, tableFromFile, type Manifest } from '../../src/core/server.ts';
import DATA from './wear-repair.json' with { type: 'json' };
import MANIFEST from './wear-repair.manifest.json' with { type: 'json' };

export type WearEvent = { id: string; chancePct: number };
export type WearSlot = { id: string; share: number };
export type WearTier = { id: string; hitWear: number; killWear: number; goldPerPoint: number; metalPerTenPoints: number; metalItem: string };
export type RepairRule = { id: string; wornSlopePct: number; wearMaxLossPer100: number; wearMaxFloorPct: number; qualityFloorPct: number };
export type Piece = { worn: number; max: number; baseMax: number };   // baseMax is the piece's original wearMax, the floor for max

export function checkWearRelations(data: { wearEvents: WearEvent[]; wearSlots: WearSlot[]; wearTiers: WearTier[]; repairRules: RepairRule[] }): void {
  const bad: string[] = [];
  for (const e of data.wearEvents) if (!(e.chancePct >= 1 && e.chancePct <= 100)) bad.push(`${e.id}: chancePct must be 1..100`);
  if (data.wearSlots.reduce((n, s) => n + s.share, 0) !== 100 || data.wearSlots.some((s) => !(s.share >= 1))) bad.push('wearSlots: shares must each be >= 1 and sum to 100');
  for (const t of data.wearTiers) {
    if (!(t.hitWear >= 1 && t.killWear >= t.hitWear)) bad.push(`${t.id}: hitWear >= 1 and killWear >= hitWear`);
    if (!(t.goldPerPoint >= 1 && t.metalPerTenPoints >= 0)) bad.push(`${t.id}: goldPerPoint >= 1, metalPerTenPoints >= 0`);
  }
  for (const r of data.repairRules) {
    if (!(r.qualityFloorPct >= 1 && r.qualityFloorPct <= 100)) bad.push(`${r.id}: qualityFloorPct must be 1..100 (gear never breaks to nothing)`);
    if (!(r.wearMaxFloorPct >= 1 && r.wearMaxFloorPct <= 100)) bad.push(`${r.id}: wearMaxFloorPct must be 1..100`);
    if (!(r.wearMaxLossPer100 >= 0 && r.wornSlopePct >= 0)) bad.push(`${r.id}: wearMaxLossPer100 and wornSlopePct must be >= 0`);
  }
  if (bad.length) throw new Error(`wear-repair relations: ${bad.join('; ')}`);
}
export const loadWearRepair = (data: unknown = DATA) => {
  const reg = loadRegistry((MANIFEST.tables as unknown as Manifest[]).map((m) => tableFromFile(m, data, 'wear-repair.json')));
  checkWearRelations(data as Parameters<typeof checkWearRelations>[0]);
  return reg;
};
loadWearRepair();

export const WEAR_EVENTS: readonly WearEvent[] = DATA.wearEvents;
export const WEAR_SLOTS: readonly WearSlot[] = DATA.wearSlots;
export const WEAR_TIERS: readonly WearTier[] = DATA.wearTiers;
export const REPAIR_RULES: readonly RepairRule[] = DATA.repairRules;
export const wearTier = (id: string): WearTier | null => WEAR_TIERS.find((t) => t.id === id) ?? null;
export const repairRule = (id = 'smith'): RepairRule | null => REPAIR_RULES.find((r) => r.id === id) ?? null;
export const freshPiece = (wearMax: number): Piece => ({ worn: 0, max: wearMax, baseMax: wearMax });

// Which slot a bite lands on: `roll` in [0, 1) walks the shares in table order.
export function wornSlot(roll: number, slots: readonly WearSlot[] = WEAR_SLOTS): string {
  let acc = 0;
  for (const s of slots) { acc += s.share / 100; if (roll < acc) return s.id; }
  return slots[slots.length - 1]!.id;
}

// A piece after an event: it wears only when `roll` is under the event's chance; wear never passes the piece's max. Whether this piece is the one bitten is decided by the caller with wornSlot.
export function wearAfter(tier: WearTier, piece: Piece, event: string, roll: number, events: readonly WearEvent[] = WEAR_EVENTS): Piece {
  const e = events.find((x) => x.id === event);
  if (!e || roll >= e.chancePct / 100) return piece;
  const points = event === 'kill' ? tier.killWear : tier.hitWear;
  return { ...piece, worn: Math.min(piece.max, piece.worn + points) };
}

// The share of the piece's quality it still gives: 100% fresh, the floor when worn out, never below the floor.
export function qualityPct(piece: Piece, rule: RepairRule = repairRule()!): number {
  const kept = piece.max > 0 ? 1 - piece.worn / piece.max : 0;
  return Math.max(rule.qualityFloorPct, Math.round(rule.qualityFloorPct + (100 - rule.qualityFloorPct) * Math.max(0, kept)));
}

// Repairing `points` (default: all the wear): gold rises with how worn the piece is, metal with the points. Rounded up, so a repair never costs nothing.
export function repairCost(tier: WearTier, piece: Piece, points: number = piece.worn, rule: RepairRule = repairRule()!): { points: number; gold: number; metal: number; metalItem: string } {
  const p = Math.max(0, Math.min(points, piece.worn));
  if (p === 0) return { points: 0, gold: 0, metal: 0, metalItem: tier.metalItem };
  const wornPct = (piece.worn / piece.max) * 100;
  const perPoint = tier.goldPerPoint * (100 + (rule.wornSlopePct * wornPct) / 100) / 100;
  return { points: p, gold: Math.ceil(perPoint * p), metal: Math.ceil((tier.metalPerTenPoints * p) / 10), metalItem: tier.metalItem };
}

// The piece after the smith repairs `points`: the wear comes off, and each 100 repaired points shave wearMaxLossPer100 off max, down to the floor share of the original.
export function repairedPiece(piece: Piece, points: number = piece.worn, rule: RepairRule = repairRule()!): Piece {
  const p = Math.max(0, Math.min(points, piece.worn));
  if (p === 0) return piece;
  const floor = Math.ceil((piece.baseMax * rule.wearMaxFloorPct) / 100);
  const max = Math.max(floor, piece.max - Math.ceil((p * rule.wearMaxLossPer100) / 100));
  return { worn: Math.min(piece.worn - p, max), max, baseMax: piece.baseMax };
}
