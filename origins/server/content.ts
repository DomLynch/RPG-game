// The story content the writer's quest and talk ops run on: one bundle (a JSON array of records), loaded once when the writer starts.
// Definitions go through the contracts' loadContent (every record parsed, every cross-reference resolved); npc-talk records go through
// the talk module's loadTalk, one per NPC, and every quest step a line can take must name a quest and stage the bundle defines.
import { readFileSync } from 'node:fs';
import { fail, isPlainObject, ok, type Issue, type Result } from '../contracts/core.ts';
import type { CharacterId } from '../contracts/ids.ts';
import { loadContent } from '../contracts/registry.ts';
import { loadTalk, type Talk } from '../talk/talk.ts';
import type { StoryContent } from './story.ts';

const isTalk = (r: unknown): boolean => isPlainObject(r) && r.kind === 'npc-talk';

export function loadStoryContent(records: unknown): Result<StoryContent> {
  if (!Array.isArray(records)) return fail('wrong-type', '(bundle)', 'a content bundle is an array of records');
  const reg = loadContent(records.filter(r => !isTalk(r)));
  if (!reg.ok) return reg;
  const talks = new Map<CharacterId, Talk>();
  const issues: Issue[] = [];
  records.forEach((raw, i) => {
    if (!isTalk(raw)) return;
    const loaded = loadTalk(raw);
    if (!loaded.ok) { issues.push(...loaded.issues.map(x => ({ ...x, path: `[${i}]${x.path ? `.${x.path}` : ''}` }))); return; }
    const talk = loaded.value;
    if (talks.has(talk.npc)) issues.push({ code: 'duplicate-id', path: `[${i}].npc`, message: `${talk.npc} has two talk records` });
    for (const line of talk.lines) for (const e of line.effects) {
      if (e.kind !== 'quest') continue;
      const quest = reg.value.quests.get(e.quest);
      if (!quest) issues.push({ code: 'unknown-id', path: `${talk.npc}.${line.id}`, message: `quest ${e.quest} is not defined in this content` });
      else if (!quest.stages.some(s => s.id === e.stage)) issues.push({ code: 'unknown-id', path: `${talk.npc}.${line.id}`, message: `${e.quest} has no stage "${e.stage}"` });
    }
    talks.set(talk.npc, talk);
  });
  return issues.length ? { ok: false, issues } : ok({ quests: reg.value.quests, talks });
}

// The writer's start-up read: a bundle that does not load stops the writer (it never serves on half its content).
export function readStoryContent(path: string): StoryContent {
  const loaded = loadStoryContent(JSON.parse(readFileSync(path, 'utf8')));
  if (!loaded.ok) throw Error(`origins content ${path}: ${loaded.issues.map(i => `${i.path} ${i.message}`).join('; ')}`);
  return loaded.value;
}
