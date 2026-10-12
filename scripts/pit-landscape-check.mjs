// Landscape / portrait layout check of the Pit page (/) and its ☰ journal (Gear, Stats, Career, Settings), the part-B sequel to scripts/landscape-check.mjs (the zone page).
// For each view and state: a still, the rects of every visible control; FAIL on two controls overlapping, a control off screen or outside the safe area, a tab strip wrapping to more than one row,
// a control under 44 px, or text clipped by its own box (scrollWidth > clientWidth on a non-scrolling element). Serves this tree's build (run `npx vite build` first). PIT_GL=1 = the browser's own GL (the VPS).
// Usage: PIT_STILLS=<state regex> OUT=<dir> node scripts/pit-landscape-check.mjs [--engine webkit]. --engine webkit is the Mac release row (Safari's engine, Dom's iPhone): WebKit has no safe-area emulation, so
// the notch view runs as a plain 844x390 there (overlap, off screen, tab wrap, clipped text, 44 px tabs still apply). The profile wears six pieces at rungs 2..10, so the Gear tab is the paper-doll (tinted slots, the stat strip), and a still/row asserts both. Stills: artifacts/pit-landscape/.
import { chromium, webkit } from 'playwright';
import { preview } from 'vite';
import fs from 'node:fs/promises';

