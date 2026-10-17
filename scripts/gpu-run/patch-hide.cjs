// TEST ONLY: hide named meshes on CHEAP remote figures (names from globalThis.__hide), re-applied after every pose (the rig may toggle visibility), and record busy ms/frame + a still per case.
const fs = require('fs');
let p = fs.readFileSync('origins/preview/preview-rules.ts', 'utf8');
p = p.replace('export const previewRule = (id: (typeof NAMED)[number]): number => PREVIEW_RULES.find((r) => r.id === id)!.value;', 'export const previewRule = (id: (typeof NAMED)[number]): number => ((globalThis as unknown as { __rules?: Record<string, number> }).__rules?.[id]) ?? PREVIEW_RULES.find((r) => r.id === id)!.value;');
if (!p.includes('__rules')) throw Error('previewRule anchor missing');
fs.writeFileSync('origins/preview/preview-rules.ts', p);

let r = fs.readFileSync('origins/preview/remote-heroes.ts', 'utf8');
const anchor = '  const retag = (s: Slot, text: string | null): void => {';
if (!r.includes(anchor)) throw Error('retag anchor missing');
r = r.replace(anchor, `  const hideParts = (s: Slot): void => { const names = (globalThis as unknown as { __hide?: string[] }).__hide; if (!names) return; s.actor.anchor.traverse((o) => { if (o.name && names.includes(o.name)) { o.userData.visWas ??= o.visible; o.visible = s.cheap ? false : (o.userData.visWas as boolean); } }); };\n` + anchor);
const a2 = "slot.thaw = true; slot.actor.update(slot.speed, slot.owed, 'ready', 0, 'light', 0.35, 0); slot.owed = 0;";
if (!r.includes(a2)) throw Error('pose anchor missing');
r = r.replace(a2, a2 + ' hideParts(slot);');
const a3 = 'if ((rank >= full) !== slot.cheap) setCheap(slot, rank >= full);';
if (!r.includes(a3)) throw Error('setCheap anchor missing');
r = r.replace(a3, a3.replace('setCheap(slot, rank >= full);', 'setCheap(slot, rank >= full); hideParts(slot);'));
fs.writeFileSync('origins/preview/remote-heroes.ts', r);

let m = fs.readFileSync('origins/preview/main.ts', 'utf8');
const k = '(window as unknown as { originsPreview: unknown }).originsPreview = {';
if (!m.includes(k)) throw Error('main anchor missing');
m = m.replace(k, '(window as unknown as { __scene: unknown }).__scene = scene;\n' + k);
fs.writeFileSync('origins/preview/main.ts', m);

let h = fs.readFileSync('scripts/origins-crowd-fps.mjs', 'utf8');
h = h.replace("page.on('pageerror'", "if (process.env.RULES) await page.addInitScript((x) => { window.__rules = x; }, JSON.parse(process.env.RULES)); if (process.env.HIDE) await page.addInitScript((x) => { window.__hide = x; }, JSON.parse(process.env.HIDE)); page.on('pageerror'");
h = h.replace("res.topSelfMs = ", "res.busyMsPerFrame = +([...self.entries()].filter(([k]) => !/^\\((idle)\\)/.test(k)).reduce((a, [, v]) => a + v, 0) / Math.max(1, gapsCount())).toFixed(1); res.topSelfMs = ");
h = h.replace("const { profile } = await cdp.send('Profiler.stop')", "const gapsCount = () => window_gaps_n; const { profile } = await cdp.send('Profiler.stop')");
h = h.replace("const cdp = process.env.PROFILE", "let window_gaps_n = 1; const cdp = process.env.PROFILE");
h = h.replace("await page.waitForTimeout(WINDOW);", "await page.waitForTimeout(WINDOW); window_gaps_n = (await page.evaluate(() => window.__gaps.length)) - 2; res.still = true; await page.screenshot({ path: OUT + '/still-' + n + '.png' });");
h = h.replace('res.programsAdded = ', 'res.info = await page.evaluate(() => { const r = window.originsPreview.renderInfo(); return { calls: r.calls, triangles: r.triangles }; }); res.programsAdded = ');
if (!h.includes('process.env.HIDE') || !h.includes('busyMsPerFrame') || !h.includes('res.info')) throw Error('harness anchor missing');
fs.writeFileSync('scripts/origins-crowd-fps.mjs', h);
