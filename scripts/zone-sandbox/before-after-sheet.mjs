// Zone sandbox check (see scripts/zone-sandbox/README.md). Usage: node scripts/zone-sandbox/before-after-sheet.mjs <dir>   // builds fit-sheet.png from fit-before-*.png / fit-after-*.png
// Needs playwright resolvable from PW_ROOT (default: the current directory) and a Mac GPU: it launches chromium with --use-angle=metal.
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
const require = createRequire((process.env.PW_ROOT ?? process.cwd()) + '/');
const { chromium } = require('playwright');
const d = process.argv[2], b = (f) => readFileSync(`${d}/${f}`).toString('base64');
const cell = (f, l) => `<div style="position:relative"><img src="data:image/png;base64,${b(f)}" style="width:300px"><span style="position:absolute;left:4px;top:4px;color:#fff;font:14px sans-serif;background:#000b;padding:2px 6px">${l}</span></div>`;
const browser = await chromium.launch(); const p = await browser.newPage({ viewport: { width: 1230, height: 800 } });
await p.setContent(`<body style="margin:0;background:#111;display:grid;grid-template-columns:repeat(2,300px);gap:6px;width:606px">${cell('fit-before-ready.png', 'BEFORE ready (engine retarget only)')}${cell('fit-after-ready.png', 'AFTER ready (per-bone fit)')}${cell('fit-before-fight.png', 'BEFORE mid-fight')}${cell('fit-after-fight.png', 'AFTER mid-fight')}</body>`);
await p.waitForTimeout(500); await p.screenshot({ path: `${d}/fit-sheet.png`, clip: { x: 0, y: 0, width: 606, height: 800 } }); await browser.close();
