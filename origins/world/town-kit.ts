// Town generator -> Characters' building kit (public/world/town/buildings.json, PR #1825 char/town-buildings): maps a generated piece (town.ts: a plain node name + a variant number + a slot)
// to one of the kit's real piece names, deterministically and by the kit's own weights. Pure data. The weights below are the manifest's; town-kit.test.ts checks them against the file when it is on disk.
import type { Lot, TownPiece } from './town.ts';

export type KitPiece = { name: string; weight: number };
const k = (...p: [string, number][]): KitPiece[] => p.map(([name, weight]) => ({ name, weight }));
export const KIT = {
  wall: { plain: k(['wall_plain_a', 4], ['wall_plain_b', 3], ['wall_plain_c', 2]), window: k(['wall_window_a', 3], ['wall_window_b', 2]), door: k(['wall_door_a', 3], ['wall_door_b', 2]) },
  corner: k(['wall_corner_a', 3], ['wall_corner_b', 2]),
  arch: k(['arch_stone_a', 2], ['arch_gate_a', 2]),
  roof: k(['roof_a', 4], ['roof_b', 3], ['roof_c', 1]),
  stall: k(['stall_a', 3], ['stall_b', 3], ['stall_c', 1]),
  counter: k(['counter_bank_a', 1], ['counter_bar_a', 1]),
  sign: k(['sign_tavern_a', 1], ['sign_smith_a', 1], ['sign_bank_a', 1]),
  chimney: k(['chimney_a', 2], ['chimney_b', 2]),
} as const;
export const KIT_NAMES: readonly string[] = [...Object.values(KIT.wall).flat(), ...KIT.corner, ...KIT.arch, ...KIT.roof, ...KIT.stall, ...KIT.counter, ...KIT.sign, ...KIT.chimney].map((p) => p.name);

// The weighted pick: `variant` (0, 1, 2, ... from the generator) walks the cumulative weights, so a heavier piece is chosen more often and the same variant always gives the same piece.
const weighted = (list: readonly KitPiece[], variant: number): string => {
  const total = list.reduce((n, p) => n + p.weight, 0); let at = ((variant * 5 + 2) % total + total) % total;
  for (const p of list) { if (at < p.weight) return p.name; at -= p.weight; }
  return list[0]!.name;
};
const pick = (name: string) => [{ name, weight: 1 }];

// The kit piece for a generated piece of `lot`: signs and counters are chosen by what the building is (a smithy's sign, the bank's counter, the inn's bar), the gate's arch is the gate arch, a wall by its slot.
export function kitPiece(p: TownPiece, lot: Pick<Lot, 'kind' | 'trade'>): string {
  switch (p.node) {
    case 'wall': return weighted(KIT.wall[p.slot ?? 'plain'], p.variant);
    case 'corner': return weighted(KIT.corner, p.variant);
    case 'roof': return weighted(KIT.roof, p.variant);
    case 'stall': return weighted(KIT.stall, p.variant);
    case 'chimney': return weighted(KIT.chimney, p.variant);
    case 'arch': return lot.kind === 'gate' ? 'arch_gate_a' : weighted(KIT.arch, p.variant);
    case 'counter': return lot.kind === 'bank' ? 'counter_bank_a' : weighted(pick('counter_bar_a'), p.variant);
    case 'sign': return lot.kind === 'bank' ? 'sign_bank_a' : lot.trade === 'inn' ? 'sign_tavern_a' : lot.trade === 'smith' ? 'sign_smith_a' : weighted(KIT.sign.slice(0, 2), p.variant);
  }
}
