// Origins Region 1 content: the Concord Exchange and the Ash Frontier, as data. Preview-only: nothing in src/ reads it.
//
// Two parts:
//   1. BUNDLE: records in the contracts' own shapes (item, loot table, character, faction, region, encounter), loaded by
//      src/core/contracts/registry.ts loadContent with no new fields.
//   2. LOCAL: the kinds the contracts do not have yet, in the shapes the specs propose: `town-definition` (living-world §3.1),
//      `bounty-definition` (region1 §3, Bounties), the encounter twist flags (region1 §7, open question 1a), the rift records
//      (living-world §8.1) and the boss loot rules (region1 §4–§5: first win only). Each moves into the contracts when its kind,
//      namespace and parser land there (region1 §7 open 1a/1b/1g; feuds §13 open 4; living-world §14).
//
// Spec sources: docs/specs/origins/region1-ash-frontier.md (§1 zones, §3 Bounties, §4 bosses and creatures, §5 loot),
// docs/specs/origins/feuds.md (Bounties stay; metal in bronze), and the living-world spec on origin/expansion/living-world (§3 towns,
// §4.1 rulers, §8 rifts, §12 Region 1's three towns). The scripted Feud chain (region1 §3) is SUPERSEDED by systemic Feuds and is not
// built: no quest, no feud-* encounter, no Feud talk, no Feud ending pieces.
//
// Numbers marked PROVISIONAL are the specs' own provisional values; PROPOSED marks anything this file had to choose (names of
// non-legend NPCs the specs leave open, boss health, the rift table, zone landmarks).

import { LOOT_ITEMS } from '../../src/core/server.ts';
import { placedSpawns, placedWaypoints } from '../zones/place.ts';
import { zonePlaces } from '../zones/loader.ts';
import lootTableRows from './loot-tables.json' with { type: 'json' };
import townRows from './towns.json' with { type: 'json' };
import townManifest from './towns.manifest.json' with { type: 'json' };
import lootManifest from './loot-tables.manifest.json' with { type: 'json' };
import rows from './progression.json' with { type: 'json' };
import progressionManifest from './progression.manifest.json' with { type: 'json' };
import { buildTables, loadRegistry, tableFromFile, type Manifest } from '../../src/core/server.ts';

const gear = (id: string, name: string, slot: string, rarity: string, material: string) => ({
  kind: 'item-definition', schemaVersion: 1, id, name, category: 'gear', rarity, slot, power: 'slot-weight', material,
  appearance: { asset: `items/frontier/${id.slice('item:frontier.'.length)}.glb` }, story: 'none', binding: 'none', stack: 1,
});

// ---- 1. the contracts bundle ----------------------------------------------------------------------------------------------------

