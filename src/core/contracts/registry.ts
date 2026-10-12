// Origins O1: the content registry — one validated set of definitions, with every cross-reference resolved.
//
// Parsing a single record checks its shape and its own rules. Loading a bundle into the registry checks that every id it mentions exists
// (an unknown id is an 'unknown-id' issue with the path that named it) and that no id is defined twice. Lookups return a Result, never
// undefined, so "this id is not in the content" is always an explicit, typed answer.
import { Issues, KINDS, fail, isPlainObject, join, ok, type Issue, type Result } from './core.ts';
import type { CharacterId, CostTableId, EncounterId, FactionId, ItemId, LootTableId, QuestId, RegionId, ServiceId } from './ids.ts';
import { parseServiceDefinition, parseUpgradeCostTable, type ServiceDefinition, type UpgradeCostTable } from './economy.ts';
import { checkCustody, checkInstance, parseItemDefinition, parseLootTable, type ItemDefinition, type ItemInstance, type LootTable } from './items.ts';
import { parseQuestDefinition, type Condition, type QuestDefinition } from './story.ts';
import {
  parseCharacterDefinition, parseEncounterDefinition, parseFactionDefinition, parseRegionDefinition,
  type CharacterDefinition, type EncounterDefinition, type FactionDefinition, type RegionDefinition,
} from './world.ts';

export type Registry = {
  items: ReadonlyMap<ItemId, ItemDefinition>;
  lootTables: ReadonlyMap<LootTableId, LootTable>;
  characters: ReadonlyMap<CharacterId, CharacterDefinition>;
  factions: ReadonlyMap<FactionId, FactionDefinition>;
  regions: ReadonlyMap<RegionId, RegionDefinition>;
  encounters: ReadonlyMap<EncounterId, EncounterDefinition>;
  quests: ReadonlyMap<QuestId, QuestDefinition>;
  services: ReadonlyMap<ServiceId, ServiceDefinition>;
  costTables: ReadonlyMap<CostTableId, UpgradeCostTable>;
};

// Definitions only. Instances and states are per-player data, not content, and are refused here so they cannot be shipped as content.
const CONTENT_KINDS = ['item-definition', 'loot-table', 'character-definition', 'faction-definition', 'region-definition', 'encounter-definition', 'quest-definition', 'service-definition', 'upgrade-cost-table'] as const;

export function loadContent(records: unknown): Result<Registry> {
  if (!Array.isArray(records)) return fail('wrong-type', '(bundle)', 'a content bundle is an array of definitions');
  const issues = new Issues();
  const reg = {
    items: new Map<ItemId, ItemDefinition>(),
    lootTables: new Map<LootTableId, LootTable>(),
    characters: new Map<CharacterId, CharacterDefinition>(),
    factions: new Map<FactionId, FactionDefinition>(),
    regions: new Map<RegionId, RegionDefinition>(),
    encounters: new Map<EncounterId, EncounterDefinition>(),
    quests: new Map<QuestId, QuestDefinition>(),
    services: new Map<ServiceId, ServiceDefinition>(),
    costTables: new Map<CostTableId, UpgradeCostTable>(),
  };
  const put = <K extends string, V>(map: Map<K, V>, id: K, value: V, path: string): void => {
    if (map.has(id)) issues.add('duplicate-id', join(path, 'id'), `${id} is defined twice`);
    else map.set(id, value);
  };
  records.forEach((raw, i) => {
    const path = `[${i}]`;
    const kind = isPlainObject(raw) ? raw.kind : undefined;
    switch (kind) {
      case 'item-definition': { const r = issues.absorb(parseItemDefinition(raw, path)); if (r) put(reg.items, r.id, r, path); break; }
      case 'loot-table': { const r = issues.absorb(parseLootTable(raw, path)); if (r) put(reg.lootTables, r.id, r, path); break; }
      case 'character-definition': { const r = issues.absorb(parseCharacterDefinition(raw, path)); if (r) put(reg.characters, r.id, r, path); break; }
      case 'faction-definition': { const r = issues.absorb(parseFactionDefinition(raw, path)); if (r) put(reg.factions, r.id, r, path); break; }
      case 'region-definition': { const r = issues.absorb(parseRegionDefinition(raw, path)); if (r) put(reg.regions, r.id, r, path); break; }
      case 'encounter-definition': { const r = issues.absorb(parseEncounterDefinition(raw, path)); if (r) put(reg.encounters, r.id, r, path); break; }
      case 'quest-definition': { const r = issues.absorb(parseQuestDefinition(raw, path)); if (r) put(reg.quests, r.id, r, path); break; }
      case 'service-definition': { const r = issues.absorb(parseServiceDefinition(raw, path)); if (r) put(reg.services, r.id, r, path); break; }
      case 'upgrade-cost-table': { const r = issues.absorb(parseUpgradeCostTable(raw, path)); if (r) put(reg.costTables, r.id, r, path); break; }
      default: {
        const known = (KINDS as readonly unknown[]).includes(kind);
        issues.add('unknown-kind', join(path, 'kind'), known ? `"${String(kind)}" is player data, not content` : `unknown kind ${JSON.stringify(kind)}; content kinds: ${CONTENT_KINDS.join(', ')}`);
      }
    }
  });
  if (!issues.empty) return issues.finish(undefined as never);
  crossCheck(issues, reg);
  return issues.finish(reg);
}

