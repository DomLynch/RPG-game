// The spell book at a phone (Web, programme 2b), against a STUB writer on loopback that answers grimoire_get the way Backend's #2504 does ({ spells: [{ legend, bricks }] } sorted by legend; nothing else is read or written).
// The stored session is a stub token; nothing reaches Supabase or the live writer. Walks: a guest opens the book and is told to sign in; a signed-in account with an empty book sees "Beat a legend to take their spell";
// a book of five (real catalogue legends, three with the most bricks, one the catalogue does not know) lists each by legend name, family, spell and brick chips, sorted; no control under 44 px, off screen,
// clipped text or horizontal scroll. Serves this tree's build (`npx vite build` first). Usage: OUT=<dir> node scripts/grimoire-check.mjs [--engine webkit]; PIT_GL=1 = the browser's own GL (the VPS). Stills: <OUT>/book-*.png.
import http from 'node:http';
import fs from 'node:fs/promises';
import { chromium, webkit } from 'playwright';
import { preview } from 'vite';

const REGION_FILES = ['ash-frontier', 'black-sand', 'jade-reach', 'marble-shore', 'red-hollow', 'sun-court', 'thorn-steppe'];
const CATALOGUE = Object.fromEntries((await Promise.all(REGION_FILES.map(async (r) => JSON.parse(await fs.readFile(new URL(`../src/fight/spells-${r}.json`, import.meta.url), 'utf8')).spells))).flat().filter((r) => r.id.startsWith('spell:')).map((r) => [r.id.slice(6), r.bricks]));   // legend id -> bricks, read from the rows (the server-side guard keeps the bricks table itself out of this file)

const out = process.env.OUT || 'artifacts/grimoire'; await fs.mkdir(out, { recursive: true });
const ENGINE = process.argv.includes('--engine') ? process.argv[process.argv.indexOf('--engine') + 1] : 'chromium';
const TOKEN = 'stub-access', requests = [];
const size = (b) => 1 + b.modifiers.length + (b.suffix ? 1 : 0);
const rich = Object.entries(CATALOGUE).filter(([id]) => id !== 'alvis').sort((x, y) => size(y[1]) - size(x[1]) || x[0].localeCompare(y[0])).slice(0, 3);   // the three biggest books of bricks, so chips wrap
const BOOK = Object.fromEntries([['alvis', CATALOGUE.alvis], ...rich, ['zed-the-new', { root: 'crack', modifiers: [], suffix: null }]]);
const state = { book: {} };
const writer = http.createServer((req, res) => {
  const cors = { 'access-control-allow-origin': '*', 'access-control-allow-headers': 'authorization, content-type', 'access-control-allow-methods': '*' };
  if (req.method === 'OPTIONS') { res.writeHead(204, cors); return res.end(); }
  let raw = ''; req.on('data', (c) => (raw += c)); req.on('end', () => {
    const op = req.url.split('?')[0].split('/').pop();
    requests.push(op);
    const send = (result) => { res.writeHead(200, { ...cors, 'content-type': 'application/json' }); res.end(JSON.stringify({ ok: true, result })); };
    if (req.headers.authorization !== `Bearer ${TOKEN}`) { res.writeHead(401, cors); return res.end(); }
    if (op === 'open') return send({ marks: 0, career: { seed_credit: 5000, world_credit: 700, total_credit: 5000000, rested: 0, rested_at: 0, heat: {}, beaten: [], story: [], version: 4 }, characters: [{ id: 'pc:stub-1', name: 'Stubbs' }], items: [], quests: [], journal: [], talk: [] });
    if (op === 'build_get') return send({ level: 0, placed: {}, respreadRank: 0, version: 0 });
    if (op === 'grimoire_get') return send({ spells: Object.keys(state.book).sort().map((legend) => ({ legend, bricks: state.book[legend] })) });
    res.writeHead(404, cors); res.end();
  });
});
await new Promise((r) => writer.listen(0, '127.0.0.1', r));
const writerUrl = `http://127.0.0.1:${writer.address().port}/origins`;
const server = await preview({ preview: { host: '127.0.0.1', port: 0 } });
const origin = `http://127.0.0.1:${server.httpServer.address().port}`;
const args = process.env.PIT_GL ? [] : ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist'];
const browser = ENGINE === 'webkit' ? await webkit.launch({ headless: true }) : await chromium.launch({ headless: true, executablePath: chromium.executablePath(), args });
const fails = [], check = (ok, what) => { if (!ok) fails.push(what); };
async function open(w, h, { signedIn = true } = {}) {
  const context = await browser.newContext({ viewport: { width: w, height: h }, isMobile: true, hasTouch: true });
  if (signedIn) await context.addInitScript((t) => { try { localStorage.setItem('frankendom.auth.v1', JSON.stringify({ access_token: t, refresh_token: 'stub-refresh', expires_at: Math.floor(Date.now() / 1000) + 3600, token_type: 'bearer', user: { id: '00000000-0000-4000-8000-000000000001' } })); } catch { /* none */ } }, TOKEN);
  const page = await context.newPage(); page.setDefaultTimeout(60000);
  page.on('pageerror', (e) => fails.push(`${w}: ${String(e).slice(0, 160)}`)); await page.route('**/*sentry.io/**', (r) => r.abort());
  await context.route('**/origins/*', async (route) => { const op = new URL(route.request().url()).pathname.split('/').pop(); await route.fulfill({ response: await route.fetch({ url: `${writerUrl}/${op}` }) }); });   // the Pit page's CSP only lets it call its own origin
  await page.goto(`${origin}/`);
  await page.waitForFunction(() => document.querySelector('#art-status')?.textContent === '');
  if (await page.locator('#welcome').isVisible()) await page.getByRole('button', { name: 'Enter the arena' }).click({ force: true });
  await page.waitForFunction(() => document.querySelector('#welcome').hidden); await page.waitForTimeout(1500);
  await page.locator('#journal-button').click({ force: true }); await page.waitForTimeout(600); await page.locator('#journal .tab-fighter').click({ force: true }); await page.waitForTimeout(300);
  await page.locator('#grimoire-open').click({ force: true });
  await page.waitForFunction(() => document.getElementById('grimoire-dialog').open);
  return { context, page };
}
const settle = (page, re) => page.waitForFunction((src) => new RegExp(src).test(document.getElementById('grimoire-dialog').textContent), re.source, { timeout: 20000 }).catch(() => {});
const layout = (page, name) => page.evaluate((n) => {
  const d = document.getElementById('grimoire-dialog'), vw = innerWidth, bad = [];
  for (const e of d.querySelectorAll('button')) { const r = e.getBoundingClientRect(); if (r.width && (r.height < 44 || r.width < 44 || r.right > vw + 1 || r.left < -1)) bad.push(`${e.className} ${Math.round(r.width)}x${Math.round(r.height)}`); }
  const clipped = [...d.querySelectorAll('b, span, p, h3, i')].filter((e) => e.scrollWidth > e.clientWidth + 2 && e.clientWidth > 0).map((e) => e.textContent.slice(0, 20));
  return { bad: bad.map((b) => `${n}: ${b}`), clipped, hscroll: d.scrollWidth > d.clientWidth + 1 || document.documentElement.scrollWidth > vw + 1 };
}, name);
const text = (page) => page.locator('#grimoire-dialog').textContent();

