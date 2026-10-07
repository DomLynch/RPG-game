// A world creature fight's record (Lead's queue: "world creature duels must produce a real FightRecord"). The duel is a sparring Match, which keeps none, so the page gives it
// the Pit's own recorder (src/record.ts createRecorder) right after startSparring: Match.step then pushes every quantized intent through it, as a career fight does. The meta is
// exactly what origins/server/encounter-verify.ts checks (enemy, level, seed, the special-move phase); the weapon is the preview's longsword. Nothing is posted from here.
import type { Match } from '../../src/match.ts';
import { createRecorder, type FightRecord } from '../../src/record.ts';
import type { Finished } from '../pit/pit.ts';

export function recordWorldFight(match: Match, opponent: string, level: number, seed: number): void {
  match.recorder = createRecorder({ build: 'origins-preview', opponent: opponent as Parameters<typeof createRecorder>[0]['opponent'], weapon: 'longsword', level, seed, ...(match.specials ? { specials: true } : {}) });
}

/** The record once the fight is over: by the finish when there is one, 'abandoned' when a twist ended it with both standing (what the verifier expects). Null when none was kept. */
export function worldRecord(match: Match, finish: Finished): FightRecord | null {
  const recorder = match.recorder;
  if (!recorder) return null;
  match.recorder = null;   // once
  return recorder.finish(!finish ? 'abandoned' : finish.draw ? 'draw' : finish.victim === 1 ? 'killed' : 'died');
}
