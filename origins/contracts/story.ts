// Origins O1: quests — QuestDefinition (stages, branching conditions, journal text, a story version) and QuestState (one character's
// progress, stamped with the story version it was made under, migratable when a chapter changes).
//
// Stages are named, not numbered. A stage is progress, a finish or a failure; branching is a list of transitions, each guarded by
// conditions that must all hold. Every condition kind is listed below: content that asks for anything else is refused with an explicit
// "unsupported condition" issue rather than translated into a guess (blueprint Stage B: unsupported script behaviour must be reported).
// The graph is checked when the content loads, so a soft lock (a stage you can enter and never leave) is a content error, not a bug report.
import { isTier, levelOf, type Tier } from '../../src/grades.ts';
import {
  Issues, LOCAL_KEY, checkString, isPlainObject, join, ok, readArray, readEnum, readInt, readKind, readObject, readSchemaVersion, readString, readText, readTimestamp,
  fail, type Issue, type Obj, type Result,
} from './core.ts';
import { readId, readOptionalId, type CharacterInstanceId, type EncounterId, type FactionId, type ItemId, type LootTableId, type QuestId } from './ids.ts';
import { GATES, STANDING_MAX, STANDING_MIN, verifiedTier, type CareerStanding, type Gate } from './world.ts';

export const QUEST_DEFINITION_VERSION = 1;
export const QUEST_STATE_VERSION = 1;
// The three kinds of story state (blueprint §9): a personal journal decision, a party-instance decision, a shared world-event outcome.
export const QUEST_SCOPES = ['personal', 'party', 'world'] as const;
export const STAGE_KINDS = ['progress', 'finish', 'fail'] as const;
export type StageKind = (typeof STAGE_KINDS)[number];

export type Condition =
  | { kind: 'choice'; choice: string } // the player picked this option at this stage
  | { kind: 'flag'; name: string; value: boolean } // a flag on this quest's state
  | { kind: 'stage-reached'; quest: QuestId; stage: string } // another quest's progress
  | { kind: 'quest-at'; quest: QuestId; stage: string | null } // where a quest stands now; null = not started
  | { kind: 'standing-at-least'; faction: FactionId; value: number }
  | { kind: 'tier-at-least'; tier: Tier } // read through the canonical rank function, never a hardcoded win count
  | { kind: 'has-item'; item: ItemId }
  | { kind: 'encounter-cleared'; encounter: EncounterId };
export const CONDITION_KINDS = ['choice', 'flag', 'stage-reached', 'quest-at', 'standing-at-least', 'tier-at-least', 'has-item', 'encounter-cleared'] as const;

export type Transition = { to: string; when: Condition[]; label: string | null };
export type Stage = {
  id: string;
  kind: StageKind;
  journal: string; // the entry written when the stage is reached; '' = counts but is not listed
  transitions: Transition[];
  rewards: { loot: LootTableId | null; standing: { faction: FactionId; delta: number }[] };
};
export type Migration = { fromVersion: number; stageMap: { from: string; to: string }[]; checkpoint: string };
export type QuestDefinition = {
  kind: 'quest-definition';
  schemaVersion: 1;
  id: QuestId;
  title: string;
  storyVersion: number;
  scope: (typeof QUEST_SCOPES)[number];
  gate: Gate;
  start: string;
  stages: Stage[];
  migrations: Migration[];
};

const QUEST_KEYS = ['kind', 'schemaVersion', 'id', 'title', 'storyVersion', 'scope', 'gate', 'start', 'stages', 'migrations'] as const;
const MAX_DELTA = 200;

