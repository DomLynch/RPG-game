// Valid example records for the contract tests: a small slice of chapter one, "The Stolen Name". Every builder returns a fresh object so
// a test can break one field without touching another test's copy. Example content only; none of it is shipped.

export const ACCOUNT = 'account:0b8e2a6c-1f3d-4c5e-9a7b-2c4d6e8f0a1b';
export const OTHER_ACCOUNT = 'account:9f8e7d6c-5b4a-4321-8fed-cba987654321';
export const PC = 'pc:dom-1';
export const OTHER_PC = 'pc:rival-1';
export const AT = '2026-10-06T12:00:00Z';

export const helmetDef = () => ({
  kind: 'item-definition', schemaVersion: 1, id: 'item:loot.veteran.Helmet', name: "The Centurion's helmet", category: 'gear', rarity: 'common',
  slot: 'Helmet', power: 'slot-weight', material: 'iron', appearance: { asset: 'loot.glb/veteran.Helmet' }, story: 'none', binding: 'none', stack: 1,
});
export const recordDef = () => ({
  kind: 'item-definition', schemaVersion: 1, id: 'item:stolen-name-record', name: 'The Record of Names', category: 'quest', rarity: 'relic',
  slot: null, power: 'none', material: 'bone', appearance: { asset: 'items/record-of-names.glb' }, story: 'story-critical', binding: 'on-acquire', stack: 1,
});
export const graveIronDef = () => ({
  kind: 'item-definition', schemaVersion: 1, id: 'item:grave-iron', name: 'Grave iron', category: 'material', rarity: 'fine',
  slot: null, power: 'none', material: 'iron', appearance: { asset: 'items/grave-iron.glb' }, story: 'none', binding: 'none', stack: 50,
});
// Ore the Exchange takes in (a quest hand-in, a smith's material line). Not in `bundle()`: the registry tests pin its record indexes.
export const exchangeOreDef = () => ({
  kind: 'item-definition', schemaVersion: 1, id: 'item:exchange-ore', name: 'Exchange ore', category: 'material', rarity: 'common',
  slot: null, power: 'none', material: 'stone', appearance: { asset: 'items/exchange-ore.glb' }, story: 'none', binding: 'none', stack: 50,
});
export const tokenDef = () => ({
  kind: 'item-definition', schemaVersion: 1, id: 'item:ferry-token', name: 'Ferryman\'s token', category: 'cosmetic', rarity: 'rare',
  slot: 'Crest', power: 'none', material: 'bronze', appearance: { asset: 'items/ferry-token.glb' }, story: 'notable', binding: 'on-equip', stack: 1,
});

export const helmetInstance = () => ({
  kind: 'item-instance', schemaVersion: 1, id: 'inst:5f0c2d4e-0001', item: 'item:loot.veteran.Helmet', version: 3, quantity: 1, tier: 'Gladiator',
  location: { kind: 'equipped', owner: PC, slot: 'head' }, boundTo: null,
  provenance: { kind: 'arena-award', mintKey: 'claim:1234', at: AT, claimId: 1234, lootId: 'veteran.Helmet', wonBy: PC, fromLegend: 'veteran-3', atRank: 'Gladiator' },
  history: [],
});
export const ironInstance = () => ({
  kind: 'item-instance', schemaVersion: 1, id: 'inst:5f0c2d4e-0002', item: 'item:grave-iron', version: 0, quantity: 12, tier: null,
  location: { kind: 'bank', owner: PC, index: 4 }, boundTo: null,
  provenance: { kind: 'loot', mintKey: 'loot:ruin-vigil:7781', at: AT, wonBy: PC, table: 'loottable:ghoul', encounter: 'encounter:ruin-vigil' },
  history: [],
});
export const recordInstance = () => ({
  kind: 'item-instance', schemaVersion: 1, id: 'inst:5f0c2d4e-0003', item: 'item:stolen-name-record', version: 0, quantity: 1, tier: null,
  location: { kind: 'pack', owner: PC, index: 0 }, boundTo: PC,
  provenance: { kind: 'quest-reward', mintKey: 'quest:stolen-name:ruin:dom-1', at: AT, wonBy: PC, quest: 'quest:stolen-name', stage: 'ruin' },
  history: [],
});

export const bossLoot = () => ({
  kind: 'loot-table', schemaVersion: 1, id: 'loottable:ruin-boss', presentation: 'take-one', distribution: 'personal',
  rolls: [{ probability: 100, repeat: 1, mode: 'weighted', dropLimit: 2, minDrop: 1, entries: [
    { item: 'item:loot.veteran.Helmet', chance: 40, quantity: 1, levelMin: null, levelMax: null },
    { item: 'item:ferry-token', chance: 10, quantity: 1, levelMin: 11, levelMax: 46 },
  ] }],
  currency: { min: 50, max: 200 }, fallback: { kind: 'craft-progress', amount: 25 },
});
export const ghoulLoot = () => ({
  kind: 'loot-table', schemaVersion: 1, id: 'loottable:ghoul', presentation: 'collect', distribution: 'personal',
  rolls: [{ probability: 60, repeat: 1, mode: 'independent', dropLimit: 0, minDrop: 0, entries: [{ item: 'item:grave-iron', chance: 30, quantity: 3, levelMin: null, levelMax: null }] }],
  currency: null, fallback: null,
});

