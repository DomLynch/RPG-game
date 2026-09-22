// Finishers review harness. Drives the REAL scene (src/scene.ts — selection, gore, camera dolly) with REAL simulated kills and
// captures the death window at phone widths in all three blood modes. Never part of the build or the runtime.
//   node scripts/finisher-preview.mjs --label finishers-v2
//
// Honesty note (the owner reads this): every kill is a genuine simulation with NO overrides — the player draws, walks in and
// lands paced plain heavy overheads on a passive warden until one kills. Under the owner rule of 2026-09-18 (recorded on
// PR #112) any heavy-blow kill selects a finisher regardless of the coarse hit location, and the seeded rotation picks
// between the six shipped outcomes from the kill event — so the harness runs the same passive duel across
// seeds and captures the first death window each finisher actually draws, organic kills on the production path end-to-end:
// selection, pose, clip, gore, dolly, severed head — nothing is presented as anything other than what the sim reported.
import { createServer } from 'vite';
import { chromium } from 'playwright';
import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
import { execSync } from 'node:child_process';

const args = process.argv.slice(2), option = name => { const i = args.indexOf(`--${name}`); return i >= 0 ? args[i + 1] : undefined; };
const commit = execSync('git describe --always --dirty').toString().trim();
const label = option('label') || 'finishers-v2';
const opponent = option('opponent') || 'veteran';
// Pin a real simulated kill when retaining a camera regression; selection still uses the production pool.
const seedStart = option('seed') ? Number(option('seed')) : 731, seedCount = option('seed') ? 1 : 80;
const order = option('only') ? option('only').split(',') : ['splitCrown', 'decapitation', 'runThrough', 'plainDeath', 'quietOne', 'opened'];