export function readCondition(issues: Issues, raw: unknown, path: string): Condition | undefined {
  if (!isPlainObject(raw)) {
    issues.add('not-object', path, 'expected a condition object');
    return undefined;
  }
  const kind = raw.kind;
  if (typeof kind !== 'string' || !(CONDITION_KINDS as readonly string[]).includes(kind)) {
    issues.add('unknown-kind', join(path, 'kind'), `unsupported condition ${JSON.stringify(kind)}; supported: ${CONDITION_KINDS.join(', ')}`);
    return undefined;
  }
  const keys = (extra: string[]): Obj | undefined => readObject(issues, raw, path, ['kind', ...extra]);
  switch (kind) {
    case 'choice': {
      const o = keys(['choice']); const choice = o && readString(issues, o, 'choice', path, { pattern: LOCAL_KEY });
      return choice ? { kind, choice } : undefined;
    }
    case 'flag': {
      const o = keys(['name', 'value']); const name = o && readString(issues, o, 'name', path, { pattern: LOCAL_KEY });
      const value = o && typeof o.value === 'boolean' ? o.value : (issues.add('wrong-type', join(path, 'value'), 'expected a boolean'), undefined);
      return name && value !== undefined ? { kind, name, value } : undefined;
    }
    case 'stage-reached': {
      const o = keys(['quest', 'stage']); const quest = o && readId(issues, o, 'quest', path, 'quest'), stage = o && readString(issues, o, 'stage', path, { pattern: LOCAL_KEY });
      return quest && stage ? { kind, quest, stage } : undefined;
    }
    case 'quest-at': {
      const o = keys(['quest', 'stage']); const quest = o && readId(issues, o, 'quest', path, 'quest');
      const stage = o && (o.stage === null ? null : readString(issues, o, 'stage', path, { pattern: LOCAL_KEY }));
      return quest && stage !== undefined ? { kind, quest, stage } : undefined;
    }
    case 'standing-at-least': {
      const o = keys(['faction', 'value']); const faction = o && readId(issues, o, 'faction', path, 'faction'), value = o && readInt(issues, o, 'value', path, STANDING_MIN, STANDING_MAX);
      return faction && value !== undefined ? { kind, faction, value } : undefined;
    }
    case 'tier-at-least': {
      const o = keys(['tier']);
      if (o && !isTier(o.tier)) issues.add('wrong-type', join(path, 'tier'), 'expected a rank title (Recruit … Origin)');
      return o && isTier(o.tier) ? { kind, tier: o.tier } : undefined;
    }
    case 'has-item': {
      const o = keys(['item']); const item = o && readId(issues, o, 'item', path, 'item');
      return item ? { kind, item } : undefined;
    }
    case 'encounter-cleared': {
      const o = keys(['encounter']); const encounter = o && readId(issues, o, 'encounter', path, 'encounter');
      return encounter ? { kind, encounter } : undefined;
    }
  }
  return undefined;
}

// The lookups a condition reads, injected so the contracts never read a journal, inventory or talk state. A missing lookup fails closed.
export type ConditionFacts = {
  standing: CareerStanding; // server-verified career level, for 'tier-at-least'
  quest: (id: QuestId) => Pick<QuestState, 'stage' | 'rewarded'> | undefined; // undefined = not started
  choice?: string; // the option the player picked
  flag?: (name: string) => boolean;
  hasItem?: (item: ItemId) => boolean;
  standingWith?: (faction: FactionId) => number;
  cleared?: (encounter: EncounterId) => boolean;
};

// The one evaluator for Condition: quest journal transitions and NPC talk lines both call it.
export function holdsCondition(c: Condition, f: ConditionFacts): boolean {
  switch (c.kind) {
    case 'choice': return f.choice === c.choice;
    case 'flag': return (f.flag?.(c.name) === true) === c.value;
    case 'stage-reached': {
      const q = f.quest(c.quest);
      return q !== undefined && (q.stage === c.stage || q.rewarded.includes(c.stage));
    }
    case 'quest-at': return (f.quest(c.quest)?.stage ?? null) === c.stage;
    case 'tier-at-least': {
      const tier = verifiedTier(f.standing);
      return tier.ok && levelOf(tier.value) >= levelOf(c.tier);
    }
    case 'has-item': return f.hasItem?.(c.item) === true;
    case 'standing-at-least': return (f.standingWith?.(c.faction) ?? -Infinity) >= c.value;
    case 'encounter-cleared': return f.cleared?.(c.encounter) === true;
  }
}

