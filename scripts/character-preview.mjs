// Character review harness. Deterministic captures of the shipped warrior under the game's own loader,
// lock camera and renderer settings, plus a resource table. Never part of the build or the runtime.
//   node scripts/character-preview.mjs --label baseline      capture into artifacts/character/<label>/
//   node scripts/character-preview.mjs --against baseline    also print deltas against that label's stats
//   node scripts/character-preview.mjs --serve               keep a dev server up for manual review
//   node scripts/character-preview.mjs --weapons --label baseline [--enemy /src/assets/weapons/trident/veteran-trident.glb]
//                                                            weapons lane evidence into artifacts/weapons/<label>/ (the opponent's weapon)
import { createServer } from 'vite';
import { chromium } from 'playwright';
import fs from 'node:fs/promises';
import { gzipSync } from 'node:zlib';
import { execSync } from 'node:child_process';
const args = process.argv.slice(2), option = name => { const i = args.indexOf(`--${name}`); return i >= 0 ? args[i + 1] : undefined; };
const commit = execSync('git rev-parse --short HEAD').toString().trim();
const label = option('label') || commit, against = option('against');
const server = await createServer({ server: { host: '127.0.0.1', port: 0 }, logLevel: 'silent' });
await server.listen();
const query = new URLSearchParams(); for (const key of ['src', 'enemy']) if (option(key)) query.set(key, option(key));
const enemyFile = (option('enemy') || '/src/assets/veteran.glb').replace(/^\//, '');   // the opponent GLB on disk, for the resource table
const url = `${server.resolvedUrls.local[0]}character-preview.html${query.size ? `?${query}` : ''}`;
if (args.includes('--serve')) { console.log(`Character preview: ${url}\nCtrl-C to stop.`); await new Promise(() => {}); }

const weapons = args.includes('--weapons'), dir = `artifacts/${weapons ? 'weapons' : 'character'}/${label}`; await fs.mkdir(dir, { recursive: true });
const browser = await chromium.launch({ headless: true, executablePath: chromium.executablePath() });
const errors = [];
async function open(context) {
  const page = await context.newPage(); page.on('pageerror', e => errors.push(String(e))); page.on('response', r => { if (r.status() >= 400 && !r.url().endsWith('/favicon.ico')) errors.push(`${r.status()} ${r.url()}`); });
  await page.goto(url); await page.waitForFunction(() => window.__preview?.loaded || window.__preview?.error, null, { timeout: 90000 });
  const error = await page.evaluate(() => window.__preview.error); if (error) throw new Error(error);
  return page;
}
const save = async (name, dataUrl) => { await fs.writeFile(`${dir}/${name}`, Buffer.from(dataUrl.split(',')[1], 'base64')); console.log(`  ${dir}/${name}`); };
try {
  const context = await browser.newContext({ viewport: { width: 1280, height: 800 }, deviceScaleFactor: 1 });
  const page = await open(context);
  console.log(`Capturing ${label} (${commit}) →`);
  if (option('sheet')) { // --sheet 'Clip:0,.25,.5;Other:.1' → one key-frame sheet of the loaded source, nothing else
    const list = option('sheet').split(';').flatMap(part => { const [name, ts] = part.split(':'); return ts.split(',').map(t => [name.trim(), +t]); });
    await save('sheet.png', await page.evaluate(l => __preview.clipSheet(l), list));
    if (errors.length) throw new Error(`Page errors:\n${errors.join('\n')}`); await browser.close(); await server.close(); process.exit(0);
  }
  if (args.includes('--moodboard')) { // Direction proposal only: swatches and silhouette blockout, no baseline captures.
    for (const [name, data] of Object.entries(await page.evaluate(() => __preview.moodboard()))) await save(`${name}.png`, data);
    if (errors.length) throw new Error(`Page errors:\n${errors.join('\n')}`); await browser.close(); await server.close(); process.exit(0);
  }
  if (weapons) { // Weapons lane evidence: the opponent's weapon alone, in hand, its clips, phone lock stills, the scripted exchange and the cost table.
    await save('weapon-turntable.png', await page.evaluate(() => __preview.weaponTurntable()));
    await save('weapon-on-rig.png', await page.evaluate(() => __preview.weaponOnRig()));
    await save('weapon-clips.png', await page.evaluate(() => __preview.weaponClips()));
    for (const [orientation, role, t] of [['phone', 'idle', 0], ['phoneLandscape', 'idle', 0], ['phone', 'thrust', .34], ['phoneLandscape', 'thrust', .34], ['phoneLandscape', 'guard', 1]])
      await save(`weapon-lock-${orientation}-${role}.png`, await page.evaluate(([o, r, t]) => __preview.weaponLock(o, r, t), [orientation, role, t]));
    await save('exchange.png', await page.evaluate(() => __preview.weaponExchange()));
    await save('exchange-zoom.png', await page.evaluate(() => __preview.weaponExchange('phoneLandscape', 15, 2)));
    const weapon = await page.evaluate(() => __preview.weaponStats()), enemy = await fs.readFile(enemyFile);
    const stats = { label, commit, date: new Date().toISOString().slice(0, 10), enemyGlb: enemyFile, enemyGlbBytes: enemy.length, enemyGlbGzip: gzipSync(enemy).length, ...weapon };
    await fs.writeFile(`${dir}/stats.json`, JSON.stringify(stats, null, 1));
    const previous = against ? JSON.parse(await fs.readFile(`artifacts/weapons/${against}/stats.json`, 'utf8')) : null;
    const row = (name, value) => { const delta = previous && typeof previous[name] === 'number' ? ` (${value - previous[name] >= 0 ? '+' : ''}${(value - previous[name]).toLocaleString()})` : ''; return `| ${name} | ${value.toLocaleString()}${delta} |`; };
    console.log(`\n| resource | ${label}${previous ? ` (Δ vs ${against})` : ''} |\n|---|---|\n${['enemyGlbBytes', 'enemyGlbGzip', 'triangles', 'extentMetres'].map(k => row(k, stats[k])).join('\n')}`);
    console.log(`weapon: ${stats.node} contact ${stats.contact.join('–')} m; materials ${stats.materials.join(', ')}; clips (${stats.clips.length}): ${stats.clips.join(', ')}`);
    if (errors.length) throw new Error(`Page errors:\n${errors.join('\n')}`); await browser.close(); await server.close(); process.exit(0);
  }
  await save('inspection-turntable.png', await page.evaluate(() => __preview.turntable()));
  await save('details.png', await page.evaluate(() => __preview.details()));
  await save('details-opponent.png', await page.evaluate(() => __preview.details(undefined, 'opponent'))); // the Veteran's own close-ups
  await save('faces.png', await page.evaluate(() => __preview.faces())); // both heads from the portrait angles
  if (option('src')) { // raw source inspection: no clips, no lock sequence, no stats
    if (errors.length) throw new Error(`Page errors:\n${errors.join('\n')}`); await browser.close(); await server.close(); process.exit(0);
  }
  await save('clips.png', await page.evaluate(() => __preview.clipSheet()));
  for (const orientation of ['portrait', 'landscape']) for (const moment of ['ready', 'attack'])
    await save(`gameplay-${orientation}-${moment}.png`, await page.evaluate(([o, m]) => __preview.lockStill(o, m), [orientation, moment]));
  await save('sequence.png', await page.evaluate(() => __preview.sequenceSheet()));
  await save('sequence-zoom.png', await page.evaluate(() => __preview.sequenceSheet('landscape', 15, 2)));
  const stats = await page.evaluate(() => __preview.stats());
  await context.close();
  // Real-time playback video: feel reference only; frame timing depends on this machine's software GL.
  const video = await browser.newContext({ viewport: { width: 844, height: 390 }, deviceScaleFactor: 1, recordVideo: { dir, size: { width: 844, height: 390 } } });
  const player = await open(video); await player.evaluate(() => __preview.play()); const file = player.video(); await video.close();
  await file.saveAs(`${dir}/sequence.webm`); await fs.rm(await file.path(), { force: true }); console.log(`  ${dir}/sequence.webm`);
  const glb = await fs.readFile('src/assets/warrior.glb'), enemy = await fs.readFile(enemyFile).catch(() => null);
  const resources = { label, commit, date: new Date().toISOString().slice(0, 10), glbBytes: glb.length, glbGzip: gzipSync(glb).length, ...(enemy ? { enemyGlbBytes: enemy.length, enemyGlbGzip: gzipSync(enemy).length } : {}), ...stats };
  await fs.writeFile(`${dir}/stats.json`, JSON.stringify(resources, null, 1));
  const previous = against ? JSON.parse(await fs.readFile(`artifacts/character/${against}/stats.json`, 'utf8')) : null;
  const row = (name, value, unit = '') => { const delta = previous && typeof previous[name] === 'number' ? ` (${value - previous[name] >= 0 ? '+' : ''}${(value - previous[name]).toLocaleString()})` : ''; return `| ${name} | ${value.toLocaleString()}${unit}${delta} |`; };
  const flat = { glbBytes: resources.glbBytes, glbGzip: resources.glbGzip, ...(enemy ? { enemyGlbBytes: resources.enemyGlbBytes, enemyGlbGzip: resources.enemyGlbGzip } : {}), meshTriangles: resources.meshTriangles, drawCallsTwoFighters: stats.characterOnly.drawCalls, trianglesRenderedTwoFighters: stats.characterOnly.triangles, textureBytes: resources.textureBytes, bones: resources.bones, textures: stats.textures.length, materials: stats.materials.length, clips: stats.clips.length };
  if (previous) for (const k of Object.keys(flat)) previous[k] ??= { drawCallsTwoFighters: previous.characterOnly?.drawCalls, trianglesRenderedTwoFighters: previous.characterOnly?.triangles, textures: previous.textures?.length, materials: previous.materials?.length, clips: previous.clips?.length }[k];
  console.log(`\n| resource | ${label}${previous ? ` (Δ vs ${against})` : ''} |\n|---|---|\n${Object.entries(flat).map(([k, v]) => row(k, v)).join('\n')}`);
  console.log(`materials: ${stats.materials.map(m => `${m.name}[${m.maps.join(',')}]`).join(' ')}`);
  console.log(`textures: ${stats.textures.map(t => `${t.material}.${t.slot} ${t.width}×${t.height}`).join(' ')}`);
  if (errors.length) throw new Error(`Page errors:\n${errors.join('\n')}`);
} finally { await browser.close(); await server.close(); }
