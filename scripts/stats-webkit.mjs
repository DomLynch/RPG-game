// The Mac release row for the stats screen in Safari's engine (Dom's iPhone): scripts/stats-check.mjs with --engine webkit.
// A WebKit row stays on the Mac (Dom's rule). Serves the built origins preview (run `npx vite build --config origins/preview/vite.config.mjs` first); stills: artifacts/stats-webkit/.
process.env.OUT ||= 'artifacts/stats-webkit';
if (!process.argv.includes('--engine')) process.argv.push('--engine', 'webkit');
await import('./stats-check.mjs');
