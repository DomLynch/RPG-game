// Origins Region 1 content: the Concord Exchange and the Ash Frontier, as data. Preview-only: nothing in src/ reads it.
//
// Two parts:
//   1. BUNDLE: records in the contracts' own shapes (item, loot table, character, faction, region, encounter), loaded by
//      origins/contracts/registry.ts loadContent with no new fields.
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

const gear = (id: string, name: string, slot: string, rarity: string, material: string) => ({
  kind: 'item-definition', schemaVersion: 1, id, name, category: 'gear', rarity, slot, power: 'slot-weight', material,
  appearance: { asset: `items/frontier/${id.slice('item:frontier.'.length)}.glb` }, story: 'none', binding: 'none', stack: 1,
});
const gearEntry = (item: string, chance: number) => ({ item, chance, quantity: 1, levelMin: 11, levelMax: null });
const table = (id: string, presentation: 'take-one' | 'collect', rolls: unknown[], currency: { min: number; max: number } | null) => ({
  kind: 'loot-table', schemaVersion: 1, id, presentation, distribution: 'personal', rolls, currency, fallback: null, // crafting is out
});
const independent = (probability: number, entries: unknown[]) => ({ probability, repeat: 1, mode: 'independent', dropLimit: 0, minDrop: 0, entries });
const weighted = (probability: number, entries: unknown[]) => ({ probability, repeat: 1, mode: 'weighted', dropLimit: 1, minDrop: 1, entries });
const figure = (
  id: string, name: string, source: string, summary: string, faction: string | null,
  forms: { id: string; opponent: string; level: number; encounter: string | null }[], asset: string,
) => ({
  kind: 'character-definition', schemaVersion: 1, id, name, lore: { source, summary }, faction, essential: false,
  relationships: [], questRoles: [], presentations: [{ id: 'default', asset: `characters/${asset}.glb` }], encounterForms: forms, routine: [],
});
const ORIGINAL = 'original';

// ---- 1. the contracts bundle ----------------------------------------------------------------------------------------------------

// Items (region1 §5). No weapon drops in Region 1 (ruled). The Feud pieces (court mail, Varney's marker, the Roll page) are parked.
export const ITEMS = [
  gear('item:frontier.ash-helm', 'Ash-caked helm', 'Helmet', 'common', 'iron'),
  gear('item:frontier.watch-greaves', 'Watchtower greaves', 'Greaves', 'common', 'iron'),
  gear('item:frontier.thrall-gloves', "Thrall's iron gloves", 'Gloves', 'fine', 'iron'),
  gear('item:frontier.ferryman-boots', "Ferryman's boots", 'Boots', 'fine', 'leather'),
  gear('item:frontier.mere-arms', 'Drowned vambraces', 'Arms', 'fine', 'bronze'),
  gear('item:frontier.mere-shield', "The Mere-Mother's shield", 'Shield', 'relic', 'bone'),
  {
    kind: 'item-definition', schemaVersion: 1, id: 'item:grave-iron', name: 'Grave iron', category: 'material', rarity: 'fine', slot: null,
    power: 'none', material: 'iron', appearance: { asset: 'items/grave-iron.glb' }, story: 'none', binding: 'none', stack: 50,
  },
];