// Items (region1 §5). No weapon drops in Region 1 (ruled). The Feud pieces (court mail, Varney's marker, the Roll page) are parked.
export const ITEMS = [
  gear('item:frontier.ash-helm', 'Ash-caked helm', 'Helmet', 'common', 'iron'),
  gear('item:frontier.watch-greaves', 'Watchtower greaves', 'Greaves', 'common', 'iron'),
  gear('item:frontier.thrall-gloves', "Thrall's iron gloves", 'Gloves', 'fine', 'iron'),
  gear('item:frontier.ferryman-boots', "Ferryman's boots", 'Boots', 'fine', 'leather'),
  gear('item:frontier.mere-arms', 'Drowned vambraces', 'Arms', 'fine', 'bronze'),
  gear('item:frontier.mere-shield', "The Mere-Mother's shield", 'Shield', 'relic', 'bone'),
  // The starter ground item (Backend brief #2775; Lead 2026-10-15): the one weapon Region 1 may define, because a ground row names it (origins/world/ground-items.json). Longsword is
  // DEFAULT_WEAPON, so a new player already fights with its moves: wearing it changes nothing about the fight. Bound on acquire: not tradable. The rust tint is owed by Characters & Art.
  {
    kind: 'item-definition', schemaVersion: 1, id: 'item:starter.rusty-sword', name: 'Rusty sword', category: 'gear', rarity: 'common', slot: 'Longsword',
    power: 'slot-weight', material: 'iron', appearance: { asset: 'weapons/player/longsword.glb' }, story: 'none', binding: 'on-acquire', stack: 1,
  },
  // The other four starter weapons (Strategy 2026-10-15: fixed ground placements, looks in origins/preview/ground-looks.json). Common, bound on acquire, never above Recruit gear.
  {
    kind: 'item-definition', schemaVersion: 1, id: 'item:starter.knife', name: 'Chipped knife', category: 'gear', rarity: 'common', slot: 'Knife',
    power: 'slot-weight', material: 'iron', appearance: { asset: 'weapons/player/knife.glb' }, story: 'none', binding: 'on-acquire', stack: 1,
  },
  {
    kind: 'item-definition', schemaVersion: 1, id: 'item:starter.cleaver', name: 'Notched cleaver', category: 'gear', rarity: 'common', slot: 'Cleaver',
    power: 'slot-weight', material: 'iron', appearance: { asset: 'weapons/player/cleaver.glb' }, story: 'none', binding: 'on-acquire', stack: 1,
  },
  {
    kind: 'item-definition', schemaVersion: 1, id: 'item:starter.gladius', name: 'Pitted gladius', category: 'gear', rarity: 'common', slot: 'Gladius',
    power: 'slot-weight', material: 'iron', appearance: { asset: 'weapons/player/gladius.glb' }, story: 'none', binding: 'on-acquire', stack: 1,
  },
  {
    kind: 'item-definition', schemaVersion: 1, id: 'item:starter.estoc', name: 'Bent estoc', category: 'gear', rarity: 'common', slot: 'Estoc',
    power: 'slot-weight', material: 'iron', appearance: { asset: 'weapons/player/estoc.glb' }, story: 'none', binding: 'on-acquire', stack: 1,
  },
  // Armour on the ground (batch two): Recruit-tier goblin pieces from loot.glb, looks in origins/preview/ground-looks.json. No placements yet (Strategy's call).
  {
    kind: 'item-definition', schemaVersion: 1, id: 'item:starter.goblin-scrap-cap', name: 'Goblin scrap cap', category: 'gear', rarity: 'common', slot: 'Helmet',
    power: 'slot-weight', material: 'iron', appearance: { asset: 'loot.glb' }, story: 'none', binding: 'on-acquire', stack: 1,
  },
  {
    kind: 'item-definition', schemaVersion: 1, id: 'item:starter.goblin-shin-plates', name: 'Goblin shin plates', category: 'gear', rarity: 'common', slot: 'Greaves',
    power: 'slot-weight', material: 'iron', appearance: { asset: 'loot.glb' }, story: 'none', binding: 'on-acquire', stack: 1,
  },
  {
    kind: 'item-definition', schemaVersion: 1, id: 'item:grave-iron', name: 'Grave iron', category: 'material', rarity: 'fine', slot: null,
    power: 'none', material: 'iron', appearance: { asset: 'items/grave-iron.glb' }, story: 'none', binding: 'none', stack: 50,
  },
];

// Loot tables (region1 §5) are ROWS: origins/region1/loot-tables.json, one object per table in the contract's own shape (a new table is one row, no code).
export const LOOT_TABLES: Record<string, unknown>[] = lootTableRows.map((t: Record<string, unknown>) => Object.fromEntries(Object.entries(t).filter(([k]) => k !== 'rolledBy')));   // `rolledBy` is the link to creatures, not part of the contract's table

// Factions. `faction:concord` would come from an Exchange bundle that does not exist yet, so it is here. The Ferry Court belonged to
// the superseded Feud and has no member left, so it is not defined.
export const FACTIONS = [
  { kind: 'faction-definition', schemaVersion: 1, id: 'faction:concord', name: 'The Concord', joinable: false, hidden: false, ranks: [], reactions: [{ faction: 'faction:blood-court', attitude: 'angry' }] },
  { kind: 'faction-definition', schemaVersion: 1, id: 'faction:blood-court', name: 'The Blood Court', joinable: false, hidden: true, ranks: [], reactions: [{ faction: 'faction:concord', attitude: 'hostile' }] },
];

// Bosses, Bounty targets and creatures (region1 §4, §8; living-world §8, §16): ROWS in origins/region1/progression.json, the contracts' character-definition shape
// (legends for bosses and named targets, original mooks; the worm's PLACEHOLDER body is the held `minotaur` duel form, Strategy 2026-10-07).
export const FOES: Record<string, unknown>[] = rows.foes;