function readStage(issues: Issues, raw: unknown, path: string): Stage | undefined {
  const obj = readObject(issues, raw, path, ['id', 'kind', 'journal', 'transitions', 'rewards']);
  if (!obj) return undefined;
  const id = readString(issues, obj, 'id', path, { pattern: LOCAL_KEY });
  const kind = readEnum(issues, obj, 'kind', path, STAGE_KINDS);
  const journal = readText(issues, obj, 'journal', path, { min: 0, max: 600 });
  const transitions = readArray(issues, obj, 'transitions', path, (v, p) => {
    const t = readObject(issues, v, p, ['to', 'when', 'label']);
    if (!t) return undefined;
    const to = readString(issues, t, 'to', p, { pattern: LOCAL_KEY });
    const when = readArray(issues, t, 'when', p, (cv, cp) => readCondition(issues, cv, cp), { max: 16 });
    const label = t.label === null || t.label === undefined ? null : readText(issues, t, 'label', p, { max: 80 });
    return to && when && label !== undefined ? { to, when, label } : undefined;
  }, { max: 16 });
  let rewards: Stage['rewards'] | undefined;
  const r = Object.hasOwn(obj, 'rewards') ? readObject(issues, obj.rewards, join(path, 'rewards'), ['loot', 'standing']) : (issues.add('missing-field', join(path, 'rewards'), 'required field "rewards" is missing'), undefined);
  if (r) {
    const loot = readOptionalId(issues, r, 'loot', join(path, 'rewards'), 'loottable');
    const standing = readArray(issues, r, 'standing', join(path, 'rewards'), (v, p) => {
      const s = readObject(issues, v, p, ['faction', 'delta']);
      const faction = s && readId(issues, s, 'faction', p, 'faction'), delta = s && readInt(issues, s, 'delta', p, -MAX_DELTA, MAX_DELTA);
      return faction && delta !== undefined ? { faction, delta } : undefined;
    }, { max: 16 });
    if (loot !== undefined && standing) rewards = { loot, standing };
  }
  return id && kind && journal !== undefined && transitions && rewards ? { id, kind, journal, transitions, rewards } : undefined;
}

// The story graph rules, on a fully parsed definition.
function checkGraph(issues: Issues, def: Omit<QuestDefinition, 'migrations'>, path: string): void {
  const byId = new Map<string, Stage>();
  def.stages.forEach((stage, i) => {
    if (byId.has(stage.id)) issues.add('duplicate-id', join(join(join(path, 'stages'), i), 'id'), `stage "${stage.id}" is defined twice`);
    byId.set(stage.id, stage);
  });
  if (!byId.has(def.start)) issues.add('unknown-id', join(path, 'start'), `start stage "${def.start}" does not exist`);
  def.stages.forEach((stage, i) => {
    const sp = join(join(path, 'stages'), i);
    const terminal = stage.kind !== 'progress';
    if (terminal && stage.transitions.length > 0) issues.add('rule-violation', join(sp, 'transitions'), `a ${stage.kind} stage ends the quest and has no transitions`);
    if (!terminal && stage.transitions.length === 0) issues.add('rule-violation', join(sp, 'transitions'), `progress stage "${stage.id}" has no way out (soft lock)`);
    stage.transitions.forEach((t, j) => {
      if (!byId.has(t.to)) issues.add('unknown-id', join(join(join(sp, 'transitions'), j), 'to'), `stage "${t.to}" does not exist`);
    });
  });
  if (!def.stages.some((s) => s.kind === 'finish')) issues.add('rule-violation', join(path, 'stages'), 'a quest has at least one finish stage');
  if (!issues.empty) return;
  // Reachable from the start, and every stage can still reach an ending.
  const reached = new Set<string>([def.start]);
  const queue = [def.start];
  while (queue.length) for (const t of byId.get(queue.shift()!)!.transitions) if (!reached.has(t.to)) { reached.add(t.to); queue.push(t.to); }
  const ends = new Set(def.stages.filter((s) => s.kind !== 'progress').map((s) => s.id));
  for (let changed = true; changed;) {
    changed = false;
    for (const s of def.stages) if (!ends.has(s.id) && s.transitions.some((t) => ends.has(t.to))) { ends.add(s.id); changed = true; }
  }
  def.stages.forEach((stage, i) => {
    const sp = join(join(path, 'stages'), i);
    if (!reached.has(stage.id)) issues.add('rule-violation', sp, `stage "${stage.id}" cannot be reached from "${def.start}"`);
    if (!ends.has(stage.id)) issues.add('rule-violation', sp, `stage "${stage.id}" can never reach an ending (soft lock)`);
  });
}

