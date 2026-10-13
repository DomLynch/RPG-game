// The Mac release row for "place your point" in Safari's engine (Dom's iPhone): scripts/build-point-check.mjs with --engine webkit.
// A WebKit row stays on the Mac (Dom's rule), and its name is what the Mac's heavy-run guard recognises. Serves this tree's build (run `npx vite build` first); stills: artifacts/point-webkit/.
process.env.OUT ||= 'artifacts/point-webkit';
if (!process.argv.includes('--engine')) process.argv.push('--engine', 'webkit');
await import('./build-point-check.mjs');