// Loot tables (region1 §5): personal, fallback null; gear entries levelMin 11, levelMax null.
export const LOOT_TABLES = [
  table('loottable:cinder-scavenger', 'collect', [
    independent(50, [{ item: 'item:grave-iron', chance: 40, quantity: 2, levelMin: null, levelMax: null }]),
    independent(100, [gearEntry('item:frontier.ash-helm', 2), gearEntry('item:frontier.watch-greaves', 2)]),
  ], { min: 3, max: 12 }),
  table('loottable:ruin-ghoul', 'collect', [independent(60, [{ item: 'item:grave-iron', chance: 30, quantity: 3, levelMin: null, levelMax: null }])], null),
  // The Ash Wolf's table (Backend 2026-10-08): a pack beast of 2-3 at L11-13, each kill a scavenger's worth; Frontier gear only.
  table('loottable:ash-wolf', 'collect', [
    independent(50, [{ item: 'item:grave-iron', chance: 40, quantity: 1, levelMin: null, levelMax: null }]),
    independent(100, [gearEntry('item:frontier.ash-helm', 2), gearEntry('item:frontier.watch-greaves', 2)]),
  ], { min: 3, max: 10 }),
  // The Ember Wolf's table: the Ash Wolf's, same shape (Backend to rule on the numbers when Zone 2's economy is set; nothing here is tuned).
  table('loottable:ember-wolf', 'collect', [
    independent(50, [{ item: 'item:grave-iron', chance: 40, quantity: 1, levelMin: null, levelMax: null }]),
    independent(100, [gearEntry('item:frontier.ash-helm', 2), gearEntry('item:frontier.watch-greaves', 2)]),
  ], { min: 3, max: 10 }),
  // The Cinder Bear (Backend's ruling, 2026-10-08, Dom's animal rule): a material most kills, a little bronze every kill, a rare piece of common Frontier gear.
  table('loottable:cinder-bear', 'collect', [
    independent(60, [{ item: 'item:grave-iron', chance: 40, quantity: 2, levelMin: null, levelMax: null }]),
    independent(100, [gearEntry('item:frontier.watch-greaves', 2)]),
  ], { min: 2, max: 8 }),
  // The Ash Boar's table (Backend 2026-10-08): a lone uncommon beast, level 13-14, a little richer than a scavenger camp's single kill; Frontier gear only.
  table('loottable:ash-boar', 'collect', [
    independent(60, [{ item: 'item:grave-iron', chance: 40, quantity: 2, levelMin: null, levelMax: null }]),
    independent(100, [gearEntry('item:frontier.ash-helm', 3), gearEntry('item:frontier.watch-greaves', 3)]),
  ], { min: 5, max: 15 }),
  table('loottable:mere-brood', 'collect', [independent(40, [{ item: 'item:grave-iron', chance: 30, quantity: 1, levelMin: null, levelMax: null }])], null),
  table('loottable:court-thrall', 'take-one', [weighted(25, [
    gearEntry('item:frontier.thrall-gloves', 50), gearEntry('item:frontier.ferryman-boots', 30), gearEntry('item:frontier.watch-greaves', 20),
  ])], { min: 10, max: 30 }),
  // The matriarch's boss table: rolled only on the kill that pays the world-boss once-row (BOSS_LOOT below).
  table('loottable:mere-mother', 'take-one', [weighted(100, [
    gearEntry('item:frontier.mere-shield', 25), gearEntry('item:frontier.mere-arms', 45), gearEntry('item:frontier.ferryman-boots', 30),
  ])], { min: 100, max: 250 }),
  // PROPOSED: the rift worm's personal table (living-world §8.4 names it, gives no entries). Frontier armour only, no weapons.
  table('loottable:rift-worm', 'take-one', [weighted(100, [
    gearEntry('item:frontier.mere-arms', 40), gearEntry('item:frontier.thrall-gloves', 30), gearEntry('item:frontier.ferryman-boots', 30),
  ])], { min: 50, max: 150 }),
  // A Bounty pays metal only (region1 §5). The contract requires every encounter boss to name a table with at least one entry, so the
  // Bounty encounters name this one and BOSS_LOOT marks it `never` rolled: contract gap, `boss.loot` nullable (see the loader).
  table('loottable:bounty-unrolled', 'collect', [independent(1, [{ item: 'item:grave-iron', chance: 1, quantity: 1, levelMin: null, levelMax: null }])], null),
];

