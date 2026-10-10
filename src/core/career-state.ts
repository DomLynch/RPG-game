// Pure: the writer's career row -> the progression model's state. The one mapping the server (origins/server/career.ts, mob-rewards, story) and the zone page (origins/preview/save.ts) share, so no page imports server code.
import type { CareerState } from '../../origins/progression/model.ts';

// The writer's career row, by shape (origins/server/store.ts CareerRow is assignable): src/ must not import the server's store, which drags node types into the page build.
export type CareerRowShape = { total_credit: number; rested: number; rested_at: number; heat: Record<string, unknown>; beaten: string[]; story: string[] };

export function careerState(row: CareerRowShape): CareerState {
  return {
    credit: Number(row.total_credit), pit: { rung: 0 }, pitWins: 0, rested: Number(row.rested), restedAt: Number(row.rested_at),
    heat: row.heat as CareerState['heat'], beaten: row.beaten, story: row.story,
  };
}