// Town people (living-world §4.1, §12): rulers, their stand-in stewards, the service NPCs and the Exchange's working NPCs (Town plan A1, NPC rows in origins/region1/npcs.ts):
// ROWS in progression.json. Rulers are original NPCs (Brannoc and Osk named by the spec; the quarter's mayor PROPOSED); stewards and service NPCs are PROPOSED.
// A service NPC can be a grudge rival (feuds §3.1), so each has a duel form; a ruler never is (living-world ruling 7), so rulers and stewards have none.
export const TOWNSFOLK: Record<string, unknown>[] = rows.townsfolk;

// The encounters (region1 §4; living-world §8) are ROWS in progression.json: Bounties solo, no decay, restart 0, the single-foe ones with the dummy stage
// region1 §4 names (`challenge`); the public events decay. Health, levels and loot tables are tunable starting values (Strategy, 2026-10-07).
export const DUMMY_STAGE = 'challenge';
export const ENCOUNTERS: Record<string, unknown>[] = rows.encounters;

// The two contracts regions. Waypoints are the world landmark names (unique across each region, region1 §1), checked by the loader.
const spawn = (id: string, at: string, encounter: string | null, characters: string[] = []) => ({ id, at, encounter, characters });
export const REGIONS = [
  {
    kind: 'region-definition', schemaVersion: 1, id: 'region:concord-exchange', name: 'The Concord Exchange', gate: 'outer',
    waypoints: [
      'centre', 'pit-gate',
      'outer-gate', 'covenant-stone', 'contract-board', 'forge', 'bank', 'west-gate', 'square-arch',
      'quarter-arch', 'quarter-centre', 'quarter-hall', 'quarter-forge', 'quarter-healer', 'quarter-fence', 'quarter-jail',
    ],
    portals: [{ id: 'to-frontier', at: 'west-gate', to: 'region:ash-frontier', toPortal: 'to-exchange' }],
    landmarks: [
      { id: 'square-arch', name: 'The Exchange Arch', at: 'square-arch' },
      { id: 'quarter', name: 'The Exchange Quarter', at: 'quarter-centre' },
    ],
    spawns: [
      spawn('marrow', 'contract-board', null, ['character:recorder-marrow']),
      spawn('quarter-ruler', 'quarter-hall', null, ['character:mayor-hollin']),
      spawn('quarter-steward', 'quarter-hall', null, ['character:steward-quarter']),
      spawn('quarter-smith', 'quarter-forge', null, ['character:smith-quarter']),
      spawn('quarter-healer', 'quarter-healer', null, ['character:healer-quarter']),
      spawn('quarter-fence', 'quarter-fence', null, ['character:fence-quarter']),
    ],
    triggers: [], assetManifest: 'regions/concord-exchange/manifest.json',
  },
  {
    kind: 'region-definition', schemaVersion: 1, id: 'region:ash-frontier', name: 'The Ash Frontier', gate: 'outer',
    waypoints: [
      ...placedWaypoints(zonePlaces()),   // each zone row's own landmarks (its place), Zone 1's first
    ],
    portals: [{ id: 'to-exchange', at: 'exchange-gate', to: 'region:concord-exchange', toPortal: 'to-frontier' }],
    landmarks: [
      { id: 'cinder-hold', name: 'Cinder Hold', at: 'hold-centre' },
      { id: 'mere-end', name: 'Mere End', at: 'end-centre' },
      { id: 'grey-ferry', name: 'The Grey Ferry', at: 'dock' },
    ],
    // triggers: []: nothing advances on walking into a place (region1 §1). The five feud-* spawns are superseded.
    spawns: [
      spawn('bounty-shrine', 'shrine', 'encounter:bounty-hrungnir'),
      spawn('bounty-toll', 'milestone', 'encounter:bounty-toll'),
      spawn('bounty-reeds', 'reed-bank', 'encounter:bounty-peg-powler'),
      spawn('matriarch', 'mere-hollow', 'encounter:mere-mother'),
      ...placedSpawns(zonePlaces()).map((g) => spawn(g.id, g.at, null, g.characters)),   // each zone row's spawn groups (its place), Zone 1's first so every seed keeps
    ],
    triggers: [], assetManifest: 'regions/ash-frontier/manifest.json',
  },
];

loadRegistry(progressionManifest.tables.map((m) => tableFromFile(m as unknown as Manifest, rows, 'origins/region1/progression.json')));

export const BUNDLE: Record<string, unknown>[] = [...ITEMS, ...LOOT_ITEMS, ...LOOT_TABLES, ...FACTIONS, ...FOES, ...TOWNSFOLK, ...ENCOUNTERS, ...REGIONS];

// ---- 2. kinds the contracts do not have yet --------------------------------------------------------------------------------------

