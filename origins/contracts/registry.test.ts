// O1 registry: a whole content bundle loads with every cross-reference resolved; every dangling id, duplicate and stray kind fails
// explicitly; lookups never return undefined.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import type { Result } from './core.ts';
import * as F from './fixtures.ts';
import type { CharacterId, ItemId, QuestId } from './ids.ts';
import { parseItemInstance } from './items.ts';
import type { UpgradeCostTable } from './economy.ts';
import { character, checkCostTablePayable, checkInstances, costTable, itemDef, loadContent, quest, service } from './registry.ts';

type Raw = Record<string, unknown>;
const refused = (r: Result<unknown>, code: string, path?: string): void => {
  assert.equal(r.ok, false, `expected ${code}${path ? ` at ${path}` : ''}`);
  if (r.ok) return;
  assert.ok(r.issues.some((i) => i.code === code && (path === undefined || i.path === path)), `want ${code}${path ? ` at ${path}` : ''}; got ${JSON.stringify(r.issues)}`);
};
const must = <T>(r: Result<T>): T => { assert.ok(r.ok, JSON.stringify(!r.ok && r.issues)); return r.value; };
const swap = (kindId: string, patch: Raw): unknown[] => F.bundle().map((rec) => (rec.id === kindId ? { ...rec, ...patch } : rec));

test('registry: the chapter-one bundle loads and resolves', () => {
  const reg = must(loadContent(F.bundle()));
  assert.deepEqual([reg.items.size, reg.lootTables.size, reg.characters.size, reg.factions.size, reg.regions.size, reg.encounters.size, reg.quests.size, reg.services.size, reg.costTables.size], [4, 2, 4, 2, 2, 1, 1, 1, 1]);
  assert.equal(must(quest(reg, 'quest:stolen-name' as QuestId)).title, 'The Stolen Name');
  assert.ok(must(service(reg, 'service:exchange-forge' as never)).costTable === must(costTable(reg, 'costtable:forge' as never)).id);
});

test('registry: lookups of unknown ids fail explicitly', () => {
  const reg = must(loadContent(F.bundle()));
  refused(itemDef(reg, 'item:nothing' as ItemId), 'unknown-id');
  refused(character(reg, 'character:legend.veteran-1' as CharacterId), 'unknown-id'); // a valid legend id, just not in this content
});

test('registry: bundle-level rejections', () => {
  refused(loadContent({}), 'wrong-type');
  refused(loadContent([...F.bundle(), F.helmetDef()]), 'duplicate-id');
  refused(loadContent([...F.bundle(), { kind: 'spell', id: 'x' }]), 'unknown-kind', '[18].kind');
  refused(loadContent([...F.bundle(), F.helmetInstance()]), 'unknown-kind', '[18].kind'); // player data is not content
  refused(loadContent([...F.bundle(), 'text']), 'unknown-kind');
  refused(loadContent([...F.bundle(), { ...F.helmetDef(), id: 'item:other', schemaVersion: 9 }]), 'unsupported-version', '[18].schemaVersion');
});

test('registry: every dangling cross-reference is an unknown-id at the referring path', () => {
  const cases: [string, Raw, string][] = [
    ['loottable:ghoul', { rolls: [{ ...F.ghoulLoot().rolls[0], entries: [{ item: 'item:missing', chance: 5, quantity: 1, levelMin: null, levelMax: null }] }] }, 'loottable:ghoul.rolls[0].entries[0].item'],
    ['character:courier-vell', { faction: 'faction:missing' }, 'character:courier-vell.faction'],
    ['character:courier-vell', { relationships: [{ character: 'character:missing', relation: 'ally' }] }, 'character:courier-vell.relationships[0].character'],
    ['character:courier-vell', { questRoles: [{ quest: 'quest:missing', role: 'giver' }] }, 'character:courier-vell.questRoles[0].quest'],
    ['character:courier-vell', { routine: [{ ...F.courier().routine[0], region: 'region:missing' }, F.courier().routine[1]] }, 'character:courier-vell.routine[0].region'],
    ['character:courier-vell', { routine: [{ ...F.courier().routine[0], waypoint: 'plaza' }, F.courier().routine[1]] }, 'character:courier-vell.routine[0].waypoint'],
    ['character:legend.nightborn-3', { encounterForms: [{ id: 'duel', opponent: 'nightborn', level: 13, encounter: 'encounter:missing' }] }, 'character:legend.nightborn-3.encounterForms[0].encounter'],
    ['faction:ferry-court', { reactions: [{ faction: 'faction:missing', attitude: 'hostile' }] }, 'faction:ferry-court.reactions[0].faction'],
    ['region:ash-frontier', { portals: [{ id: 'to-exchange', at: 'east-road', to: 'region:missing', toPortal: 'x' }] }, 'region:ash-frontier.portals[0].to'],
    ['region:concord-exchange', { portals: [{ id: 'to-frontier', at: 'west-gate', to: 'region:ash-frontier', toPortal: 'no-such-portal' }] }, 'region:concord-exchange.portals[0].toPortal'],
    ['region:ash-frontier', { triggers: [{ id: 't', at: 'dock', quest: 'quest:stolen-name', stage: 'no-such-stage' }] }, 'region:ash-frontier.triggers[0].stage'],
    ['region:ash-frontier', { spawns: [{ id: 's', at: 'dock', encounter: 'encounter:missing', characters: [] }] }, 'region:ash-frontier.spawns[0].encounter'],
    ['encounter:ruin-vigil', { boss: { character: 'character:legend.nightborn-3', loot: 'loottable:missing' } }, 'encounter:ruin-vigil.boss.loot'],
    ['encounter:ruin-vigil', { region: 'region:missing' }, 'encounter:ruin-vigil.region'],
    ['service:exchange-forge', { npc: 'character:missing' }, 'service:exchange-forge.npc'],
    ['service:exchange-forge', { costTable: 'costtable:missing' }, 'service:exchange-forge.costTable'],
    ['costtable:forge', { rows: [{ level: 1, rarity: 'common', coin: 5, materials: [{ item: 'item:missing', quantity: 1 }] }] }, 'costtable:forge.rows[0].materials[0].item'],
  ];
  for (const [id, patch, path] of cases) refused(loadContent(swap(id, patch)), 'unknown-id', path);
  // Conditions that name other content.
  const stages = F.stolenName().stages;
  const withCondition = (condition: Raw) => swap('quest:stolen-name', { stages: stages.map((s) => (s.id === 'erased' ? { ...s, transitions: [{ to: 'courier', when: [condition], label: null }] } : s)) });
  const at = 'quest:stolen-name.stages[0].transitions[0].when[0]';
  refused(loadContent(withCondition({ kind: 'stage-reached', quest: 'quest:stolen-name', stage: 'nope' })), 'unknown-id', `${at}.stage`);
  refused(loadContent(withCondition({ kind: 'stage-reached', quest: 'quest:missing', stage: 'x' })), 'unknown-id', `${at}.quest`);
  refused(loadContent(withCondition({ kind: 'has-item', item: 'item:missing' })), 'unknown-id', `${at}.item`);
  refused(loadContent(withCondition({ kind: 'standing-at-least', faction: 'faction:missing', value: 1 })), 'unknown-id', `${at}.faction`);
  refused(loadContent(withCondition({ kind: 'encounter-cleared', encounter: 'encounter:missing' })), 'unknown-id', `${at}.encounter`);
});

