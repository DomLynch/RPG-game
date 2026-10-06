// Pure: the snapshot's quest, journal and talk rows -> the O2 modules' journal and talk state, the facts their conditions read, and the
// commit batch for one advanced quest (quest_set + its journal lines, the quest-stage event, the story event and its career_set). No I/O.
// Every fact comes from the snapshot the server read; nothing here reads the client's body.
import type { Issue, Result } from '../contracts/core.ts';
import type { CharacterId, CharacterInstanceId, ItemId, QuestId } from '../contracts/ids.ts';
import type { ConditionFacts, QuestDefinition, QuestState } from '../contracts/story.ts';
import { award, levelOfCredit } from '../progression/model.ts';
import { loadJournal, type Advanced, type Journal } from '../quests/journal.ts';
import type { Talk, TalkState } from '../talk/talk.ts';
import { careerState } from './career.ts';
import { BadRequest } from './errors.ts';
import type { CareerRow, Json, Snapshot } from './store.ts';

export type StoryContent = { quests: ReadonlyMap<QuestId, QuestDefinition>; talks: ReadonlyMap<CharacterId, Talk> };
export const NO_CONTENT: StoryContent = { quests: new Map(), talks: new Map() };
export type Clock = () => Date;

const MAX_EVENT_ID = 200;   // origins_events.event_id check
const HELD = new Set(['pack', 'equipped', 'bank']);   // where a character holds an item for 'has-item'

export const refusal = (issues: readonly Issue[]): BadRequest => new BadRequest(issues.map(i => `${i.path || '(request)'}: ${i.message}`).join('; '));
// A body field the op reads: a string of 1..max characters, or a 400.
export const field = (v: unknown, what: string, max: number): string => {
  if (typeof v !== 'string' || v.length < 1 || v.length > max) throw new BadRequest(`${what}: a string of 1 to ${max} characters`);
  return v;
};
export const must = <T>(r: Result<T>): T => { if (!r.ok) throw refusal(r.issues); return r.value; };

// The character must be one the snapshot lists for this account (the token's); anything else is refused before any row is read.
export function ownCharacter(snap: Snapshot, character: unknown): CharacterInstanceId {
  if (typeof character !== 'string' || !snap.characters.some(c => c.id === character)) throw new BadRequest('character: not one of your characters');
  return character as CharacterInstanceId;
}

export const career = (snap: Snapshot): CareerRow => {
  if (!snap.career) throw Error('no career row after open');
  return snap.career;
};

// The stored quest rows of one character, as QuestStates the journal module loads (parsed, migrated to the content's story version, checked).
// A row for a quest the content no longer has is left out: it cannot be advanced, and a condition on it reads "not started" (fails closed).
export type Stored = ReadonlyMap<QuestId, { version: number; lines: number }>;
export function journalOf(snap: Snapshot, character: CharacterInstanceId, quests: StoryContent['quests']): { journal: Journal; stored: Stored } {
  const stored = new Map<QuestId, { version: number; lines: number }>();
  const rows: QuestState[] = [];
  for (const q of snap.quests) {
    if (q.character !== character || !quests.has(q.quest as QuestId)) continue;
    const lines = snap.journal.filter(j => j.character === character && j.quest === q.quest).sort((a, b) => Number(a.seq) - Number(b.seq));
    stored.set(q.quest as QuestId, { version: Number(q.version), lines: lines.length });
    rows.push({
      kind: 'quest-state', schemaVersion: 1, character, quest: q.quest as QuestId, storyVersion: Number(q.story_version), stage: String(q.stage),
      status: q.status as QuestState['status'], flags: q.flags as Record<string, boolean>, rewarded: q.rewarded as string[],
      journal: lines.map(l => ({ stage: String(l.stage), text: String(l.text), at: new Date(String(l.at)).toISOString() })),
    });
  }
  const loaded = loadJournal(character, rows, quests);
  if (!loaded.ok) throw Error(`stored quests do not load: ${loaded.issues.map(i => `${i.path} ${i.message}`).join('; ')}`);
  return { journal: loaded.value, stored };
}

