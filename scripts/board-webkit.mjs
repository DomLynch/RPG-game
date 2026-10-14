// The Mac release row for the daily board screen in Safari's engine (Dom's iPhone): scripts/board-check.mjs with --engine webkit.
// A WebKit row stays on the Mac (Dom's rule), and its name is what the Mac's heavy-run guard recognises. Serves the built origins preview (run `npx vite build --config origins/preview/vite.config.mjs` first); stills: artifacts/board-webkit/.
process.env.OUT ||= 'artifacts/board-webkit';
if (!process.argv.includes('--engine')) process.argv.push('--engine', 'webkit');
await import('./board-check.mjs');
