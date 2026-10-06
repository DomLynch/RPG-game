// POST /origins/talk_pick {character, npc, line}: one of the account's characters says one line to an NPC. The server rebuilds the talk state
// and the journal from its snapshot, runs the O2 talk module's pick() (every condition evaluated on the server's facts) and commits the talk
// row, the once-line's talk event and any quest step the line triggers, all in one batch.
import type { CharacterId, QuestId } from '../contracts/ids.ts';
import type { Result } from '../contracts/core.ts';
import { advance, type Advanced, type Journal } from '../quests/journal.ts';
import { pick } from '../talk/talk.ts';
import { BadRequest, Refused } from './errors.ts';
import { openAccount, type Handler } from './handlers.ts';
import * as store from './store.ts';
import { career, eventId, factsOf, field, journalOf, must, ownCharacter, questBatch, talkOf, type Clock, type StoryContent } from './story.ts';
import type { Json } from './store.ts';

export function talkPick(content: StoryContent | null, now: Clock = () => new Date()): Handler {
  return async (ctx, body) => {
    if (!content) throw new Refused(503, 'talk is not loaded: the writer is not ready');
    const npc = field(body.npc, 'npc', 120) as CharacterId, lineId = field(body.line, 'line', 64);
    const talk = content.talks.get(npc);
    if (!talk) throw new BadRequest(`npc: ${npc} has nothing to say`);
    const snap = await openAccount(ctx);
    const character = ownCharacter(snap, body.character);
    const { journal, stored } = journalOf(snap, character, content.quests);
    const { state, version } = talkOf(snap, character);
    const at = now();
    const facts = factsOf(snap, character, journal);
    const steps: { quest: QuestId; adv: Result<Advanced> }[] = [];   // loadTalk allows one quest effect per line; the batch below takes any number
    const picked = must(pick<Journal>(talk, state, lineId, facts, (quest, stage, choice) => {
      const adv = advance(journal, quest, stage, { ...facts, quests: content.quests, at: at.toISOString(), choice: choice ?? undefined });
      steps.push({ quest, adv });
      return adv.ok ? { ok: true, value: adv.value.journal } : adv;
    }));
    const batch: Json[] = [];
    const line = talk.lines.find(l => l.id === lineId)!;
    const changed = picked.state.told !== state.told || picked.state.flags !== state.flags;
    if (changed) {
      batch.push({ op: 'talk_set', character, told: [...picked.state.told], flags: Object.fromEntries(picked.state.flags), ...(version === null ? {} : { expected_version: version }) });
    }
    if (line.once) batch.push({ op: 'event', event_id: eventId(`talk:${character}:${npc}:${line.id}`), kind: 'talk', account: ctx.account, character, payload: { npc, line: line.id } });
    let cp = 0, row = career(snap);
    for (const { quest, adv } of steps) {
      if (!adv.ok) continue;   // unreachable: pick() refuses the whole line when its step is refused
      const q = questBatch(ctx.account, character, quest, journal, stored, adv.value, row, at);
      batch.push(...q.batch);
      cp += q.cp;
      row = q.row;   // a second paying step books on the career the first one left (its version, credit and story list)
    }
    if (batch.length) await store.commit(ctx.db, ctx.account, batch);
    return { reply: picked.reply, effects: picked.effects, cp };
  };
}