// Factions. `faction:concord` would come from an Exchange bundle that does not exist yet, so it is here. The Ferry Court belonged to
// the superseded Feud and has no member left, so it is not defined.
export const FACTIONS = [
  { kind: 'faction-definition', schemaVersion: 1, id: 'faction:concord', name: 'The Concord', joinable: false, hidden: false, ranks: [], reactions: [{ faction: 'faction:blood-court', attitude: 'angry' }] },
  { kind: 'faction-definition', schemaVersion: 1, id: 'faction:blood-court', name: 'The Blood Court', joinable: false, hidden: true, ranks: [], reactions: [{ faction: 'faction:concord', attitude: 'hostile' }] },
];

// Bosses, Bounty targets and creatures (region1 §4, §8; living-world §8, §16). Legends for bosses and named targets, original mooks.
export const FOES = [
  figure('character:mere-mother', "Grendel's Mother", 'Beowulf (Old English poem, Cotton Vitellius A.xv)',
    'In the old poem she came up out of a haunted mere to avenge her son and was cut down in her own hall beneath the water. The Fracture set her mere on the Ash Frontier, and she drowns every boat put on it.',
    null, [{ id: 'public', opponent: 'witch', level: 4, encounter: 'encounter:mere-mother' }], 'mere-mother'),
  figure('character:hrungnir', 'Hrungnir', 'Snorri Sturluson, Prose Edda, Skaldskaparmal, c. 1220',
    'A giant of stone with a heart of stone. Here he stands on the displaced shrine in the Cinder Fields and takes any challenge put to him.',
    null, [{ id: 'bounty', opponent: 'knight', level: 3, encounter: 'encounter:bounty-hrungnir' }], 'hrungnir'),
  figure('character:peg-powler', 'Peg Powler', 'Tees folklore; W. Henderson, Notes on the Folk-Lore of the Northern Counties, 1866',
    'The green-haired hag of the river, who drags the careless under. In the Black Mere she keeps to the reeds and runs when the fight turns.',
    null, [{ id: 'bounty', opponent: 'witch', level: 3, encounter: 'encounter:bounty-peg-powler' }], 'peg-powler'),
  figure('character:court-thrall', 'Court thrall', ORIGINAL, 'A bonded fighter of the Blood Court, sent out along the Charnel Road to take tolls in its name.',
    'faction:blood-court', [
      { id: 'l12', opponent: 'pitborn', level: 3, encounter: 'encounter:bounty-toll' },
      { id: 'l13', opponent: 'pitborn', level: 13, encounter: null },
    ], 'court-thrall'),
  figure('character:cinder-scavenger', 'Cinder scavenger', ORIGINAL, 'Picks the ash pits for iron and anything else the Fracture left lying.',
    null, [{ id: 'mob', opponent: 'goblin', level: 1, encounter: null }], 'cinder-scavenger'),
  figure('character:ash-wolf', 'Ash wolf', ORIGINAL, 'Lean and ash-coated, it hunts the road verge where the Fracture left the herds nothing.',
    null, [{ id: 'mob', opponent: 'wolf', level: 1, encounter: null }], 'ash-wolf'),
  figure('character:ember-wolf', 'Ember wolf', ORIGINAL, 'Its coat has burned down to the colour of a banked fire, and it hunts the Reach in a pack of two or three.',
    null, [{ id: 'mob', opponent: 'wolf', level: 1, encounter: null }], 'ember-wolf'),
  figure('character:cinder-bear', 'Cinder bear', ORIGINAL, 'Heavy and soot-matted, it came down off the burnt moor when the herds went and takes what it finds.',
    null, [{ id: 'mob', opponent: 'bear', level: 1, encounter: null }], 'cinder-bear'),
  figure('character:ash-boar', 'Ash boar', ORIGINAL, 'Tusked and ash-streaked, it roots the verge of the hold road for what the Fracture left in the ground.',
    null, [{ id: 'mob', opponent: 'boar', level: 1, encounter: null }], 'ash-boar'),
  figure('character:mere-brood', 'Mere brood', ORIGINAL, "One of the mere's spawn, out of the reeds and hungry.",
    null, [{ id: 'mob', opponent: 'goblin', level: 1, encounter: 'encounter:mere-mother' }], 'mere-brood'),
  figure('character:ruin-ghoul', 'Ruin ghoul', ORIGINAL, 'A starved servant of the Blood Court ruin.',
    'faction:blood-court', [{ id: 'mob', opponent: 'goblin', level: 1, encounter: null }], 'ruin-ghoul'),
  // PLACEHOLDER body: the worm fights on the held `minotaur` duel form until it has its own model (Strategy, 2026-10-07).
  figure('character:lambton-worm', 'The Lambton Worm', 'County Durham folklore; R. Surtees, History of Durham, vol. 2, 1820',
    'The worm a young heir threw down a well grew until it wrapped a hill. Where the sky splits over the Frontier, it comes up through the rift.',
    null, [{ id: 'rift', opponent: 'minotaur', level: 17, encounter: 'encounter:rift-worm' }], 'lambton-worm'),
  figure('character:rift-spawn', 'Rift spawn', ORIGINAL, 'Something that came through the split sky ahead of the worm.',
    null, [{ id: 'guardian', opponent: 'goblin', level: 15, encounter: 'encounter:rift-worm' }], 'rift-spawn'),
];

