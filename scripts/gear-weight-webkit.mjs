// The Mac release row for the armour weight badge on the Pit page's gear sheet in Safari's engine: scripts/gear-weight-check.mjs with --engine webkit. A WebKit row stays on the Mac (Dom's rule).
// Serves the Pit's built dist (run `npm run build` first); stills: artifacts/gear-weight-webkit/.
process.env.GEAR_RECEIPT_DIR ||= 'artifacts/gear-weight-webkit';
if (!process.argv.includes('--engine')) process.argv.push('--engine', 'webkit');
await import('./gear-weight-check.mjs');