export const ferryCourt = () => ({
  kind: 'faction-definition', schemaVersion: 1, id: 'faction:ferry-court', name: 'The Ferry Court', joinable: true, hidden: false,
  ranks: [{ id: 'oarhand', title: 'Oarhand', minStanding: 0 }, { id: 'pilot', title: 'Pilot', minStanding: 300 }],
  reactions: [{ faction: 'faction:blood-court', attitude: 'hostile' }],
});
export const bloodCourt = () => ({
  kind: 'faction-definition', schemaVersion: 1, id: 'faction:blood-court', name: 'The Blood Court', joinable: false, hidden: true, ranks: [],
  reactions: [{ faction: 'faction:ferry-court', attitude: 'angry' }],
});
export const standing = () => ({ kind: 'faction-standing', schemaVersion: 1, character: PC, faction: 'faction:ferry-court', standing: 120, rank: 0, expelled: false });

export const exchange = () => ({
  kind: 'region-definition', schemaVersion: 1, id: 'region:concord-exchange', name: 'The Concord Exchange', gate: 'outer',
  waypoints: ['plaza', 'bank-front', 'west-gate'],
  portals: [{ id: 'to-frontier', at: 'west-gate', to: 'region:ash-frontier', toPortal: 'to-exchange' }],
  landmarks: [{ id: 'bank', name: 'The Vaults', at: 'bank-front' }],
  spawns: [], triggers: [], assetManifest: 'regions/exchange/manifest.json',
});
export const frontier = () => ({
  kind: 'region-definition', schemaVersion: 1, id: 'region:ash-frontier', name: 'The Ash Frontier', gate: 'outer',
  waypoints: ['east-road', 'dock', 'house', 'ruin-gate'],
  portals: [{ id: 'to-exchange', at: 'east-road', to: 'region:concord-exchange', toPortal: 'to-frontier' }],
  landmarks: [{ id: 'ferry', name: 'The Grey Ferry', at: 'dock' }],
  spawns: [{ id: 'vigil', at: 'ruin-gate', encounter: 'encounter:ruin-vigil', characters: [] }, { id: 'courier', at: 'dock', encounter: null, characters: ['character:courier-vell'] }],
  triggers: [{ id: 'ruin-door', at: 'ruin-gate', quest: 'quest:stolen-name', stage: 'ruin' }],
  assetManifest: 'regions/ash-frontier/manifest.json',
});

export const courier = () => ({
  kind: 'character-definition', schemaVersion: 1, id: 'character:courier-vell', name: 'Vell the Courier',
  lore: { source: 'original', summary: 'A ferry courier who carried one name too many across the river.' },
  faction: 'faction:ferry-court', essential: true,
  relationships: [{ character: 'character:legend.nightborn-3', relation: 'enemy' }],
  questRoles: [{ quest: 'quest:stolen-name', role: 'witness' }],
  presentations: [{ id: 'default', asset: 'characters/courier.glb' }],
  encounterForms: [],
  routine: [
    { start: '06:00', end: '20:00', activity: 'carry', region: 'region:ash-frontier', waypoint: 'dock' },
    { start: '20:00', end: '06:00', activity: 'sleep', region: 'region:ash-frontier', waypoint: 'house' },
  ],
});
export const varney = () => ({
  kind: 'character-definition', schemaVersion: 1, id: 'character:legend.nightborn-3', name: 'Varney',
  lore: { source: 'Varney the Vampire, 1847', summary: 'An undead gentleman who keeps the stolen record in his ruin.' },
  faction: 'faction:blood-court', essential: false, relationships: [], questRoles: [{ quest: 'quest:stolen-name', role: 'boss' }],
  presentations: [{ id: 'default', asset: 'characters/nightborn.glb' }],
  encounterForms: [{ id: 'duel', opponent: 'nightborn', level: 13, encounter: 'encounter:ruin-vigil' }],
  routine: [],
});
export const ghoul = () => ({
  kind: 'character-definition', schemaVersion: 1, id: 'character:ruin-ghoul', name: 'Ruin ghoul',
  lore: { source: 'original', summary: 'A starved servant of the ruin.' }, faction: 'faction:blood-court', essential: false,
  relationships: [], questRoles: [], presentations: [{ id: 'default', asset: 'characters/ghoul.glb' }],
  encounterForms: [{ id: 'mob', opponent: 'goblin', level: 11, encounter: null }], routine: [],
});