// Town people (living-world §4.1, §12): rulers, their stand-in stewards, and the service NPCs. Rulers are original NPCs (Brannoc and
// Osk named by the spec; the quarter's mayor PROPOSED). Stewards and service NPCs are PROPOSED. A service NPC can be a grudge rival
// (feuds §3.1), so each has a duel form; a ruler never is (living-world ruling 7), so rulers and stewards have none.
export const TOWNSFOLK = [
  figure('character:recorder-marrow', 'Marrow the Recorder', ORIGINAL, 'Keeps the Roll and the contract board in the Exchange square, and takes the fines that clear a name.',
    'faction:concord', [], 'recorder-marrow'),
  figure('character:mayor-hollin', 'Mayor Hollin', ORIGINAL, 'Runs the quarter outside the Exchange square for whoever pays the most rent this season.', 'faction:concord', [], 'mayor-hollin'),
  figure('character:warden-brannoc', 'Warden Brannoc', ORIGINAL, 'Holds the stockade at Cinder Hold and means to hold more of the Frontier than that.', null, [], 'warden-brannoc'),
  figure('character:reeve-osk', 'Reeve Osk', ORIGINAL, 'Keeps the hamlet at the foot of the causeway alive by never giving the mere a reason.', null, [], 'reeve-osk'),
  figure('character:steward-quarter', 'The Quarter Steward', ORIGINAL, 'Rules the quarter when the mayor cannot.', 'faction:concord', [], 'steward'),
  figure('character:steward-cinder', 'The Hold Steward', ORIGINAL, 'Rules Cinder Hold when the warden cannot.', null, [], 'steward'),
  figure('character:steward-mere', 'The Mere End Steward', ORIGINAL, 'Rules Mere End when the reeve cannot.', null, [], 'steward'),
  figure('character:smith-quarter', 'The Quarter Smith', ORIGINAL, 'Undercuts the forge in the square and does not care who knows it.', null,
    [{ id: 'duel', opponent: 'dwarf', level: 13, encounter: null }], 'smith'),
  figure('character:healer-quarter', 'The Quarter Healer', ORIGINAL, 'Binds wounds in the quarter for metal, and asks nothing about how they were got.', null,
    [{ id: 'duel', opponent: 'plaguedoctor', level: 12, encounter: null }], 'healer'),
  figure('character:fence-quarter', 'The Quarter Fence', ORIGINAL, 'Buys what the square will not.', null,
    [{ id: 'duel', opponent: 'executioner', level: 13, encounter: null }], 'fence'),
  figure('character:smith-cinder', 'The Hold Smith', ORIGINAL, 'Works grave iron from the ash pits into anything that holds an edge.', null,
    [{ id: 'duel', opponent: 'dwarf', level: 13, encounter: null }], 'smith'),
  figure('character:fence-cinder', 'The Hold Fence', ORIGINAL, 'Trades from the shrine road, where the warden does not look.', null,
    [{ id: 'duel', opponent: 'executioner', level: 12, encounter: null }], 'fence'),
  figure('character:healer-mere', 'The Mere End Healer', ORIGINAL, 'Draws mere-water out of drowned lungs, most days.', null,
    [{ id: 'duel', opponent: 'plaguedoctor', level: 13, encounter: null }], 'healer'),  // The Exchange's working NPCs (Town plan A1, NPC rows in origins/region1/npcs.ts). PROPOSED (Backend) names; no duel form: they are not grudge rivals.
  figure('character:banker-exchange', 'Cassa the Banker', ORIGINAL, 'Holds the Exchange vault, day and night; a night teller takes the counter while she sleeps.', 'faction:concord', [], 'banker'),
  figure('character:provisioner-exchange', 'Dunmore the Provisioner', ORIGINAL, 'Sells grave iron by the piece to anyone the smith will serve.', 'faction:concord', [], 'provisioner'),
  figure('character:innkeeper-exchange', 'Brisa of the Last Lamp', ORIGINAL, 'Keeps the only lamp in the square that never goes out.', 'faction:concord', [], 'innkeeper'),
];