// Towns (living-world §3.1, §12) are rows: origins/region1/towns.json holds the definitions table (trades, temperaments, ruler titles) and
// the town rows. Tier at start comes from startProsperity (§3.3); patrons are strike sources only, never foes (feuds §12-§13);
// `services[].trade` is the feuds §11 `trade` key. A new trade, temperament or town is one row there.
// The shared registry loader (src/core/registry.ts) reads the manifest beside the rows: a duplicate id, unknown ref, missing field or wrong type throws here.
loadRegistry(townManifest.tables.map((m) => tableFromFile(m as Manifest, townRows, `origins/region1/${m.file}`)));
export const TOWN_DEFS: Record<string, Record<string, Record<string, unknown>>> = townRows.definitions;
export const TOWNS = townRows.towns;

// Twists: Origins encounter flags only (region1 §7 ruling 10). The fight reads the encounter's flag; a Bounty's copy is display only
// and must match it. Kinds are the section 4 list; nothing here touches the live ladder, its RNG or src/.
export const ENCOUNTER_FLAGS: Record<string, Record<string, unknown>[]> = Object.fromEntries(rows.encounterFlags.map((r) => [r.id, r.twists]));

// Bounties (region1 §3, Bounties; feuds keeps them unchanged): rows in progression.json. Metal is bronze on the one bound balance; dailyCap is wins paid per
// character per UTC server day. PROVISIONAL with the section: Dom may rename "Bounty". The row's twist is its encounter's first flag (display only).
export const BOUNTIES = rows.bounties.map((b) => ({
  kind: b.kind, schemaVersion: b.schemaVersion, id: b.id, name: b.name, region: b.region, gate: b.gate, encounter: b.encounter,
  twist: ENCOUNTER_FLAGS[b.encounter]![0], metal: b.metal, dailyCap: b.dailyCap,
}));

// Rifts (living-world §8.1, §8.4): the five Region 1 sites, the Lambton Worm, the scheduler. PROVISIONAL numbers, the spec's.
export const RIFTS: Record<string, unknown>[] = rows.rifts;

// Who pays which progression row (region1 §4: the `Kill` event's `type`), and how each boss table is rolled (region1 §5 ruling 9).
//   first-win: the table rolls only on the kill that pays the once-row; a repeat kill rolls nothing (world-boss).
//   weekly-cap: every eligible kill rolls, at most `perWeek` rolls an account a week (living-world §8.4, the PROPOSED rift-boss row).
//   never: the table is not rolled; the win pays metal (a Bounty).
export const KILL_ROWS: Record<string, string> = Object.fromEntries(rows.killRows.map((r) => [r.id, r.row]));
export const BOSS_LOOT: { encounter: string; rule: 'first-win' | 'weekly-cap' | 'never'; perWeek?: number }[] = rows.bossLoot.map((r) => ({
  encounter: r.encounter, rule: r.rule as 'first-win' | 'weekly-cap' | 'never', ...('perWeek' in r ? { perWeek: r.perWeek } : {}),
}));

// Which table each creature rolls in the open world is the loot row's own `rolledBy` (no encounter: a plain kill); row order = creature order.
// Loaded through the shared registry (src/core/registry.ts): loot-tables.manifest.json derives the creature->table link from the rows' `rolledBy`, so a creature in two
// rows is a duplicate-id and an unknown creature or table is an unknown-ref, here at load and in scripts/registry-check.mjs. Order = row order.
// Ids other tables point at come from the contracts bundle (characters here); the gate asks for the same sets.
export const REGISTRY_EXTERNAL: Record<string, string[]> = { character: BUNDLE.map((r) => String(r.id)).filter((id) => id.startsWith('character:')) };
const lootRegistry = loadRegistry(buildTables(lootManifest.tables.map((m) => ({ manifest: m as Manifest, parsed: lootTableRows, file: 'origins/region1/loot-tables.json' }))), REGISTRY_EXTERNAL);
export const CREATURE_LOOT: Record<string, string> = Object.fromEntries([...lootRegistry.rows.get('creatureLoot')!.values()].map((r) => [r.id as string, r.loottable as string]));

export const LOCAL = { townDefs: TOWN_DEFS, towns: TOWNS, bounties: BOUNTIES, flags: ENCOUNTER_FLAGS, rifts: RIFTS, killRows: KILL_ROWS, bossLoot: BOSS_LOOT, creatureLoot: CREATURE_LOOT };
