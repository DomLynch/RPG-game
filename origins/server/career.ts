// Pure: the career row -> the progression model's state, and a verified Pit claim -> the batch that pays it. No I/O here.
import { careerState } from '../../src/core/server.ts';
import { legendKey, levelOfCredit } from '../progression/model.ts';
import type { CareerRow, Json, PitClaim } from './store.ts';

// The claim was verified by the loot sweep (record replayed, standing checked). Pit wins pay PIT RANKS only (Strategy, 2026-10-09; the unification waits for the post-K7 ledger): the claim is settled once,
// as a pit:<claim> event with cp 0 (the event is the idempotency lock, so the claim leaves the pending list for good), and it changes NO career column: zone credit comes from zone kills only.
export function pitBatch(account: string, row: CareerRow, claim: PitClaim): { batch: Json[]; cp: number; reason: string } {
  const level = levelOfCredit(careerState(row).credit);
  const batch: Json[] = [{ op: 'event', event_id: `pit:${claim.claim_id}`, kind: 'pit', account, payload: { cp: 0, legend: legendKey(claim.opponent, level), reason: 'pit-ranks-only' } }];
  return { batch, cp: 0, reason: 'pit-ranks-only' };
}
