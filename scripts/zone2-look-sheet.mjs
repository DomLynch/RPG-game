// A labelled side-by-side sheet from zone2-look-stills.mjs output: node scripts/zone2-look-sheet.mjs <stills dir>  -> sheet-375.png, sheet-desktop.png
import fs from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright';

const dir = process.argv[2]; if (!dir) throw new Error('usage: zone2-look-sheet.mjs <stills dir>');
const labels = { base: 'Today', a: 'A  Ember dusk', b: 'B  Bone mist', c: 'C  Blood moon' };
const browser = await chromium.launch({ executablePath: process.env.CHROME || undefined });
try {
  for (const [name, w, h] of [['375', 375, 812], ['desktop', 640, 360]]) {
    const cells = Object.entries(labels).map(([k, t]) => `<figure><img src="data:image/png;base64,${fs.readFileSync(path.join(dir, `${k}-${name}.png`)).toString('base64')}" width="${w}" height="${h}"><figcaption>${t}</figcaption></figure>`).join('');
    const cols = name === '375' ? 4 : 2, page = await browser.newPage({ viewport: { width: cols * (w + 12) + 12, height: 100 } });
    await page.setContent(`<body style="margin:0;background:#111;color:#eee;font:600 18px Georgia"><div style="display:grid;grid-template-columns:repeat(${cols},${w}px);gap:12px;padding:12px">${cells}</div><style>figure{margin:0}figcaption{padding:6px 2px}</style></body>`);
    await page.screenshot({ path: path.join(dir, `sheet-${name}.png`), fullPage: true });
    await page.close();
  }
} finally { await browser.close(); }