// The encounters (region1 §4; living-world §8). Bounties are solo, no decay, restart 0. The contract needs at least one stage before the
// boss: a two-foe Bounty uses it as the first foe; a single-foe Bounty takes the dummy stage region1 §4 names (`challenge`: the foe
// itself steps up, one kill opens the fight), until `stages` may be empty (region1 §7 open 1b).
const solo = (id: string, name: string, stage: { id: string; character: string }, boss: string, level: number) => ({
  kind: 'encounter-definition', schemaVersion: 1, id, name, region: 'region:ash-frontier', scope: 'solo',
  stages: [{ id: stage.id, killsToAdvance: 1, population: 1, roster: [{ character: stage.character, weight: 1 }], loot: null }],
  boss: { character: boss, loot: 'loottable:bounty-unrolled', level },
  decay: null, restartSeconds: 0, rewards: { minContributionPercent: 10 },
});
export const DUMMY_STAGE = 'challenge';
export const ENCOUNTERS = [
  // The public event: one brood guardian (never a kill count), then Grendel's Mother. Health PROPOSED (the boss fixture's 1,000 a level).
  {
    kind: 'encounter-definition', schemaVersion: 1, id: 'encounter:mere-mother', name: 'The Mere-Mother Rises', region: 'region:ash-frontier', scope: 'public',
    stages: [{ id: 'guard', killsToAdvance: 1, population: 1, roster: [{ character: 'character:mere-brood', weight: 1 }], loot: null }],
    boss: { character: 'character:mere-mother', loot: 'loottable:mere-mother', level: 4, health: 4_000 },   // Zone 1's boss is the zone level + 3 (Dom 2026-10-08: Zone N = level N, boss N+3); health = the boss fixture's 1,000 a level (Lead ruling on Combat's bound for a Lv 4 player: ~3.3 min of perfect hits, 7-11 min realistic; 15,000 was 25-40 min); a boss battery may re-set it   // tunable starting value; re-set by a boss battery before any player meets it (Strategy, 2026-10-07),
    decay: { windowSeconds: 900, keepProgressPercent: 50 }, restartSeconds: 3600, rewards: { minContributionPercent: 10 },
  },
  solo('encounter:bounty-hrungnir', 'The Stone at the Shrine', { id: DUMMY_STAGE, character: 'character:hrungnir' }, 'character:hrungnir', 3),
  solo('encounter:bounty-toll', 'The Toll at the Milestone', { id: 'first-thrall', character: 'character:court-thrall' }, 'character:court-thrall', 3),
  solo('encounter:bounty-peg-powler', 'Peg Powler of the Reeds', { id: DUMMY_STAGE, character: 'character:peg-powler' }, 'character:peg-powler', 3),
  // The rift (living-world §8.3): one or two guardian duels per player, then the shared bar. Level = band top 15 + levelOver 2.
  // Health PROPOSED. It decays like any public event; the rift itself closes at the scheduler's openSeconds.
  {
    kind: 'encounter-definition', schemaVersion: 1, id: 'encounter:rift-worm', name: 'The Lambton Worm', region: 'region:ash-frontier', scope: 'public',
    stages: [{ id: 'gathering', killsToAdvance: 2, population: 2, roster: [{ character: 'character:rift-spawn', weight: 1 }], loot: null }],
    boss: { character: 'character:lambton-worm', loot: 'loottable:rift-worm', level: 17, health: 40_000 },   // tunable starting value; re-set by a boss battery before any player meets it (Strategy, 2026-10-07),
    decay: { windowSeconds: 900, keepProgressPercent: 50 }, restartSeconds: 0, rewards: { minContributionPercent: 10 },
  },
];

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
      'exchange-gate', 'milestone', 'watchtower', 'fields-turn', 'crossroads',
      'road-end', 'ferry-house', 'boathouse', 'mere-shore', 'dock',
      'road-gate', 'ash-pits', 'shrine', 'hold-road',
      'landing-shore', 'reed-bank', 'mere-hollow', 'causeway', 'causeway-foot',
      'causeway-end', 'ruin-jetty', 'ruin-gate', 'crypt',
      'reach-turn', 'reach-gate', 'reach-cairn', 'reach-ruin',
      'hold-gate', 'hold-centre', 'hold-hall', 'hold-forge', 'hold-fence', 'hold-jail',
      'end-gate', 'end-centre', 'end-hall', 'end-healer', 'end-jail',
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
      spawn('scavengers', 'ash-pits', null, ['character:cinder-scavenger']),
      spawn('wolves', 'hold-road', null, ['character:ash-wolf']),   // inert until a preview adds the wolf's mob row (origins/preview/mobs.ts previewRows ?wolf)
      spawn('brood', 'reed-bank', null, ['character:mere-brood']),
      spawn('ghouls', 'causeway-end', null, ['character:ruin-ghoul']),
      spawn('hold-ruler', 'hold-hall', null, ['character:warden-brannoc']),
      spawn('hold-steward', 'hold-hall', null, ['character:steward-cinder']),
      spawn('hold-smith', 'hold-forge', null, ['character:smith-cinder']),
      spawn('hold-fence', 'hold-fence', null, ['character:fence-cinder']),
      spawn('end-ruler', 'end-hall', null, ['character:reeve-osk']),
      spawn('end-steward', 'end-hall', null, ['character:steward-mere']),
      spawn('end-healer', 'end-healer', null, ['character:healer-mere']),
      spawn('bears', 'ruin-jetty', null, ['character:cinder-bear']),   // last in the list so the creatures placed before it keep their seeds (mobs.golden.json)
      spawn('boars', 'hold-road', null, ['character:ash-boar']),   // last in the list so the creatures placed before it keep their seeds (mobs.golden.json)
      spawn('reach-wolves', 'reach-cairn', null, ['character:ember-wolf']),   // Zone 2's (origins/zones/zone2): only a Zone 2 page has the Ash Reach in its plan
      spawn('reach-scavengers', 'reach-ruin', null, ['character:cinder-scavenger']),
    ],
    triggers: [], assetManifest: 'regions/ash-frontier/manifest.json',
  },
];

