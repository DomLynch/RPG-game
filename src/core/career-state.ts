// Pure: the writer's career row -> the progression model's state. The one mapping the server (origins/server/career.ts, mob-rewards, story) and the zone page (origins/preview/save.ts) share, so no page imports server code.
// Types are by SHAPE (origins/progression/model.ts CareerState and origins/server/store.ts CareerRow are assignable to and from these): nothing under src/ imports origins/ (origins/region1 pins that).
export type CareerRowShape = { total_credit: number; rested: number; rested_at: number; heat: Record<string, unknown>; beaten: string[]; story: string[] };
export type CareerStateShape = {
  credit: number; pit: { rung: number }; pitWins: number; rested: number; restedAt: number;
  heat: Readonly<Record<string, { units: number; at: number }>>; beaten: readonly string[]; story: readonly string[];
};

export function careerState(row: CareerRowShape): CareerStateShape {
  return {
    credit: Number(row.total_credit), pit: { rung: 0 }, pitWins: 0, rested: Number(row.rested), restedAt: Number(row.rested_at),
    heat: row.heat as CareerStateShape['heat'], beaten: row.beaten, story: row.story,
  };
}
