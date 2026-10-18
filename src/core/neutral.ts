// The CORE's NEUTRAL door: re-exports only modules that import NOTHING (no renderer, no node API, no other core module), so both the page (origins/preview/**) and the box's node services can take it
// without the page reaching src/core/server.ts or the server closure reaching src/core/index.ts. For the page-folder files the writer ALSO loads at runtime (preview-rules.ts, frontier-plan-rules.ts): the
// registry loader that reads their rows. Add a module here only if it has zero imports (tests/core-boundary.test.ts walks this file's closure and fails on any), never to dodge a door.
export * from './registry.ts';
