// Seeds the fighter profile with worn loot (paperdoll keys), boots the fight, and reports which worn pieces are in the scene and visible.
import { chromium } from 'playwright';
const [, , base] = process.argv;
const ids = JSON.parse(process.env.IDS || '{"legs":"dwarf.Greaves"}');
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 375, height: 812 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
await p.addInitScript(() => { const t = new EventTarget(); window.__scenes = []; t.addEventListener('observe', e => { if (e.detail?.isScene) window.__scenes.push(e.detail); }); window.__THREE_DEVTOOLS__ = t; });
p.on('pageerror', e => console.log('pageerror', e.message));
await p.goto(base, { timeout: 120000 });
await p.evaluate((ids) => { const k = 'frankendom.fighter.v1', prof = JSON.parse(localStorage.getItem(k) || '{"version":1,"id":"00000000-0000-4000-8000-000000000001","name":"Wanderer"}'); prof.loot = { owned: Object.values(ids), equipped: ids }; localStorage.setItem(k, JSON.stringify(prof)); }, ids);
await p.goto(`${base}?opponent=dwarf`, { timeout: 120000 });
const t0 = Date.now();
await p.waitForFunction(() => window.__scenes.some(s => { let f = false; s.traverse(o => { if (o.isMesh && /DwarfIron/.test(o.material?.name || '')) f = true; }); return f; }), null, { timeout: 150000, polling: 2000 }).then(() => console.log('loot piece in scene after', (Date.now() - t0) / 1000, 's'), () => console.log('NO loot piece after 150 s'));
console.log('saved loot', await p.evaluate(() => JSON.stringify(JSON.parse(localStorage.getItem('frankendom.fighter.v1')).loot)));
console.log(JSON.stringify(await p.evaluate((want) => {
  const out = { scenes: window.__scenes.length, pieces: [] };
  for (const s of window.__scenes) s.traverse(o => { if (o.isMesh && /Greaves|Boots|dwarf|Iron/.test((o.name || '') + JSON.stringify(o.userData) + (o.material?.name || ''))) { let vis = true; for (let q = o; q; q = q.parent) vis = vis && q.visible; out.pieces.push({ name: o.name, visible: vis, parent: o.parent?.name, ud: JSON.stringify(o.userData).slice(0, 120), verts: o.geometry.attributes.position.count }); } });
  return out;
}, Object.values(ids))));
await b.close();
