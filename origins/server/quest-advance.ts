// POST /origins/quest_advance {character, quest, stage, choice?}: move one of the account's characters' quests to `stage` (the start stage to
// take it, or the next stage along a transition; `choice` names the branch). The server reads the rows, runs the O2 journal's advance() on
// facts from its own snapshot and commits the result in one batch. The client names only what it wants; whether it may, and what it pays,
// is the server's.
import type { QuestId } from '../contracts/ids.ts';
import { advance } from '../quests/journal.ts';
import { Refused } from './errors.ts';
import { career, factsOf, field, journalOf, must, ownCharacter, questBatch, type Clock, type StoryContent } from './story.ts';
import { openAccount, type Handler } from './handlers.ts';
import * as store from './store.ts';

const optionalChoice = (v: unknown): string | undefined => (v === undefined || v === null ? undefined : field(v, 'choice', 64));

export function questAdvance(content: StoryContent | null, now: Clock = () => new Date()): Handler {
  return async (ctx, body) => {
    if (!content) throw new Refused(503, 'quests are not loaded: the writer is not ready');
    const quest = field(body.quest, 'quest', 120) as QuestId, stage = field(body.stage, 'stage', 64), choice = optionalChoice(body.choice);
    const snap = await openAccount(ctx);
    const character = ownCharacter(snap, body.character);
    const { journal, stored } = journalOf(snap, character, content.quests);
    const at = now();
    const adv = must(advance(journal, quest, stage, { ...factsOf(snap, character, journal), quests: content.quests, at: at.toISOString(), choice }));
    const { batch, cp } = questBatch(ctx.account, character, quest, journal, stored, adv, career(snap), at);
    if (batch.length) await store.commit(ctx.db, ctx.account, batch);
    const state = adv.journal.quests.get(quest)!;
    return { quest, stage: state.stage, status: state.status, cp, replay: batch.length === 0 };
  };
}
