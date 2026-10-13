// The Mac release row for the sparring banner in Safari's engine (Dom's iPhone): scripts/sparring-banner-still.mjs with --engine webkit.
// A WebKit row stays on the Mac (Dom's rule), and its name is what the Mac's heavy-run guard recognises. Serves this tree's build (run `npx vite build` first); stills: artifacts/sparring-banner-webkit/.
process.env.OUT ||= 'artifacts/sparring-banner-webkit';
if (!process.argv.includes('--engine')) process.argv.push('--engine', 'webkit');
await import('./sparring-banner-still.mjs');
