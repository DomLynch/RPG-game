// The sparring banner at a phone: it must clear the stance panel (the column down the right edge) and not be cut off.
// Serves the built dist (run `npx vite build` first); stills: artifacts/sparring-banner/.
import { launch, phonePage, serveDist, waitForGame } from './lib/harness.mjs';
import { mkdir } from 'node:fs/promises';
import process from 'node:process';
import console from 'node:console';
/* global document */

const out = process.env.OUT ?? 'artifacts/sparring-banner';
await mkdir(out, { recursive: true });
const site = await serveDist(), browser = await launch(), fails = [];
try {
  for (const [name, width, height] of [['375', 375, 812], ['320', 320, 568]]) {
    const { page } = await phonePage(browser, { viewport: { width, height }, timeout: 60000 });
    await page.goto(`${site.url}/?opponent=dwarf&difficulty=dummy&weapon=estoc&skill=none&spar=1&special=none&yourSpecial=none&arena=ladder`, { waitUntil: 'commit' });
    await waitForGame(page, { art: true }); await page.waitForTimeout(1500);
    const g = await page.evaluate(() => {
      const b = document.getElementById('replay-banner'), p = document.getElementById('stance-panel');
      const range = document.createRange(); range.selectNodeContents(b); const t = range.getBoundingClientRect(), q = p?.getBoundingClientRect();
      return { text: b.textContent, shown: !b.hidden, textRight: Math.round(t.right), textLeft: Math.round(t.left), panelLeft: q ? Math.round(q.left) : null, panelShown: !!q && q.width > 0, bannerBottom: Math.round(b.getBoundingClientRect().bottom), panelTop: q ? Math.round(q.top) : null };
    });
    console.log(name, JSON.stringify(g));
    if (!g.shown || !/Sparring the dummy/i.test(g.text)) fails.push(`${name}: the banner is not showing the dummy line (${g.text})`);
    if (g.panelShown && g.textRight > g.panelLeft + 1 && g.bannerBottom > g.panelTop) fails.push(`${name}: the banner text (right ${g.textRight}) runs under the stance panel (left ${g.panelLeft})`);
    if (g.textLeft < 0) fails.push(`${name}: the banner is cut off on the left`);
    await page.screenshot({ path: `${out}/banner-${name}.png` });
  }
} catch (e) { fails.push(`ERROR ${String(e.message).slice(0, 300)}`); }
finally { await browser.close(); await site.close(); }
console.log(fails.length ? `sparring-banner FAIL\n${fails.join('\n')}` : 'sparring-banner PASS');
process.exitCode = fails.length ? 1 : 0;
