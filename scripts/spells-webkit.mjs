// The Mac release row for the spell book in Safari's engine (Dom's iPhone): scripts/grimoire-check.mjs with --engine webkit.
// A WebKit row stays on the Mac (Dom's rule), and its name is what the Mac's heavy-run guard recognises. Serves this tree's build (run `npx vite build` first); stills: artifacts/spells-webkit/.
process.env.OUT ||= 'artifacts/spells-webkit';
if (!process.argv.includes('--engine')) process.argv.push('--engine', 'webkit');
await import('./grimoire-check.mjs');