export const BUNDLE: Record<string, unknown>[] = [...ITEMS, ...LOOT_TABLES, ...FACTIONS, ...FOES, ...TOWNSFOLK, ...ENCOUNTERS, ...REGIONS];

// ---- 2. kinds the contracts do not have yet --------------------------------------------------------------------------------------

// Towns (living-world §3.1, §12). Tier at start comes from startProsperity (§3.3); services open never exceed the tier's count.
// Patrons are strike sources only, never foes (feuds §12–§13). `services[].trade` is the feuds §11 `trade` key.
const town = (
  id: string, name: string, region: string, zone: string, startProsperity: number, patron: string,
  ruler: { title: string; character: string; temperament: string; standIn: string },
  centre: string, jail: string, services: { trade: string; npc: string; at: string }[], resources: string[], riverside: boolean,
) => ({ kind: 'town-definition', schemaVersion: 1, id, name, region, zone, safe: false, startProsperity, patron, ruler: { ...ruler, successors: [] }, centre, jail, services, resources, riverside });

export const TOWNS = [
  town('town:exchange-quarter', 'The Exchange Quarter', 'region:concord-exchange', 'exchange-quarter', 500, 'patron:zeus',
    { title: 'mayor', character: 'character:mayor-hollin', temperament: 'mercantile', standIn: 'character:steward-quarter' },
    'quarter-centre', 'quarter-jail', [
      { trade: 'smith', npc: 'character:smith-quarter', at: 'quarter-forge' },
      { trade: 'healer', npc: 'character:healer-quarter', at: 'quarter-healer' },
      { trade: 'fence', npc: 'character:fence-quarter', at: 'quarter-fence' },
    ], ['rents', 'tolls'], false),
  town('town:cinder-hold', 'Cinder Hold', 'region:ash-frontier', 'cinder-hold', 260, 'patron:hel',
    { title: 'reeve', character: 'character:warden-brannoc', temperament: 'ambitious', standIn: 'character:steward-cinder' },
    'hold-centre', 'hold-jail', [
      { trade: 'smith', npc: 'character:smith-cinder', at: 'hold-forge' },
      { trade: 'fence', npc: 'character:fence-cinder', at: 'hold-fence' },
    ], ['grave-iron', 'ash-salt'], false),
  town('town:mere-end', 'Mere End', 'region:ash-frontier', 'mere-end', 180, 'patron:poseidon',
    { title: 'reeve', character: 'character:reeve-osk', temperament: 'cautious', standIn: 'character:steward-mere' },
    'end-centre', 'end-jail', [{ trade: 'healer', npc: 'character:healer-mere', at: 'end-healer' }], ['eels', 'reed'], true),
];

