// POST /origins/quest_advance {character, quest, stage, choice?}: move one of the account's characters' quests to `stage` (the start stage to
// take it, or the next stage along a transition; `choice` names the branch). The server reads the rows, runs the O2 journal's advance() on
// facts from its own snapshot and commits the result in one batch. The client names only what it wants; whether it may, and what it pays,
// is the server's.
import type { QuestId } from '../../src/core/server.ts';
import { advance } from '../quests/journal.ts';
import { Refused } from './errors.ts';
import { career, factsOf, field, journalOf, must, ownCharacter, questBatch, type Clock, type StoryContent } from './story.ts';
import { openAccount, type Handler } from './handlers.ts';
import * as store from './store.ts';
import { qaOf } from './qa-account.ts';
import SERVER_RULES from './server-rules.json' with { type: 'json' };

const INPUT = SERVER_RULES.inputLimits[0]!;   // the longest each request id may be (rows of the inputLimits table)

const optionalChoice = (v: unknown): string | undefined => (v === undefined || v === null ? undefined : field(v, 'choice', INPUT.choiceIdChars));

export function questAdvance(content: StoryContent | null, now: Clock = () => new Date()): Handler {
  return async (ctx, body) => {
    if (!content) throw new Refused(503, 'quests are not loaded: the writer is not ready');
    const quest = field(body.quest, 'quest', INPUT.questIdChars) as QuestId, stage = field(body.stage, 'stage', INPUT.stageIdChars), choice = optionalChoice(body.choice);
    const snap = await openAccount(ctx);
    const character = ownCharacter(snap, body.character);
    const { journal, stored } = journalOf(snap, character, content.quests);
    const at = now();
    const adv = must(advance(journal, quest, stage, { ...factsOf(snap, character, journal), quests: content.quests, at: at.toISOString(), choice }));
    const qa = (await qaOf(ctx.db, ctx.account)) === 'yes';   // the QA account (fighter_profiles.is_test) advances but books no CP; a blind lookup pays as normal
    const { batch, cp } = questBatch(ctx.account, character, quest, journal, stored, adv, career(snap), at, qa);
    if (batch.length) await store.commit(ctx.db, ctx.account, batch);
    const state = adv.journal.quests.get(quest)!;
    return { quest, stage: state.stage, status: state.status, cp, replay: batch.length === 0 };
  };
}
