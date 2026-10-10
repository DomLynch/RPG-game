// Pure: the writer's career row -> the progression model's state. The one mapping the server (origins/server/career.ts, mob-rewards, story) and the zone page (origins/preview/save.ts) share, so no page imports server code.
import type { CareerState } from '../../origins/progression/model.ts';
import type { CareerRow } from '../../origins/server/store.ts';

export function careerState(row: CareerRow): CareerState {
  return {
    credit: Number(row.total_credit), pit: { rung: 0 }, pitWins: 0, rested: Number(row.rested), restedAt: Number(row.rested_at),
    heat: row.heat as CareerState['heat'], beaten: row.beaten, story: row.story,
  };
}
