// The CORE's NODE-SAFE door (like src/fight/server.ts): re-exports only, nothing that touches three.js or the page. Server-run code (origins/server, contracts,
// encounters, inventory, region1) and node scripts reach the core here; they cannot take ./index.ts (gear-room draws with three.js, which the box does not install).
export * from './writer-call.ts';
export * from './open.ts';
export * from './grades.ts';
export * from './loot.ts';
export * from './gear-ledger.ts';
export * from './career-state.ts';
