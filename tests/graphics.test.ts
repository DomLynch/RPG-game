import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import ts from 'typescript';
import * as gestures from '../src/gestures.ts';
import * as feedback from '../src/feedback.ts';
import * as sim from '../src/sim.ts';
import * as combat from '../src/combat.ts';
import * as moves from '../src/moves.ts';
const { MOVES } = moves;
import * as profile from '../src/profile.ts';
import * as ladder from '../src/ladder.ts';
import * as trial from '../src/trial.ts';

// Execute the actual entry point with a controllable GPU/clock, keeping real combat and input wiring.
const code = ts.transpileModule(readFileSync(new URL('../src/main.ts', import.meta.url), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
class Element extends EventTarget {
  hidden = false; open = false; value: string | number = ''; textContent = ''; disabled = false;
  style = { props: new Map<string, string>(), setProperty(k: string, v: string) { this.props.set(k, v); }, getPropertyValue(k: string) { return this.props.get(k) ?? ''; } } as { props: Map<string, string>; setProperty(k: string, v: string): void; getPropertyValue(k: string): string; transform?: string }; dataset: Record<string, string> = {}; attributes = new Map<string, string>(); children: Element[] = [];
  setAttribute(key: string, value: string) { this.attributes.set(key, value); }
  append(child: Element) { this.children.push(child); }
  setPointerCapture() {}
  getBoundingClientRect() { return { left: 0, top: 0, width: 108, height: 108 }; }
  click() { this.dispatchEvent(new Event('click')); }
  focus() {} close() { this.open = false; } showModal() { this.open = true; }
}
function boot(profileExtras: Record<string, unknown> = {}) {
  const elements = new Map<string, Element>(), doc = new EventTarget(), win = new EventTarget();
  const element = (id: string) => { if (!elements.has(id)) elements.set(id, new Element()); return elements.get(id)!; };
  let lost = false, loseDuringDraw = true, failDraw = false, failRebuild = false, now = 0, serial = 0, rebuilds = 0, renders = 0, reloads = 0; const replaced: string[] = [];
  const callbacks = new Map<number, (time: number) => void>(), timers = new Map<number, () => void>(), errors: unknown[] = [];
  let rendered: combat.Practice | undefined, renderedBody: { x: number; z: number; heading: number } | undefined, renderedFrozen = false;
  const view = { yaw: 0, recenter() {}, lowerResolution() {}, orbit() {}, renderer: { getContext: () => ({ isContextLost: () => lost }) },
    restoreGraphics() { rebuilds++; if (failRebuild) throw Error('rebuild failed'); },
    render(state: { x: number; z: number; heading: number }, _locked: boolean, _dt: number, practice: combat.Practice, _events?: unknown, frozen = false) { rendered = practice; renderedBody = state; renderedFrozen = frozen; renders++; if (failDraw) { lost = loseDuringDraw; throw Error('shader lost during draw'); } } };
  const stored = new Map<string, string>([['frankendom.fighter.v1', JSON.stringify({ version: 1, id: 'test', name: 'Tester', ...profileExtras })]]);
  const storage = { getItem: (key: string) => stored.get(key) ?? null, setItem: (key: string, value: string) => { stored.set(key, value); } };
  const modules: Record<string, unknown> = { './gestures.ts': gestures, './feedback.ts': feedback, './sim.ts': sim, './combat.ts': combat, './profile.ts': profile, './ladder.ts': ladder, './trial.ts': trial, './moves.ts': moves, './scene.ts': { createScene: (_: unknown, status: (value: string) => void) => { status(''); return view; } }, '@sentry/browser': { captureException: (error: unknown) => errors.push(error) } };
  runInNewContext(code, { require: (id: string) => modules[id] || {}, exports: {}, window: win,
    document: Object.assign(doc, { hidden: false, getElementById: element, createElement: () => new Element() }),
    innerWidth: 375, matchMedia: () => ({ matches: false }), HTMLInputElement: class {}, localStorage: storage, crypto: { randomUUID: () => 'test' }, performance: { now: () => now }, location: { reload: () => reloads++, href: 'https://frankendom.com/?opponent=veteran&debug', replace: (href: string) => { replaced.push(href); } }, URL,
    requestAnimationFrame: (cb: (time: number) => void) => { const id = ++serial; callbacks.set(id, cb); return id; }, cancelAnimationFrame: (id: number) => callbacks.delete(id),
    setTimeout: (cb: () => void) => { const id = ++serial; timers.set(id, cb); return id; }, clearTimeout: (id: number) => timers.delete(id),
  });
  element('welcome').hidden = true;
  return { element, errors, callbacks, timers, storage, window: win, get rendered() { return rendered!; }, get renderedBody() { return renderedBody!; }, get renderedFrozen() { return renderedFrozen; }, get renders() { return renders; }, get rebuilds() { return rebuilds; }, get reloads() { return reloads; }, replaced,
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
    assert.equal(app.element('stamina').value, interrupt ? 100 : 100 - MOVES.light_right.stamina);
  }
});

test('mobile outer-stick sprint stops on cancellation and menu opening pauses combat', () => {
  for (const end of ['pointercancel','menu']) {
    const app=boot();app.tick();
    // Sprint is a deliberate push well past the knob's rim (the stub pad is 108 px: centre 54, rim at 42 px): 120 is 1.57 rims out, 100 only 1.1.
    app.element('joystick').dispatchEvent(Object.assign(new Event('pointerdown'),{pointerId:1,clientX:108,clientY:54}));   // 1.29 rims: past the old 1.15 threshold, short of the deliberate 1.4
    for(let i=0;i<10;i++)app.tick(); assert.equal(app.element('stamina').value,100,'a little past the rim is a walk, not a sprint'); assert.equal(app.element('stick').dataset.run,'false');
    app.element('joystick').dispatchEvent(Object.assign(new Event('pointermove'),{pointerId:1,clientX:120,clientY:54}));
    for(let i=0;i<10;i++)app.tick();
    const spent=app.element('stamina').value as number;assert.ok(spent<100&&spent>95); assert.equal(app.element('stick').dataset.run,'true','the knob shows the sprint');
    if(end==='menu')app.element('journal-button').click();
    else app.element('joystick').dispatchEvent(Object.assign(new Event('pointercancel'),{pointerId:1}));
    // The sprint stopped: no further drain (regeneration resumes at once now that a sprint sets no delay, so the bar may climb).
    for(let i=0;i<10;i++)app.tick();assert.ok((app.element('stamina').value as number)>=spent,'no drain after the sprint ended'); assert.equal(app.element('stick').dataset.run,'false');
    if(end==='menu') { const paused=app.element('stamina').value; app.element('close-journal').click();for(let i=0;i<10;i++)app.tick();assert.ok((app.element('stamina').value as number)>=(paused as number)); }
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
  assert.equal(app.element('stamina').value,100-MOVES.thrust.stamina,'one upward flick is one thrust');assert.equal(app.rendered.duel.fighters[0].move,'thrust');
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
  assert.equal(JSON.parse(app.storage.getItem('frankendom.controls.v1')!).scheme, 'flick'); app.element('controls-mode').click(); app.tick();
  // v7 guard ring: the same verbs as the cluster (Slash, Stab shown) in the ring geometry; then back to the cluster.
  assert.equal(actions.dataset.gestures, 'ring'); assert.equal(app.element('controls-mode').textContent, 'Controls: guard ring · v7'); assert.equal(thrust.hidden, false, 'Stab is a ring button too'); assert.equal(app.element('attack-button').dataset.mobile, 'Slash');
  app.element('controls-mode').click(); app.tick();   // → ring8 (v8)
  // v8 guard ring: one strike circle owns every attack — no Heavy or Stab buttons; then back to the cluster.
  assert.equal(actions.dataset.gestures, 'ring8'); assert.equal(app.element('controls-mode').textContent, 'Controls: guard ring · v8');
  assert.equal(thrust.hidden, true, 'v8: Stab is a flick, not a button'); assert.equal(app.element('heavy-button').hidden, true, 'v8: no Heavy button');
  assert.equal(app.element('attack-button').dataset.mobile, 'Strike');
  app.element('controls-mode').click(); app.tick(); assert.equal(actions.dataset.gestures, 'cluster');
});

test('guard ring v8: the strike circle owns every attack — a tap slashes as the thumb lifts, a flick up stabs, holding loads the heavy', () => {
  const app = boot(); app.tick(); app.key('KeyF'); for (let i = 0; i < 45; i++) app.tick();
  const me = () => app.rendered.duel.fighters[0];
  const at = (type: string, x: number, y: number, id = 9) => Object.assign(new Event(type, { cancelable: true }), { pointerId: id, button: 0, clientX: x, clientY: y });
  const settle = () => { for (let i = 0; i < 900 && !(me().phase === 'ready' && !app.rendered.threat && !app.rendered.enemyAttacking && me().stamina > 60); i++) app.tick(); };
  for (let i = 0; i < 3; i++) { app.element('controls-mode').click(); app.tick(); }
  assert.equal(app.element('actions').dataset.gestures, 'ring8');
  const strike = app.element('attack-button');
  settle(); strike.dispatchEvent(at('pointerdown', 0, 0)); strike.dispatchEvent(at('pointerup', 0, 0)); app.tick();
  assert.ok(me().move?.startsWith('light'), `a quick tap is the slash, got ${me().move}`);
  settle(); strike.dispatchEvent(at('pointerdown', 0, 0)); strike.dispatchEvent(at('pointermove', 0, -40)); app.tick();
  assert.equal(me().move, 'thrust', 'a flick up is the stab');
  strike.dispatchEvent(at('pointerup', 0, -40));
  settle(); strike.dispatchEvent(at('pointerdown', 0, 0));
  const arm = [...app.timers.values()].pop(); assert.ok(arm, 'holding arms a pending heavy'); app.timers.clear(); arm();
  app.tick();
  assert.equal(me().move, 'heavy_overhead', 'the loaded heavy');
  for (let i = 0; i < 16; i++) app.tick();
  assert.ok(me().charge >= 1, `keeping it held starts the charge (charge ${me().charge})`);
  strike.dispatchEvent(at('pointerup', 0, 0));
});


test('the scorecard tallies fights, wins, rematches and damage per scheme', () => {
  const app = boot(); app.tick(); app.key('KeyF'); for (let i = 0; i < 45; i++) app.tick();
  for (let i = 0; i < 6000 && !app.rendered.finish; i++) app.tick();   // stand still until the warden wins
  assert.ok(app.rendered.finish, 'the fight ends'); const card = () => JSON.parse(app.storage.getItem('frankendom.controls.v1')!).card.cluster;
  assert.equal(card().fights, 1); assert.equal(card().wins, 0); assert.equal(card().taken, moves.RULES.health); assert.ok(card().ticks > 600);
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
  app.key('KeyE'); app.lose(); app.restore();
  let rolled = false; for (let i = 0; i < 20; i++) { app.tick(); rolled ||= app.rendered.duel.fighters[0].phase === 'roll'; }   // the fighter's phase, not the bar: the warden may have wounded the ceiling by now
  assert.ok(!rolled, 'a graphics interruption releases the held control before it can roll');
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

test('the stick never stays pushed: a release delivered outside the pad, a touchend with no fingers, or a new touch all clear it', () => {
  const app = boot(); app.tick(); app.key('KeyF'); for (let i = 0; i < 45; i++) app.tick();
  const joystick = app.element('joystick'), stick = app.element('stick'), win = app.window;
  const at = (type: string, x: number, y: number, id = 2) => Object.assign(new Event(type, { cancelable: true }), { pointerId: id, button: 0, clientX: x, clientY: y });
  const pushed = () => stick.style.transform !== '';
  // Lost capture: the finger leaves the pad and the browser delivers pointerup to whatever is under it (here, the window).
  joystick.dispatchEvent(at('pointerdown', 20, 54)); assert.equal(pushed(), true);
  win.dispatchEvent(at('pointerup', 300, 300)); assert.equal(pushed(), false, 'a pointerup anywhere releases the stick');
  // iOS: pointerup never arrives but touchend says no fingers remain.
  joystick.dispatchEvent(at('pointerdown', 20, 54, 3)); assert.equal(pushed(), true);
  win.dispatchEvent(Object.assign(new Event('touchend'), { touches: [] })); assert.equal(pushed(), false, 'touchend with no touches releases the stick');
  // A stuck id must not lock the pad: a new touch takes it over and its own release clears it.
  joystick.dispatchEvent(at('pointerdown', 20, 54, 4)); joystick.dispatchEvent(at('pointerdown', 88, 54, 5)); assert.equal(pushed(), true);
  joystick.dispatchEvent(at('pointerup', 88, 54, 5)); assert.equal(pushed(), false, 'the newest touch owns the stick');
});

test('the HUD shows both posture bars and flags a bar near breaking', () => {
  const app = boot(); app.tick(); app.key('KeyF'); for (let i = 0; i < 45; i++) app.tick();
  const mine = app.element('posture'), theirs = app.element('target-posture');
  assert.equal(Number(mine.value), 0); assert.equal(Number(theirs.value), 0); assert.equal(mine.dataset.critical, 'false');
  // Land lights until the warden's bar has moved (the harness warden blocks or takes them; either fills it).
  for (let i = 0; i < 2400 && Number(theirs.value) === 0; i++) { if (app.rendered.finish) { app.element('reset-button').click(); app.tick(); app.key('KeyF'); for (let k = 0; k < 45; k++) app.tick(); } if (app.rendered.duel.fighters[0].phase === 'ready') app.key('KeyF'); app.tick(); }
  assert.ok(Number(theirs.value) > 0, `warden posture ${theirs.value}`);
  assert.equal(theirs.style.getPropertyValue('--fill'), `${Number(theirs.value)}%`);
  assert.equal(theirs.dataset.critical, String(Number(theirs.value) >= 70));
  // Keep cutting (blocked cuts fill the warden's bar, parried ones fill ours) until either bar is near breaking: the HUD must flag that bar.
  let flagged: Element | null = null;
  for (let i = 0; i < 6000 && !flagged; i++) {
    if (app.rendered.finish) { app.element('reset-button').click(); app.tick(); app.key('KeyF'); for (let k = 0; k < 45; k++) app.tick(); }
    if (app.rendered.duel.fighters[0].phase === 'ready') app.key('KeyF'); app.tick();
    if (Number(mine.value) >= 70) flagged = mine; else if (Number(theirs.value) >= 70) flagged = theirs;
  }
  assert.ok(flagged, `a bar reached 70 %: own ${mine.value}, warden ${theirs.value}`); assert.equal(flagged!.dataset.critical, 'true', 'a bar at 70 % or more is flagged');
  assert.equal(mine.dataset.critical, String(Number(mine.value) >= 70)); assert.equal(theirs.dataset.critical, String(Number(theirs.value) >= 70));
});

test('hit-stop: every contact freezes the simulation for exactly ceil(ms / 17) frames (+ the frame that resumes) while frames keep rendering; heavier contacts stop longer; ticks are never skipped', () => {
  const app = boot(); app.tick(); app.key('KeyF'); for (let i = 0; i < 45; i++) app.tick();
  const tickOf = () => app.rendered.duel.tick, me = () => app.rendered.duel.fighters[0];
  const EXPECT: Record<string, number> = { Blocked: 30, Hit: 50, Parried: 70, GuardBroken: 90, PostureBroken: 120, 'heavy Hit': 90, 'heavy Blocked': 50 };
  const heavyMove = (e: { move?: string; charged?: boolean }) => e.charged || ['heavy_overhead', 'heavy_riposte', 'heavy_counter', 'critical'].includes(e.move ?? '');
  const kind = (e: { type: string; move?: string; charged?: boolean }) => e.type === 'Hit' && heavyMove(e) ? 'heavy Hit' : e.type === 'Blocked' && heavyMove(e) ? 'heavy Blocked' : e.type;
  // Both fighters' contacts count. The player spams cuts; the warden answers with blocks, parries and its own heavies.
  const measured: Record<string, number[]> = {};
  let needTick = true;
  for (let frame = 0; frame < 6000 && !((measured['Hit']?.length ?? 0) >= 2 && (measured['heavy Hit']?.length ?? 0) >= 2 && (measured['heavy Blocked']?.length ?? 0) >= 1); frame++) {
    const hitsDone = (measured['Hit']?.length ?? 0) >= 2 && (measured['heavy Hit']?.length ?? 0) >= 2;   // then hold guard so a warden heavy is blocked
    if (needTick) { if (hitsDone) app.key('KeyQ'); else if (me().phase === 'ready' && !app.rendered.finish) app.key('KeyF'); app.tick(); }
    needTick = true;
    if (app.rendered.finish) { app.element('reset-button').click(); app.tick(); app.key('KeyF'); for (let i = 0; i < 45; i++) app.tick(); continue; }
    const contacts = app.rendered.events.filter(e => e.type in EXPECT); if (!contacts.length) continue;
    const longest = contacts.map(kind).sort((a, b) => EXPECT[b] - EXPECT[a])[0];
    const at = tickOf(), renders = app.renders; let frozen = 0;
    while (tickOf() === at && frozen < 40) { app.tick(); frozen++; }
    assert.ok(app.renders > renders, 'frames were rendered during the stop');
    (measured[longest] ??= []).push(frozen);
    needTick = false;   // the frame that resumed may itself carry the next contact: examine it before ticking again
  }
  // The loop counts the frame on which the tick finally moves too, hence + 1.
  for (const [type, frames] of Object.entries(measured)) for (const f of frames) assert.equal(f, Math.ceil(EXPECT[type] / 17) + 1, `${type}: ${f} frames on the contact tick for a ${EXPECT[type]} ms stop`);
  assert.ok((measured['Hit']?.length ?? 0) >= 2 && (measured['heavy Hit']?.length ?? 0) >= 2 && (measured['heavy Blocked']?.length ?? 0) >= 1, `measured ${JSON.stringify(measured)}`);
  // Long frames (a phone dropping to 20 fps steps three ticks per frame) must still end on the contact tick, or the frozen pose is never shown.
  // Holding guard is a level, so the same fight unfolds tick for tick whatever the frame length; every contact tick must be rendered in both.
  const contactsRendered = (frameMs: number) => {
    const a = boot(); a.tick(); a.key('KeyF'); for (let i = 0; i < 45; i++) a.tick(); a.key('KeyQ');
    const ticks = new Set<number>(); let guard = 0, biggestJump = 0, prev = a.rendered.duel.tick;
    while (a.rendered.duel.tick < 1500 && guard++ < 6000) { a.tick(frameMs); const t = a.rendered.duel.tick; biggestJump = Math.max(biggestJump, t - prev); prev = t; if (a.rendered.events.some(e => e.type in EXPECT)) ticks.add(t); }
    return { ticks, biggestJump };
  };
  const smooth = contactsRendered(17), dropped = contactsRendered(51);
  assert.ok(smooth.ticks.size >= 3, `contacts in 1500 ticks: ${smooth.ticks.size}`); assert.deepEqual([...dropped.ticks], [...smooth.ticks], 'every contact tick is the last tick of its frame, even at three ticks per frame');
  // A 17 ms frame legitimately steps 2 ticks now and then (17 > 16.67) and a 51 ms frame 4; a stop that left time in the accumulator would add a whole tick or two on top.
  assert.ok(smooth.biggestJump <= 2 && dropped.biggestJump <= 4, `no catch-up jump after a stop: ${smooth.biggestJump} / ${dropped.biggestJump} ticks in one frame`);
  // Determinism: the freeze delays wall-clock only; quiet frames map one to one onto ticks.
  for (let i = 0; i < 200 && (app.rendered.threat || me().phase !== 'ready'); i++) app.tick();
  const before = tickOf(); let quiet = 0; for (let i = 0; i < 30; i++) { app.tick(17); if (!app.rendered.events.some(e => e.type in EXPECT)) quiet++; }
  assert.ok(tickOf() - before >= quiet - 1, `${quiet} quiet frames advanced ${tickOf() - before} ticks`);
});

test('the Kick button says when the warden is inside its cone', () => {
  const app = boot(); app.tick(); app.key('KeyF'); for (let i = 0; i < 45; i++) app.tick();
  const kick = app.element('kick-button'), gap = () => Math.hypot(app.rendered.fighter.x - app.rendered.enemy.x, app.rendered.fighter.z - app.rendered.enemy.z);
  const seen = new Set<string>();
  for (let i = 0; i < 1500; i++) { app.tick(); seen.add(kick.dataset.reach); assert.equal(kick.dataset.reach, String(gap() <= 1.5), `reach flag follows the gap (${gap().toFixed(2)})`); }
  assert.deepEqual([...seen].sort(), ['false', 'true'], 'both states occur in a fight');
});

test('a cancelled touch withdraws its press even after the simulation has buffered it, and never another control\'s press', () => {
  const app = boot(); app.tick(); app.key('KeyF'); for (let i = 0; i < 45; i++) app.tick();
  const me = () => app.rendered.duel.fighters[0];
  const press = (el: Element, type: string, id = 6) => el.dispatchEvent(Object.assign(new Event(type, { cancelable: true }), { pointerId: id, button: 0, clientX: 0, clientY: 0 }));
  const settle = () => { for (let i = 0; i < 900 && !(me().phase === 'ready' && !app.rendered.threat && !app.rendered.enemyAttacking && me().stamina > 60); i++) app.tick(); };
  // Light, then press Heavy late in its recovery (inside the buffer window), tick so the sim buffers it, then cancel the Heavy touch: no heavy follows.
  // Inside the buffer window at the end of the cut (a cut thrown inside a chain window uses the shorter chained timing).
  const late = () => { const t = me().chained ? MOVES.light_right.chained! : MOVES.light_right; return t.windup + t.active + t.recovery - 8; };
  settle(); app.key('KeyF'); app.tick(); assert.ok(me().move?.startsWith('light_'));
  for (let i = 0, n = late(); i < n; i++) app.tick(); press(app.element('heavy-button'), 'pointerdown'); app.tick(); assert.ok(me().buffer?.action === 'heavy', `buffered: ${JSON.stringify(me().buffer)}`);
  press(app.element('heavy-button'), 'pointercancel'); for (let i = 0; i < 20; i++) app.tick();
  assert.notEqual(me().move, 'heavy_overhead', 'the cancelled heavy never started'); assert.equal(me().buffer, null);
  // Same, but the cancel comes from an unrelated control: the buffered heavy survives.
  settle(); app.key('KeyF'); app.tick(); for (let i = 0, n = late(); i < n; i++) app.tick(); press(app.element('heavy-button'), 'pointerdown'); app.tick(); assert.equal(me().buffer?.action, 'heavy');
  press(app.element('kick-button'), 'pointercancel', 7); for (let i = 0; i < 20; i++) app.tick(); assert.equal(me().move, 'heavy_overhead', 'another control\'s cancel does not touch it');
});

test('hit-stop presentation: the frozen frames show the contact tick itself (bodies and a frozen flag for the renderer), the frame that outlives the pause carries its remainder into the next tick, and the journal toggle turns the pause off and remembers it', () => {
  const app = boot(); app.tick(); app.key('KeyF'); for (let i = 0; i < 45; i++) app.tick();
  const tickOf = () => app.rendered.duel.tick, me = () => app.rendered.duel.fighters[0];
  const CONTACT = new Set(['Blocked', 'Hit', 'Parried', 'GuardBroken', 'PostureBroken', 'Killed']);
  // Stand and get hit: a blow's knockback moves the struck body on the contact tick itself, so a frame that blended back toward the tick before would show a different position.
  let struck = false, before = app.rendered.fighter;
  for (let frame = 0; frame < 6000 && !struck; frame++) {
    before = app.rendered.fighter; app.tick();
    if (app.rendered.finish) { app.element('reset-button').click(); app.tick(); app.key('KeyF'); for (let i = 0; i < 45; i++) app.tick(); continue; }
    if (app.rendered.events.some(e => (e.type === 'Hit' || e.type === 'GuardBroken') && e.target === 0)) struck = true;
  }
  assert.ok(struck, 'the player was struck');
  const at = tickOf(), body = app.rendered.fighter;
  assert.ok(Math.hypot(body.x - before.x, body.z - before.z) > .01, 'the blow moved the body on the contact tick');
  assert.equal(app.renderedFrozen, true, 'the contact frame is rendered frozen');
  assert.deepEqual([app.renderedBody.x, app.renderedBody.z], [body.x, body.z], 'the contact frame shows the contact tick\'s body, not the tick before');
  // Until the tick moves every frame shows the contact body; the frozen flag holds while pause time remains (the frame that spends the last of it renders unfrozen with the same body).
  let frozenFrames = 0, flagged = 0; while (tickOf() === at && frozenFrames < 40) { app.tick(); if (tickOf() === at) { frozenFrames++; if (app.renderedFrozen) flagged++; assert.deepEqual([app.renderedBody.x, app.renderedBody.z], [body.x, body.z], 'every frozen frame shows the same contact body'); } }
  assert.ok(frozenFrames >= 1 && flagged >= frozenFrames - 1, `frozen for ${frozenFrames} frames, flagged ${flagged}`); assert.equal(app.renderedFrozen, false, 'the resuming frame is not frozen');
  // Overshoot: a 50 ms Hit stop under 40 ms frames — the second frame spends the last 10 ms of the pause and its remaining 30 ms steps a tick in the same frame.
  const hitAt = (frameMs: number) => {
    const a = boot(); a.tick(); a.key('KeyF'); for (let i = 0; i < 45; i++) a.tick();
    for (let frame = 0; frame < 6000; frame++) {
      if (a.rendered.duel.fighters[0].phase === 'ready' && !a.rendered.finish) a.key('KeyF'); a.tick();
      if (a.rendered.finish) { a.element('reset-button').click(); a.tick(); a.key('KeyF'); for (let i = 0; i < 45; i++) a.tick(); continue; }
      const kinds = a.rendered.events.filter(e => CONTACT.has(e.type));
      if (kinds.length === 1 && kinds[0].type === 'Hit' && kinds[0].move !== 'heavy_overhead' && !kinds[0].charged && kinds[0].move !== 'critical' && kinds[0].move !== 'heavy_riposte' && kinds[0].move !== 'heavy_counter') { const t = a.rendered.duel.tick, frames: number[] = []; for (let f = 1; f <= 4; f++) { a.tick(frameMs); frames.push(a.rendered.duel.tick - t); } return frames; }
    }
    throw Error('no plain hit found');
  };
  assert.deepEqual(hitAt(40), [0, 1, 4, 6], 'frame 2 ends the 50 ms pause with 30 ms to spare and steps one tick (13 ms carried); then 53 ms = 3 ticks, 43 ms = 2 — without the carry it would read 0, 0, 2, 4');
  // Toggle: off means no pause at all (contacts tick straight through), the label flips, and the choice survives a reload.
  app.element('hitstop-mode').click();
  assert.equal(app.element('hitstop-mode').textContent, 'Hit-stop: off'); assert.equal(app.storage.getItem('frankendom.hitstop.v1'), 'off');
  let paused = 0, contacts = 0;
  for (let frame = 0; frame < 3000 && contacts < 3; frame++) {
    if (me().phase === 'ready' && !app.rendered.finish) app.key('KeyF'); const t = tickOf(); app.tick();
    if (app.rendered.finish) { app.element('reset-button').click(); app.tick(); app.key('KeyF'); for (let i = 0; i < 45; i++) app.tick(); continue; }
    if (app.rendered.events.some(e => CONTACT.has(e.type))) { contacts++; const c = tickOf(); app.tick(); if (tickOf() === c) paused++; assert.equal(app.renderedFrozen, false); }
    void t;
  }
  assert.ok(contacts >= 3, `contacts seen with the pause off: ${contacts}`); assert.equal(paused, 0, 'no contact froze the simulation');
  const again = boot(); again.storage.setItem('frankendom.hitstop.v1', 'off');
  const reloaded = boot(); void again; assert.equal(reloaded.element('hitstop-mode').textContent, 'Hit-stop: on', 'a fresh store starts on');
});

test('controls pass: Slash held chambers the cut, a held strike dragged off its circle becomes a guard press (feint in the window), the held level belongs to its own control, and Step rolls at once when the stick is deflected', () => {
  const app = boot(); app.tick(); app.key('KeyF'); for (let i = 0; i < 45; i++) app.tick();
  const me = () => app.rendered.duel.fighters[0], light = MOVES.light_right;
  const at = (type: string, x: number, y: number, id = 6) => Object.assign(new Event(type, { cancelable: true }), { pointerId: id, button: 0, clientX: x, clientY: y });
  const settle = () => { for (let i = 0; i < 900 && !(me().phase === 'ready' && !app.rendered.threat && !app.rendered.enemyAttacking && me().stamina > 60 && !me().exposed); i++) app.tick(); };
  const slash = app.element('attack-button'), heavy = app.element('heavy-button'), step = app.element('dodge-button'), joystick = app.element('joystick');
  // Slash held: the cut parks at its chamber (charge counts) while the thumb stays down; release lets it fly.
  settle(); slash.dispatchEvent(at('pointerdown', 54, 54)); app.tick(); assert.ok(me().move?.startsWith('light_'), `a cut: ${me().move}`);   // cuts alternate sides
  for (let i = 0; i < light.chamber! + 6; i++) app.tick();
  assert.ok(me().charge >= 4 && me().age === light.chamber, `a held Slash parks at its chamber: age ${me().age}, held ${me().charge}`);
  slash.dispatchEvent(at('pointerup', 54, 54)); for (let i = 0; i < 4; i++) app.tick(); assert.ok(me().age > light.chamber, 'released, the cut continues');
  // Drag-off feint: Slash pressed, thumb slides off the circle inside the feint window → the swing is abandoned into a guard press; the guard stays up until the thumb lifts.
  settle(); slash.dispatchEvent(at('pointerdown', 54, 54, 7)); app.tick(); assert.ok(me().move?.startsWith('light_'));
  app.tick(); slash.dispatchEvent(at('pointermove', 54, 54, 7)); app.tick(); assert.equal(me().phase, 'attack', 'moving inside the circle changes nothing');
  slash.dispatchEvent(at('pointermove', 200, 54, 7)); app.tick();
  assert.equal(me().phase, 'guard', 'off the circle: the cut is feinted into a guard'); assert.ok(app.rendered.events.some(e => e.type === 'ActionStarted' && e.action === 'feint') || me().parrying, 'as a feint');
  for (let i = 0; i < 20; i++) app.tick(); assert.equal(me().phase, 'guard', 'the guard is held while the thumb stays down off the circle');
  slash.dispatchEvent(at('pointerup', 200, 54, 7)); for (let i = 0; i < 3; i++) app.tick(); assert.notEqual(me().phase, 'guard', 'lifting the thumb drops the guard');
  // Held ownership: Heavy held and Slash tapped — releasing Slash must not drop Heavy's charge.
  settle(); heavy.dispatchEvent(at('pointerdown', 54, 54, 8)); app.tick(); assert.equal(me().move, 'heavy_overhead');
  slash.dispatchEvent(at('pointerdown', 54, 54, 9)); slash.dispatchEvent(at('pointerup', 54, 54, 9));
  for (let i = 0; i < MOVES.heavy_overhead.chamber! + 8; i++) app.tick();
  assert.ok(me().charge >= 6 && me().age === MOVES.heavy_overhead.chamber, `the heavy is still charging after another control's release: age ${me().age}, held ${me().charge}`);
  heavy.dispatchEvent(at('pointerup', 54, 54, 8)); for (let i = 0; i < 40; i++) app.tick();
  // Step with the stick deflected rolls on the press itself (no 150 ms wait); with a neutral stick a tap is still a backstep.
  settle(); joystick.dispatchEvent(at('pointerdown', 20, 54, 2)); app.tick();
  step.dispatchEvent(at('pointerdown', 54, 54, 10)); app.tick(); assert.equal(me().phase, 'roll', 'deflected stick: the press rolls at once');
  step.dispatchEvent(at('pointerup', 54, 54, 10)); app.window.dispatchEvent(at('pointerup', 300, 300, 2)); for (let i = 0; i < 60; i++) app.tick();
  settle(); step.dispatchEvent(at('pointerdown', 54, 54, 11)); app.tick(); assert.equal(me().phase, 'backstep', 'neutral stick: a tap backsteps'); step.dispatchEvent(at('pointerup', 54, 54, 11));
});

test('tempo: the 50 Hz toggle steps the same simulation a fifth slower in wall-clock (17 ms frames advance ~50 ticks a second instead of ~60), is remembered, and hit-stop stays in milliseconds', () => {
  const app = boot(); app.tick(); app.key('KeyF'); for (let i = 0; i < 45; i++) app.tick();
  const tickOf = () => app.rendered.duel.tick;
  const perSecond = () => { const t = tickOf(); for (let i = 0; i < 60; i++) app.tick(1000 / 60); return tickOf() - t; };
  assert.equal(app.element('tempo-mode').textContent, 'Tempo: 60 Hz');
  const at60 = perSecond(); assert.ok(at60 >= 58 && at60 <= 61, `60 Hz: ${at60} ticks in a second`);
  app.element('tempo-mode').click();
  assert.equal(app.element('tempo-mode').textContent, 'Tempo: 50 Hz'); assert.equal(app.storage.getItem('frankendom.tempo.v1'), '50');
  const at50 = perSecond(); assert.ok(at50 >= 48 && at50 <= 51, `50 Hz: ${at50} ticks in a second`);
  // Ticks are the sim's own clock: the fight is identical, only slower. A contact still stops for its ms, not its ticks.
  app.element('tempo-mode').click(); assert.equal(app.element('tempo-mode').textContent, 'Tempo: 60 Hz'); assert.equal(app.storage.getItem('frankendom.tempo.v1'), '60');
});

test('the ladder: saved progress picks the opponent and labels him; a loss offers a rematch, not the next rung, and never reloads', () => {
  const app = boot({ id: 'tester-0001', ladder: 'pitborn' }); app.tick();   // a valid id: the harness default 'test' fails the profile's 8-char rule and boots a fresh guest
  assert.equal(app.rendered.enemyMaxHealth, 190, 'the Pitborn stands opposite (his health, not a man\'s)');
  assert.equal(app.element('opponent-name').textContent, 'THE PITBORN');
  app.key('KeyF'); for (let i = 0; i < 6000 && !app.rendered.finish; i++) app.tick();   // stand still until he wins
  assert.ok(app.rendered.finish && app.rendered.finish.victim === 0, 'the player fell');
  assert.equal(app.element('reset-button').textContent, 'Rematch');
  app.element('reset-button').click(); app.tick();
  assert.equal(app.reloads, 0, 'a rematch stays on the same rig'); assert.equal(app.rendered.enemyMaxHealth, 190);
  assert.equal(JSON.parse(app.storage.getItem('frankendom.fighter.v1')!).ladder, 'pitborn', 'progress is untouched by a loss');
});

test('the ladder: the first rung is the Veteran and his label stays the warden', () => {
  const app = boot(); app.tick();
  assert.equal(app.rendered.enemyMaxHealth, 150); assert.equal(app.element('opponent-name').textContent, '');
  assert.equal(JSON.parse(app.storage.getItem('frankendom.fighter.v1')!).ladder, undefined);
});

test('the journal opponent picker lists the ladder, shows the current rung, and a pick saves the rung and reloads without the URL override', () => {
  const app = boot({ id: 'tester-0001', ladder: 'goblin' }); app.tick();
  const select = app.element('opponent-select');
  assert.deepEqual(select.children.map(o => o.value), ['veteran', 'pitborn', 'goblin', 'nightborn']);
  assert.equal(select.value, 'goblin', 'the picker shows the rung this device is on');
  select.value = 'nightborn'; select.dispatchEvent(new Event('change')); app.tick();
  assert.equal(JSON.parse(app.storage.getItem('frankendom.fighter.v1')!).ladder, 'nightborn', 'the pick is saved as the rung');
  assert.equal(app.replaced.length, 1, 'one navigation'); assert.ok(!app.replaced[0].includes('opponent='), `the URL override is dropped: ${app.replaced[0]}`); assert.ok(app.replaced[0].includes('debug'), 'other query flags survive');
  select.value = 'cyclops'; select.dispatchEvent(new Event('change')); app.tick();
  assert.equal(app.replaced.length, 1, 'an unknown value does nothing'); assert.equal(JSON.parse(app.storage.getItem('frankendom.fighter.v1')!).ladder, 'nightborn');
});
