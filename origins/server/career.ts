// Pure: the career row -> the progression model's state, and a verified Pit claim -> the batch that pays it. No I/O here.
import { award, legendKey, type CareerState } from '../progression/model.ts';
import type { CareerRow, Json, PitClaim } from './store.ts';

export function careerState(row: CareerRow): CareerState {
  return {
    credit: Number(row.total_credit), pit: { rung: 0 }, pitWins: 0, rested: Number(row.rested), restedAt: Number(row.rested_at),
    heat: row.heat as CareerState['heat'], beaten: row.beaten, story: row.story,
  };
}

// The claim was verified by the loot sweep (record replayed, standing checked). It pays the legend row once at the account's derived level;
// a legend already beaten (or a grey one) still gets its pit:<claim> event, with cp 0, so the claim leaves the pending list for good.
export function pitBatch(account: string, row: CareerRow, claim: PitClaim): { batch: Json[]; cp: number; reason: string } {
  const at = Math.floor(Date.parse(claim.at) / 1000);
  const state = careerState(row);
  const won = award(state, { kind: 'arena-win', id: `pit:${claim.claim_id}`, at, opponent: claim.opponent });
  const batch: Json[] = [{ op: 'event', event_id: `pit:${claim.claim_id}`, kind: 'pit', account, payload: { cp: won.cp, legend: legendKey(claim.opponent, won.levelBefore), reason: won.reason } }];
  if (won.reason === 'ok') {
    batch.push({
      op: 'career_set', account, expected_version: row.version, world_credit: row.world_credit, rested: won.state.rested, rested_at: won.state.restedAt,
      heat: won.state.heat, story: won.state.story, beaten: won.state.beaten,
    });
  }
  return { batch, cp: won.cp, reason: won.reason };
}
