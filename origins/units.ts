// Generic units both the writer (origins/server) and the page-reachable presence code (origins/presence, origins/preview) read. Nothing here may import server code: the built page follows these imports (tests/preview-no-server.test.ts).
// None is a game rule: each is a named exempt entry in scripts/as-data/allow/origins-server.json with its reason. origins/server/units.ts re-exports them for the writer.
export const MS_PER_SECOND = 1000;
export const HALF = 0.5;   // one half: a half-extent, a midpoint, the centre of an interval; x * HALF is exactly x / 2 in floating point
export const DIAMETER_PER_RADIUS = 2;   // a circle's diameter is twice its radius: geometry
export const PERCENT = 100;   // a percent is a hundredth: the scale a percent figure is read on