function crossCheck(issues: Issues, reg: Registry): void {
  const need = <K>(map: ReadonlyMap<K, unknown>, id: K, path: string, what: string): boolean => {
    if (map.has(id)) return true;
    issues.add('unknown-id', path, `${what} ${String(id)} is not defined in this content`);
    return false;
  };

  // Cross-reference paths start at the defining record's id, which is stable where a bundle index is not.
  for (const table of reg.lootTables.values()) {
    const p = table.id;
    table.rolls.forEach((roll, i) => roll.entries.forEach((entry, j) => {
      const ep = `${p}.rolls[${i}].entries[${j}]`;
      if (need(reg.items, entry.item, join(ep, 'item'), 'item') && entry.quantity > reg.items.get(entry.item)!.stack) {
        issues.add('rule-violation', join(ep, 'quantity'), `${entry.item} stacks to ${reg.items.get(entry.item)!.stack}, not ${entry.quantity}`);
      }
    }));
  }
  for (const c of reg.characters.values()) {
    const p = c.id;
    if (c.faction) need(reg.factions, c.faction, join(p, 'faction'), 'faction');
    c.relationships.forEach((r, i) => need(reg.characters, r.character, `${p}.relationships[${i}].character`, 'character'));
    c.questRoles.forEach((r, i) => need(reg.quests, r.quest, `${p}.questRoles[${i}].quest`, 'quest'));
    c.encounterForms.forEach((f, i) => { if (f.encounter) need(reg.encounters, f.encounter, `${p}.encounterForms[${i}].encounter`, 'encounter'); });
    c.routine.forEach((r, i) => {
      if (need(reg.regions, r.region, `${p}.routine[${i}].region`, 'region') && !reg.regions.get(r.region)!.waypoints.includes(r.waypoint)) {
        issues.add('unknown-id', `${p}.routine[${i}].waypoint`, `waypoint "${r.waypoint}" is not in ${r.region}`);
      }
    });
  }
  for (const f of reg.factions.values()) {
    f.reactions.forEach((r, i) => need(reg.factions, r.faction, `${f.id}.reactions[${i}].faction`, 'faction'));
  }
  for (const r of reg.regions.values()) {
    const p = r.id;
    r.portals.forEach((portal, i) => {
      if (need(reg.regions, portal.to, `${p}.portals[${i}].to`, 'region') && !reg.regions.get(portal.to)!.portals.some((back) => back.id === portal.toPortal)) {
        issues.add('unknown-id', `${p}.portals[${i}].toPortal`, `${portal.to} has no portal "${portal.toPortal}"`);
      }
    });
    r.spawns.forEach((s, i) => {
      if (s.encounter) need(reg.encounters, s.encounter, `${p}.spawns[${i}].encounter`, 'encounter');
      s.characters.forEach((c, j) => need(reg.characters, c, `${p}.spawns[${i}].characters[${j}]`, 'character'));
    });
    r.triggers.forEach((t, i) => {
      if (need(reg.quests, t.quest, `${p}.triggers[${i}].quest`, 'quest') && !reg.quests.get(t.quest)!.stages.some((s) => s.id === t.stage)) {
        issues.add('unknown-id', `${p}.triggers[${i}].stage`, `${t.quest} has no stage "${t.stage}"`);
      }
    });
  }
  for (const e of reg.encounters.values()) {
    const p = e.id;
    need(reg.regions, e.region, join(p, 'region'), 'region');
    e.stages.forEach((s, i) => {
      s.roster.forEach((r, j) => need(reg.characters, r.character, `${p}.stages[${i}].roster[${j}].character`, 'character'));
      if (s.loot) need(reg.lootTables, s.loot, `${p}.stages[${i}].loot`, 'loot table');
    });
    need(reg.characters, e.boss.character, `${p}.boss.character`, 'character');
    need(reg.lootTables, e.boss.loot, `${p}.boss.loot`, 'loot table');
  }
  for (const q of reg.quests.values()) {
    const p = q.id;
    q.stages.forEach((s, i) => {
      const sp = `${p}.stages[${i}]`;
      if (s.rewards.loot) need(reg.lootTables, s.rewards.loot, `${sp}.rewards.loot`, 'loot table');
      s.rewards.standing.forEach((st, j) => need(reg.factions, st.faction, `${sp}.rewards.standing[${j}].faction`, 'faction'));
      s.transitions.forEach((t, j) => t.when.forEach((c, k) => checkConditionRefs(c, `${sp}.transitions[${j}].when[${k}]`)));
    });
  }
  for (const sv of reg.services.values()) {
    need(reg.characters, sv.npc, `${sv.id}.npc`, 'character');
    need(reg.regions, sv.region, `${sv.id}.region`, 'region');
    need(reg.costTables, sv.costTable, `${sv.id}.costTable`, 'cost table');
  }
  for (const table of reg.costTables.values()) {
    table.rows.forEach((row, i) => row.materials.forEach((m, j) => need(reg.items, m.item, `${table.id}.rows[${i}].materials[${j}].item`, 'item')));
    for (const issue of checkCostTablePayable(table, (id) => reg.items.get(id))) if (issue.code !== 'unknown-id') issues.add(issue.code, issue.path, issue.message);
  }
  function checkConditionRefs(c: Condition, path: string): void {
    switch (c.kind) {
      case 'stage-reached':
        if (need(reg.quests, c.quest, join(path, 'quest'), 'quest') && !reg.quests.get(c.quest)!.stages.some((s) => s.id === c.stage)) {
          issues.add('unknown-id', join(path, 'stage'), `${c.quest} has no stage "${c.stage}"`);
        }
        return;
      case 'standing-at-least': need(reg.factions, c.faction, join(path, 'faction'), 'faction'); return;
      case 'has-item': need(reg.items, c.item, join(path, 'item'), 'item'); return;
      case 'encounter-cleared': need(reg.encounters, c.encounter, join(path, 'encounter'), 'encounter'); return;
      default: return; // choice, flag and tier name nothing outside the quest
    }
  }
}

