// Replay and share of a fight record (beta plan brief 3, second slice). Pure: no DOM, no renderer. `verifyRecord` steps the
// duel from the record exactly as the live game did (same seed, same warden profile, the same quantized intents) and confirms the
// fight ends where the record says it does; Share runs it headless before anything is published, and the release gate and a
// server can run it the same way. `shareUrl` builds the link the game opens in replay mode: the opponent id rides in the URL as
// its own parameter so the page boots the right rig synchronously, and the record itself follows as the `replay` parameter.
import { initialPractice, stepPractice, type Practice } from './combat.ts';
import { OPPONENTS } from './moves.ts';
import { encodeRecord, type FightRecord } from './record.ts';

export const MAX_SHARE_CHARS = 2000;   // a link that fits every share sheet and SMS; longer fights wait for the short-id route (Dev/Deploy)

export type Verification = { ok: true; practice: Practice } | { ok: false; reason: string; practice: Practice | null };

// Steps the record headless and checks that the fight finished on its last recorded tick with the recorded outcome.
export function verifyRecord(record: FightRecord): Verification {
  const opponent = OPPONENTS[record.opponent], profile = opponent?.profiles[record.profile];   // the warden's per-opponent profile, exactly as main.ts steps it
  if (!opponent || !profile) return { ok: false, reason: 'unknown opponent or warden profile', practice: null };
  let practice = initialPractice(record.seed, opponent);
  for (let i = 0; i < record.intents.length; i++) {
    if (practice.finish) return { ok: false, reason: `the fight ended at tick ${practice.duel.tick}, before the record's last tick ${record.ticks}`, practice };
    practice = stepPractice(practice, record.intents[i], profile);
  }
  const finish = practice.finish;
  if (record.outcome === 'abandoned') return finish ? { ok: false, reason: 'an abandoned record ends in a finish', practice } : { ok: true, practice };
  if (!finish) return { ok: false, reason: 'the record does not reach its finish', practice };
  const outcome = finish.draw ? 'draw' : finish.victim === 1 ? 'killed' : 'died';
  if (outcome !== record.outcome) return { ok: false, reason: `the replay ends in "${outcome}", the record says "${record.outcome}"`, practice };
  return { ok: true, practice };
}

export async function shareUrl(record: FightRecord, origin: string): Promise<{ url: string } | { tooLong: number }> {
  const text = await encodeRecord(record);
  if (text.length > MAX_SHARE_CHARS) return { tooLong: text.length };
  return { url: `${origin}/?opponent=${record.opponent}&replay=${text}` };
}

export const replayParam = (search: string): string | null => /[?&]replay=([A-Za-z0-9_-]+)/.exec(search)?.[1] ?? null;
