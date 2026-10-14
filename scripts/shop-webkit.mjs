// The Mac release row for the shop screen in Safari's engine (Dom's iPhone): scripts/shop-check.mjs with --engine webkit.
// A WebKit row stays on the Mac (Dom's rule). Serves the built origins preview (run `npx vite build --config origins/preview/vite.config.mjs` first); stills: artifacts/shop-webkit/.
process.env.OUT ||= 'artifacts/shop-webkit';
if (!process.argv.includes('--engine')) process.argv.push('--engine', 'webkit');
await import('./shop-check.mjs');