export const vigil = () => ({
  kind: 'encounter-definition', schemaVersion: 1, id: 'encounter:ruin-vigil', name: 'The Vigil at the Ruin', region: 'region:ash-frontier', scope: 'party',
  stages: [
    { id: 'outer-court', killsToAdvance: 6, population: 3, roster: [{ character: 'character:ruin-ghoul', weight: 1 }], loot: 'loottable:ghoul' },
    { id: 'crypt', killsToAdvance: 4, population: 2, roster: [{ character: 'character:ruin-ghoul', weight: 1 }], loot: null },
  ],
  boss: { character: 'character:legend.nightborn-3', loot: 'loottable:ruin-boss' },
  decay: null, restartSeconds: 0, rewards: { minContributionPercent: 10 },
});

const noRewards = () => ({ loot: null, standing: [] });
export const stolenName = () => ({
  kind: 'quest-definition', schemaVersion: 1, id: 'quest:stolen-name', title: 'The Stolen Name', storyVersion: 2, scope: 'personal', gate: 'outer', start: 'erased',
  stages: [
    { id: 'erased', kind: 'progress', journal: 'My name is gone from the record beneath the Pit.', rewards: noRewards(),
      transitions: [{ to: 'courier', when: [{ kind: 'tier-at-least', tier: 'Gladiator' }], label: null }] },
    { id: 'courier', kind: 'progress', journal: 'A ferry courier carried the record away.', rewards: noRewards(),
      transitions: [{ to: 'ruin', when: [{ kind: 'flag', name: 'heard-testimony', value: true }], label: null }] },
    { id: 'ruin', kind: 'progress', journal: 'The record is in the ruin of the Blood Court.', rewards: { loot: 'loottable:ruin-boss', standing: [{ faction: 'faction:blood-court', delta: -50 }] },
      transitions: [
        { to: 'returned', when: [{ kind: 'choice', choice: 'return' }, { kind: 'has-item', item: 'item:stolen-name-record' }], label: 'Return the record' },
        { to: 'bargained', when: [{ kind: 'choice', choice: 'bargain' }, { kind: 'standing-at-least', faction: 'faction:ferry-court', value: 100 }], label: 'Bargain with it' },
        { to: 'exposed', when: [{ kind: 'choice', choice: 'expose' }, { kind: 'encounter-cleared', encounter: 'encounter:ruin-vigil' }], label: 'Expose the forgery' },
      ] },
    { id: 'returned', kind: 'finish', journal: 'I put my name back where it was.', transitions: [], rewards: { loot: null, standing: [{ faction: 'faction:ferry-court', delta: 50 }] } },
    { id: 'bargained', kind: 'finish', journal: 'The Ferry Court owes me now.', transitions: [], rewards: noRewards() },
    { id: 'exposed', kind: 'finish', journal: '', transitions: [], rewards: noRewards() },
  ],
  migrations: [{ fromVersion: 1, stageMap: [{ from: 'missing', to: 'courier' }], checkpoint: 'erased' }],
});
export const questState = () => ({
  kind: 'quest-state', schemaVersion: 1, character: PC, quest: 'quest:stolen-name', storyVersion: 2, stage: 'ruin', status: 'active',
  journal: [{ stage: 'erased', text: 'My name is gone from the record beneath the Pit.', at: AT }],
  flags: { 'heard-testimony': true },
});

export const smith = () => ({
  kind: 'character-definition', schemaVersion: 1, id: 'character:smith-orla', name: 'Orla the Smith',
  lore: { source: 'original', summary: 'Keeps the forge beside the Concord Exchange and works any metal brought to her.' },
  faction: null, essential: true, relationships: [], questRoles: [], presentations: [{ id: 'default', asset: 'characters/smith.glb' }],
  encounterForms: [], routine: [],
});
export const blacksmith = () => ({
  kind: 'service-definition', schemaVersion: 1, id: 'service:exchange-forge', name: 'The Exchange Forge', npc: 'character:smith-orla',
  region: 'region:concord-exchange', service: 'upgrade', costTable: 'costtable:forge', accepts: 'all',
});
export const forgeCosts = () => ({
  kind: 'upgrade-cost-table', schemaVersion: 1, id: 'costtable:forge', revision: 1, currency: 'coin',
  rows: [
    { level: 1, rarity: 'common', coin: 100, materials: [] },
    { level: 2, rarity: 'common', coin: 250, materials: [{ item: 'item:grave-iron', quantity: 5 }] },
    { level: 1, rarity: 'relic', coin: 300, materials: [] },
  ],
});

export const bundle = (): Record<string, unknown>[] => [
  smith(), blacksmith(), forgeCosts(),
  helmetDef(), recordDef(), graveIronDef(), tokenDef(), bossLoot(), ghoulLoot(), ferryCourt(), bloodCourt(), exchange(), frontier(), courier(), varney(), ghoul(), vigil(), stolenName(),
];
