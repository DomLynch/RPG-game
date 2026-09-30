// The one door into the Pit (docs/pit-design.md §3-4, Lead 2026-09-29): the only file that loads src/pit/, by dynamic import, so the
// Pit is its own chunk and the fight's download never carries it (tests/pit-boundary.test.ts, check-budget.mjs PIT).
import type { Entry, Pit, PitStyle, Pose, Stage } from './pit/stage.ts';
export type { GameStage, Pit, PitStyle, Pose, SceneStage, Stage } from './pit/stage.ts';

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
export async function openPit(stage: Stage, entry: Entry, pose?: Pose, wanted: () => boolean = () => true, style?: PitStyle): Promise<Pit | undefined> {
  const pit = await load();
  return wanted() ? pit.enter(stage, entry, pose, style) : undefined;
}

// The page is going away (pagehide): free the room and its sheet if the Pit was ever opened. Nothing is fetched to do it.
export function disposePit(): void {
  void chunk?.then((pit) => pit.disposeRoom(), () => {});
}