export function parseQuestDefinition(raw: unknown, path = ''): Result<QuestDefinition> {
  const issues = new Issues();
  const obj = readObject(issues, raw, path, QUEST_KEYS);
  if (!obj) return issues.finish(undefined as never);
  readKind(issues, obj, path, 'quest-definition');
  readSchemaVersion(issues, obj, path, [QUEST_DEFINITION_VERSION]);
  const id = readId(issues, obj, 'id', path, 'quest');
  const title = readText(issues, obj, 'title', path, { max: 80 });
  const storyVersion = readInt(issues, obj, 'storyVersion', path, 1, 1000);
  const scope = readEnum(issues, obj, 'scope', path, QUEST_SCOPES);
  const gate = readEnum(issues, obj, 'gate', path, GATES);
  const start = readString(issues, obj, 'start', path, { pattern: LOCAL_KEY });
  const stages = readArray(issues, obj, 'stages', path, (v, p) => readStage(issues, v, p), { min: 1, max: 64 });
  const migrations = readArray(issues, obj, 'migrations', path, (v, p) => {
    const m = readObject(issues, v, p, ['fromVersion', 'stageMap', 'checkpoint']);
    if (!m) return undefined;
    const fromVersion = readInt(issues, m, 'fromVersion', p, 1, 1000);
    const stageMap = readArray(issues, m, 'stageMap', p, (sv, sp) => {
      const e = readObject(issues, sv, sp, ['from', 'to']);
      const from = e && readString(issues, e, 'from', sp, { pattern: LOCAL_KEY }), to = e && readString(issues, e, 'to', sp, { pattern: LOCAL_KEY });
      return from && to ? { from, to } : undefined;
    }, { max: 64 });
    const checkpoint = readString(issues, m, 'checkpoint', p, { pattern: LOCAL_KEY });
    return fromVersion !== undefined && stageMap && checkpoint ? { fromVersion, stageMap, checkpoint } : undefined;
  }, { max: 32 });
  if (!issues.empty) return issues.finish(undefined as never);
  const def: QuestDefinition = { kind: 'quest-definition', schemaVersion: 1, id: id!, title: title!, storyVersion: storyVersion!, scope: scope!, gate: gate!, start: start!, stages: stages!, migrations: migrations! };
  checkGraph(issues, def, path);
  const stageIds = new Set(def.stages.map((s) => s.id));
  const versions = new Set<number>();
  def.migrations.forEach((m, i) => {
    const mp = join(join(path, 'migrations'), i);
    if (m.fromVersion >= def.storyVersion) issues.add('rule-violation', join(mp, 'fromVersion'), `a migration comes from an older story version than ${def.storyVersion}`);
    if (versions.has(m.fromVersion)) issues.add('duplicate-id', join(mp, 'fromVersion'), `two migrations from version ${m.fromVersion}`);
    versions.add(m.fromVersion);
    if (!stageIds.has(m.checkpoint)) issues.add('unknown-id', join(mp, 'checkpoint'), `checkpoint "${m.checkpoint}" is not a current stage`);
    const froms = new Set<string>();
    m.stageMap.forEach((e, j) => {
      if (froms.has(e.from)) issues.add('duplicate-id', join(join(join(mp, 'stageMap'), j), 'from'), `old stage "${e.from}" is mapped twice`);
      froms.add(e.from);
      if (!stageIds.has(e.to)) issues.add('unknown-id', join(join(join(mp, 'stageMap'), j), 'to'), `"${e.to}" is not a current stage`);
    });
  });
  return issues.finish(def);
}

// ---- QuestState ---------------------------------------------------------------------------------------------------------------------

export const QUEST_STATUSES = ['active', 'finished', 'failed'] as const;
export type QuestStatus = (typeof QUEST_STATUSES)[number];
export type JournalEntry = { stage: string; text: string; at: string };
export type QuestState = {
  kind: 'quest-state';
  schemaVersion: 1;
  character: CharacterInstanceId;
  quest: QuestId;
  storyVersion: number;
  stage: string;
  status: QuestStatus;
  // Chronological. The text is final when written and never re-resolved: a later content edit does not rewrite what the player read.
  journal: JournalEntry[];
  flags: Record<string, boolean>;
  // The stages whose rewards have been granted, in the current story version's stage names. A stage's rewards are granted once, ever
  // (grantStageRewards); migrations carry this record through the stage map. Optional on the wire with a defined default of [] so every
  // state written before it existed validates unchanged; always present once parsed.
  rewarded: string[];
};
const STATE_KEYS = ['kind', 'schemaVersion', 'character', 'quest', 'storyVersion', 'stage', 'status', 'journal', 'flags', 'rewarded'] as const;
const MAX_STAGES = 64;
export const statusFor = (kind: StageKind): QuestStatus => (kind === 'finish' ? 'finished' : kind === 'fail' ? 'failed' : 'active');