// Every material line of a cost table must be payable by a player who follows the rules: it names a material, and its quantity fits in
// one stack of it. A stack-1 material can be held only one at a time (one of each, items.ts checkOneOfEach), so a line asking for two
// of it could never be paid; for a stackable one, one stack always pays the line (and stackables merge). Exported so a proposal's table
// can be checked line by line before it is complete.
export function checkCostTablePayable(table: UpgradeCostTable, lookup: (id: ItemId) => Pick<ItemDefinition, 'category' | 'stack'> | undefined): Issue[] {
  const issues = new Issues();
  table.rows.forEach((row, i) => row.materials.forEach((m, j) => {
    const mp = `${table.id}.rows[${i}].materials[${j}]`;
    const def = lookup(m.item);
    if (!def) return issues.add('unknown-id', join(mp, 'item'), `item ${m.item} is not defined in this content`);
    if (def.category !== 'material') issues.add('rule-violation', join(mp, 'item'), `${m.item} is not a material`);
    if (m.quantity > def.stack) {
      issues.add('rule-violation', join(mp, 'quantity'), def.stack === 1
        ? `${m.item} is a single-copy material (one of each), so a line can ask for 1, not ${m.quantity}`
        : `${m.item} stacks to ${def.stack}; a line asks for at most one stack, not ${m.quantity}`);
    }
  }));
  return issues.list;
}

// Lookups. An id that is not in the content is an explicit failure.
const lookup = <K extends string, V>(map: ReadonlyMap<K, V>, id: K, what: string): Result<V> => {
  const value = map.get(id);
  return value === undefined ? fail('unknown-id', String(id), `${what} ${id} is not defined in this content`) : ok(value);
};
export const itemDef = (reg: Registry, id: ItemId): Result<ItemDefinition> => lookup(reg.items, id, 'item');
export const lootTable = (reg: Registry, id: LootTableId): Result<LootTable> => lookup(reg.lootTables, id, 'loot table');
export const character = (reg: Registry, id: CharacterId): Result<CharacterDefinition> => lookup(reg.characters, id, 'character');
export const faction = (reg: Registry, id: FactionId): Result<FactionDefinition> => lookup(reg.factions, id, 'faction');
export const region = (reg: Registry, id: RegionId): Result<RegionDefinition> => lookup(reg.regions, id, 'region');
export const encounter = (reg: Registry, id: EncounterId): Result<EncounterDefinition> => lookup(reg.encounters, id, 'encounter');
export const quest = (reg: Registry, id: QuestId): Result<QuestDefinition> => lookup(reg.quests, id, 'quest');
export const service = (reg: Registry, id: ServiceId): Result<ServiceDefinition> => lookup(reg.services, id, 'service');
export const costTable = (reg: Registry, id: CostTableId): Result<UpgradeCostTable> => lookup(reg.costTables, id, 'cost table');

// Every instance against its definition, then the custody rules across the set. An instance naming an item the content does not
// define is refused ('unknown-id'), never shown as a blank slot.
export function checkInstances(reg: Registry, instances: readonly ItemInstance[]): Issue[] {
  const issues: Issue[] = [];
  instances.forEach((inst, i) => {
    const def = reg.items.get(inst.item);
    if (!def) issues.push({ code: 'unknown-id', path: `[${i}].item`, message: `${inst.item} is not defined in this content` });
    else issues.push(...checkInstance(inst, def, `[${i}]`));
  });
  issues.push(...checkCustody(instances));
  return issues;
}
