// The Mac release row for the landscape Pit, the ☰ journal tabs and the paper-doll in Safari's engine (Dom's iPhone): scripts/pit-landscape-check.mjs with --engine webkit.
// A WebKit row stays on the Mac (Dom's rule), and its name is what the Mac's heavy-run guard recognises. Serves this tree's build (run `npx vite build` first); stills and receipt: artifacts/pit-landscape-webkit/.
process.env.OUT ||= 'artifacts/pit-landscape-webkit';
process.argv.push('--engine', 'webkit');
await import('./pit-landscape-check.mjs');
