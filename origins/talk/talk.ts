// Origins O2: NPC talk — one NPC's lines offered as a choice list (Gothic infos) and filtered by conditions (OpenMW info filtering).
//
// Rules: docs/specs/origins/gothic-dialogue.md (a flat per-NPC pool; filter by condition and "already told"; sort ascending by number,
// ties in content order; a non-permanent info disappears once said, keyed by the listener) and openmw-dialogue-conditions.md (every
// condition must hold, AND; structured conditions, never script text; result scripts become a data-driven effect list).
// Pure: no clock, randomness or I/O. Quest state comes in through `Facts.quest` and a quest step goes out through the caller's `advance`
// (the O2 quest journal's advance, bound to the current journal), so this module never imports the journal. State in, new state out.
import { Issues, LOCAL_KEY, fail, isPlainObject, join, ok, readArray, readBoolean, readInt, readKind, readObject, readSchemaVersion, readString, readText, type Result } from '../contracts/core.ts';
import { readId, type CharacterId, type QuestId } from '../contracts/ids.ts';
import { holdsCondition, readCondition, type Condition, type ConditionFacts } from '../contracts/story.ts';

export const TALK_VERSION = 1;
// The contracts' conditions minus 'choice' (here the pick is the choice). 'flag' reads this character's talk flags, which 'set-flag' writes.
export type TalkCondition = Exclude<Condition, { kind: 'choice' }>;
export type Effect =
  | { kind: 'quest'; quest: QuestId; stage: string; choice: string | null } // give a quest (its start stage) or advance it one step
  | { kind: 'set-flag'; name: string; value: boolean }
  | { kind: 'end' }; // the conversation closes after this reply
export type Line = { id: string; text: string; reply: string; priority: number; once: boolean; when: TalkCondition[]; effects: Effect[] };
export type Talk = { npc: CharacterId; lines: readonly Line[] }; // priority ascending, ties in content order
export type TalkState = { told: ReadonlySet<string>; flags: ReadonlyMap<string, boolean> }; // one per character, across every NPC
export type Facts = Omit<ConditionFacts, 'choice' | 'flag'>; // quest: e.g. (id) => journal.quests.get(id); flags come from the talk state
export type Advance<J> = (quest: QuestId, stage: string, choice: string | null) => Result<J>;
export type Picked<J> = { reply: string; effects: readonly Effect[]; state: TalkState; journal: J | null };

export const newTalkState = (): TalkState => ({ told: new Set(), flags: new Map() });

function readTalkCondition(issues: Issues, raw: unknown, path: string): TalkCondition | undefined {
  const c = readCondition(issues, raw, path);
  if (c?.kind !== 'choice') return c;
  issues.add('content-rule', join(path, 'kind'), 'a talk line is itself the choice; "choice" conditions belong to quest transitions');
  return undefined;
}

function readEffect(issues: Issues, raw: unknown, path: string): Effect | undefined {
  const kind = isPlainObject(raw) ? raw.kind : undefined;
  if (kind === 'quest') {
    const o = readObject(issues, raw, path, ['kind', 'quest', 'stage', 'choice']);
    const quest = o && readId(issues, o, 'quest', path, 'quest'), stage = o && readString(issues, o, 'stage', path, { pattern: LOCAL_KEY });
    const choice = o && (o.choice === null || o.choice === undefined ? null : readString(issues, o, 'choice', path, { pattern: LOCAL_KEY }));
    return quest && stage && choice !== undefined ? { kind, quest, stage, choice } : undefined;
  }
  if (kind === 'set-flag') {
    const o = readObject(issues, raw, path, ['kind', 'name', 'value']);
    const name = o && readString(issues, o, 'name', path, { pattern: LOCAL_KEY }), value = o && readBoolean(issues, o, 'value', path);
    return name && value !== undefined ? { kind, name, value } : undefined;
  }
  if (kind === 'end') return readObject(issues, raw, path, ['kind']) && { kind };
  issues.add('unknown-kind', join(path, 'kind'), `unsupported effect ${JSON.stringify(kind)}; supported: quest, set-flag, end`);
  return undefined;
}

