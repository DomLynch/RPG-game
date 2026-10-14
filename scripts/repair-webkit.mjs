// The Mac release row for the smith screen in Safari's engine (Dom's iPhone): scripts/repair-check.mjs with --engine webkit. A WebKit row stays on the Mac (Dom's rule).
// Serves the built origins preview (run `npx vite build --config origins/preview/vite.config.mjs` first); stills: artifacts/repair-webkit/.
process.env.OUT ||= 'artifacts/repair-webkit';
if (!process.argv.includes('--engine')) process.argv.push('--engine', 'webkit');
await import('./repair-check.mjs');
