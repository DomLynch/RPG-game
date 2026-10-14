// The Mac release row for the armour weight badge on the ZONE's ☰ Gear screen in Safari's engine: scripts/gear-weight-zone-check.mjs with --engine webkit. A WebKit row stays on the Mac (Dom's rule).
// Serves the built origins preview (run `npx vite build --config origins/preview/vite.config.mjs` first); stills: artifacts/gear-weight-zone-webkit/.
process.env.GEAR_RECEIPT_DIR ||= 'artifacts/gear-weight-zone-webkit';
if (!process.argv.includes('--engine')) process.argv.push('--engine', 'webkit');
await import('./gear-weight-zone-check.mjs');
