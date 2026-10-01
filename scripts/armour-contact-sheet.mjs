// Armour contact sheets (Armour lane, 2026-09-26): every takeable non-weapon piece worn by the HERO, one still per piece from the fight's
// opening camera and one from the journal's Profile tab paperdoll, at 375 CSS px wide (Dom judges from 375 stills), composed into one
// sheet per slot. The seeding is worn-loot-check.mjs's: a guest ledger straight into localStorage (keyed by PAPERDOLL key, not slot
// name — cleanLoot drops a slot-named key), the page reloaded with ?debug=1, the rig's worn draws read back from #debug's data-worn.
//   node scripts/armour-contact-sheet.mjs [--label audit] [--slots Helmet,Boots] [--opponents dwarf,goblin] [--only fight|doll] [--sets] [--rungs [--levels 1,5,10]]
// Writes artifacts/armour/<label>/{fight,doll}/<id>.png, sheet-<Slot>.png and receipt.json. Serves this tree's dist (npm run build first),
// or QA_URL. Never part of a gate: a person reads the sheets.
import { chromium } from 'playwright';
import fs from 'node:fs/promises';
import path from 'node:path';
import { preview } from 'vite';
import { LOOT, LOOT_SLOTS, PAPERDOLL, isWeaponLoot, paperdollOf, slotOf } from '../src/loot.ts';
import { TIERS } from '../src/grades.ts';