export function talkOf(snap: Snapshot, character: CharacterInstanceId): { state: TalkState; version: number | null } {
  const row = snap.talk.find(t => t.character === character);
  if (!row) return { state: { told: new Set(), flags: new Map() }, version: null };
  return { state: { told: new Set(row.told as string[]), flags: new Map(Object.entries(row.flags as Record<string, boolean>)) }, version: Number(row.version) };
}

// What a condition may read, all from the snapshot: the career level the server derived, this character's quests, and the items it holds.
// Faction standing and cleared encounters have no rows in origins_open's snapshot, so those lookups are left out and fail closed.
export function factsOf(snap: Snapshot, character: CharacterInstanceId, journal: Journal): Omit<ConditionFacts, 'choice' | 'flag'> {
  const held = new Set(snap.items.filter(i => i.loc_owner === character && HELD.has(String(i.loc_kind))).map(i => String(i.item)));
  return {
    standing: { source: 'server', careerLevel: levelOfCredit(Number(career(snap).total_credit)) },
    quest: (id: QuestId) => journal.quests.get(id),
    hasItem: (item: ItemId) => held.has(item),
  };
}

export const eventId = (id: string): string => { if (id.length > MAX_EVENT_ID) throw Error(`event id too long: ${id.slice(0, 40)}...`); return id; };

// One advanced quest -> its writes, in one batch. Nothing when the journal module answered a replay (same journal back). A stage reached the
// first time writes quest:<pc>:<quest>:<stage> (the once-lock for its rewards) and, when it pays one, story:<pc>:<step> with the CP award()
// prices and the career_set that books it. Loot and faction standing have no write yet: they are recorded as unpaid on the quest-stage
// event, so a later payer can settle them from the ledger and nothing is lost.
export function questBatch(
  account: string, character: CharacterInstanceId, quest: QuestId, journal: Journal, stored: Stored, adv: Advanced, row: CareerRow, now: Date,
): { batch: Json[]; cp: number; row: CareerRow } {
  if (adv.journal === journal) return { batch: [], cp: 0, row };
  const state = adv.journal.quests.get(quest)!;
  const before = stored.get(quest);
  const batch: Json[] = [{
    op: 'quest_set', character, quest, story_version: state.storyVersion, stage: state.stage, status: state.status, flags: state.flags, rewarded: state.rewarded,
    ...(before ? { expected_version: before.version } : {}), journal_append: state.journal.slice(before?.lines ?? 0),
  }];
  if (adv.rewards) {
    const unpaid = [...(adv.rewards.loot ? ['loot'] : []), ...(adv.rewards.standing.length ? ['standing'] : [])];
    batch.push({ op: 'event', event_id: eventId(`quest:${character}:${quest}:${state.stage}`), kind: 'quest-stage', account, character, payload: { stage: state.stage, rewards: adv.rewards, unpaid } });
  }
  let cp = 0;
  if (adv.event) {
    const id = eventId(`story:${character}:${adv.event.id}`);
    const won = award(careerState(row), { kind: 'story', id, at: Math.floor(now.getTime() / 1000), step: adv.event.id, type: adv.event.type });
    batch.push({ op: 'event', event_id: id, kind: 'story-step', account, character, payload: { cp: won.cp, step: adv.event.id, type: adv.event.type, reason: won.reason } });
    if (won.reason === 'ok') {
      cp = won.cp;
      batch.push({
        op: 'career_set', account, expected_version: row.version, world_credit: Number(row.world_credit) + cp, rested: won.state.rested, rested_at: won.state.restedAt,
        heat: won.state.heat, story: won.state.story, beaten: won.state.beaten,
      });
      row = {
        ...row, world_credit: Number(row.world_credit) + cp, total_credit: Number(row.total_credit) + cp, rested: won.state.rested, rested_at: won.state.restedAt,
        heat: won.state.heat, story: [...won.state.story], beaten: [...won.state.beaten], version: row.version + 1,
      };
    }
  }
  return { batch, cp, row };
}