// Twists: Origins encounter flags only (region1 §7 ruling 10). The fight reads the encounter's flag; a Bounty's copy is display only
// and must match it. Kinds are the section 4 list; nothing here touches the live ladder, its RNG or src/.
export const ENCOUNTER_FLAGS: Record<string, Record<string, unknown>[]> = {
  'encounter:bounty-hrungnir': [{ kind: 'hazard', hazard: 'embers', stillSeconds: 2 }],
  'encounter:bounty-toll': [{ kind: 'one-health-bar' }],
  'encounter:bounty-peg-powler': [{ kind: 'flee-at', percent: 30, catchSeconds: 15 }],
};

// Bounties (region1 §3, Bounties; feuds keeps them unchanged). Metal is bronze on the one bound balance; dailyCap is wins paid per
// character per UTC server day. PROVISIONAL with the section: Dom may rename "Bounty".
const bounty = (id: string, name: string, encounter: string, metal: number, dailyCap: number) => ({
  kind: 'bounty-definition', schemaVersion: 1, id, name, region: 'region:ash-frontier', gate: 'outer', encounter,
  twist: ENCOUNTER_FLAGS[encounter]![0], metal, dailyCap,
});
export const BOUNTIES = [
  bounty('bounty:hrungnir', 'The Stone at the Shrine', 'encounter:bounty-hrungnir', 40, 3),
  bounty('bounty:toll', 'The Toll at the Milestone', 'encounter:bounty-toll', 30, 3),
  bounty('bounty:peg-powler', 'Peg Powler of the Reeds', 'encounter:bounty-peg-powler', 50, 2),
];

