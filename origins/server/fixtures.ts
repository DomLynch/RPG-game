// A story bundle for the writer's tests and scripts/origins-writer-check.mjs: the O2 example content (the Concord Commission, the Smith's
// Favour, Orla) with the definitions it names, plus a small errand whose branches reach a finish and a stage that pays faction standing
// without needing an item. Example content only; not shipped.
import { concordCommission, smithsFavour } from '../quests/fixtures.ts';
import { orla } from '../talk/fixtures.ts';

const none = () => ({ loot: null, standing: [] });
export const ore = () => ({
  kind: 'item-definition', schemaVersion: 1, id: 'item:exchange-ore', name: 'Exchange ore', category: 'material', rarity: 'common',
  slot: null, power: 'none', material: 'iron', appearance: { asset: 'items/exchange-ore.glb' }, story: 'none', binding: 'none', stack: 20,
});
export const concord = () => ({ kind: 'faction-definition', schemaVersion: 1, id: 'faction:concord', name: 'The Concord', joinable: false, hidden: false, ranks: [], reactions: [] });
export const commissionLoot = () => ({
  kind: 'loot-table', schemaVersion: 1, id: 'loottable:concord-commission', presentation: 'collect', distribution: 'personal',
  rolls: [{ probability: 100, repeat: 1, mode: 'independent', dropLimit: 0, minDrop: 0, entries: [{ item: 'item:exchange-ore', chance: 100, quantity: 1, levelMin: null, levelMax: null }] }],
  currency: null, fallback: null,
});
export const errand = () => ({
  kind: 'quest-definition', schemaVersion: 1, id: 'quest:orla-errand', title: "Orla's Errand", storyVersion: 1, scope: 'personal', gate: 'outer', start: 'asked',
  stages: [
    { id: 'asked', kind: 'progress', journal: 'Orla wants a word put in for her at the Concord.', rewards: none(),
      transitions: [{ to: 'favour', when: [{ kind: 'choice', choice: 'favour' }], label: 'Speak for her' }, { to: 'done', when: [{ kind: 'choice', choice: 'thanks' }], label: 'Tell her it is done' }] },
    { id: 'favour', kind: 'progress', journal: 'The Concord heard me out.', rewards: { loot: null, standing: [{ faction: 'faction:concord', delta: 5 }] }, transitions: [{ to: 'done', when: [], label: null }] },
    { id: 'done', kind: 'finish', journal: 'The errand is done.', transitions: [], rewards: none() },
  ],
  migrations: [],
});
export const storyBundle = (): Record<string, unknown>[] => [ore(), concord(), commissionLoot(), concordCommission(), smithsFavour(), errand(), orla()];
