import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import ts from 'typescript';
import * as gestures from '../src/gestures.ts';
import * as feedback from '../src/feedback.ts';
import * as sim from '../src/sim.ts';
import * as combat from '../src/combat.ts';
import { MOVES } from '../src/moves.ts';
import * as profile from '../src/profile.ts';
import * as trial from '../src/trial.ts';

// Execute the actual entry point with a controllable GPU/clock, keeping real combat and input wiring.
const code = ts.transpileModule(readFileSync(new URL('../src/main.ts', import.meta.url), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
class Element extends EventTarget {
  hidden = false; open = false; value: string | number = ''; textContent = ''; disabled = false;
  style = { setProperty() {} }; dataset = {}; attributes = new Map<string, string>(); children: Element[] = [];
  setAttribute(key: string, value: string) { this.attributes.set(key, value); }
  append(child: Element) { this.children.push(child); }
  setPointerCapture() {}
  getBoundingClientRect() { return { left: 0, top: 0, width: 108, height: 108 }; }
  click() { this.dispatchEvent(new Event('click')); }
  focus() {} close() { this.open = false; } showModal() { this.open = true; }
}
function boot() {
  const elements = new Map<string, Element>(), doc = new EventTarget(), win = new EventTarget();
  const element = (id: string) => { if (!elements.has(id)) elements.set(id, new Element()); return elements.get(id)!; };
  let lost = false, loseDuringDraw = true, failDraw = false, failRebuild = false, now = 0, serial = 0, rebuilds = 0, renders = 0, reloads = 0;
  const callbacks = new Map<number, (time: number) => void>(), timers = new Map<number, () => void>(), errors: unknown[] = [];
  let rendered: combat.Practice | undefined;
  const view = { yaw: 0, recenter() {}, lowerResolution() {}, orbit() {}, renderer: { getContext: () => ({ isContextLost: () => lost }) },
    restoreGraphics() { rebuilds++; if (failRebuild) throw Error('rebuild failed'); },
    render(_state: unknown, _locked: boolean, _dt: number, practice: combat.Practice) { rendered = practice; renders++; if (failDraw) { lost = loseDuringDraw; throw Error('shader lost during draw'); } } };
  const stored = new Map<string, string>([['frankendom.fighter.v1', JSON.stringify({ version: 1, id: 'test', name: 'Tester' })]]);
  const storage = { getItem: (key: string) => stored.get(key) ?? null, setItem: (key: string, value: string) => { stored.set(key, value); } };
  const modules: Record<string, unknown> = { './gestures.ts': gestures, './feedback.ts': feedback, './sim.ts': sim, './combat.ts': combat, './profile.ts': profile, './trial.ts': trial, './scene.ts': { createScene: (_: unknown, status: (value: string) => void) => { status(''); return view; } }, '@sentry/browser': { captureException: (error: unknown) => errors.push(error) } };
  runInNewContext(code, { require: (id: string) => modules[id] || {}, exports: {}, window: win,
    document: Object.assign(doc, { hidden: false, getElementById: element, createElement: () => new Element() }),
    innerWidth: 375, matchMedia: () => ({ matches: false }), HTMLInputElement: class {}, localStorage: storage, crypto: { randomUUID: () => 'test' }, performance: { now: () => now }, location: { reload: () => reloads++ },
    requestAnimationFrame: (cb: (time: number) => void) => { const id = ++serial; callbacks.set(id, cb); return id; }, cancelAnimationFrame: (id: number) => callbacks.delete(id),
    setTimeout: (cb: () => void) => { const id = ++serial; timers.set(id, cb); return id; }, clearTimeout: (id: number) => timers.delete(id),
  });
  element('welcome').hidden = true;
  return { element, errors, callbacks, timers, storage, get rendered() { return rendered!; }, get renders() { return renders; }, get rebuilds() { return rebuilds; }, get reloads() { return reloads; },
    tick(ms = 17) { now += ms; const pending = [...callbacks.values()]; callbacks.clear(); for (const cb of pending) cb(now); },
    key(code: string) { win.dispatchEvent(Object.assign(new Event('keydown', { cancelable: true }), { code, repeat: false })); },
    release(code: string) { win.dispatchEvent(Object.assign(new Event('keyup', { cancelable: true }), { code })); },
    lose() { lost = true; const event = new Event('webglcontextlost', { cancelable: true }); element('world').dispatchEvent(event); assert.ok(event.defaultPrevented); },
    restore() { lost = false; failDraw = false; element('world').dispatchEvent(new Event('webglcontextrestored')); },
    failDraw(lose = true) { failDraw = true; loseDuringDraw = lose; }, failRebuild() { failRebuild = true; },
  };
}
test('graphics restoration resumes one loop, clears inputs and preserves the current fight', () => {
  const app = boot(); app.tick(); app.key('KeyF'); app.tick();
  const before = app.element('target-health').value;
  app.lose(); assert.equal(app.callbacks.size, 0); assert.equal(app.element('attack-button').attributes.get('aria-disabled'), 'true');
  app.key('KeyF'); app.key('KeyE'); app.key('KeyQ'); app.tick(60000);
  assert.equal(app.element('target-health').value, before);
  app.restore(); assert.equal(app.callbacks.size, 1); assert.equal(app.rebuilds, 1); assert.equal(app.timers.size, 0); assert.equal(app.element('message').hidden, true);
  app.tick(); assert.match(app.element('combat-status').textContent, /Drawing/); // No minute of simulation catch-up.
  for (let i = 0; i < 37; i++) app.tick();
  assert.match(app.element('combat-status').textContent, /Drawing/);
  for (let i = 0; i < 8; i++) app.tick();
  assert.equal(app.element('stamina').value, 100); assert.equal(app.element('guard-button').attributes.get('aria-pressed'), 'false');
  assert.equal(app.element('target-health').value, before);
  app.restore(); assert.equal(app.callbacks.size, 1); assert.equal(app.rebuilds, 1);
});
test('a shader error during context loss pauses and then recovers rather than killing the loop', () => {
  const app = boot(); app.failDraw(); assert.doesNotThrow(() => app.tick());
  assert.equal(app.callbacks.size, 0); assert.equal(app.timers.size, 1);
  app.restore(); app.tick(); assert.equal(app.callbacks.size, 1); assert.equal(app.errors.length, 0);
});
test('unrestored or failed graphics have a manual reload path, with real failures reported', () => {
  const app = boot(); app.lose();
  for (const callback of app.timers.values()) callback();
  const button = app.element('message').children.at(-1)!; assert.equal(button.textContent, 'Reload game'); button.dispatchEvent(new Event('click')); assert.equal(app.reloads, 1);
  app.failRebuild(); app.restore(); assert.equal(app.callbacks.size, 0); assert.equal(app.errors.length, 1); assert.equal(app.element('message').hidden, false);
});
test('repeated and reordered GPU events never multiply the animation loop or recovery timer', () => {
  const app = boot();
  for (let i = 0; i < 100; i++) {
    app.lose(); app.lose(); assert.equal(app.timers.size, 1); assert.equal(app.callbacks.size, 0);
    app.restore(); app.restore(); app.tick(); assert.equal(app.callbacks.size, 1); assert.equal(app.timers.size, 0);
  }
  assert.equal(app.rebuilds, 100);
});

test('ordinary render failures are not swallowed as recoverable GPU loss', () => {
  const app = boot(); app.failDraw(false);
  assert.throws(() => app.tick(), /shader lost during draw/);
  assert.equal(app.timers.size, 0);
});

test('a late draw press buffers one attack, and focus loss cancels it', () => {
  for (const interrupt of [false, true]) {
    const app = boot(); app.tick(); app.key('KeyF'); app.tick();
    for (let i = 0; i < 35; i++) app.tick();
    app.key('KeyF');
    if (interrupt) { app.lose(); app.restore(); }
    for (let i = 0; i < 14; i++) app.tick();
    assert.equal(app.element('stamina').value, interrupt ? 100 : 80);
  }
});

test('mobile outer-stick sprint stops on cancellation and menu opening pauses combat', () => {
  for (const end of ['pointercancel','menu']) {
    const app=boot();app.tick();
    app.element('joystick').dispatchEvent(Object.assign(new Event('pointerdown'),{pointerId:1,clientX:106,clientY:54}));
    for(let i=0;i<10;i++)app.tick();
    const spent=app.element('stamina').value as number;assert.ok(spent<100&&spent>95);
    if(end==='menu')app.element('journal-button').click();
    else app.element('joystick').dispatchEvent(Object.assign(new Event('pointercancel'),{pointerId:1}));
    for(let i=0;i<10;i++)app.tick();assert.equal(app.element('stamina').value,spent);
    if(end==='menu') { app.element('close-journal').click();for(let i=0;i<10;i++)app.tick();assert.equal(app.element('stamina').value,spent); }
  }
});
test('menu sound and camera controls stay synchronized with desktop controls', () => {
  const app=boot();app.element('mobile-sound').click();
  assert.equal(app.element('sound-button').textContent,'Sound off');
  app.element('sound-button').click();assert.equal(app.element('mobile-sound').textContent,'Sound on');
  app.element('mobile-camera').click();assert.equal(app.element('camera-button').attributes.get('aria-pressed'),'false');
  app.element('camera-button').click();assert.equal(app.element('mobile-camera').attributes.get('aria-pressed'),'true');
});

test('swipe trial fires once per gesture and clears on cancellation, pause and mode change', () => {
  const app=boot();app.tick();app.element('controls-mode').click();
  const pad=app.element('gesture-pad');
  const pointer=(type:string,x:number,y:number,id=1)=>pad.dispatchEvent(Object.assign(new Event(type,{cancelable:true}),{pointerId:id,button:0,clientX:x,clientY:y}));
  pointer('pointerdown',60,60);app.tick();pointer('pointerup',60,60);
  for(let i=0;i<45;i++)app.tick();
  assert.equal(app.element('stamina').value,100);
  pointer('pointerdown',60,60);pointer('pointermove',60,20);pointer('pointermove',60,0);app.tick();
  assert.equal(app.element('stamina').value,75,'one upward flick is one thrust');assert.equal(app.rendered.duel.fighters[0].move,'thrust');
  for(let i=0;i<12;i++)app.tick();assert.ok(app.rendered.duel.fighters[0].age>MOVES.thrust.chamber!,'v1 flick never chambers even while the thumb stays down');
  pointer('pointercancel',60,0);for(let i=0;i<80;i++)app.tick();
  app.element('reset-button').click();app.tick();app.key('KeyF');for(let i=0;i<45;i++)app.tick();
  pointer('pointerdown',60,60);pointer('pointermove',100,60);pointer('pointercancel',100,60);app.tick();
  assert.equal(app.element('stamina').value,100,'cancelled queued gesture cannot attack');
  pointer('pointerdown',60,60);app.element('journal-button').click();pointer('pointermove',100,60);app.tick();
  assert.equal(app.element('stamina').value,100);
  app.element('controls-mode').click();app.element('close-journal').click();pointer('pointermove',120,60);app.tick();
  assert.equal(app.element('stamina').value,100);
});


test('the thumb cluster is the mobile layout: round buttons incl. a Stab button that thrusts and holds; Controls swaps to the flick disc and back', () => {
  const app = boot(); app.tick(); app.key('KeyF'); for (let i = 0; i < 45; i++) app.tick();
  const me = () => app.rendered.duel.fighters[0], actions = app.element('actions');
  const press = (el: Element, type: string, id = 5) => el.dispatchEvent(Object.assign(new Event(type, { cancelable: true }), { pointerId: id, button: 0, clientX: 0, clientY: 0 }));
  const settle = () => { for (let i = 0; i < 900 && !(me().phase === 'ready' && !app.rendered.threat && !app.rendered.enemyAttacking && me().stamina > 60); i++) app.tick(); };
  assert.equal(app.element('controls-mode').textContent, 'Controls: thumb cluster'); assert.equal(actions.dataset.gestures, 'cluster');
  const thrust = app.element('thrust-button'); assert.equal(thrust.hidden, false); assert.equal(app.element('attack-button').dataset.mobile, 'Slash'); assert.equal(app.element('kick-button').hidden, false);
  settle(); press(thrust, 'pointerdown'); app.tick(); assert.equal(me().move, 'thrust');
  for (let i = 0; i < 12; i++) app.tick(); assert.equal(me().age, MOVES.thrust.chamber!, 'held Stab loads the thrust'); press(thrust, 'pointerup'); for (let i = 0; i < 4; i++) app.tick(); assert.ok(me().age > MOVES.thrust.chamber!, 'released, it goes');
  app.element('controls-mode').click(); app.tick(); assert.equal(app.element('controls-mode').textContent, 'Controls: weapon disc · flick'); assert.equal(actions.dataset.gestures, 'flick'); assert.equal(thrust.hidden, true, 'Stab is a cluster button');
  assert.equal(JSON.parse(app.storage.getItem('frankendom.controls.v1')!).scheme, 'flick'); app.element('controls-mode').click(); app.tick(); assert.equal(actions.dataset.gestures, 'cluster');
});


test('the scorecard tallies fights, wins, rematches and damage per scheme', () => {
  const app = boot(); app.tick(); app.key('KeyF'); for (let i = 0; i < 45; i++) app.tick();
  for (let i = 0; i < 6000 && !app.rendered.finish; i++) app.tick();   // stand still until the warden wins
  assert.ok(app.rendered.finish, 'the fight ends'); const card = () => JSON.parse(app.storage.getItem('frankendom.controls.v1')!).card.cluster;
  assert.equal(card().fights, 1); assert.equal(card().wins, 0); assert.equal(card().taken, 100); assert.ok(card().ticks > 600);
  app.element('reset-button').click(); app.tick(); assert.equal(card().rematches, 1); assert.equal(card().fights, 1, 'a rematch is not a fight until it ends');
  app.element('journal-button').click(); assert.match(app.element('scorecard').textContent, /^thumb cluster — 1 fights · 0 won · 1 rematches/);
});

test('dodge control: a tap is an instant backstep, a hold grows it into a roll, and interruption releases it', () => {
  const app = boot(); app.tick(); app.key('KeyF'); for (let i = 0; i < 45; i++) app.tick();
  assert.equal(app.element('stamina').value, 100);
  app.key('KeyE'); app.tick(); app.release('KeyE');
  assert.equal(app.element('stamina').value, 90, 'the press itself is a backstep');
  for (let i = 0; i < 60; i++) app.tick();
  assert.ok(app.element('stamina').value >= 90, 'a released tap never becomes a roll');
  for (let i = 0; i < 120; i++) app.tick();
  app.key('KeyE'); for (let i = 0; i < 12; i++) app.tick();
  assert.ok(app.element('stamina').value <= 70.5, `holding past 150 ms rolled: ${app.element('stamina').value}`);
  app.release('KeyE'); for (let i = 0; i < 200; i++) app.tick();
  app.key('KeyE'); app.lose(); app.restore(); for (let i = 0; i < 20; i++) app.tick();
  assert.ok(app.element('stamina').value >= 90 - 1e-9, 'a graphics interruption releases the held control before it can roll');
});

test('heavy control: a held key charges the swing and release lets it fly', () => {
  const app = boot(); app.tick(); app.key('KeyF'); for (let i = 0; i < 45; i++) app.tick();
  app.key('KeyG'); for (let i = 0; i < 30; i++) app.tick();
  const me = () => app.rendered.duel.fighters[0];
  assert.equal(me().move, 'heavy_overhead'); assert.ok(me().charge > 0, `holding G charges: charge=${me().charge}`); assert.equal(me().age, 10, 'the wind-up holds at the charge point');
  app.release('KeyG'); for (let i = 0; i < 6; i++) app.tick();
  assert.ok(me().age > 10, 'released: the swing continues');
  // A quick press is a plain heavy: released before the charge point, it never holds.
  for (let i = 0; i < 80; i++) app.tick();
  app.key('KeyG'); for (let i = 0; i < 4; i++) app.tick(); app.release('KeyG'); for (let i = 0; i < 12; i++) app.tick();
  assert.equal(me().move, 'heavy_overhead'); assert.equal(me().charge, 0, 'a tap never charges'); assert.ok(me().age > 10);
});

test('kick input spends once and clears on pointer cancellation or graphics interruption',()=>{
 for(const cancel of ['none','pointercancel','graphics']){
  const app=boot();app.tick();app.key('KeyF');for(let i=0;i<45;i++)app.tick();
  app.element('kick-button').dispatchEvent(Object.assign(new Event('pointerdown',{cancelable:true}),{button:0,pointerId:1}));
  if(cancel==='pointercancel')app.element('kick-button').dispatchEvent(new Event('pointercancel'));
  if(cancel==='graphics'){app.lose();app.restore();}
  app.tick();assert.equal(app.element('stamina').value,cancel==='none'?75:100);
  app.tick();assert.equal(app.element('stamina').value,cancel==='none'?75:100);
 }
});

test('the first match meets the fixed warden and every rematch a differently seeded one', () => {
  const app = boot(); app.tick(); app.key('KeyF'); app.tick();
  assert.equal(app.rendered.ai.seed, 731, 'the browser gate relies on the first warden');
  app.element('reset-button').click(); app.tick(); const second = app.rendered.ai.seed;
  app.element('reset-button').click(); app.tick(); const third = app.rendered.ai.seed;
  assert.ok(second !== 731 && third !== second, `seeds 731 → ${second} → ${third}`);
});

test('a tap that ends before the next tick still lands: only pointercancel withdraws a queued press (lostpointercapture follows every pointerup)', () => {
  const app = boot(); app.tick(); app.key('KeyF'); for (let i = 0; i < 45; i++) app.tick();
  const me = () => app.rendered.duel.fighters[0];
  const press = (el: Element, type: string, x = 0, y = 0, id = 8) => el.dispatchEvent(Object.assign(new Event(type, { cancelable: true }), { pointerId: id, button: 0, clientX: x, clientY: y }));
  const tap = (el: Element, x = 0, y = 0) => { press(el, 'pointerdown', x, y); press(el, 'pointerup', x, y); press(el, 'lostpointercapture', x, y); };
  const settle = () => { for (let i = 0; i < 900 && !(me().phase === 'ready' && !app.rendered.threat && !app.rendered.enemyAttacking && me().stamina > 60); i++) app.tick(); };
  settle(); tap(app.element('heavy-button')); app.tick(); assert.equal(me().move, 'heavy_overhead', 'a same-frame heavy tap lands'); for (let i = 0; i < 70; i++) app.tick();
  settle(); tap(app.element('dodge-button')); app.tick(); assert.equal(me().phase, 'backstep', 'a same-frame step tap lands'); for (let i = 0; i < 20; i++) app.tick();
  settle(); tap(app.element('guard-button')); app.tick(); assert.equal(me().phase, 'guard', 'a same-frame guard tap opens the parry window'); assert.equal(me().parrying, true); for (let i = 0; i < 40; i++) app.tick();
  settle(); tap(app.element('thrust-button')); app.tick(); assert.equal(me().move, 'thrust', 'a same-frame Stab tap lands'); for (let i = 0; i < 50; i++) app.tick();
  app.element('controls-mode').click(); app.tick();   // the flick disc
  const pad = app.element('gesture-pad'); settle(); press(pad, 'pointerdown', 60, 60); press(pad, 'pointermove', 60, 20); press(pad, 'pointerup', 60, 20); press(pad, 'lostpointercapture', 60, 20); app.tick();
  assert.equal(me().move, 'thrust', 'a same-frame flick lands'); for (let i = 0; i < 50; i++) app.tick();
  settle(); press(pad, 'pointerdown', 60, 60); press(pad, 'pointermove', 100, 60); press(pad, 'pointercancel', 100, 60); app.tick(); assert.notEqual(me().phase, 'attack', 'a cancelled pointer withdraws the press');
});
