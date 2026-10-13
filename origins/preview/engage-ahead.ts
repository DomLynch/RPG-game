// The engage token BEFORE the join (World, sheet-in-world PR 3; Lead 2026-10-13): a bout's roll seed is hash32(the creature's engage token, join step) (src/fight/bout-seed.ts), but the token comes from an async POST, so it has to be
// asked for while the hero is still inside the creature's aggro radius, before it reaches the engage ring. This asks spawn-net (spawnTracker.engaged) once per creature that is close enough, never past the open-token budget
// (a full budget, a refusal or an offline writer just means that bout has no token and plays band-off, exactly as today: never a refusal), and hands a token back that the hero walked away from (evaded) so it stops counting.
// No DOM, clock or storage: the page passes the time. A creature already in the loop (fighting) is never handed back.
export type AheadNet = { engaged(instance: string): Promise<unknown>; evaded(instance: string): void; open(): string[]; tokenOf(instance: string): string | null };
export type Near = { id: string; dist: number; aggro: number };
export const ASK_BUDGET = 4, RELEASE_FACTOR = 1.5, RETRY_MS = 5000;   // the writer's open-engage budget per account; a creature is let go past 1.5x its aggro radius; a refused ask is repeated no sooner than this

export function createEngageAhead(net: AheadNet, now: () => number) {
  const asked = new Map<string, number>();   // instance -> when it was last asked for
  return {
    frame(near: readonly Near[], fighting: (id: string) => boolean): void {
      const here = new Set(near.map((n) => n.id));
      for (const n of near) {
        if (n.dist > n.aggro) continue;
        const at = asked.get(n.id);
        if (at !== undefined && (net.tokenOf(n.id) !== null || now() - at < RETRY_MS)) continue;
        if (net.open().length >= ASK_BUDGET && !net.open().includes(n.id)) continue;   // the budget is full: this bout is band-off
        asked.set(n.id, now()); void net.engaged(n.id);
      }
      for (const [id] of asked) {
        const n = near.find((m) => m.id === id);
        if ((!n || n.dist > n.aggro * RELEASE_FACTOR || !here.has(id)) && !fighting(id)) { asked.delete(id); net.evaded(id); }
      }
    },
    asked: (): string[] => [...asked.keys()],
  };
}