const arg = (name, fallback) => { const i = process.argv.indexOf(`--${name}`); return i > 0 ? process.argv[i + 1] : fallback; };
const label = arg('label', 'audit'), only = arg('only', 'both');
const slots = arg('slots', '').split(',').filter(Boolean), opponents = arg('opponents', '').split(',').filter(Boolean);
const dir = `artifacts/armour/${label}`; for (const sub of ['fight', 'doll']) await fs.mkdir(path.join(dir, sub), { recursive: true });
// --roster (Dom via Strategy, 2026-09-27): ten sheets, one per rank (TIERS 1..10), every ladder opponent in his OWN kit at that rank's
// dressing (what ?tier= does in the game: view.setTier), FRONT and BACK, desktop resolution, captioned name + rank. Rendered through
// the game's own createScene on a harness page (scripts/versus-cards.mjs's pattern) because the free camera orbits the HERO: yaw ~0 looks
// past his shoulder at the opponent's front, yaw ~π stands behind the opponent. Same arena, same light for both views.
//   node scripts/armour-contact-sheet.mjs --roster [--tiers Recruit,Origin] [--opponents dwarf,goblin] [--yaw .35] [--pitch .25] [--gap 3] [--herox 0] [--fill .9] [--arena 1] [--look souls]
// Writes artifacts/armour/roster-tiers/<Tier>.png (one sheet per rank, printed as it lands) and receipt.json. A cell that fails to dress
// or render is captioned with its error and the sheet goes on.
if (process.argv.includes('--roster')) {
  const { createServer } = await import('vite');
  const wantedTiers = arg('tiers', '').split(',').filter(Boolean), tiers = wantedTiers.length ? wantedTiers : [...TIERS];
  const yaw = Number(arg('yaw', 0.35)), pitch = Number(arg('pitch', 0.22)), gap = Number(arg('gap', 3)), heroX = Number(arg('herox', 0)), fill = Number(arg('fill', 0.9)), arena = arg('arena', '1'), look = arg('look', ''), cellW = 420, cellH = 720;   // --look souls|shade|souls,shade (World's #902 ?look=, read inside createScene from location.search)   // arena '1' = Arena 1 (sand, ash): one look for every cell
  const out = 'artifacts/armour/roster-tiers'; await fs.mkdir(out, { recursive: true });
  const PAGE = `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>Roster tier cell</title>
<style>html,body{margin:0;height:100%;background:#000;overflow:hidden}#world{display:block}</style></head>
<body><canvas id="world"></canvas><script type="module">
import * as THREE from 'three';
import { createScene } from '/src/scene.ts';
import { initialPractice, project } from '/src/combat.ts';
import { OPPONENTS } from '/src/moves.ts';
import { LADDER } from '/src/ladder.ts';
import { TARGET } from '/src/sim.ts';
const q = new URLSearchParams(location.search), id = q.get('opponent'), tier = q.get('tier'), arena = q.get('arena') || undefined, TICK = 1 / 60;
const canvas = document.getElementById('world'), view = createScene(canvas, () => {}, id, arena);   // one arena for every cell: only the kit differs
// Both armed. The free camera orbits the HERO, 7.5 m behind him along his heading, so the hero is placed \`gap\` m BEYOND the opponent on the
// camera's line (side −1: past him toward −z for the front view; +1: past him toward +z for the back view) and \`heroX\` m aside: the opponent
// stands nearer the camera, centred, and the hero shows small behind him.
function pose(gap, heroX, side) {
  const p = initialPractice(731, OPPONENTS[id]), f = p.duel.fighters;
  return project({ ...p.duel, fighters: [{ ...f[0], phase: 'ready', body: { x: heroX, z: TARGET.z + side * gap, heading: Math.PI, distance: 0 } }, f[1]] }, p.ai);
}
window.__roster = {
  ladder: LADDER.map(r => ({ id: r.id, name: r.name })),
  ready: view.ready.then(() => { view.setTier(tier); return true; }).catch(e => String(e)),
  still(yaw, pitch, gap, heroX, fill, w, h, side) {
    const s = pose(gap, heroX, side);
    let cam = null, world = null; const render = view.renderer.render.bind(view.renderer); view.renderer.render = (scene, camera) => { cam = camera; world = scene; render(scene, camera); };
    view.recenter(); for (let i = 0; i < 60; i++) view.render(s.fighter, false, TICK, s, [], false);
    view.orbit(-yaw / 0.005, (pitch - 0.45) / 0.003);
    for (let i = 0; i < 120; i++) view.render(s.fighter, false, TICK, s, [], false);
    // The opponent's on-screen box, measured: every vertex of his skinned draws (bone transforms applied: fused scan bodies, helms, hoods,
    // crests alike) projected through the settled camera at the game's fov. His draws are the skinned meshes whose skeleton root stands
    // within 1.2 m of the target; the hero's stands 3 m off. A rig that yields nothing falls back to a man's 0–1.8 m at the target.
    const W = canvas.width, H = canvas.height, proj = (p) => { const q = p.clone().project(cam); return [(q.x + 1) / 2 * W, (1 - q.y) / 2 * H]; };
    const at = (y) => proj(new THREE.Vector3(TARGET.x, y, TARGET.z));
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity; const v = new THREE.Vector3(), root = new THREE.Vector3();
    world.traverse((o) => { if (!o.isSkinnedMesh || !o.visible || !o.skeleton?.bones?.length) return; o.skeleton.bones[0].getWorldPosition(root); if (Math.hypot(root.x - TARGET.x, root.z - TARGET.z) > 1.2) return;
      const p = o.geometry.getAttribute('position'), step = Math.max(1, Math.floor(p.count / 2000));
      for (let i = 0; i < p.count; i += step) { o.applyBoneTransform(i, v.fromBufferAttribute(p, i)); v.applyMatrix4(o.matrixWorld); const [x, y] = proj(v); if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; } });
    const measured = Number.isFinite(y0), man = [at(0), at(1.8)];
    if (!measured) { [x0, x1] = [man[0][0] - 60, man[0][0] + 60]; y0 = Math.min(man[0][1], man[1][1]); y1 = Math.max(man[0][1], man[1][1]); }
    // Never smaller than a man (Strategy 2026-09-27): the fit is the larger of the measured span and 1.8 m at the target.
    y0 = Math.min(y0, man[1][1]); y1 = Math.max(y1, man[0][1]);
    // Narrowing the fov by 'zoom' scales the frame about its centre: p' = C + (p − C) / zoom. Pick zoom so the box fills 'fill' of the cell,
    // centre the window on the zoomed box, keep the window inside the frame (no black), and check the box sits inside it with ≥ 3 % margin
    // top and bottom; if not, widen the fov by 15 % and take it again, once.
    const C = [W / 2, H / 2], zoomed = (p, z) => [C[0] + (p[0] - C[0]) / z, C[1] + (p[1] - C[1]) / z];
    let zoom = Math.min(2, Math.max(0.12, (y1 - y0) / (fill * h))), ok = false, win = null, tries = 0, boxZ = null;
    while (tries++ < 2) {
      const a = zoomed([x0, y0], zoom), b = zoomed([x1, y1], zoom); boxZ = { x0: a[0], y0: a[1], x1: b[0], y1: b[1] };
      const cx = (a[0] + b[0]) / 2, cy = (a[1] + b[1]) / 2;
      win = [Math.min(W - w, Math.max(0, Math.round(cx - w / 2))), Math.min(H - h, Math.max(0, Math.round(cy - h / 2)))];
      const m = 0.03 * h; ok = a[1] >= win[1] + m && b[1] <= win[1] + h - m && a[0] >= win[0] && b[0] <= win[0] + w;
      if (ok) break; zoom = Math.min(2, zoom * 1.15);
    }
    const fov = cam.fov; cam.fov = fov * zoom; cam.updateProjectionMatrix(); view.render(s.fighter, false, TICK, s, [], false); cam.fov = fov; cam.updateProjectionMatrix();
    const out = document.createElement('canvas'); out.width = w; out.height = h; out.getContext('2d').drawImage(canvas, win[0], win[1], w, h, 0, 0, w, h);
    return { data: out.toDataURL('image/png'), zoom: +zoom.toFixed(3), measured, ok, box: [Math.round(boxZ.x0 - win[0]), Math.round(boxZ.y0 - win[1]), Math.round(boxZ.x1 - win[0]), Math.round(boxZ.y1 - win[1])] };
  },
};
</script></body></html>`;
  const server = await createServer({ server: { host: '127.0.0.1', port: 0 }, logLevel: 'silent', plugins: [{ name: 'roster-cell', configureServer(s) { s.middlewares.use(async (req, res, next) => { if (req.url.split('?')[0] !== '/roster-cell.html') return next(); res.setHeader('Content-Type', 'text/html'); res.end(await s.transformIndexHtml(req.url, PAGE)); }); } }] });
  await server.listen();
  const base = `${server.resolvedUrls.local[0]}roster-cell.html`;
  const browser = await chromium.launch({ headless: true, executablePath: chromium.executablePath() });
  const receipt = { tiers: {}, settings: { yaw, pitch, gap, heroX, fill, arena, look } };
  try {
    const page = await browser.newPage({ viewport: { width: 1400, height: 2000 }, deviceScaleFactor: 1 });   // tall: the opponent sits below the hero pivot and drops further as the fov narrows
    page.setDefaultTimeout(120000); await page.route('**/*sentry.io/**', (r) => r.abort());
    const extra = look ? `&look=${look}&bloom=1` : '';
    await page.goto(`${base}?opponent=veteran&tier=Recruit&arena=${arena}${extra}`); const ladder = (await page.evaluate(() => window.__roster.ladder)).filter((r) => !opponents.length || opponents.includes(r.id));
    const sheet = await browser.newPage({ viewport: { width: 5 * (2 * cellW + 4 + 12) + 12 * 6, height: 900 }, deviceScaleFactor: 1 });   // five opponents a row at the cells' own pixels
    for (const tier of tiers) {
      const rank = TIERS.indexOf(tier) + 1, cells = [];
      for (const { id, name } of ladder) {
        const cell = { id, name, front: null, back: null, error: null };
        try {
          await page.goto(`${base}?opponent=${id}&tier=${tier}&arena=${arena}${extra}`);
          const ok = await page.evaluate(() => window.__roster.ready); if (ok !== true) throw new Error(ok);
          await page.waitForTimeout(400);   // setTier's re-dress and rebake land over a few frames
          const front = await page.evaluate(([y, p, g, x, z, w, h]) => window.__roster.still(y, p, g, x, z, w, h, -1), [yaw, pitch, gap, heroX, fill, cellW, cellH]);
          const back = await page.evaluate(([y, p, g, x, z, w, h]) => window.__roster.still(y, p, g, x, z, w, h, 1), [Math.PI + yaw, pitch, gap, heroX, fill, cellW, cellH]);
          cell.front = front.data; cell.back = back.data; cell.framing = { front: { zoom: front.zoom, measured: front.measured, ok: front.ok, box: front.box }, back: { zoom: back.zoom, measured: back.measured, ok: back.ok, box: back.box } };
        } catch (e) { cell.error = String(e).split('\n')[0]; }
        cells.push(cell); console.log(`  ${tier} ${id}${cell.error ? `: ${cell.error}` : ` zoom ${cell.framing.front.zoom}/${cell.framing.back.zoom}${cell.framing.front.ok && cell.framing.back.ok ? '' : ' TIGHT'}${cell.framing.front.measured ? '' : ' (unmeasured)'}`}`);
      }
      const html = `<!doctype html><meta charset="utf-8"><style>body{margin:0;background:#1a1a1a;color:#eee;font:14px/1.3 system-ui;padding:14px}h1{font-size:18px;margin:0 0 10px}main{display:grid;grid-template-columns:repeat(5,1fr);gap:12px}figure{margin:0;background:#111;padding:6px}figcaption{margin:0 0 4px;font-weight:600}small{color:#aaa;font-weight:400}.pair{display:flex;gap:4px}.pair img{display:block}.err{color:#f66}</style>
<h1>${tier} — rank ${rank} of ${TIERS.length}: every opponent in his own kit at this rank's dressing, front (fight camera side) and back</h1><main>${cells.map((c) => `<figure><figcaption>${c.name} <small>· ${tier}</small></figcaption>${c.error ? `<div class="err">failed: ${c.error}</div>` : `<div class="pair"><img src="${c.front}"><img src="${c.back}"></div>`}</figure>`).join('')}</main>`;
      await sheet.setContent(html); await sheet.evaluate(() => Promise.all([...document.images].map((i) => i.decode().catch(() => {}))));
      const file = path.join(out, `${tier}.png`); await sheet.screenshot({ path: file, fullPage: true });
      receipt.tiers[tier] = cells.map(({ id, error, framing }) => ({ id, error, framing }));
      console.log(`${file}`);
    }
  } finally {
    await fs.writeFile(path.join(out, 'receipt.json'), JSON.stringify(receipt, null, 2));
    await browser.close(); await server.close();
  }
  process.exit(0);
}

