// The Mac release row for the player's title in Safari's engine (Dom's iPhone): scripts/title-check.mjs with --engine webkit.
// A WebKit row stays on the Mac (Dom's rule), and its name is what the Mac's heavy-run guard recognises. Serves this tree's build (run `npx vite build` first); stills: artifacts/title-webkit/.
process.env.OUT ||= 'artifacts/title-webkit';
if (!process.argv.includes('--engine')) process.argv.push('--engine', 'webkit');
await import('./title-check.mjs');