test('registry: cross-content rules — stack sizes and smith materials', () => {
  refused(loadContent(swap('loottable:ghoul', { rolls: [{ ...F.ghoulLoot().rolls[0], entries: [{ item: 'item:grave-iron', chance: 5, quantity: 51, levelMin: null, levelMax: null }] }] })), 'rule-violation', 'loottable:ghoul.rolls[0].entries[0].quantity');
  refused(loadContent(swap('costtable:forge', { rows: [{ level: 1, rarity: 'common', coin: 5, materials: [{ item: 'item:ferry-token', quantity: 1 }] }] })), 'rule-violation', 'costtable:forge.rows[0].materials[0].item');
});

test('registry: instances are checked against content — unknown items refused, custody enforced', () => {
  const reg = must(loadContent(F.bundle()));
  const instances = [F.helmetInstance(), F.ironInstance(), F.recordInstance()].map((raw) => must(parseItemInstance(raw)));
  assert.deepEqual(checkInstances(reg, instances), []);
  const ghost = must(parseItemInstance({ ...F.ironInstance(), id: 'inst:ghost', item: 'item:not-in-content', location: { kind: 'bank', owner: F.PC, index: 7 }, provenance: { ...F.ironInstance().provenance, mintKey: 'loot:ghost-0001' } }));
  const issues = checkInstances(reg, [...instances, ghost]);
  assert.ok(issues.some((i) => i.code === 'unknown-id' && i.path === '[3].item'));
  assert.ok(checkInstances(reg, [instances[0]!, instances[0]!]).some((i) => i.code === 'duplicate-id'));
});

// A stack-1 material can only ever be held one at a time (one of each), so a cost line asking for two of it can never be paid. Every
// cost line must be payable under the stacking and one-of-each rules, checked when the content loads.
const trophyDef = (stack = 1): Raw => ({ ...F.graveIronDef(), id: 'item:boss-trophy', name: 'Boss trophy', rarity: 'relic', story: 'notable', stack });
const trophyRows = (quantity: number): Raw[] => [{ level: 1, rarity: 'common', coin: 5, materials: [{ item: 'item:boss-trophy', quantity }] }];

test('registry: a cost line must be payable — never more than one of a stack-1 material, never more than a stack', () => {
  must(loadContent([...swap('costtable:forge', { rows: trophyRows(1) }), trophyDef()]));
  refused(loadContent([...swap('costtable:forge', { rows: trophyRows(2) }), trophyDef()]), 'rule-violation', 'costtable:forge.rows[0].materials[0].quantity');
  must(loadContent([...swap('costtable:forge', { rows: trophyRows(2) }), trophyDef(5)])); // a stackable trophy could be asked for twice
  const iron = (quantity: number): Raw[] => [{ level: 1, rarity: 'common', coin: 5, materials: [{ item: 'item:grave-iron', quantity }] }];
  must(loadContent(swap('costtable:forge', { rows: iron(50) })));
  refused(loadContent(swap('costtable:forge', { rows: iron(51) })), 'rule-violation', 'costtable:forge.rows[0].materials[0].quantity');
});

test('registry: every material line in the blacksmith cost proposal is payable', () => {
  const doc = readFileSync(new URL('../../docs/specs/origins/blacksmith-costs-proposal.md', import.meta.url), 'utf8');
  const json = /```json\n([\s\S]*?)```/.exec(doc);
  assert.ok(json, 'the proposal carries its cost table as JSON');
  const table = JSON.parse(json[1]!) as UpgradeCostTable; // abridged on purpose (not every level), so only the lines are checked here
  const defs = new Map([F.graveIronDef(), trophyDef()].map((d) => [d.id as ItemId, { stack: d.stack as number, category: d.category as 'material' }]));
  assert.deepEqual(checkCostTablePayable(table, (id) => defs.get(id)), []);
  assert.ok(table.rows.some((r) => r.materials.some((m) => m.item === ('item:boss-trophy' as ItemId))), 'the trophy lines are still in the proposal');
});