const out = process.env.OUT || 'artifacts/pit-landscape'; await fs.mkdir(out, { recursive: true });
const server = await preview({ preview: { host: '127.0.0.1', port: 0 } });
const origin = `http://127.0.0.1:${server.httpServer.address().port}`;
const ENGINE = process.argv.includes('--engine') ? process.argv[process.argv.indexOf('--engine') + 1] : 'chromium';
if (!['chromium', 'webkit'].includes(ENGINE)) throw new Error(`--engine ${ENGINE}: chromium or webkit`);
const worn = { head: 'veteran.Helmet', chest: 'nightborn.Body', arms: 'executioner.Arms', hands: 'goblin.Gloves', legs: 'pitborn.Greaves', feet: 'dwarf.Boots' };
const taken = Object.fromEntries(Object.values(worn).map((id, i) => [id, { opponent: id.split('.')[0], attempt: 1, healthLeft: 50, recordId: null, day: '2026-10-12', tier: [2, 4, 6, 8, 9, 10][i] }]));
const profile = { version: 1, id: 'career-fighter-0001', name: 'Wanderer', career: { victoryMarks: 7 }, loot: { owned: Object.values(worn), equipped: worn, taken } };
const args = process.env.PIT_GL ? [] : ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist'];
const browser = ENGINE === 'webkit' ? await webkit.launch({ headless: true }) : await chromium.launch({ headless: true, executablePath: chromium.executablePath(), args });
// [name, w, h, safe-area insets {l, r, t, b}] as in landscape-check.mjs
const VIEWS = [['portrait', 375, 812], ['landscape', 812, 375], ['short', 844, 340], ['notch', 844, 390, { l: 47, r: 47, t: 0, b: 21 }], ['ipad', 1024, 768]];
const CTL = 'button, a[href], [role=button], select, input, #journal .tab-strip label, #journal-name, #stance-panel, .identity, .combat-hud'; // the Gear tab label is display:none (the bottom bar's #nav-gear is its control)
const measure = (page, scope) => page.evaluate(([sel, scope]) => {
  const root = scope ? document.querySelector(scope) : document, out = [];
  const els = [...root.querySelectorAll(sel)];
  const vis = (e) => { const r = e.getBoundingClientRect(); if (r.width < 4 || r.height < 4) return null; let scrolled = false; for (let p = e; p; p = p.parentElement) { const c = getComputedStyle(p); if (c.display === 'none' || c.visibility === 'hidden' || Number(c.opacity) === 0) return null; if (p.tagName === 'DETAILS' && !p.open && !e.closest('summary')) return null; if (p !== e && /(auto|scroll)/.test(c.overflowY) && p.scrollHeight > p.clientHeight + 2) scrolled = true; } return { r, scrolled }; };
  els.forEach((e) => { const v = vis(e); if (v) out.push({ e, id: e.id || (e.textContent || e.getAttribute('aria-label') || '').trim().slice(0, 16) || e.className, x: Math.round(v.r.x), y: Math.round(v.r.y), w: Math.round(v.r.width), h: Math.round(v.r.height), scrolled: v.scrolled, tab: e.matches('.tab-strip label') }); });
  const clipped = [...root.querySelectorAll('button, label, a, h1, h2, h3, p, span, small, li, strong')].filter((e) => { const v = vis(e); if (!v) return false; const c = getComputedStyle(e); return c.display !== 'inline' && !/(auto|scroll)/.test(c.overflowX) && e.scrollWidth > e.clientWidth + 2 && e.clientWidth > 0; }).map((e) => `${(e.id || e.textContent || e.className).trim().slice(0, 20)} (${e.scrollWidth}>${e.clientWidth})`);
  const tabRows = new Set(out.filter((o) => o.tab).map((o) => o.y)).size;
  return { clipped, tabRows, list: out.map((o) => ({ id: o.id, x: o.x, y: o.y, w: o.w, h: o.h, scrolled: o.scrolled, tab: o.tab, anc: out.map((q, k) => (q !== o && q.e.contains(o.e) ? k : -1)).filter((k) => k >= 0) })) };
}, [CTL, scope]);
const judge = (m, w, h, safe) => {
  const bad = [], { list } = m;
  for (let i = 0; i < list.length; i++) {
    const a = list[i];
    if (!a.scrolled && (a.x < 0 || a.y < 0 || a.x + a.w > w + 1 || a.y + a.h > h + 1)) bad.push(`${a.id} off screen`);
    if (safe && !a.scrolled && (a.x < safe.l - 1 || a.x + a.w > w - safe.r + 1 || a.y + a.h > h - safe.b + 1)) bad.push(`${a.id} outside the safe area`);
    if (a.tab && a.h < 44) bad.push(`tab ${a.id} under 44 px (${a.h})`);
    for (let j = i + 1; j < list.length; j++) { const b = list[j]; if (a.anc.includes(j) || b.anc.includes(i) || a.scrolled !== b.scrolled) continue; const ox = Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x), oy = Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y); if (ox > 2 && oy > 2) bad.push(`${a.id} x ${b.id} (${ox}x${oy})`); }
  }
  if (m.tabRows > 1) bad.push(`tab strip wraps to ${m.tabRows} rows`);
  for (const c of m.clipped) bad.push(`text clipped: ${c}`);
  return bad;
};
const receipt = { engine: ENGINE, views: [], errors: [] };
try {
  for (const [name, w, h, safe] of VIEWS) {
    const v = { view: name, w, h, states: {} }; receipt.views.push(v);
    const context = await browser.newContext({ viewport: { width: w, height: h }, isMobile: w < 900, hasTouch: w < 900 });
    await context.addInitScript((p) => { localStorage.setItem('frankendom.fighter.v1', JSON.stringify(p)); }, profile);
    const page = await context.newPage(); page.setDefaultTimeout(60000);
    if (safe && ENGINE === 'chromium') { const cdp = await context.newCDPSession(page); try { await cdp.send('Emulation.setSafeAreaInsetsOverride', { insets: { left: safe.l, right: safe.r, top: safe.t, bottom: safe.b } }); } catch (error) { v.safeAreaUnsupported = String(error).slice(0, 120); } }
    page.on('pageerror', (e) => receipt.errors.push(`${name}: ${String(e).slice(0, 200)}`)); await page.route('**/*sentry.io/**', (r) => r.abort());
    const snap = async (state, scope) => { if (!process.env.PIT_STILLS || new RegExp(process.env.PIT_STILLS).test(state)) await page.screenshot({ path: `${out}/${name}-${state}.png` });   // PIT_STILLS=<regex of states>: the T4's artifact copy keeps ~24 files, so a still run names the few it needs
    const m = await measure(page, scope); v.states[state] = { count: m.list.length, bad: judge(m, w, h, safe), list: m.list }; };
    await page.goto(`${origin}/`);
    await page.waitForFunction(() => document.querySelector('#art-status')?.textContent === '');
    await snap('welcome');
    if (await page.locator('#welcome').isVisible()) await page.getByRole('button', { name: 'Enter the arena' }).click();
    await page.waitForFunction(() => document.querySelector('#welcome').hidden); await page.waitForTimeout(1500);
    await snap('pit');
    await page.locator('#journal-button').click(); await page.waitForTimeout(1200);
    for (const tab of ['profile', 'fighter', 'career', 'settings']) {
      await page.locator(tab === 'profile' ? '#journal #nav-gear' : `#journal .tab-${tab}`).click(); await page.waitForTimeout(600); await snap(`journal-${tab}`, '#journal');
      if (tab === 'profile') {   // the paper-doll: six worn slots tinted by rung, the strip's rows drawn
        const doll = await page.evaluate(() => ({ tints: [...document.querySelectorAll('#journal .doll .slot.on:not([data-loot=""])')].map((e) => e.style.getPropertyValue('--tier')), rows: [...document.querySelectorAll('#gear-stats > div')].map((d) => d.getAttribute('data-stat')) }));
        v.paperDoll = doll;
        if (doll.tints.length !== 6 || new Set(doll.tints).size !== 6) v.states[`journal-${tab}`].bad.push(`paper-doll: ${doll.tints.length} tinted slots (${doll.tints}), want six distinct rungs`);
        if (!['health', 'stamina', 'attack', 'res'].every((id) => doll.rows.includes(id))) v.states[`journal-${tab}`].bad.push(`stat strip rows: ${doll.rows}`);
      }
    }
    await context.close();
  }
  await fs.writeFile(`${out}/receipt.json`, JSON.stringify(receipt, null, 2));
  const fails = [...receipt.errors, ...receipt.views.flatMap((v) => [...(v.safeAreaUnsupported ? [`${v.view}: the safe-area override failed (${v.safeAreaUnsupported})`] : []), ...Object.entries(v.states).flatMap(([s, r]) => r.bad.map((b) => `${v.view}/${s}: ${b}`))])];
  console.log(fails.length ? `pit-landscape-check [${ENGINE}] FAIL\n${fails.join('\n')}` : `pit-landscape-check [${ENGINE}] PASS`, JSON.stringify(receipt.views.map((v) => [v.view, Object.fromEntries(Object.entries(v.states).map(([k, r]) => [k, r.count]))])));
  process.exitCode = fails.length ? 1 : 0;
} catch (error) { console.error('pit-landscape-check ERROR', error.message); process.exitCode = 2; }
finally { await browser.close(); await server.close(); }
