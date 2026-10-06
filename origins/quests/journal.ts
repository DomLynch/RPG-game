// Origins O2: the quest journal — one character's state of every quest, advanced only along the content's transitions.
//
// Built on the O1 story contracts (QuestDefinition, QuestState, grantStageRewards, migrateQuestState); nothing here redefines them.
// Pure: no clock, no randomness, no I/O. The caller passes the server time, the career standing and the item/standing/encounter lookups;
// a journal goes in and a new journal comes out, the old one untouched. Rules: docs/specs/origins/openmw-quest-journal.md (entries are
// appended as final text, never rewritten; a stage already in the journal adds no second entry) and modernuo-quests.md (a finished quest
// is final; rewards are paid once).
import { ISO_UTC, fail, ok, type Result } from '../contracts/core.ts';
import { levelOf as tierLevel } from '../../src/grades.ts';
import type { CharacterInstanceId, EncounterId, FactionId, ItemId, QuestId } from '../contracts/ids.ts';
import {
  checkQuestState, grantStageRewards, migrateQuestState, parseQuestState, statusFor,
  type Condition, type QuestDefinition, type QuestState, type QuestStatus, type Stage,
} from '../contracts/story.ts';
import { gateAccess, verifiedTier, type CareerStanding } from '../contracts/world.ts';

export type Journal = { character: CharacterInstanceId; quests: ReadonlyMap<QuestId, QuestState> };
export type AdvanceContext = {
  quests: ReadonlyMap<QuestId, QuestDefinition>; // the loaded content (Registry['quests'])
  standing: CareerStanding; // server-verified career level: opens the quest's gate and 'tier-at-least'
  member?: boolean;
  at: string; // server time (ISO UTC) stamped on a new journal entry
  choice?: string; // the option the player picked, for 'choice' conditions
  hasItem?: (item: ItemId) => boolean; // injected so this module never reads an inventory
  standingWith?: (faction: FactionId) => number;
  cleared?: (encounter: EncounterId) => boolean;
};
// What origins/progression's award() takes as a 'story' event, minus the server's own clock.
export type StoryEvent = { kind: 'story'; type: 'story-step' | 'story-chapter'; id: string };
export type Advanced = { journal: Journal; rewards: Stage['rewards'] | null; event: StoryEvent | null };

export const newJournal = (character: CharacterInstanceId): Journal => ({ character, quests: new Map() });
export const progressOf = (journal: Journal, quest: QuestId): QuestStatus | 'not-started' => journal.quests.get(quest)?.status ?? 'not-started';

// Every entry the player has read, oldest first by server time (same-time entries keep quest order; each quest's own list is chronological).
export const entries = (journal: Journal): { quest: QuestId; stage: string; text: string; at: string }[] =>
  [...journal.quests.values()].flatMap((s) => s.journal.map((e) => ({ quest: s.quest, ...e }))).sort((a, b) => Date.parse(a.at) - Date.parse(b.at));

function holds(c: Condition, state: QuestState, journal: Journal, ctx: AdvanceContext): boolean {
  switch (c.kind) {
    case 'choice': return ctx.choice === c.choice;
    case 'flag': return (Object.hasOwn(state.flags, c.name) && state.flags[c.name] === true) === c.value;
    case 'stage-reached': {
      const other = journal.quests.get(c.quest);
      return other !== undefined && (other.stage === c.stage || other.rewarded.includes(c.stage));
    }
    case 'tier-at-least': {
      const tier = verifiedTier(ctx.standing);
      return tier.ok && tierLevel(tier.value) >= tierLevel(c.tier);
    }
    case 'has-item': return ctx.hasItem?.(c.item) === true;
    case 'standing-at-least': return (ctx.standingWith?.(c.faction) ?? -Infinity) >= c.value;
    case 'encounter-cleared': return ctx.cleared?.(c.encounter) === true;
  }
}

