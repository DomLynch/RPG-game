// The CORE's NODE-SAFE door (like src/fight/server.ts): re-exports only, nothing that touches three.js or the page. Server-run code (origins/server, contracts,
// encounters, inventory, region1) and node scripts reach the core here; they cannot take ./index.ts (gear-room draws with three.js, which the box does not install).
export * from './writer-call.ts';
export * from './open.ts';
export * from './grades.ts';
export * from './loot.ts';
export * from './gear-ledger.ts';
export * from './career-ladder.ts';
export * from './career-model.ts';
export * from './registry.ts';
export * from './live-ops.ts';
export * from './world-sim.ts';
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
export * from './items/loot-catalogue.ts';
export * from './contracts/registry.ts';
export * from './contracts/fixtures.ts';
export { powerOf, categoryOf, storyOf, provenanceOf } from './contracts/definitions.ts';   // the data-defined item vocabularies' readers (rows in contracts/definitions.json)
export * from './luck.ts';
// Names two core modules both define: the explicit export wins the star ambiguity, the other keeps an alias.
export type { Provenance } from './loot.ts';
export type { Provenance as ItemProvenance } from './contracts/items.ts';
export type { Rarity } from './contracts/items.ts';
export type { Rarity as MobRarity } from './world/row.ts';
export { tierOf } from './career-model.ts';
export { tierOf as standingTierOf } from './contracts/world.ts';
export { FREE_RESPREAD_LEVEL, RANK_LEVELS } from './build-model.ts';   // the re-spread numbers: origins/server/build.ts reads them here (one copy, in the client model)
