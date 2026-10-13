// ONE spell gate for every settle path that replays a record (the Auditor's HOLD on #2487, Lead 2026-10-13): a v53 record's spell block is the client's claim, so the encounter settle, the career/practice
// sweep (scripts/verify-loot.mjs) and the daily sweep (scripts/verify-daily.mjs) all ask here before they pay. Same refuse semantics as expectedSpell: an unowned id, or a skill past the stored ceiling.
// A spell record that names no stored build (characterId + buildVersion) has nothing to vouch for its skill and is refused. tests/spell-gate.test.ts pins that every replay entry calls this.
import { checkSpell, heldSql } from './spell-check.ts';
export { heldSql };   // the one ledger query: the sweeps, the encounter settle and the Postgres check all run this text

export type SpellLoader = {
  held: (account: string, character: string) => Promise<{ grimoire: Record<string, unknown>; xp: Record<string, number> }>;   // the account's grimoire and this character's banked practice
  build: (account: string, character: string, version: number) => Promise<{ placed: Record<string, number> } | null>;        // the stored build the record names
};

/** Why a record's spell cannot be paid, or null (no spell, or owned and within the stored skill). Never throws for a bad claim. */
export async function spellRefusal(record: { spell?: { id: string; skill: number }; characterId?: string; buildVersion?: number }, account: string, load: SpellLoader): Promise<string | null> {
  if (!record.spell) return null;
  if (record.characterId === undefined || record.buildVersion === undefined) return 'the record casts a spell and names no stored build to check its skill against';
  const character = `pc:${record.characterId}`, [held, build] = await Promise.all([load.held(account, character), load.build(account, character, record.buildVersion)]);
  if (build === null) return 'the record casts a spell and its stored build is unknown';
  const verdict = checkSpell(record.spell, { grimoire: held.grimoire, xp: held.xp, placed: build.placed });
  return verdict.ok ? null : verdict.reason;
}