// Move one quest to `toStage`. A quest starts only at its start stage, behind its gate; after that only along a transition from the
// current stage whose conditions all hold (branching: the caller names which next stage). Finished and failed are final. Asking again
// for the stage the quest is already at is a replay: ok, nothing new. Reaching a stage the first time pays its rewards and one story
// event (a finish is the quest's chapter end; a failure pays none); a stage reached again through a loop pays nothing.
export function advance(journal: Journal, questId: QuestId, toStage: string, ctx: AdvanceContext): Result<Advanced> {
  const def = ctx.quests.get(questId);
  if (!def) return fail('unknown-id', 'quest', `quest ${String(questId)} is not in this content`);
  const target = def.stages.find((s) => s.id === toStage);
  if (!target) return fail('unknown-id', 'stage', `stage ${JSON.stringify(toStage)} is not in ${def.id}`);
  if (!ISO_UTC.test(ctx.at) || Number.isNaN(Date.parse(ctx.at))) return fail('wrong-type', 'at', 'the server time is an ISO UTC timestamp');
  const prev = journal.quests.get(questId);
  let state: QuestState;
  if (!prev) {
    if (toStage !== def.start) return fail('rule-violation', 'stage', `${def.id} starts at "${def.start}"`);
    const access = gateAccess(def.gate, ctx.standing, ctx.member === true);
    if (!access.ok) return fail('rule-violation', 'gate', `${def.id} is behind the ${def.gate} gate: needs ${access.needs}`);
    state = { kind: 'quest-state', schemaVersion: 1, character: journal.character, quest: def.id, storyVersion: def.storyVersion, stage: toStage, status: statusFor(target.kind), journal: [], flags: {}, rewarded: [] };
  } else {
    if (prev.storyVersion !== def.storyVersion) return fail('story-version-mismatch', 'storyVersion', `migrate ${def.id} to story version ${def.storyVersion} first`);
    if (prev.stage === toStage) return ok({ journal, rewards: null, event: null });
    if (prev.status !== 'active') return fail('rule-violation', 'status', `${def.id} is ${prev.status}; that is final`);
    const ways = def.stages.find((s) => s.id === prev.stage)?.transitions.filter((t) => t.to === toStage) ?? [];
    if (ways.length === 0) return fail('rule-violation', 'stage', `no way from "${prev.stage}" to "${toStage}" in ${def.id}`);
    if (!ways.some((t) => t.when.every((c) => holds(c, prev, journal, ctx)))) return fail('rule-violation', 'stage', `the conditions for "${toStage}" do not hold`);
    state = { ...prev, stage: toStage, status: statusFor(target.kind) };
  }
  if (target.journal !== '' && !state.journal.some((e) => e.stage === toStage)) state = { ...state, journal: [...state.journal, { stage: toStage, text: target.journal, at: ctx.at }] };
  const granted = grantStageRewards(state, def, toStage); // refused only when this stage already paid
  const fresh = granted.ok ? granted.value : null;
  const quests = new Map(journal.quests).set(questId, fresh?.state ?? state);
  const event: StoryEvent | null = fresh && target.kind !== 'fail' ? { kind: 'story', type: target.kind === 'finish' ? 'story-chapter' : 'story-step', id: `${def.id}:${toStage}` } : null;
  return ok({ journal: { ...journal, quests }, rewards: fresh?.rewards ?? null, event });
}

// A journal from stored rows (one QuestState each): parsed, migrated to the current story version, and checked against the content.
export function loadJournal(character: CharacterInstanceId, rows: readonly unknown[], quests: ReadonlyMap<QuestId, QuestDefinition>): Result<Journal> {
  const loaded = new Map<QuestId, QuestState>();
  for (const [i, row] of rows.entries()) {
    const parsed = parseQuestState(row, `[${i}]`);
    if (!parsed.ok) return parsed;
    const def = quests.get(parsed.value.quest);
    if (!def) return fail('unknown-id', `[${i}].quest`, `quest ${parsed.value.quest} is not in this content`);
    if (parsed.value.character !== character) return fail('rule-violation', `[${i}].character`, `row belongs to ${parsed.value.character}`);
    if (loaded.has(def.id)) return fail('duplicate-id', `[${i}].quest`, `${def.id} has two rows`);
    const migrated = migrateQuestState(parsed.value, def);
    if (!migrated.ok) return migrated;
    const issues = checkQuestState(migrated.value, def, `[${i}]`);
    if (issues.length) return { ok: false, issues };
    loaded.set(def.id, migrated.value);
  }
  return ok({ character, quests: loaded });
}