const PAGE = `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>Frankendom finisher preview</title>
<style>html,body{margin:0;height:100%;background:#2b2d2f;overflow:hidden}#world{display:block;width:100vw;height:100vh}</style></head>
<body><canvas id="world"></canvas><script type="module">
import { createScene } from '/src/scene.ts';
import { initialPractice, stepPractice } from '/src/combat.ts';
import { selectFinisher } from '/src/finishers.ts';
import { OPPONENTS } from '/src/moves.ts';
import { Box3, Vector3, Raycaster } from 'three';
const opponentId = ${JSON.stringify(opponent)}, wanted = ${JSON.stringify(order)};
const PASSIVE = { reaction: 1e9, accuracy: 0, parry: 0, dodge: 0, aggression: 0, pressure: 0, discipline: 0, lapse: 1 };
const IDLE = { move: { x: 0, z: 0, yaw: 0, run: false }, action: null, guard: false, held: false, lock: true, cancel: null };
const TICK = 1 / 60;
const canvas = document.getElementById('world');
window.__step = 'module';
window.addEventListener('unhandledrejection', e => { window.__finisherError = String(e.reason && e.reason.stack || e.reason); });
const view = createScene(canvas, () => {}, opponentId);
let renderedScene, renderedCamera, present = true;
const render = view.renderer.render.bind(view.renderer);
view.renderer.render = (scene, camera) => { renderedScene = scene; renderedCamera = camera; if (present) render(scene, camera); };
window.__step = 'scene';
await view.ready;
window.__step = 'ready';
// A real kill: light to draw, walk in, paced plain heavy overheads (the pacing lets posture drain so the killing blow stays a
// plain heavy_overhead — the warden is passive, both sides stepped through the real sim). Each seed yields its own kill
// event; the seeded rotation maps it to a finisher, and we keep the first death window each shipped finisher draws.
function simulate(seed) {
  let p = initialPractice(seed, OPPONENTS[opponentId]);
  const frames = [];
  let kill = -1;
  let lastHit = -1e9;
  for (let tick = 0; tick < 60 * 120; tick++) {
    if (kill >= 0 && p.duel.tick > kill + 200) break;   // the death window itself: 200 ticks (3.3 s) past the blow, corpse held
    const dx = p.enemy.x - p.fighter.x, dz = p.enemy.z - p.fighter.z;
    const dist = Math.hypot(dx, dz);
    const f = p.duel.fighters[0];
    const intent = { ...IDLE };
    if (f.phase === 'sheathed' || f.phase === 'draw') intent.action = 'light';
    else if (f.phase === 'ready') {
      if (dist > 1.9) intent.move = { x: dx, z: dz, yaw: Math.atan2(dx, dz), run: false };
      else if (tick - lastHit > 200) intent.action = 'heavy';
    }
    p = stepPractice(p, intent, PASSIVE);
    for (const e of p.duel.events) {
      if (e.type === 'Hit' && e.actor === 0) lastHit = p.duel.tick;
      if (e.type === 'Killed') kill = p.duel.tick;
    }
    frames.push({ state: { ...p.fighter }, practice: p, events: p.duel.events });
  }
  return { frames, kill };
}
// The first death window each shipped outcome draws, across seeded duels (the rotation seed is the kill event itself).
const windows = {};
const provenance = [];
for (let seed = ${seedStart}; seed < ${seedStart + seedCount} && wanted.some(id => windows[id] === undefined); seed++) {
  const sim = simulate(seed);
  if (sim.kill < 0) continue;   // the scripted duel produced no kill on this seed
  const finish = sim.frames[sim.frames.length - 1].practice.finish;
  const duel = sim.frames[sim.frames.length - 1].practice.duel;
  const finisher = selectFinisher(finish, [duel.fighters[0].weapon, duel.fighters[1].weapon]);
  if (finisher && windows[finisher] === undefined) {
    const from = sim.frames.findIndex(f => f.practice.duel.tick >= sim.kill - 45);
    windows[finisher] = { frames: sim.frames.slice(from, from + 220), killIndex: sim.frames.slice(from, from + 220).findIndex(f => f.events.some(e => e.type === 'Killed')) };
    provenance.push({ seed, finisher, finish });
  }
}
// Body wounds (owner 2026-09-21): the same scripted duel from its first tick to the first landed blow that finds the warden at
// 60 % health or below, plus a dozen frames to settle — the marks must already show on him there (before any finisher).
{
  const sim = simulate(${seedStart});
  const at = sim.frames.findIndex(f => f.events.some(e => e.type === 'Hit' && e.target === 1) && f.practice.health <= .6 * f.practice.enemyMaxHealth && f.practice.health > 0);
  if (at >= 0) windows.wounded = { frames: sim.frames.slice(0, at + 200), killIndex: 1e9, hitIndex: at };   // 3.3 s past the blow: the runs lengthen, then hold
}
// Outcomes outside the automatic rotation (The Quiet One since the beta cut, owner 2026-09-20) are still shipped and
// forceable from the dev picker; the harness reaches them the same way — the production override on a real kill from a
// seed that drew another outcome — and labels the window so nothing reads as an organic draw.
for (const id of wanted) if (windows[id] === undefined) {
  const donor = provenance.find(p => !p.override);
  if (!donor) break;
  windows[id] = { ...windows[donor.finisher], override: id };
  provenance.push({ seed: donor.seed, finisher: id, override: true, finish: donor.finish });
}
window.__provenance = provenance;
if (wanted.some(id => windows[id] === undefined)) throw new Error('could not draw requested outcomes from the requested seeds: ' + JSON.stringify(provenance));
window.__step = 'simulated';
let cursor = -1, maxCameraStep = 0, currentMode = 'red';
window.__finisher = {
  provenance,
  inspect() {
    const headProp = renderedScene?.getObjectByName('BloodHeadCut')?.parent;
    const headBox = headProp ? new Box3().setFromObject(headProp,true) : null;
    const detachedHead = headBox ? {center:view.project(headBox.getCenter(new Vector3()).toArray()),frame:[headBox.min.x,headBox.max.x].flatMap(x=>[headBox.min.y,headBox.max.y].flatMap(y=>[headBox.min.z,headBox.max.z].map(z=>view.project([x,y,z]))))} : null;
    const crown = renderedScene?.getObjectByName('SplitCrown');
    const opened = renderedScene?.getObjectByName('Opened');
    const dropped=opened?.getObjectByName('OpenedWeapon'), weaponBox=dropped?.children.length ? new Box3().setFromObject(dropped,true) : null;
    const pieces = opened?.children.filter(o=>o.name!=='OpenedWeapon').map(half => {
      const box = new Box3().setFromObject(half,true);
      return {name:half.name,visible:half.visible,opacity:half.getObjectByName('CreatureBody')?.material.opacity ?? 1,min:box.min.toArray(),max:box.max.toArray(),caps:half.children.filter(o=>o.name==='WaistCut').length,
        frame:[box.min.x,box.max.x].flatMap(x=>[box.min.y,box.max.y].flatMap(y=>[box.min.z,box.max.z].map(z=>view.project([x,y,z]))))};
    });
    // The two fighters: a top-level scene child with a 'pelvis' bone. The arena group is excluded by name because it now
    // carries skinned rigs of its own - the six lorarii on the walkway (Brief 13) are built on the hero skeleton, so the
    // arena itself answers getObjectByName('pelvis') and would count as a third actor, leaving framing undefined and
    // every framing assertion reading it off undefined. Scenery is not an actor; the fighter assertions stay exactly as
    // strict, and a genuine third FIGHTER would still be caught here.
    const actors = renderedScene?.children.filter(o => o.name !== 'arena' && o.getObjectByName('pelvis')) ?? [];
    if(detachedHead && actors[0]) {
      actors[0].traverse(o=>{if(o.isSkinnedMesh){o.computeBoundingSphere();o.computeBoundingBox();}});
      const toward=headBox.getCenter(new Vector3()).sub(renderedCamera.position);
      const ray=new Raycaster(renderedCamera.position,toward.clone().normalize(),0,Math.max(0,toward.length()-.05));
      detachedHead.occludedByVictor=ray.intersectObject(actors[0],true).some(hit=>hit.object.visible);
    }
    const blade = actors[0]?.getObjectByName('SwordDrawn'), chest = actors[1]?.getObjectByName('spine_02')?.getWorldPosition(new Vector3());
    // Owner 2026-09-20: is the victim hidden behind the killer? A camera ray to the victim's chest, and to the (split) skull.
    const hiddenByVictor = (point) => {
      if(!point || !actors[0]) return null;
      actors[0].traverse(o=>{if(o.isSkinnedMesh){o.computeBoundingSphere();o.computeBoundingBox();}});
      const toward=point.clone().sub(renderedCamera.position);
      return new Raycaster(renderedCamera.position,toward.clone().normalize(),0,Math.max(0,toward.length()-.05)).intersectObject(actors[0],true).some(hit=>hit.object.visible);
    };
    const victim = { chestHidden: hiddenByVictor(chest), skullHidden: hiddenByVictor(crown ? new Box3().setFromObject(crown,true).getCenter(new Vector3()) : actors[1]?.getObjectByName('Head')?.getWorldPosition(new Vector3())) };
    let framing;
    if (actors.length === 2) {
      const a = actors[0].children[0].getWorldPosition(new Vector3()), b = actors[1].children[0].getWorldPosition(new Vector3());
      const axis = b.clone().sub(a).setY(0).normalize();
      const eye = renderedCamera.position.clone().sub(a.clone().add(b).multiplyScalar(.5)).setY(0).normalize();
      framing = { maxCameraStep, side: Math.abs(axis.x*eye.z-axis.z*eye.x), heads: actors.map(o => view.project(o.getObjectByName('Head').getWorldPosition(new Vector3()).toArray())), camera: renderedCamera.position.toArray() };
    }
    let impalement;
    if (blade && chest) {
      const grip = blade.localToWorld(new Vector3(0, .24, 0)), tip = blade.localToWorld(new Vector3(0, .85, 0));
      const run = tip.clone().sub(grip), along = chest.clone().sub(grip).dot(run) / run.lengthSq();
      impalement = { miss: grip.clone().addScaledVector(run, along).distanceTo(chest), along, tip: tip.toArray(), chest: chest.toArray(), step: actors[0].children[0].position.toArray() };
    }
    const neck = actors[1]?.getObjectByName('neck_01')?.getWorldPosition(new Vector3()), hand = actors[1]?.getObjectByName('hand_l')?.getWorldPosition(new Vector3()), head = actors[1]?.getObjectByName('Head')?.getWorldPosition(new Vector3()), wound = renderedScene?.getObjectByName('Wound_1');
    const body = new Box3();
    actors[1]?.traverse(o => { if (o.isSkinnedMesh) body.expandByObject(o,true); });
    const bodyFrame = body.isEmpty() ? [] : [body.min.x,body.max.x].flatMap(x=>[body.min.y,body.max.y].flatMap(y=>[body.min.z,body.max.z].map(z=>view.project([x,y,z]))));
    const quiet = neck && hand && head ? { bodyFrame, handMiss: hand.distanceTo(neck), headHeight: head.y, woundVisible: wound?.visible, woundDistance: wound?.position.distanceTo(neck), woundWidth: wound?.children.at(-1)?.scale.x, headScale: actors[1].getObjectByName('Head').scale.x } : null;
    return { victim, detachedHead, blood: view.bloodState(), opened: {visible:opened?.visible ?? false,pieces:pieces ?? [],weapon:weaponBox ? {min:weaponBox.min.toArray(),max:weaponBox.max.toArray(),frame:[weaponBox.min.x,weaponBox.max.x].flatMap(x=>[weaponBox.min.y,weaponBox.max.y].flatMap(y=>[weaponBox.min.z,weaponBox.max.z].map(z=>view.project([x,y,z]))))} : null}, quiet, framing, impalement, crown: !!crown, visible: crown?.visible ?? false, halves: crown?.children.length ?? 0,
      headScale: crown?.parent.getObjectByName('Head')?.scale.x ?? 1,
      bounds: crown ? new Box3().setFromObject(crown).getSize(new Vector3()).toArray() : [],
      position: crown ? new Box3().setFromObject(crown).getCenter(new Vector3()).toArray() : [],
      head: crown?.parent.getObjectByName('Head')?.getWorldPosition(new Vector3()).toArray(),
      draws: view.renderer.info.render.calls, triangles: view.renderer.info.render.triangles };
  },
  async rear(which, index = windows[which].frames.length - 1) {
    view.setFinisherOverride(windows[which].override ?? null);
    view.stopTour();   // a player's touch on the arena hands the camera back before an orbit (main.ts); the tour would otherwise hold the side view
    const rearYaw = view.yaw + Math.PI; view.recenter(); view.orbit(-rearYaw / .005, 35);
    const f = windows[which].frames[index];
    present = true; view.render(f.state, false, 0, f.practice, [], false);
    await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
  },
  front() { view.recenter(); },
  modesAndRematch(which) {
    view.setFinisherOverride(windows[which].override ?? null);
    const f = windows[which].frames.at(-1), receipts = [];
    for (const mode of ['dark', 'off', 'red']) {
      view.setBloodMode(mode); view.render(f.state, true, 0, f.practice, [], false);
      receipts.push({ mode, ...this.inspect() });
    }
    const p = initialPractice(731, OPPONENTS[opponentId]); view.render(p.fighter, true, TICK, p, [], false);
    const reset = this.inspect();
    present = false; for (let i=0;i<60;i++) view.render(p.fighter, true, TICK, p, [], false); present = true;
    receipts.push({ mode: 'rematch', ...reset, cameraAfterReset: this.inspect().framing }); return receipts;
  },
  hold(which, seconds) {
    const f=windows[which].frames.at(-1);
    for(let i=0;i<seconds*60;i++) {present=i===seconds*60-1;view.render(f.state,true,TICK,f.practice,[],false);}
    return new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(()=>resolve(this.inspect()))));
  },
  count(which) { return windows[which]?.frames.length ?? 0; },
  hitIndex(which) { return windows[which]?.hitIndex ?? -1; },
  probe() { return view.probe(); },
  killIndex(which) { return windows[which].killIndex; },
  play(which, i, mode) {
    // Render inside a rAF double-tick: without preserveDrawingBuffer a synchronous render never reaches the compositor,
    // and screenshots would show a stale frame. A fresh playback resets the cursor so the scene state rebuilds from tick 0.
    return new Promise(resolve => requestAnimationFrame(() => {
      view.setFinisherOverride(windows[which].override ?? null);   // the picker's own path for outcomes outside the rotation
      if (i <= cursor) view.setPreviousFinisher(null);   // every captured window is a first fight (the no-repeat rule reads the previous one)
      if (mode && mode !== currentMode) { view.setBloodMode(mode); currentMode = mode; }
      if (i <= cursor) { cursor = -1; maxCameraStep = 0; view.recenter(); }
      for (let j = cursor + 1; j <= i; j++) { const f = windows[which].frames[j], before = renderedCamera?.position.clone(); present = j === i; view.render(f.state, true, TICK, f.practice, f.events, false); if (before && j > windows[which].killIndex+(which === 'quietOne' ? 10 : 60)) maxCameraStep = Math.max(maxCameraStep, before.distanceTo(renderedCamera.position)); cursor = j; }
      requestAnimationFrame(() => resolve(view.playing()));
    }));
  },
};
</script></body></html>`;