export function parseQuestState(raw: unknown, path = ''): Result<QuestState> {
  const issues = new Issues();
  const obj = readObject(issues, raw, path, STATE_KEYS);
  if (!obj) return issues.finish(undefined as never);
  readKind(issues, obj, path, 'quest-state');
  readSchemaVersion(issues, obj, path, [QUEST_STATE_VERSION]);
  const character = readId(issues, obj, 'character', path, 'pc');
  const quest = readId(issues, obj, 'quest', path, 'quest');
  const storyVersion = readInt(issues, obj, 'storyVersion', path, 1, 1000);
  const stage = readString(issues, obj, 'stage', path, { pattern: LOCAL_KEY });
  const status = readEnum(issues, obj, 'status', path, QUEST_STATUSES);
  const journal = readArray(issues, obj, 'journal', path, (v, p) => {
    const e = readObject(issues, v, p, ['stage', 'text', 'at']);
    const s = e && readString(issues, e, 'stage', p, { pattern: LOCAL_KEY }), text = e && readText(issues, e, 'text', p, { max: 600 }), at = e && readTimestamp(issues, e, 'at', p);
    return s && text && at ? { stage: s, text, at } : undefined;
  }, { max: 256 });
  let flags: Record<string, boolean> | undefined;
  if (!Object.hasOwn(obj, 'flags')) issues.add('missing-field', join(path, 'flags'), 'required field "flags" is missing ({} for none)');
  else if (!isPlainObject(obj.flags)) issues.add('not-object', join(path, 'flags'), 'expected an object of boolean flags');
  else {
    flags = {};
    for (const [name, value] of Object.entries(obj.flags)) {
      if (!LOCAL_KEY.test(name)) issues.add('bad-id', join(join(path, 'flags'), name), `flag name "${name}" must be a lowercase key`);
      else if (typeof value !== 'boolean') issues.add('wrong-type', join(join(path, 'flags'), name), 'a flag is true or false');
      else flags[name] = value;
    }
  }
  let rewarded: string[] | undefined = [];
  if (Object.hasOwn(obj, 'rewarded')) {
    rewarded = readArray(issues, obj, 'rewarded', path, (v, p) => checkString(issues, v, p, { pattern: LOCAL_KEY }), { max: MAX_STAGES });
    rewarded?.forEach((id, i) => {
      if (rewarded!.indexOf(id) !== i) issues.add('duplicate-id', join(join(path, 'rewarded'), i), `stage "${id}" is recorded as rewarded twice`);
    });
  }
  return issues.finish({ kind: 'quest-state', schemaVersion: 1, character: character!, quest: quest!, storyVersion: storyVersion!, stage: stage!, status: status!, journal: journal!, flags: flags!, rewarded: rewarded! });
}

// A state against the definition it claims to follow. A different story version is its own code so the caller migrates rather than
// reading stage names that may mean something else now.
export function checkQuestState(state: QuestState, def: QuestDefinition, path = ''): Issue[] {
  const issues = new Issues();
  if (state.quest !== def.id) issues.add('rule-violation', join(path, 'quest'), `state is for ${state.quest}, checked against ${def.id}`);
  if (state.storyVersion !== def.storyVersion) {
    issues.add('story-version-mismatch', join(path, 'storyVersion'), `state was written under story version ${state.storyVersion}; content is at ${def.storyVersion} (migrate first)`);
    return issues.list;
  }
  const stage = def.stages.find((s) => s.id === state.stage);
  if (!stage) issues.add('unknown-id', join(path, 'stage'), `stage "${state.stage}" is not in ${def.id} v${def.storyVersion}`);
  else if (statusFor(stage.kind) !== state.status) issues.add('rule-violation', join(path, 'status'), `stage "${stage.id}" is a ${stage.kind} stage, so the status is "${statusFor(stage.kind)}"`);
  state.rewarded.forEach((id, i) => {
    if (!def.stages.some((s) => s.id === id)) issues.add('unknown-id', join(join(path, 'rewarded'), i), `rewarded stage "${id}" is not in ${def.id} v${def.storyVersion}`);
  });
  return issues.list;
}