try {
  for (const [name, w, h] of [['phone', 375, 812], ['small', 320, 568]]) {
    { requests.length = 0; const { context, page } = await open(w, h, { signedIn: false }); await settle(page, /Sign in/);
      check(/Sign in to see your spell book/.test(await text(page)), `${name}: a guest is told to sign in (${(await text(page)).slice(0, 80)})`);
      check(!requests.includes('grimoire_get'), `${name}: a guest sends no grimoire_get`); await page.screenshot({ path: `${out}/book-${name}-guest.png` }); await context.close(); }
    state.book = {};
    { const { context, page } = await open(w, h); await settle(page, /Beat a legend/);
      check(/Beat a legend to take their spell/.test(await text(page)) && /0 spells/.test(await text(page)), `${name}: an empty book says what to do (${(await text(page)).slice(0, 80)})`);
      await page.screenshot({ path: `${out}/book-${name}-empty.png` }); await context.close(); }
    state.book = BOOK;
    { const { context, page } = await open(w, h); await settle(page, /5 spells/);
      const t = await text(page), names = await page.locator('#grimoire-dialog .grimoire-name').allTextContents();
      check(/5 spells/.test(t), `${name}: five spells counted (${t.slice(0, 60)})`);
      check(names.length === 5 && names.join('|') === [...names].sort((a, b) => a.localeCompare(b)).join('|'), `${name}: five entries sorted by name (${names})`);
      check(names.includes('Alvis') && /Dwarf family/.test(t) && /Long Shadow/.test(t), `${name}: Alvis shows his family and brick`);
      check(names.includes('Zed The New'), `${name}: a legend the catalogue does not know still lists`);
      const chips = await page.locator('#grimoire-dialog .grimoire-brick').count(); check(chips >= 5, `${name}: brick chips drawn (${chips})`);
      await page.screenshot({ path: `${out}/book-${name}-spells.png` });
      const m = await layout(page, name); for (const b of m.bad) check(false, `control too small or off screen: ${b}`); check(!m.clipped.length, `${name}: text clipped: ${m.clipped}`); check(!m.hscroll, `${name}: horizontal scroll`);
      await page.locator('#grimoire-dialog .grimoire-close').click({ force: true }); check(!(await page.locator('#grimoire-dialog').evaluate((d) => d.open)), `${name}: the close button closes it`);
      await context.close(); }
  }
} catch (e) { fails.push(`ERROR ${String(e.message).slice(0, 300)}`); }
finally { await browser.close(); await server.close(); writer.close(); }
console.log(fails.length ? `grimoire-check [${ENGINE}] FAIL\n${fails.join('\n')}` : `grimoire-check [${ENGINE}] PASS`);
process.exitCode = fails.length ? 1 : 0;
