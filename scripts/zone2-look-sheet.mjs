// A labelled side-by-side sheet from zone2-look-stills.mjs output (FIGHT=1 adds the -fight shots): node scripts/zone2-look-sheet.mjs <stills dir>  -> sheet-375.png, sheet-desktop.png
import fs from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright';
import { launchBrowser } from './lib/harness-browser-launch.mjs';

const dir = process.argv[2]; if (!dir) throw new Error('usage: zone2-look-sheet.mjs <stills dir>');
const labels = { today: 'Today', plate: "Dom's plate (look row reach-plate)" };   // <name>-<375|desktop>[-fight].png in the stills dir
const browser = await launchBrowser(chromium, { executablePath: process.env.CHROME || undefined });
try {
  for (const [name, w, h] of [['375', 375, 812], ['desktop', 640, 360]]) {
    const cells = ['', '-fight'].flatMap((suffix) => Object.entries(labels).map(([k, t]) => [`${k}-${name}${suffix}.png`, `${t}${suffix ? ' · mid-fight' : ' · ready idle'}`])).filter(([f]) => fs.existsSync(path.join(dir, f)))
      .map(([f, t]) => `<figure><img src="data:image/png;base64,${fs.readFileSync(path.join(dir, f)).toString('base64')}" width="${w}" height="${h}"><figcaption>${t}</figcaption></figure>`).join('');
    const cols = name === '375' ? 4 : 2, page = await browser.newPage({ viewport: { width: cols * (w + 12) + 12, height: 100 } });
    await page.setContent(`<body style="margin:0;background:#111;color:#eee;font:600 16px Georgia"><div style="display:grid;grid-template-columns:repeat(${cols},${w}px);gap:12px;padding:12px">${cells}</div><style>figure{margin:0}figcaption{padding:6px 2px}</style></body>`);
    await page.screenshot({ path: path.join(dir, `sheet-${name}.png`), fullPage: true });
    await page.close();
  }
} finally { await browser.close(); }
