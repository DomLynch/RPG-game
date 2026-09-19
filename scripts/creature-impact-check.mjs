// Actual simulated hits through the real scene: Skeleton stays dry; its human opponent still bleeds.
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { createServer } from 'vite';
import { chromium } from 'playwright';
import { initialPractice, stepPractice, OPPONENTS } from '../src/combat.ts';

const passive = { reaction: 1e9, accuracy: 0, parry: 0, dodge: 0, aggression: 0, pressure: 0, discipline: 0, lapse: 1 };
const idle = { move: { x: 0, z: 0, yaw: 0, run: false }, action: null, guard: false, held: false, lock: true, cancel: null };
function contact(target, fatal) {
  let practice = initialPractice(731, OPPONENTS.skeleton), lastHit = -1000;
  const initial = practice;
  for (let tick = 0; tick < 7200; tick++) {
    const before = practice, intent = { ...idle };
    const dx = practice.enemy.x - practice.fighter.x, dz = practice.enemy.z - practice.fighter.z;
    const fighter = practice.duel.fighters[0];
    if (fighter.phase === 'sheathed' || fighter.phase === 'draw') intent.action = 'light';
    else if (fighter.phase === 'ready') {
      if (Math.hypot(dx, dz) > 1.9) intent.move = { x: dx, z: dz, yaw: Math.atan2(dx, dz), run: false };
      else if (target === 1 && tick - lastHit > 200) intent.action = 'heavy';
    }
    practice = stepPractice(practice, intent, target === 1 ? passive : OPPONENTS.skeleton.profiles.hard);
    if (practice.events.some(e => e.type === 'Hit' && e.actor === 0)) lastHit = tick;
    if (practice.events.some(e => e.target === target && e.type === (fatal ? 'Killed' : 'Hit'))) return { initial, before, after: practice };
    if (practice.finish) break;
  }
  throw Error(`No real ${fatal ? 'fatal' : 'ordinary'} contact against side ${target}`);
}
const contacts = [contact(1, false), contact(1, true), contact(0, false)];
if (process.argv.includes('--simulation-only')) {
  console.log(JSON.stringify(contacts.map(c => ({ tick: c.after.duel.tick, events: c.after.events }))));
} else {
  const dir = 'artifacts/character/werewolf-skeleton/impacts';
  await fs.mkdir(dir, { recursive: true });
  const server = await createServer({ server: { host: '127.0.0.1', port: 0 } }); await server.listen();
  const origin = `http://127.0.0.1:${server.httpServer.address().port}`;
  const software = process.argv.includes('--software');
  const browser = await chromium.launch({ headless: true, args: software ? ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] : [] });
  const receipt = { software, physicalPhone: false, checks: [], errors: [] };
  try {
    const page = await browser.newPage({ viewport: { width: 852, height: 393 } });
    page.on('pageerror', error => receipt.errors.push(String(error)));
    page.on('console', message => { if (message.type() === 'error' && /shader|WebGL|THREE/.test(message.text())) receipt.errors.push(message.text()); });
    await page.route('**/*sentry.io/**', route => route.abort());
    await page.route(`${origin}/impact-harness*`, route => route.fulfill({ contentType: 'text/html', body: `<style>body{margin:0}canvas{width:100vw;height:100vh}</style><canvas id="world"></canvas><script type="module">
      import {createScene} from '/src/scene.ts';
      const view=createScene(document.querySelector('canvas'),()=>{},new URL(location.href).searchParams.get('opponent') || 'skeleton');
      const render=view.renderer.render.bind(view.renderer);
      view.renderer.render=(scene,camera)=>{window.scene=scene;if(window.present!==false)render(scene,camera)};
      await view.ready; window.view=view;
    </script>` }));
    await page.goto(`${origin}/impact-harness`);
    await page.waitForFunction(() => !!window.view, null, { timeout: 90000 });
    receipt.renderer = await page.evaluate(() => { const gl = window.view.renderer.getContext(), ext = gl.getExtension('WEBGL_debug_renderer_info'); return ext ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) : ''; });
    if (software) assert.match(receipt.renderer, /SwiftShader/i);
    for (const mode of ['red', 'dark', 'off']) for (const [index, frames] of contacts.entries()) {
      const state = await page.evaluate(({ mode, frames }) => {
        const { view } = window;
        view.setBloodMode(mode);
        window.present = false;
        view.render(frames.initial.fighter, true, 0, frames.initial, []);
        // Settle the follow camera at the actual pre-contact state without spending GPU frames.
        for (let frame = 0; frame < 180; frame++) view.render(frames.before.fighter, true, 1 / 60, frames.before, [], true);
        window.present = true;
        view.render(frames.after.fighter, true, 1 / 60, frames.after, frames.after.events);
        const sparks = window.scene.children.find(o => o.isPoints && o.geometry.attributes.position.count === 12);
        const pools = window.scene.children.filter(o => o.isMesh && o.geometry.type === 'PlaneGeometry' && o.geometry.parameters.width === 2 && o.material.map && o.visible);
        return { wounds: [0, 1].map(i => window.scene.getObjectByName(`Wound_${i}`).visible), pools: pools.length, impact: sparks.material.color.getHexString(), blood: view.bloodState() };
      }, { mode, frames });
      const flesh = index === 2 && mode !== 'off';
      assert.deepEqual(state.wounds, [flesh, false], 'only the living player has a bleeding wound');
      assert.equal(state.pools, flesh ? 1 : 0, 'Skeleton never leaves blood splats or a death pool');
      assert.equal(state.impact, flesh ? mode === 'dark' ? '3e2527' : 'a32b27' : 'b1a28a');
      assert.equal(state.blood.emitted, 0, 'unsupported creature finishers never emit wound jets');
      await page.screenshot({ path: `${dir}/${mode}-${['skeleton-hit', 'skeleton-death', 'player-hit'][index]}.png` });
      receipt.checks.push({ mode, contact: index, ...state });
    }
    // Matching arena preview for the other new creature, using its actual simulation and rig.
    let werewolf = initialPractice(731, OPPONENTS.werewolf);
    for (let tick = 0; tick < 120; tick++) werewolf = stepPractice(werewolf, { ...idle, action: werewolf.fighter.phase === 'sheathed' ? 'light' : null }, passive);
    await page.goto(`${origin}/impact-harness?opponent=werewolf`);
    await page.waitForFunction(() => !!window.view, null, { timeout: 90000 });
    for (const viewport of [{ width: 852, height: 393 }, { width: 393, height: 852 }]) {
      await page.setViewportSize(viewport);
      await page.evaluate(p => { window.present = false; for (let i = 0; i < 180; i++) window.view.render(p.fighter, true, 1 / 60, p, [], true); window.present = true; window.view.render(p.fighter, true, 1 / 60, p, []); }, werewolf);
      await page.screenshot({ path: `${dir}/werewolf-${viewport.width}.png` });
    }
    assert.deepEqual(receipt.errors, []); receipt.passed = true;
    console.log('Skeleton and player real-scene impacts PASS in red/dark/off');
  } finally {
    await fs.writeFile(`${dir}/receipt.json`, JSON.stringify(receipt, null, 2));
    await browser.close(); await server.close();
  }
}
