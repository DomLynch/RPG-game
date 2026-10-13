// The CORE's PAGE-AND-NODE-SAFE door (World, 2026-10-13): the few pure modules BOTH the built Origins page and node-run code need (origins/preview/mobs.ts is loaded by the page and by the box's
// world-spawns), re-exported without the barrel doors' weight: src/core/index.ts draws with three.js and src/core/server.ts re-exports the whole server-side core. Nothing here may reach origins/,
// a *server.ts door, a renderer or the network: tests/preview-no-server.test.ts walks this file's closure. Add a module only if it is pure and either side needs it.
export * from './world-sim.ts';
export * from './world/row.ts';
export type { CharacterId, EncounterId } from './contracts/ids.ts';
