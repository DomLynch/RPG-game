// The CORE's one door for MODES (the Pit src/main.ts, the zone page origins/preview): accounts, the item ledger, loot, grades, the gear sheet and the writer call.
// Renderer-bearing (gear-room draws with three.js), so server-run code takes ./server.ts instead. tests/core-boundary.test.ts pins both doors.
export * from './writer-call.ts';
export * from './open.ts';
export * from './build-ref.ts';
export * from './session.ts';
export * from './profile.ts';
export * from './grades.ts';
export * from './loot.ts';
export * from './loot-claims.ts';
export * from './loot-panel.ts';
export * from './gear-ledger.ts';
export * from './gear-net.ts';
export * from './gear-server.ts';
export * from './gear-room.ts';
export * from './gear-sheet.ts';
export * from './gear-strip.ts';
export * from './career-ladder.ts';
export * from './career-model.ts';
export * from './career-client.ts';
export * from './career-screen.ts';
export * from './rename.ts';
export * from './registry.ts';
export * from './world/row.ts';
export * from './world/styles.ts';
export * from './world/kits.ts';
export * from './world/kit-version.ts';
export * from './world/info.ts';
export * from './world/wildlife-rows.ts';
export * from './contracts/core.ts';
export * from './contracts/ids.ts';
export * from './contracts/items.ts';
export * from './contracts/economy.ts';
export * from './contracts/world.ts';
export * from './contracts/story.ts';
export * from './contracts/registry.ts';
export * from './contracts/fixtures.ts';
export { powerOf, categoryOf, storyOf, provenanceOf } from './contracts/definitions.ts';   // the data-defined item vocabularies' readers (rows in contracts/definitions.json)
export * from './luck.ts';
// Names two core modules both define: the explicit export wins the star ambiguity, the other keeps an alias.
export type { Provenance } from './loot.ts';
export type { Provenance as ItemProvenance } from './contracts/items.ts';
export type { Rarity } from './contracts/items.ts';
export type { Rarity as MobRarity } from './world/row.ts';
export type { UpgradeReceipt } from './gear-net.ts';
export type { UpgradeReceipt as EconomyUpgradeReceipt } from './contracts/economy.ts';
export { tierOf } from './career-model.ts';
export { tierOf as standingTierOf } from './contracts/world.ts';