// --sets: one cell per opponent wearing his WHOLE armour set (every paperdoll key his kit fills; a crest yields to the helmet), for
// slot-to-slot clipping. Each cell is still a `piece` row: id `<opponent>.Set`, slot 'Set', and `equipped` the full map.
const sets = process.argv.includes('--sets');
const pieces = sets
  ? Object.entries(LOOT).map(([opponent, ids]) => { const equipped = {}; for (const id of ids.filter((id) => !isWeaponLoot(id))) { const key = paperdollOf(slotOf(id)); if (!equipped[key] || slotOf(id) === 'Helmet') equipped[key] = id; } return { opponent, id: `${opponent}.Set`, slot: 'Set', equipped }; })
    .filter((p) => !opponents.length || opponents.includes(p.opponent))
  : Object.entries(LOOT).flatMap(([opponent, ids]) => ids.filter((id) => !isWeaponLoot(id)).map((id) => ({ opponent, id, slot: slotOf(id), key: paperdollOf(slotOf(id)), equipped: { [paperdollOf(slotOf(id))]: id } })))
    .filter((p) => (!slots.length || slots.includes(p.slot)) && (!opponents.length || opponents.includes(p.opponent)));
// --rungs: the standing acceptance sheet (Dom, 2026-09-26: "visibly cooler per level"). Every piece at every rung 1..10 (Provenance.tier,
// the rung it was TAKEN at, which its finish shows on the hero: rank-tint.ts), fight camera + Profile; one sheet per slot with a row per rung,
// split into parts ≤ 2,800 px so a phone can open them, and an index page with the adjacent-rung pairs to mark pass/fail by hand.
const rungs = process.argv.includes('--rungs'), levels = rungs ? arg('levels', '1,2,3,4,5,6,7,8,9,10').split(',').map(Number) : [0];
const cells = pieces.flatMap((p) => levels.map((level) => ({ ...p, level, id: level ? `${p.id}@${level}` : p.id, base: p.id })));
const DAY = '2026-09-26';
const ledgerFor = (cell) => { const owned = Object.values(cell.equipped); const loot = { owned, equipped: cell.equipped }; if (cell.level) loot.taken = Object.fromEntries(owned.map((id) => [id, { opponent: cell.opponent, attempt: 1, healthLeft: 1, recordId: null, day: DAY, tier: cell.level }])); return loot; };
const server = process.env.QA_URL ? null : await preview({ preview: { host: '127.0.0.1', port: 0 } });
const origin = process.env.QA_URL || `http://127.0.0.1:${server.httpServer.address().port}`;
const browser = await chromium.launch({ headless: true, executablePath: chromium.executablePath() });
const page = await (await browser.newContext({ viewport: { width: 375, height: 812 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 })).newPage();
page.setDefaultTimeout(90000);
await page.route('**/*sentry.io/**', (route) => route.abort());
const errors = []; page.on('pageerror', (e) => errors.push(String(e)));
const ready = async () => {
  await page.waitForFunction(() => document.querySelector('#art-status')?.textContent === '' && document.querySelector('#attack-button')?.getAttribute('aria-disabled') === 'false');
  await page.evaluate(() => new Promise((done) => requestAnimationFrame(() => requestAnimationFrame(done))));
};
// The hero at the opening camera, 375×812: head to toe with the sand around him (worn-loot-check's 390-wide frame, rescaled and widened).
const FIGURE = { x: 95, y: 470, width: 185, height: 230 };
const receipt = { origin, revision: null, pieces: {}, errors };
try {
  receipt.revision = await page.request.get(new URL('/release.json', origin).href).then((r) => r.json()).catch(() => null);
  await page.goto(new URL('/?opponent=goblin&debug=1', origin).href); await ready();
  // The bare hero, twice: the readability numbers (below) are differences against bare-1, and bare-1 vs bare-2 is the noise floor the idle
  // breath and the sand's shimmer put under every difference.
  for (const n of [1, 2]) {
    await page.evaluate(() => { const key = 'frankendom.fighter.v1'; const p = JSON.parse(localStorage.getItem(key)); p.loot = { owned: [], equipped: {} }; localStorage.setItem(key, JSON.stringify(p)); });
    await page.reload(); await ready();
    const enter = page.getByRole('button', { name: 'Enter the arena' }); if (await enter.isVisible().catch(() => false)) await enter.tap();
    await page.waitForTimeout(300);
    if (only !== 'doll') await page.screenshot({ path: path.join(dir, `fight/bare-${n}.png`), clip: FIGURE });
  }
  for (const piece of cells) {
    const { equipped } = piece, want = Object.keys(equipped).length;
    await page.evaluate((loot) => { const key = 'frankendom.fighter.v1'; const p = JSON.parse(localStorage.getItem(key)); p.loot = loot; localStorage.setItem(key, JSON.stringify(p)); }, ledgerFor(piece));
    await page.reload(); await ready();
    const enter = page.getByRole('button', { name: 'Enter the arena' }); if (await enter.isVisible().catch(() => false)) await enter.tap();
    await page.waitForFunction((want) => (JSON.parse(document.querySelector('#debug').dataset.worn || '{}').worn ?? []).length >= want, want, { timeout: 30000 }).catch(() => {});
    await page.waitForTimeout(300);
    const { worn: draws = [] } = await page.evaluate(() => JSON.parse(document.querySelector('#debug').dataset.worn || '{}'));
    const entry = { draws, fight: null, doll: null };
    if (only !== 'doll') { entry.fight = `fight/${piece.id}.png`; await page.screenshot({ path: path.join(dir, entry.fight), clip: FIGURE }); }
    if (only !== 'fight') {
      await page.locator('#journal-button').tap();
      await page.locator('#journal-tab-profile').check({ force: true }).catch(() => {});
      const doll = page.locator('.doll');   // Fitting rail (2026-10-01): this stage is now the live mannequin (the real rig through pitStage) beside the rail; no Wear tap is used here
      await doll.waitFor({ state: 'visible' });
      await page.waitForFunction((keys) => keys.every((key) => getComputedStyle(document.querySelector(`.doll-layer[data-layer='${key}']`)).backgroundImage !== 'none'), Object.keys(equipped), { timeout: 5000 }).catch(() => { entry.dollLayer = 'none'; });
      await page.evaluate(() => Promise.all([...document.images].map((i) => i.decode().catch(() => {}))));
      await page.waitForTimeout(200);
      entry.doll = `doll/${piece.id}.png`; await doll.screenshot({ path: path.join(dir, entry.doll) });
      await page.locator('#close-journal').tap().catch(() => {});
    }
    receipt.pieces[piece.id] = entry;
    console.log(`${piece.id}: ${draws.length} draw(s)${entry.dollLayer ? ', no doll layer' : ''}`);
  }
  // Fight-camera readability (Strategy's standard 1, bar accepted provisionally 2026-09-26): per piece, against the bare hero inside the
  // figure clip, L = rec.601 luma 0..1, T = .06: changed = |L − L_bare1| > T and not a noise pixel (|L_bare1 − L_bare2| > T);
  //   changedShare  = changed / figure pixels (%), figure = bare-1 pixels farther than .09 in RGB from the clip's median sand colour;
  //   valueDelta    = mean L of the changed pixels − mean L of the bare figure (signed, darker < 0);
  //   silhouette    = changed pixels OUTSIDE the figure mask / figure pixels (%): the part of the change that is a new outline.
  // Bar (provisional): changedShare ≥ 15 AND (|valueDelta| ≥ .08 OR silhouette ≥ 3). Computed on a canvas in the sheet page: no image library.
  const sheet = await browser.newPage({ viewport: { width: 1600, height: 900 }, deviceScaleFactor: 1 });
  const uri = async (file) => `data:image/png;base64,${(await fs.readFile(path.join(dir, file))).toString('base64')}`;   // about:blank cannot load file: URLs
  if (only !== 'doll') {
    const b1 = await uri('fight/bare-1.png'), b2 = await uri('fight/bare-2.png');
    for (const cell of cells) {
      const e = receipt.pieces[cell.id]; if (!e?.fight) continue;
      e.readability = await sheet.evaluate(async ([b1, b2, c]) => {
        const load = async (src) => { const img = new Image(); img.src = src; await img.decode(); const k = document.createElement('canvas'); k.width = img.width; k.height = img.height; const g = k.getContext('2d'); g.drawImage(img, 0, 0); return g.getImageData(0, 0, k.width, k.height).data; };
        const [A, B, C] = await Promise.all([b1, b2, c].map(load)), n = A.length / 4, T = .06;
        const L = (d, i) => (.299 * d[i * 4] + .587 * d[i * 4 + 1] + .114 * d[i * 4 + 2]) / 255;
        const r = [], g = [], b = []; for (let i = 0; i < n; i++) { r.push(A[i * 4]); g.push(A[i * 4 + 1]); b.push(A[i * 4 + 2]); }
        const med = (v) => v.slice().sort((x, y) => x - y)[v.length >> 1], sand = [med(r), med(g), med(b)];
        let figure = 0, changed = 0, outside = 0, sumFig = 0, sumChanged = 0;
        for (let i = 0; i < n; i++) {
          const dist = Math.hypot(A[i * 4] - sand[0], A[i * 4 + 1] - sand[1], A[i * 4 + 2] - sand[2]) / 255, inFig = dist > .09;
          const la = L(A, i), lb = L(B, i), lc = L(C, i), noise = Math.abs(la - lb) > T;
          if (inFig) { figure++; sumFig += la; }
          if (!noise && Math.abs(lc - la) > T) { changed++; sumChanged += lc; if (!inFig) outside++; }
        }
        const changedShare = 100 * changed / figure, valueDelta = changed ? sumChanged / changed - sumFig / figure : 0, silhouette = 100 * outside / figure;
        return { changedShare: +changedShare.toFixed(1), valueDelta: +valueDelta.toFixed(3), silhouette: +silhouette.toFixed(1), figurePx: figure, pass: changedShare >= 15 && (Math.abs(valueDelta) >= .08 || silhouette >= 3) };
      }, [b1, b2, await uri(e.fight)]);
    }
  }
  const fmt = (e) => e.readability ? ` · Δ${e.readability.changedShare}% v${e.readability.valueDelta > 0 ? '+' : ''}${e.readability.valueDelta} s${e.readability.silhouette}% ${e.readability.pass ? 'PASS' : 'fail'}` : '';
  // One sheet per slot: fight still over doll still, captioned, composed in the browser (no image library in the tree).
  const sheetSlots = [...LOOT_SLOTS, 'Set'].filter((s) => pieces.some((p) => p.slot === s));
  if (rungs) {
    // Row per rung, column per opponent, fight over doll at 150 px; five rows a part keeps a part under 2,800 px.
    const ROWS = 5, index = [];
    for (const slot of sheetSlots) {
      const cols = pieces.filter((p) => p.slot === slot);
      for (let part = 0; part * ROWS < levels.length; part++) {
        const rows = await Promise.all(levels.slice(part * ROWS, part * ROWS + ROWS).map(async (level) => `<tr><th>${level}<br><small>${TIERS[level - 1]}</small></th>${(await Promise.all(cols.map(async (p) => { const e = receipt.pieces[`${p.id}@${level}`]; return `<td>${e?.fight ? `<img src="${await uri(e.fight)}">` : ''}${e?.doll ? `<img src="${await uri(e.doll)}" class="doll">` : ''}<small>${e ? fmt(e).slice(3) : ''}</small></td>`; }))).join('')}</tr>`));
        const html = `<!doctype html><meta charset="utf-8"><style>body{margin:0;background:#1a1a1a;color:#eee;font:12px/1.3 system-ui;padding:10px}h1{font-size:15px;margin:0 0 8px}table{border-collapse:collapse}th{text-align:left;padding:2px 6px;vertical-align:top;font-size:13px}th small{color:#aaa;font-weight:400}td{padding:2px;vertical-align:top}td small{display:block;color:#bbb;font-size:10px;width:150px}thead th{font-size:11px;color:#ccc}img{display:block;width:150px;background:#333}img.doll{width:150px;margin-top:2px}</style><h1>${slot} — rungs ${levels[part * ROWS]}–${levels[Math.min(levels.length, part * ROWS + ROWS) - 1]} (row) × opponent (column), hero at the fight camera over the Profile tab, 375 wide, ${label}, ${receipt.revision?.revision ?? 'local'}. Dom: "visibly cooler per level".</h1><table><thead><tr><th></th>${cols.map((p) => `<th>${p.opponent}</th>`).join('')}</tr></thead><tbody>${rows.join('')}</tbody></table>`;
        await sheet.setContent(html); await sheet.evaluate(() => Promise.all([...document.images].map((i) => i.decode().catch(() => {}))));
        const file = `sheet-${slot}-${part + 1}.png`; await sheet.screenshot({ path: path.join(dir, file), fullPage: true }); index.push({ slot, part: part + 1, file });
      }
    }
    // The index: sheets per slot, and the adjacent-rung pairs to mark by hand (pass = rung N+1 looks like something a player wants MORE than rung N, at the fight camera AND on the Profile).
    const pairs = levels.slice(1).map((l, i) => `${levels[i]}→${l}`);
    const md = [`# Rung acceptance sheet — ${label}, ${receipt.revision?.revision ?? 'local'}`, '', 'Dom (2026-09-26): "It should be visibly cooler per level, to keep players interested." Per slot, each adjacent pair passes only if rung N+1 reads as MORE desirable than rung N at the fight camera AND on the Profile.', '', '| slot | sheets | ' + pairs.join(' | ') + ' |', '|---|---|' + pairs.map(() => '---').join('|') + '|', ...sheetSlots.map((slot) => `| ${slot} | ${index.filter((i) => i.slot === slot).map((i) => i.file).join(', ')} | ${pairs.map(() => ' ').join(' | ')} |`), ''].join('\n');
    await fs.writeFile(path.join(dir, 'index.md'), md);
  } else
  for (const slot of sheetSlots) {
    const figures = (await Promise.all(pieces.filter((p) => p.slot === slot).map(async (p) => { const e = receipt.pieces[p.id]; return `<figure><figcaption>${p.id}<small>${e.draws.length} draw(s)${e.dollLayer ? ' · no doll layer' : ''}${fmt(e)}</small></figcaption>${e.fight ? `<img src="${await uri(e.fight)}">` : ''}${e.doll ? `<img src="${await uri(e.doll)}" class="doll">` : ''}</figure>`; }))).join('');
    const html = `<!doctype html><meta charset="utf-8"><style>body{margin:0;background:#1a1a1a;color:#eee;font:13px/1.3 system-ui;padding:12px}h1{font-size:16px;margin:0 0 10px}main{display:flex;flex-wrap:wrap;gap:12px}figure{margin:0;width:200px;display:flex;flex-direction:column;gap:4px}figcaption{font-weight:600}small{display:block;font-weight:400;color:#aaa}img{width:200px;image-rendering:auto;background:#333}img.doll{width:200px}</style><h1>${slot} — hero at the fight camera (top) and Profile tab (bottom), 375 wide, ${label}, ${receipt.revision?.revision ?? 'local'}</h1><main>${figures}</main>`;
    await sheet.setContent(html); await sheet.evaluate(() => Promise.all([...document.images].map((i) => i.decode().catch(() => {}))));
    await sheet.screenshot({ path: path.join(dir, `sheet-${slot}.png`), fullPage: true });
  }
} finally {
  await fs.writeFile(path.join(dir, 'receipt.json'), JSON.stringify(receipt, null, 2));
  await browser.close(); await server?.close();
}
console.log(JSON.stringify({ pieces: Object.keys(receipt.pieces).length, errors }));