// Rifts (living-world §8.1, §8.4): the five Region 1 sites, the Lambton Worm, the scheduler. PROVISIONAL numbers, the spec's.
const site = (id: string, zone: string, at: string, weight: number) => ({ kind: 'rift-site', schemaVersion: 1, id, region: 'region:ash-frontier', zone, at, weight });
export const RIFTS = [
  site('rift:cinder-ash-pits', 'cinder-fields', 'ash-pits', 30),
  site('rift:ruin-causeway-end', 'blood-ruin', 'causeway-end', 20),
  site('rift:road-milestone', 'east-road', 'milestone', 15),
  site('rift:mere-reed-bank', 'black-mere', 'reed-bank', 20),
  site('rift:ruin-gate', 'blood-ruin', 'ruin-gate', 15),
  {
    kind: 'rift-boss', schemaVersion: 1, id: 'riftboss:lambton-worm', character: 'character:lambton-worm', levelOver: 2,
    guardian: 'character:rift-spawn', lootTable: 'loottable:rift-worm', weight: 20, encounter: 'encounter:rift-worm',
  },
  {
    kind: 'rift-scheduler', schemaVersion: 1, id: 'riftsched:ash-frontier', region: 'region:ash-frontier', perDayMin: 2, perDayMax: 4,
    minGapSeconds: 10_800, warnSeconds: 600, openSeconds: 1800, siteCooldownSeconds: 172_800, townClearanceMetres: 60, lootRollsPerWeek: 5,
  },
];

// Who pays which progression row (region1 §4: the `Kill` event's `type`), and how each boss table is rolled (region1 §5 ruling 9).
//   first-win: the table rolls only on the kill that pays the once-row; a repeat kill rolls nothing (world-boss).
//   weekly-cap: every eligible kill rolls, at most `perWeek` rolls an account a week (living-world §8.4, the PROPOSED rift-boss row).
//   never: the table is not rolled; the win pays metal (a Bounty).
export const KILL_ROWS: Record<string, string> = {
  'character:mere-mother': 'world-boss',
  'character:lambton-worm': 'rift-boss',
  'character:hrungnir': 'named',
  'character:peg-powler': 'named',
  'character:court-thrall': 'elite',
  'character:rift-spawn': 'elite',
  'character:cinder-scavenger': 'mob',
  'character:mere-brood': 'mob',
  'character:ash-wolf': 'mob',
  'character:ember-wolf': 'mob',
  'character:cinder-bear': 'mob',
  'character:ash-boar': 'mob',
  'character:ruin-ghoul': 'mob',
};
export const PROPOSED_ROWS = ['rift-boss'] as const; // living-world §8.4: weight 150, once false, rested, party each
export const BOSS_LOOT: { encounter: string; rule: 'first-win' | 'weekly-cap' | 'never'; perWeek?: number }[] = [
  { encounter: 'encounter:mere-mother', rule: 'first-win' },
  { encounter: 'encounter:rift-worm', rule: 'weekly-cap', perWeek: 5 },
  { encounter: 'encounter:bounty-hrungnir', rule: 'never' },
  { encounter: 'encounter:bounty-toll', rule: 'never' },
  { encounter: 'encounter:bounty-peg-powler', rule: 'never' },
];

// Which encounter each creature table is rolled from in the open world (no encounter: a plain kill).
export const CREATURE_LOOT: Record<string, string> = {
  'character:cinder-scavenger': 'loottable:cinder-scavenger',
  'character:ruin-ghoul': 'loottable:ruin-ghoul',
  'character:mere-brood': 'loottable:mere-brood',
  'character:ash-wolf': 'loottable:ash-wolf',
  'character:ember-wolf': 'loottable:ember-wolf',
  'character:cinder-bear': 'loottable:cinder-bear',
  'character:ash-boar': 'loottable:ash-boar',
  'character:court-thrall': 'loottable:court-thrall',
};

export const LOCAL = { towns: TOWNS, bounties: BOUNTIES, flags: ENCOUNTER_FLAGS, rifts: RIFTS, killRows: KILL_ROWS, bossLoot: BOSS_LOOT, creatureLoot: CREATURE_LOOT };
