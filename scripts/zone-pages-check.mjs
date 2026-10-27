// Release row: LOAD EVERY ZONE PAGE (Lead 2026-10-22: a /dungeon1/ crash passed full CI because no row opened that page). The zone registry's rows (origins/zone-rows/zone<N>.row.json, scripts/lib/zone-pages.mjs)
// say which pages exist: /zone<N>/ for every listed row and /<alias>/ for a row that names one. Each is opened on the built origins preview at 375 wide, touch, as a guest, and must (1) raise no page error and
// log no console error, (2) bring up window.originsPreview, (3) carry its own place name in the tab title (`Frankendom — <row name>`). No zone id, name or alias is written in this file.
//   node scripts/zone-pages-check.mjs [--dist <built origins preview>] [--all]     (no --dist: builds this tree; --all: unlisted rows too, which needs a build made with VITE_UNLISTED_ZONES=1)
// Receipt: artifacts/zone-pages.json (every page, its title, its errors, how long it took). Exit 1 names every failing page.
/* global process, console, document, window */
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { chromium } from 'playwright';
import { launchBrowser } from './lib/harness-browser-launch.mjs';
import { serveOriginsPreview } from './lib/origins-preview-harness.mjs';
import { pagesToOpen, shortPaths, titleOf, zonePages } from './lib/zone-pages.mjs';

const argv = process.argv.slice(2), flag = (n) => argv.includes(`--${n}`), opt = (n) => { const i = argv.indexOf(`--${n}`); return i >= 0 ? argv[i + 1] : undefined; };
const root = process.cwd(), dist = path.resolve(opt('dist') ?? 'artifacts/origins-preview'), BOOT_MS = Number(process.env.ZONE_PAGES_BOOT_MS ?? 150000), SETTLE_MS = Number(process.env.ZONE_PAGES_SETTLE_MS ?? 4000);
if (!fs.existsSync(path.join(dist, 'index.html'))) execFileSync('npx', ['vite', 'build', '--config', 'origins/preview/vite.config.mjs'], { stdio: 'inherit', timeout: 600_000 });

const zones = zonePages(), pages = pagesToOpen(zones, flag('all'));
if (!pages.length) throw new Error('zone-pages-check: the registry lists no zone page to open');
const server = await serveOriginsPreview(dist, root, shortPaths(zones));
const browser = await launchBrowser(chromium, { args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const receipt = { origin: server.origin, viewport: '375x812 touch', opened: pages.length, pages: [] };
try {
  for (const p of pages) {
    const t0 = Date.now(), errors = [], ctx = await browser.newContext({ viewport: { width: 375, height: 812 }, isMobile: true, hasTouch: true }), page = await ctx.newPage();
    page.on('pageerror', (e) => errors.push(`pageerror: ${String(e).slice(0, 240)}`));
    page.on('console', (m) => { if (m.type() === 'error' && !/Failed to load resource|WebSocket connection to/.test(m.text())) errors.push(`console.error: ${m.text().slice(0, 240)}`); });   // a missing optional asset and the presence socket (this server has no game box behind it) are network lines, not a crash
    const rec = { id: p.id, path: p.path, expected: titleOf(p.name), title: null, booted: false, errors, ms: 0 };
    try {
      await page.goto(`${server.origin}${p.path}`, { waitUntil: 'domcontentloaded', timeout: 60000 });
      rec.booted = await page.waitForFunction(() => !!window.originsPreview, null, { timeout: BOOT_MS }).then(() => true, () => false);
      await page.waitForTimeout(SETTLE_MS);   // a crash just after boot (the first frames, the deferred files) still lands inside the window
      rec.title = await page.title();
    } catch (e) { errors.push(`navigation: ${String(e).slice(0, 240)}`); }
    rec.ms = Date.now() - t0; receipt.pages.push(rec); await ctx.close();
    console.log(`zone-pages ${p.path} (zone ${p.id}): ${rec.booted ? 'originsPreview up' : 'NO window.originsPreview'}, title "${rec.title}", ${errors.length} error(s), ${rec.ms} ms`);
  }
} finally { await browser.close(); await server.close(); }

const why = (r) => [!r.booted && 'window.originsPreview never appeared', r.title !== r.expected && `title is "${r.title}", expected "${r.expected}"`, ...r.errors].filter(Boolean);
const failed = receipt.pages.map((r) => ({ r, why: why(r) })).filter((f) => f.why.length);
receipt.failed = failed.map((f) => ({ path: f.r.path, id: f.r.id, why: f.why }));
fs.mkdirSync('artifacts', { recursive: true }); fs.writeFileSync('artifacts/zone-pages.json', JSON.stringify(receipt, null, 2));
if (failed.length) { for (const f of failed) console.error(`zone-pages-check FAILED ${f.r.path} (zone ${f.r.id}): ${f.why.join(' | ')}`); process.exit(1); }
console.log(`zone-pages-check: ${receipt.pages.length} page(s) opened, all clean`);
