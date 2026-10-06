// Chapter one's world boss, as raw content (parsed by parseBossDefinition in the tests): the Ash Hound Matriarch in the Ash Frontier, the
// region through the Concord Exchange's west gate. Twelve ash hounds fill the bar, then she comes up at level 12; back an hour after.
export const matriarch = () => ({
  encounter: {
    kind: 'encounter-definition', schemaVersion: 1, id: 'encounter:ash-hound-matriarch', name: 'The Ash Hound Matriarch',
    region: 'region:ash-frontier', scope: 'public',
    stages: [{ id: 'pack', killsToAdvance: 12, population: 4, roster: [{ character: 'character:ash-hound', weight: 1 }], loot: null }],
    boss: { character: 'character:ash-hound-matriarch', loot: 'loottable:ash-hound-matriarch' },
    decay: { windowSeconds: 1800, keepProgressPercent: 20 }, restartSeconds: 3600, rewards: { minContributionPercent: 10 },
  },
  level: 12,
  health: 12_000,
});