// Move a state written under an older story version onto the current one. No migration for that version is an explicit failure, never a
// guess. Journal and flags are kept as written.
//   - An ACTIVE quest goes to the mapped stage if the migration names it, else to the migration's safe checkpoint.
//   - A FINISHED or FAILED quest stays terminal: its ending must be mapped onto a current stage of the same kind (finish → finish,
//     fail → fail). It is never sent to the checkpoint or any progress stage, where its stage rewards could pay a second time; with no
//     such mapping the migration is refused ('no-migration') and the content needs a stageMap entry for that ending.
//   - The rewards record is carried through the same stage map. A granted stage the map renames is recorded under its new name; one the
//     map does not name is kept if a current stage still has that name (over-recording can only withhold a reward, never pay one twice)
//     and dropped only when no current stage has it.
export function migrateQuestState(state: QuestState, def: QuestDefinition): Result<QuestState> {
  if (state.quest !== def.id) return fail('rule-violation', 'quest', `state is for ${state.quest}, not ${def.id}`);
  if (state.storyVersion === def.storyVersion) return ok(state);
  if (state.storyVersion > def.storyVersion) return fail('story-version-mismatch', 'storyVersion', `state is from story version ${state.storyVersion}, newer than this content (${def.storyVersion})`);
  const migration = def.migrations.find((m) => m.fromVersion === state.storyVersion);
  if (!migration) return fail('no-migration', 'storyVersion', `${def.id} has no migration from story version ${state.storyVersion}`);
  const mapped = migration.stageMap.find((e) => e.from === state.stage)?.to;
  let stage: Stage;
  if (state.status === 'active') {
    stage = def.stages.find((s) => s.id === (mapped ?? migration.checkpoint))!;
  } else {
    if (mapped === undefined) return fail('no-migration', 'stage', `${state.quest} is ${state.status} at "${state.stage}"; v${def.storyVersion} must map that ending, a ${state.status} quest is never reopened at a checkpoint`);
    stage = def.stages.find((s) => s.id === mapped)!;
    if (statusFor(stage.kind) !== state.status) return fail('rule-violation', 'stage', `${state.quest} is ${state.status}; "${mapped}" is a ${stage.kind} stage, and a ${state.status} quest stays ${state.status}`);
  }
  const current = new Set(def.stages.map((s) => s.id));
  const rewarded: string[] = [];
  for (const id of state.rewarded) {
    const to = migration.stageMap.find((e) => e.from === id)?.to ?? (current.has(id) ? id : undefined);
    if (to !== undefined && !rewarded.includes(to)) rewarded.push(to);
  }
  return ok({ ...state, storyVersion: def.storyVersion, stage: stage.id, status: statusFor(stage.kind), rewarded });
}

// Grant a stage's rewards: once, ever, and only at the stage the quest is at, under the current story version. Returns the state with the
// stage recorded and the rewards to pay; the server commits both in one transaction, so a retry finds the record and is refused.
export function grantStageRewards(state: QuestState, def: QuestDefinition, stageId: string): Result<{ state: QuestState; rewards: Stage['rewards'] }> {
  if (state.quest !== def.id) return fail('rule-violation', 'quest', `state is for ${state.quest}, not ${def.id}`);
  if (state.storyVersion !== def.storyVersion) return fail('story-version-mismatch', 'storyVersion', `state is at story version ${state.storyVersion}; migrate to ${def.storyVersion} first`);
  if (state.stage !== stageId) return fail('rule-violation', 'stage', `the quest is at "${state.stage}", not "${stageId}"`);
  const stage = def.stages.find((s) => s.id === stageId);
  if (!stage) return fail('unknown-id', 'stage', `stage "${stageId}" is not in ${def.id} v${def.storyVersion}`);
  if (state.rewarded.includes(stageId)) return fail('duplicate-id', 'rewarded', `the rewards of "${stageId}" were already granted`);
  return ok({ state: { ...state, rewarded: [...state.rewarded, stageId] }, rewards: stage.rewards });
}
