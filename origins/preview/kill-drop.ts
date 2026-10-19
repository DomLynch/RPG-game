// A kill drops what the creature wore, on the ground, to pick up (zone sandbox, Dom 2026-10-17: "real item drops per kill"). SANDBOX ONLY: the Test Zone is invisible to the server, so nothing here is an
// account item; the pieces go in a "Found" list in PAGE MEMORY only (no localStorage, nothing sent) until the backend loot-table rows exist (the loadout rows already name the loot piece ids, so a loot table per
// loadout maps one to one). Donors: UO / ModernUO (the corpse holds what the creature wore) and EQEmu ground spawns (an item at a place, taken by walking onto it). Pure logic: the piece lies as itself through the ground-item view (no marker of its own, no assets).
import type { Tier } from '../../src/core/index.ts';

export type FoundItem = { piece: string; label: string; from: string; n: number };

/** The Found list: counts per piece, PAGE MEMORY ONLY (nothing is stored or sent; a reload empties it). */
export function createFound() {
  let items: FoundItem[] = [];
  return {
    list: (): readonly FoundItem[] => items,
    count: (): number => items.reduce((s, i) => s + i.n, 0),
    add(piece: string, label: string, from: string): void { const i = items.find((x) => x.piece === piece); if (i) i.n++; else items = [...items, { piece, label, from, n: 1 }]; },
    clear(): void { items = []; },
  };
}

export type Drop = { id: number; piece: string; label: string; from: string; x: number; z: number; rung?: string };
type Deps = { view: { show(id: string, item: string, at: { x: number; z: number }, tier?: Tier): void; hide(id: string): void }; itemOf: (piece: string) => string; found: ReturnType<typeof createFound>; reach: number; onPick: (d: Drop) => void; onChange: () => void };

/** Pieces lying on the ground: `drop` lays one where the creature fell (as itself: its drop-looks row, pickup ring and beam; a piece with no row or model THROWS, nothing is drawn at a guessed pose), `update` takes the one the hero walks onto (within `reach` metres). */
export function createKillDrops(deps: Deps) {
  const live = new Map<number, Drop>(); let next = 1;
  return {
    drop(piece: string, label: string, from: string, x: number, z: number, rung?: string): void {
      const id = next++;
      deps.view.show(`drop:${id}`, deps.itemOf(piece), { x, z }, rung as Tier | undefined);
      live.set(id, { id, piece, label, from, x, z, rung });
    },
    update(hero: { x: number; z: number }): void {
      for (const [id, d] of live) {
        if (Math.hypot(hero.x - d.x, hero.z - d.z) <= deps.reach) { deps.found.add(d.piece, d.label, d.from); deps.view.hide(`drop:${id}`); live.delete(id); deps.onPick(d); deps.onChange(); }
      }
    },
    waiting: (): number => live.size,
  };
}
