// TEST ONLY: the crowd-fps harness also records EVERY skinned mesh name in the scene (name -> count), so the hero's real part names are read, not guessed.
const fs = require('fs');
let h = fs.readFileSync('scripts/origins-crowd-fps.mjs', 'utf8');
h = h.replace('res.programsAdded = ', 'res.allMeshes = await page.evaluate(() => { const by = {}; window.__scene.traverse((o) => { if (o.isSkinnedMesh) by[o.name || "(unnamed)"] = (by[o.name || "(unnamed)"] ?? 0) + 1; }); return by; }); res.programsAdded = ');
if (!h.includes('res.allMeshes')) throw Error('dump anchor missing');
fs.writeFileSync('scripts/origins-crowd-fps.mjs', h);
// the crowd page check: also take HIDE (a list of mesh names) from env, like the fps harness
let c = fs.readFileSync('scripts/origins-crowd-page-check.mjs', 'utf8');
c = c.replace("page.on('pageerror'", "if (process.env.HIDE) await page.addInitScript((x) => { window.__hide = x; }, JSON.parse(process.env.HIDE)); page.on('pageerror'");
if (!c.includes('process.env.HIDE')) throw Error('crowd page HIDE anchor missing');
fs.writeFileSync('scripts/origins-crowd-page-check.mjs', c);