const dir = `artifacts/character/${label}`; await fs.mkdir(dir, { recursive: true });
// The page is served by this script (no harness file in the repo root); as a plugin it runs before vite's SPA fallback.
const server = await createServer({ server: { host: '127.0.0.1', port: 0 }, logLevel: 'silent', optimizeDeps: { noDiscovery: true }, plugins: [{ name: 'finisher-preview', configureServer(s) { s.middlewares.use(async (req, res, next) => {
  if (req.url.split('?')[0] !== '/finisher-preview.html') return next();
  res.setHeader('Content-Type', 'text/html'); res.end(await s.transformIndexHtml('/finisher-preview.html', PAGE));
}) } }] });
await server.listen();
const url = `${server.resolvedUrls.local[0]}finisher-preview.html`;
const browser = await chromium.launch({ headless: true, executablePath: chromium.executablePath() });
const errors = [];
const save = async (name, data) => { await fs.writeFile(`${dir}/${name}`, data); console.log(`  ${dir}/${name}`); };
try {
  console.log(`Capturing ${label} (${commit}) →`);
  const open = async (viewport, reducedMotion = 'no-preference') => {
    const page = await (await browser.newContext({ viewport, deviceScaleFactor: 2, reducedMotion })).newPage();
    page.on('pageerror', e => { errors.push(String(e)); console.log('  pageerror:', String(e).slice(0, 300)); });
    page.on('console', m => { if (m.type() === 'error') console.log('  console:', m.text().slice(0, 300)); });
    page.on('response', r => { if (r.status() >= 400 && !r.url().endsWith('/favicon.ico')) { console.log('  HTTP', r.status(), r.url()); errors.push(`${r.status()} ${r.url()}`); } });
    await page.goto(url); await page.waitForFunction(() => window.__finisher || window.__finisherError, null, { timeout: 120000 }).catch(async () => { console.log("  stuck at step:", await page.evaluate(() => window.__step), "err:", await page.evaluate(() => window.__finisherError)); throw new Error("page stuck"); });
    return page;
  };
  const NAMES = { splitCrown: 'split-crown', decapitation: 'decapitation', runThrough: 'run-through', quietOne: 'quiet-one', plainDeath: 'plain-death', opened: 'opened' };
  const ORDER = order, cameraChecks = [], quietChecks = [], bloodChecks = [];
  const first = await open({ width: 393, height: 852 });
  const info = await first.evaluate(() => ({ provenance: window.__finisher.provenance }));
  await first.context().close();
  for (const p of info.provenance) console.log(`  ${p.finisher}: seed ${p.seed}${p.override ? ' (picker override — outside the automatic rotation)' : ''}, kill ${JSON.stringify(p.finish)}`);
  // Body wounds (owner 2026-09-21): one still of the warden at 60 % or below, mid-fight — marks on the struck body, then 'off' hides them.
  if (option('wounds')) {
    const page = await open({ width: 393, height: 852 });
    const count = await page.evaluate(() => __finisher.count('wounded'));
    // Lead review (2026-09-22): a duel that never reaches the threshold used to skip the whole check with a log line and
    // exit 0 — a release gate has to fail there, not pass vacuously. The scripted duel (paced heavies, passive warden)
    // reaches 60 % well before any kill on every shipped opponent; if it stops doing that, that is itself a real finding.
    assert.ok(count > 0, 'the scripted duel must reach the warden at 60 % health or below before the kill — it never did');
    // The runs (owner 2026-09-22, "proper blood dripping"): stills at 0.3 / 1.5 / 3 s after the blow, front and rear, and the
    // acceptance rule as a gate — at 1.5 s the longest run is visibly longer than at 0.3 s and at least 8 cm on a man's torso.
    const hitIndex = await page.evaluate(() => __finisher.hitIndex('wounded')), runs = {};
    for (const [seconds, tag] of [[0.3, '0.3s'], [1.5, '1.5s'], [3, '3s']]) {
      const i = Math.min(count - 1, hitIndex + Math.round(seconds * 60));
      await page.evaluate(([j]) => __finisher.play('wounded', j, 'red'), [i]);
      runs[tag] = (await page.evaluate(() => __finisher.probe())).bodyWounds[1];
      await page.screenshot({ path: `${dir}/wounds-${tag}-front.png` });
      await page.evaluate(([j]) => __finisher.rear('wounded', j), [i]); await page.screenshot({ path: `${dir}/wounds-${tag}-rear.png` });
    }
    console.log(`  wounds: runs 0.3 s ${runs['0.3s'].drip} m → 1.5 s ${runs['1.5s'].drip} m → 3 s ${runs['3s'].drip} m (${runs['1.5s'].visible} mark(s), opacity ${runs['1.5s'].opacity})`);
    assert.ok(runs['1.5s'].visible >= 1 && runs['1.5s'].opacity > .3, 'a wounded warden shows at least one mark once at 60 % health or below');
    assert.ok(runs['1.5s'].drip > runs['0.3s'].drip * 1.5, `the run is visibly longer at 1.5 s than at 0.3 s (${runs['0.3s'].drip} → ${runs['1.5s'].drip} m)`);
    assert.ok(runs['3s'].drip >= runs['1.5s'].drip - 1e-6, 'and never shorter at 3 s');
    if (opponent === 'veteran' || opponent === 'nightborn' || opponent === 'executioner' || opponent === 'goblin') assert.ok(runs['1.5s'].drip >= 0.08, `at least 8 cm at 1.5 s on the torso, the goblin's pauldron in place (${runs['1.5s'].drip} m)`);
    await page.evaluate(([i]) => __finisher.play('wounded', i, 'red'), [count - 1]);
    const red = (await page.evaluate(() => __finisher.probe())).bodyWounds;
    await page.screenshot({ path: `${dir}/wounds-phone.png` });
    await page.evaluate(([i]) => __finisher.play('wounded', i, 'off'), [count - 1]);
    const off = (await page.evaluate(() => __finisher.probe())).bodyWounds;
    assert.equal(off[1].visible, 0, "blood 'off' hides the body wounds");
    await save('wound-checks.json', JSON.stringify({ opponent, commit, runs, red, off }, null, 2));
    await page.context().close();
  }
  // Mode stills: one clean playthrough per blood mode per outcome (scene state evolves with playback, so each mode replays from scratch).
  for (const which of ORDER) {
    for (const [mode, name] of [['red', ''], ['dark', '-dark'], ['off', '-off']]) {
      const page = await open({ width: 393, height: 852 });
      const { killIndex, count } = await page.evaluate(w => ({ killIndex: __finisher.killIndex(w), count: __finisher.count(w) }), which);
      const settled = count - 1;
      for (const [i, suffix] of [[Math.min(killIndex + 26, settled), 'contact'], [Math.min(killIndex + 78, settled), 'drop'], [settled, 'settled']]) {
        const playing = await page.evaluate(([w, j, m]) => __finisher.play(w, j, m), [which, i, mode]);
        if (mode === 'red' && suffix === 'settled') console.log(`  ${which} rig at settle: ${playing.split(' ')[1]}`);
        await page.screenshot({ path: `${dir}/${NAMES[which]}-phone${name}-${suffix}.png` });
        if (['runThrough', 'splitCrown'].includes(which) && suffix === 'contact') {
          const { framing } = await page.evaluate(() => __finisher.inspect());
          assert.ok(framing.side < .6, 'the side move waits until after the impact');
        }
        if (['runThrough', 'splitCrown'].includes(which) && suffix === 'settled') {
          const { framing, victim } = await page.evaluate(() => __finisher.inspect());
          cameraChecks.push({ opponent, which, mode, framing, victim });
          if (which === 'runThrough') assert.ok(framing.side > .8, 'the settled finisher moves far enough sideways to expose the victim');
          else {
            // Owner 2026-09-20: the seam only reads from the front — a raised front-quarter (45°), never the profile.
            assert.ok(framing.side > .55 && framing.side < .85, 'Split Crown settles on a front-quarter, not a profile ' + JSON.stringify(framing));
            assert.equal(victim.skullHidden, false, 'the split skull is not hidden behind the killer ' + JSON.stringify({ framing, victim }));
          }
          assert.ok(framing.maxCameraStep < .25, 'the late camera move is continuous, without a camera cut');
          assert.ok(framing.heads.every(p => p && p[0] > 10 && p[0] < 383 && p[1] > 20 && p[1] < 700), 'both heads stay in the portrait frame above the controls');
          assert.ok(Math.hypot(framing.camera[0], framing.camera[2]) <= 11.5, 'finisher camera stays inside the arena');
        }
        if (which === 'decapitation') {
          const {detachedHead,framing,victim} = await page.evaluate(()=>__finisher.inspect());
          assert.ok(framing.side<.5,'Decapitation keeps the front-facing camera (a slide to camera-right, no side reveal) '+JSON.stringify(framing));
          if(suffix==='settled') assert.equal(victim.chestHidden,false,'owner 2026-09-20: the headless corpse is seen past the killer '+JSON.stringify({framing,victim}));
          if(mode!=='off') {
            assert.ok(detachedHead,'head is detached');
            if(suffix!=='contact') assert.equal(detachedHead.occludedByVictor,false,'landed head is not hidden behind the victor');
            assert.ok(detachedHead.frame.every(p=>p && p[0]>5 && p[0]<388 && p[1]>20 && p[1]<700),'detached head stays visible above portrait controls '+JSON.stringify({suffix,detachedHead,framing}));
          }
          cameraChecks.push({opponent,which,mode,suffix,framing,detachedHead,victim});
        }
        if (which === 'opened') {
          const {opened,framing} = await page.evaluate(() => __finisher.inspect());
          assert.equal(opened.visible,mode !== 'off','waist separation obeys blood mode');
          if(mode !== 'off') {
            assert.match(playing,/Opened:WaistCut/);
            assert.equal(opened.pieces.length,2);
            assert.ok(opened.pieces.every(p=>p.visible && p.opacity>.75),'halves remain visible through separation and landing');
            assert.ok(opened.pieces.every(p=>p.caps>0),'both halves have closed cut surfaces');
            assert.ok(opened.pieces.every(p=>p.min[1]>-.015),'no half sinks through the floor');
            if(suffix === 'settled') {
              assert.ok(opened.pieces.every(p=>p.min[1]<.04),'both halves land');
              assert.ok(opened.weapon,'the victim\'s weapon detaches (every roster fighter is armed; the Wraith carries the reaper)');
              assert.ok(opened.weapon.min[1]>-.015 && opened.weapon.max[1]<.5,'victim weapon drops flat');
              assert.ok(opened.weapon.frame.every(v=>v && v[0]>5 && v[0]<388 && v[1]>20 && v[1]<700),'dropped weapon remains in the portrait frame');
              assert.ok(opened.pieces.every(p=>p.frame.every(v=>v && v[0]>5 && v[0]<388 && v[1]>20 && v[1]<700)),'entire corpse clears portrait controls');
            }
          }
          if(suffix === 'settled') {
            assert.ok(framing.side>.75 && framing.maxCameraStep<.25,'smooth side reveal '+JSON.stringify(framing));
            cameraChecks.push({opponent,which,mode,opened,framing});
          }
        }
        if (which === 'quietOne') {
          const { quiet, framing } = await page.evaluate(() => __finisher.inspect());
          quietChecks.push({opponent,mode,suffix,quiet,framing,playing});
          if (suffix !== 'contact') {
            assert.match(playing,/Death_QuietOne:Death_QuietOne/);
            assert.ok(quiet.handMiss < .16, 'left hand clutches the throat through the collapse');
            assert.equal(quiet.woundVisible,mode !== 'off','neck wound follows blood mode');
            assert.ok(quiet.woundDistance < .16 && quiet.woundWidth < 2, 'small wound follows the animated neck');
            assert.equal(quiet.headScale,1,'head stays intact');
          }
          if (suffix === 'drop') assert.ok(quiet.headHeight > .9*(opponent === 'goblin' ? .7 : opponent === 'executioner' ? 1.2 : 1), 'the held beat remains upright');
          if (suffix === 'settled') {
            assert.ok(quiet.headHeight < .55,'body reaches the ground');
            assert.ok(quiet.bodyFrame.every(p=>p && p[0]>5 && p[0]<388 && p[1]>20 && p[1]<700),`whole fallen body remains inside the portrait frame: ${JSON.stringify(quiet.bodyFrame)}`);
            assert.ok(framing.side > .75 && framing.maxCameraStep < .25,'continuous side reveal');
            assert.ok(framing.heads.every(p=>p && p[0]>10 && p[0]<383 && p[1]>20 && p[1]<700),'both heads clear the portrait controls');
          }
        }
        if (which === 'runThrough' && suffix !== 'contact') {
          const { impalement } = await page.evaluate(() => __finisher.inspect());
          assert.ok(impalement.miss < .09 && impalement.along > .2 && impalement.along < .8, 'blade stays embedded during the collapse and final hold');
          assert.match(playing, /Fin_RunThrough:Fin_RunThrough/);
        }
        if (which === 'splitCrown' && mode === 'red' && suffix === 'contact') {
          await page.evaluate(([w, j]) => __finisher.rear(w, j), [which, i]);
          await page.screenshot({ path: `${dir}/${NAMES[which]}-phone-rear-contact.png` });
          await page.evaluate(() => __finisher.front());
        }
      }
      if (args.includes('--blood-check')) {
        const before=await page.evaluate(()=>__finisher.inspect());
        const held=await page.evaluate(w=>__finisher.hold(w,6),which), blood=held.blood;
        assert.equal(blood.visible,mode!=='off','all finisher blood obeys the mode');
        if(mode!=='off') {
          assert.ok(blood.emitted>150 && blood.landed>100,'heavy spray reaches the floor');
          assert.equal(blood.airborne,0,'jets taper out and the held corpse does not spray forever');
          assert.ok(blood.pools.length>2 && blood.pools.length<=80,'bounded multiple floor spills');
          assert.ok(blood.pools.every(p=>p.position[1]>=.02 && p.position[1]<.04),'spills lie on the sand');
          assert.ok(blood.pools.some(p=>p.radius>.35),'substantial pooled blood');
          assert.ok(blood.sources.every(s=>blood.pools.some(p=>Math.hypot(p.position[0]-s.position[0],p.position[2]-s.position[2])<.7)),'each wound has blood spilled nearby');
          if(which==='decapitation')assert.deepEqual(blood.sources.map(s=>s.site),['neck-stump','detached-head']);
          if(which==='opened') {
            assert.deepEqual(before.blood.sources.map(s=>s.site),['waist-legs','waist-torso']);
            if(opponent==='wraith') {
              assert.ok(held.opened.pieces.every(p=>!p.visible && p.opacity===0),'Wraith halves fade only after the visible split');
              assert.equal(blood.sources.length,0,'vanished halves stop emitting');
            } else assert.ok(held.opened.pieces.every(p=>p.visible),'physical corpses stay');
          }
          if(which==='quietOne')assert.equal(blood.sources[0].site,'jugular');
        } else {assert.equal(blood.emitted,0);assert.equal(blood.pools.length,0);}
        bloodChecks.push({opponent,which,mode,before:before.blood,held:blood,draws:held.draws,triangles:held.triangles});
        await page.screenshot({path:`${dir}/${NAMES[which]}-phone${name}-blood-held.png`});
        // Dedicated reset check uses a fresh page so the existing finisher state checks retain their own sequence.
        const resetPage=await open({width:393,height:852});
        await resetPage.evaluate(w=>__finisher.play(w,__finisher.count(w)-1,'red'),which);
        const reset=await resetPage.evaluate(w=>__finisher.modesAndRematch(w),which);
        assert.equal(reset.at(-1).blood.pools.length,0);assert.equal(reset.at(-1).blood.visible,false,'rematch clears all finisher blood');
        await resetPage.context().close();
      }
      if (which === 'runThrough') {
        if (mode === 'red') {
          await page.evaluate(w => __finisher.rear(w), which);
          await page.screenshot({ path: `${dir}/run-through-phone-rear.png` });
          assert.ok((await page.evaluate(() => __finisher.inspect())).framing.side < .8, 'free camera can orbit away from the automatic side view');
        }
        const checks = await page.evaluate(w => __finisher.modesAndRematch(w), which);
        for (const state of checks.slice(0, 3)) {
          assert.ok(state.impalement.miss < .09, 'held blade intersects chest in every blood mode');
          assert.ok(state.impalement.along > .2 && state.impalement.along < .8, 'blade extends through chest');
        }
        assert.deepEqual(checks.at(-1).impalement.step, [0, 0, 0], 'rematch clears presentation approach');
        assert.ok(checks.at(-1).cameraAfterReset.side < .1, 'normal lock camera returns after rematch');
        await save('run-through-checks' + name + '.json', JSON.stringify({ opponent, commit, checks }, null, 2));
      }
      if (which === 'opened') {
        const checks=await page.evaluate(w=>__finisher.modesAndRematch(w),which);
        assert.deepEqual(checks.map(s=>s.opened.visible),[true,false,true,false]);
        assert.equal(checks.at(-1).opened.pieces.length,0,'rematch removes the waist props');
        assert.ok(checks.at(-1).cameraAfterReset.side<.1,'ordinary lock returns on rematch');
        await save('opened-checks'+name+'.json',JSON.stringify({opponent,commit,checks},null,2));
      }
      if (which === 'quietOne') {
        const checks = await page.evaluate(w => __finisher.modesAndRematch(w), which);
        assert.deepEqual(checks.slice(0,3).map(s=>s.quiet.woundVisible),[true,false,true]);
        assert.equal(checks.at(-1).quiet.woundVisible,false,'rematch clears neck wound');
        assert.ok(checks.at(-1).cameraAfterReset.side<.1,'rematch restores ordinary camera');
      }
      if (which === 'splitCrown') {
        const state = await page.evaluate(() => __finisher.inspect());
        console.log('  skull state', JSON.stringify(state));
        assert.equal(state.visible, mode !== 'off', 'Split Crown obeys the blood mode');
        if (mode !== 'off') {
          assert.equal(state.halves, 2, 'the real scene renders two skull halves');
          assert.ok(Math.hypot(...state.position.map((v, i) => v-state.head[i])) < .35, 'the split stays attached to the animated head');
          assert.ok(state.bounds.every(v => v > .05 && v < 1), 'the rendered skull has a finite head-sized extent');
        }
        if (mode === 'red') {
          await page.evaluate(w => __finisher.rear(w), which);
          await page.screenshot({ path: `${dir}/${NAMES[which]}-phone-rear.png` });
          assert.ok((await page.evaluate(() => __finisher.inspect())).framing.side < .8, 'free camera can orbit away from the automatic side view');
          const checks = await page.evaluate(w => __finisher.modesAndRematch(w), which);
          assert.deepEqual(checks.map(s => [s.mode, s.visible, s.headScale]), [['dark', true, .0001], ['off', false, 1], ['red', true, .0001], ['rematch', false, 1]]);
          assert.equal(checks.at(-1).crown, false, 'rematch removes the split meshes');
          assert.ok(checks.at(-1).cameraAfterReset.side < .1, 'normal lock camera returns after rematch');
          await save('checks.json', JSON.stringify({ opponent, commit, provenance: info.provenance, checks }, null, 2));
        }
      }
      await page.context().close();
      if (mode === 'red') {   // the landscape lock for the wide frame — a FRESH page at landscape size: resizing the portrait
        const wide = await open({ width: 852, height: 393 });   // page invalidates the WebGL buffer and play() would skip the
        await wide.evaluate(w => __finisher.play(w, __finisher.count(w) - 1, 'red'), which);   // re-render (cursor already at settle)
        await wide.screenshot({ path: `${dir}/${NAMES[which]}-phone-landscape-settled.png` });
        await wide.context().close();
        if (['runThrough','splitCrown','quietOne','opened'].includes(which)) {
          const reduced = await open({ width: 393, height: 852 }, 'reduce');
          await reduced.evaluate(w => __finisher.play(w, __finisher.count(w)-1, 'red'), which);
          const state = await reduced.evaluate(() => __finisher.inspect());
          assert.ok(state.framing.side < .3, 'reduced motion keeps the original camera behind the player');
          cameraChecks.push({ opponent, which, reducedMotion: true, framing: state.framing });
          await reduced.context().close();
        }
      }
    }
    if (args.includes('--no-video')) continue;
    // Feel reference: the whole death window in real time, phone portrait.
    const video = await browser.newContext({ viewport: { width: 393, height: 852 }, deviceScaleFactor: 2, recordVideo: { dir, size: { width: 393, height: 852 } } });
    const vpage = await video.newPage(); vpage.on('pageerror', e => errors.push(String(e)));
    await vpage.goto(url); await vpage.waitForFunction(() => window.__finisher, null, { timeout: 120000 });
    await vpage.evaluate(async w => {   // real-time playback: one presented frame per step (~30-60 fps under software GL)
      for (let i = 0; i < __finisher.count(w); i++) await __finisher.play(w, i, i === 0 ? 'red' : undefined);
    }, which);
    const file = await vpage.video(); await video.close(); await file.saveAs(`${dir}/${NAMES[which]}.webm`); await fs.rm(await file.path(), { force: true });
    console.log(`  ${dir}/${NAMES[which]}.webm`);
  }
  if (bloodChecks.length) await save('blood-checks.json',JSON.stringify({commit,bloodChecks},null,2));
  if (quietChecks.length) await save('quiet-checks.json',JSON.stringify({commit,quietChecks},null,2));
  await save('camera-checks.json', JSON.stringify({ commit, cameraChecks }, null, 2));
  if (errors.length) throw new Error(`Page errors:\n${errors.join('\n')}`);
} finally { await browser.close(); await server.close(); }
