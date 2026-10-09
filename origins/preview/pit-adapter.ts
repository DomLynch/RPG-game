// The ONE origins file allowed to import the Pit (src/arena*.ts), whitelisted by name in the core/pit lint (Combat). main.ts gets the Pit's start-area builder and Arena 1's theme through here
// until the zone-agnostic scenery (sky environment, ground disc, backdrop ring, shared materials, texture worker, props loader) is MOVED into core and this file is deleted (Lead's scope ruling 2026-10-08, step D).
export { buildArena } from '../../src/arena.ts';
export { ARENA_THEMES } from '../../src/arena-themes.ts';
