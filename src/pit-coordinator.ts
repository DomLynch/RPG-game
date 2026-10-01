// The one door into the Pit (docs/pit-design.md §3-4, Lead 2026-09-29): the only file that loads src/pit/, by dynamic import, so the
// Pit is its own chunk and the fight's download never carries it (tests/pit-boundary.test.ts, check-budget.mjs PIT).
import { inGate, LAYOUT } from './arena.ts';
import type { Entry, Pit, Pose, Stage } from './pit/stage.ts';
export type { GameStage, Pit, Pose, SceneStage, Stage } from './pit/stage.ts';

let chunk: Promise<typeof import('./pit/pit.ts')> | undefined;
// A failed fetch (offline, a chunk from an older release) is forgotten, so the next tap tries again.
const load = () => (chunk ??= import('./pit/pit.ts').catch((error: unknown) => { chunk = undefined; throw error; }));

// Start the download after a kill without competing with the fight's own traffic. Lead's order: the next opponent's look prefetch
// outranks the Pit, so `after` is that fetch when one is queued; the Pit waits for it to settle, then for an idle moment.
export function prefetchPit(after?: Promise<unknown>): void {
  const idle = () => {
    const start = () => void load().catch(() => {});   // a prefetch failure is silent; openPit reports it when the player asks
    if (typeof requestIdleCallback === 'function') requestIdleCallback(start, { timeout: 2000 });
    else setTimeout(start, 1000);   // Safari has no requestIdleCallback
  };
  if (after) void after.then(idle, idle); else idle();
}

// The player tapped Enter the Pit (a win) or Recover (a defeat); `pose` pins the camera (the `?look=pit` stills). Rejects if the chunk
// cannot load: the caller keeps the kill screen and says so; nothing has been changed. `wanted` is asked once the chunk is in and BEFORE
// enter() touches the scene: a slow chunk that lands after the player moved on (a Rematch started the next fight) resolves undefined and
// changes nothing (Code Quality P1, #1122).
export async function openPit(stage: Stage, entry: Entry, pose?: Pose, wanted: () => boolean = () => true, arrival = 0, gateAt?: number): Promise<Pit | undefined> {
  const pit = await load();
  return wanted() ? pit.enter(stage, entry, pose, arrival, gateAt) : undefined;
}
// The chunk alone (the walk to the gate, docs/pit-design.md §9): main.ts holds him at the line until it is in, then fades and enters.
export const loadPit = (): Promise<void> => load().then(() => undefined);

// D2 (docs/pit-design.md §9): the gate line he crosses on foot, one metre inside the wall inside the gate's arc; and the door's rule while
// he walks (Strategy): hidden as soon as the stick moves him, back once he has stood still for DOOR_STILL ms.
export const GATE_LINE = LAYOUT.wall.inner - 1.0;
export const atGateLine = (x: number, z: number): boolean => { const r = Math.hypot(x, z); return r >= GATE_LINE && inGate(Math.atan2(x, z), r); };
export const DOOR_STILL = 3000;
export const doorHidden = (lastMoveAt: number | null, now: number): boolean => lastMoveAt !== null && now - lastMoveAt < DOOR_STILL;

// The page is going away (pagehide): free the room and its sheet if the Pit was ever opened. Nothing is fetched to do it.
export function disposePit(): void {
  void chunk?.then((pit) => pit.disposeRoom(), () => {});
}