function readLine(issues: Issues, raw: unknown, path: string): Line | undefined {
  const o = readObject(issues, raw, path, ['id', 'text', 'reply', 'priority', 'once', 'when', 'effects']);
  if (!o) return undefined;
  const id = readString(issues, o, 'id', path, { pattern: LOCAL_KEY });
  const text = readText(issues, o, 'text', path, { max: 120 }), reply = readText(issues, o, 'reply', path, { max: 600 });
  const priority = readInt(issues, o, 'priority', path, 0, 999), once = readBoolean(issues, o, 'once', path);
  const when = readArray(issues, o, 'when', path, (v, p) => readTalkCondition(issues, v, p), { max: 16 });
  const effects = readArray(issues, o, 'effects', path, (v, p) => readEffect(issues, v, p), { max: 8 });
  if (effects && effects.filter((e) => e.kind === 'quest').length > 1) issues.add('content-rule', join(path, 'effects'), 'one quest effect per line: a pick moves the journal one step');
  return id && text && reply && priority !== undefined && once !== undefined && when && effects ? { id, text, reply, priority, once, when, effects } : undefined;
}

// One NPC's talk content, checked whole at load (every issue listed, like the contracts' readers).
export function loadTalk(raw: unknown): Result<Talk> {
  const issues = new Issues();
  const obj = readObject(issues, raw, '', ['kind', 'schemaVersion', 'npc', 'lines']);
  if (!obj) return issues.finish(undefined as never);
  readKind(issues, obj, '', 'npc-talk');
  readSchemaVersion(issues, obj, '', [TALK_VERSION]);
  const npc = readId(issues, obj, 'npc', '', 'character');
  const lines = readArray(issues, obj, 'lines', '', (v, p) => readLine(issues, v, p), { min: 1, max: 200 });
  const seen = new Set<string>();
  lines?.forEach((l, i) => {
    if (seen.has(l.id)) issues.add('duplicate-id', `lines[${i}].id`, `line "${l.id}" appears twice`);
    seen.add(l.id);
  });
  if (!issues.empty || !npc || !lines) return issues.finish(undefined as never);
  return ok({ npc, lines: [...lines].sort((a, b) => a.priority - b.priority) }); // sort is stable: ties keep content order
}

const toldKey = (talk: Talk, line: Line): string => `${talk.npc} ${line.id}`;
const said = (talk: Talk, state: TalkState, line: Line): boolean => line.once && state.told.has(toldKey(talk, line));
const available = (talk: Talk, state: TalkState, line: Line, f: Facts): boolean => !said(talk, state, line) && line.when.every((c) => holdsCondition(c, { ...f, flag: (n) => state.flags.get(n) === true }));

// What the player can say now, in menu order.
export const choices = (talk: Talk, state: TalkState, f: Facts): Line[] => talk.lines.filter((l) => available(talk, state, l, f));

// Say one line. Refused (state untouched, nothing emitted) when the line is unknown, not available now, or the journal refuses its quest
// step. Otherwise the reply, the line's effects, the new talk state, and the journal the caller's advance returned (null if no quest).
export function pick<J>(talk: Talk, state: TalkState, lineId: string, f: Facts, advance: Advance<J>): Result<Picked<J>> {
  const line = talk.lines.find((l) => l.id === lineId);
  if (!line) return fail('unknown-id', 'line', `${talk.npc} has no line ${JSON.stringify(lineId)}`);
  if (!available(talk, state, line, f)) return fail('rule-violation', 'line', said(talk, state, line) ? `"${line.id}" is said once and was said` : `"${line.id}" is not available now`);
  let journal: J | null = null;
  let flags = state.flags;
  for (const e of line.effects) {
    if (e.kind === 'set-flag') flags = new Map(flags).set(e.name, e.value);
    if (e.kind !== 'quest') continue;
    const advanced = advance(e.quest, e.stage, e.choice);
    if (!advanced.ok) return advanced;
    journal = advanced.value;
  }
  const told = line.once ? new Set(state.told).add(toldKey(talk, line)) : state.told;
  return ok({ reply: line.reply, effects: line.effects, state: { told, flags }, journal });
}
