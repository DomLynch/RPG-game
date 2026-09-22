import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import ts from 'typescript';
import * as feedback from '../src/feedback.ts';
import * as sim from '../src/sim.ts';
import * as combat from '../src/combat.ts';
import * as moves from '../src/moves.ts';
const { MOVES } = moves;
import * as profile from '../src/profile.ts';
import * as ladder from '../src/ladder.ts';
import * as roster from '../src/roster.ts';
import * as trial from '../src/trial.ts';
import * as record from '../src/record.ts';
import * as loot from '../src/loot.ts';
import * as replay from '../src/replay.ts';
import * as shareStore from '../src/share-store.ts';
import * as ai from '../src/ai.ts';
import * as autopsyModule from '../src/autopsy.ts';
import * as daily from '../src/daily.ts';
// The daily's server call and the build's API are stubbed per test: the harness has no network and no env.
const dailyModule: Record<string, unknown> = { ...daily }, apiModule: { api: { url: string; key: string } | null } = { api: null };
import { session } from '../src/session.ts';
import * as career from '../src/career.ts';
import * as scorecard from '../src/scorecard.ts';
import * as hud from '../src/hud.ts';
import * as input from '../src/input.ts';

// Execute the actual entry point with a controllable GPU/clock, keeping real combat and input wiring.
const code = ts.transpileModule(readFileSync(new URL('../src/main.ts', import.meta.url), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
class Element extends EventTarget {
  hidden = false; open = false; value: string | number = ''; textContent = ''; disabled = false;
  style = { props: new Map<string, string>(), setProperty(k: string, v: string) { this.props.set(k, v); }, getPropertyValue(k: string) { return this.props.get(k) ?? ''; } } as { props: Map<string, string>; setProperty(k: string, v: string): void; getPropertyValue(k: string): string; transform?: string }; dataset: Record<string, string> = {}; attributes = new Map<string, string>(); children: Element[] = [];
  setAttribute(key: string, value: string) { this.attributes.set(key, value); }
  className = ''; classList = { set: new Set<string>(), toggle(name: string, force?: boolean) { const on = force ?? !this.set.has(name); if (on) this.set.add(name); else this.set.delete(name); return on; }, contains(name: string) { return this.set.has(name); } };
  append(...nodes: Element[]) { this.children.push(...nodes); }
  replaceChildren(...nodes: Element[]) { this.children = nodes; }
  setPointerCapture() {}
  getBoundingClientRect() { return { left: 0, top: 0, width: 108, height: 108 }; }
  click() { this.dispatchEvent(new Event('click')); }
  focus() {} close() { this.open = false; } showModal() { this.open = true; }
}
function boot(profileExtras: Record<string, unknown> = {}, initializationError?: Error, seed: Record<string, string> = {}, search = '') {
  const elements = new Map<string, Element>(), doc = new EventTarget(), win = Object.assign(new EventTarget(), { location: { search } });   // window.location.search is what main.ts reads for ?opponent / ?replay / ?debug
  const element = (id: string) => { if (!elements.has(id)) elements.set(id, new Element()); return elements.get(id)!; };
  let lost = false, loseDuringDraw = true, failDraw = false, failRebuild = false, now = 0, serial = 0, rebuilds = 0, renders = 0, reloads = 0; const replaced: string[] = [];
  const callbacks = new Map<number, (time: number) => void>(), timers = new Map<number, () => void>(), errors: unknown[] = [];
  let rendered: combat.Practice | undefined, renderedBody: { x: number; z: number; heading: number } | undefined, renderedFrozen = false;
  let report: (value: string, kind: 'loading' | 'ready' | 'failed') => void = () => {}, retries = 0;
  const view = { yaw: 0, recenter() {}, stopTour() {}, lowerResolution() {}, orbit() {}, previousFinisher: () => null, finishPhase: () => ({ settled: false, touring: false, age: 0 }), fallenRect: () => null as { x: number; y: number; w: number; h: number } | null, worn: [] as string[], wear(ids: string[]) { view.worn = ids; }, retryArt() { retries++; report('Loading warriors…', 'loading'); return Promise.resolve(); }, renderer: { getContext: () => ({ isContextLost: () => lost }) },
    restoreGraphics() { rebuilds++; if (failRebuild) throw Error('rebuild failed'); },
    render(state: { x: number; z: number; heading: number }, _locked: boolean, _dt: number, practice: combat.Practice, _events?: unknown, frozen = false) { rendered = practice; renderedBody = state; renderedFrozen = frozen; renders++; if (failDraw) { lost = loseDuringDraw; throw Error('shader lost during draw'); } } };
  const stored = new Map<string, string>([['frankendom.fighter.v1', JSON.stringify({ version: 1, id: 'harness-fighter', name: 'Tester', ...profileExtras })], ...Object.entries(seed)]);
  const storage = { getItem: (key: string) => stored.get(key) ?? null, setItem: (key: string, value: string) => { stored.set(key, value); } };
  const modules: Record<string, unknown> = { './feedback.ts': feedback, './sim.ts': sim, './combat.ts': combat, './profile.ts': profile, './ladder.ts': ladder, './roster.ts': roster, './trial.ts': trial, './record.ts': record, './loot.ts': loot, './replay.ts': replay, './share-store.ts': shareStore, './session.ts': { session }, './ai.ts': ai, './autopsy.ts': autopsyModule, './daily.ts': dailyModule, './api.ts': apiModule, './career.ts': career, './scorecard.ts': scorecard, './hud.ts': hud, './input.ts': input, './moves.ts': moves, './scene.ts': { createScene: (_: unknown, status: (value: string, kind: 'loading' | 'ready' | 'failed') => void) => { if (initializationError) throw initializationError; report = status; status('', 'ready'); return view; } }, '@sentry/browser': { captureException: (error: unknown) => errors.push(error) } };
  runInNewContext(code, { require: (id: string) => modules[id] || {}, exports: {}, window: win, Event,
    document: Object.assign(doc, { hidden: false, getElementById: element, createElement: () => new Element(), createTextNode: (text: string) => Object.assign(new Element(), { textContent: text }) }),
    innerWidth: 375, matchMedia: () => ({ matches: false }), HTMLInputElement: class {}, localStorage: storage, crypto: { randomUUID: () => 'test' }, performance: { now: () => now }, location: { reload: () => reloads++, href: 'https://frankendom.com/?opponent=veteran&debug', search, origin: 'https://frankendom.com', replace: (href: string) => { replaced.push(href); } }, URL,
    requestAnimationFrame: (cb: (time: number) => void) => { const id = ++serial; callbacks.set(id, cb); return id; }, cancelAnimationFrame: (id: number) => callbacks.delete(id),
    setTimeout: (cb: () => void) => { const id = ++serial; timers.set(id, cb); return id; }, clearTimeout: (id: number) => timers.delete(id),
  });
  element('welcome').hidden = true;
  return { element, errors, callbacks, timers, storage, window: win, document: doc, get worn() { return [...view.worn]; }, report: (value: string, kind: 'loading' | 'ready' | 'failed') => report(value, kind), get retries() { return retries; }, get rendered() { return rendered!; }, get renderedBody() { return renderedBody!; }, get renderedFrozen() { return renderedFrozen; }, get renders() { return renders; }, get rebuilds() { return rebuilds; }, get reloads() { return reloads; }, replaced,
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

test('the thumb cluster is the one mobile layout: round buttons incl. a Stab button that thrusts and holds', () => {
  const app = boot(); app.tick(); app.key('KeyF'); for (let i = 0; i < 45; i++) app.tick();
  const me = () => app.rendered.duel.fighters[0];
  const press = (el: Element, type: string, id = 5) => el.dispatchEvent(Object.assign(new Event(type, { cancelable: true }), { pointerId: id, button: 0, clientX: 0, clientY: 0 }));
  const settle = () => { for (let i = 0; i < 900 && !(me().phase === 'ready' && !app.rendered.threat && !app.rendered.enemyAttacking && me().stamina > 60); i++) app.tick(); };
  const thrust = app.element('thrust-button'); assert.equal(thrust.hidden, false); assert.equal(app.element('attack-button').dataset.mobile, 'Slash'); assert.equal(app.element('kick-button').hidden, false);
  settle(); press(thrust, 'pointerdown'); app.tick(); assert.equal(me().move, 'thrust'); assert.equal(thrust.dataset.held, '', 'data-held lights the ring while Stab is down');
  const kick = app.element('kick-button'); press(kick, 'pointerdown', 6); assert.equal(kick.dataset.held, ''); press(kick, 'pointerup', 6); assert.equal(kick.dataset.held, undefined, 'Kick: held for the press only');
  for (let i = 0; i < 12; i++) app.tick(); assert.equal(me().age, MOVES.thrust.chamber!, 'held Stab loads the thrust'); press(thrust, 'pointerup'); assert.equal(thrust.dataset.held, undefined, 'lifted: the ring goes back to rest'); for (let i = 0; i < 4; i++) app.tick(); assert.ok(me().age > MOVES.thrust.chamber!, 'released, it goes');
});

test('the scorecard tallies fights, wins, rematches and damage', () => {
  const app = boot(); app.tick(); app.key('KeyF'); for (let i = 0; i < 45; i++) app.tick();
  for (let i = 0; i < 6000 && !app.rendered.finish; i++) app.tick();   // stand still until the warden wins
  assert.ok(app.rendered.finish, 'the fight ends'); const card = () => JSON.parse(app.storage.getItem('frankendom.controls.v1')!).card;
  assert.equal(card().fights, 1); assert.equal(card().wins, 0); assert.equal(card().taken, moves.RULES.health); assert.ok(card().ticks > 600);
  app.element('reset-button').click(); app.tick(); assert.equal(card().rematches, 1); assert.equal(card().fights, 1, 'a rematch is not a fight until it ends');
  app.element('journal-button').click(); assert.match(app.element('scorecard').textContent, /^1 fights · 0 won · 1 rematches/);
});

test('guard side: a slide on the Guard button or Q + an arrow sets the guard direction the simulation sees; lifting resets it', () => {
  const app = boot(); app.tick(); app.key('KeyF'); for (let i = 0; i < 45; i++) app.tick();
  const me = () => app.rendered.duel.fighters[0], guardButton = app.element('guard-button');
  const at = (type: string, x: number, y: number, id = 7) => Object.assign(new Event(type, { cancelable: true }), { pointerId: id, button: 0, clientX: x, clientY: y });
  const settle = () => { for (let i = 0; i < 900 && !(me().phase === 'ready' && !app.rendered.threat && !app.rendered.enemyAttacking && me().stamina > 60); i++) app.tick(); };
  settle(); guardButton.dispatchEvent(at('pointerdown', 100, 100)); guardButton.dispatchEvent(at('pointermove', 60, 104)); app.tick();
  assert.equal(guardButton.dataset.side, 'left'); assert.equal(me().phase, 'guard'); assert.equal(me().guardDirection, 'left', 'the press carries the side the thumb slid to');
  guardButton.dispatchEvent(at('pointerup', 60, 104)); assert.equal(guardButton.dataset.side, 'straight', 'lifting resets the side');
  for (let i = 0; i < 40; i++) app.tick();
  settle(); guardButton.dispatchEvent(at('pointerdown', 100, 100)); guardButton.dispatchEvent(at('pointermove', 104, 100)); app.tick();
  assert.equal(me().guardDirection, null, 'a small wobble is still the straight guard'); guardButton.dispatchEvent(at('pointerup', 104, 100));
  for (let i = 0; i < 40; i++) app.tick();
  settle(); const x = me().body.x, z = me().body.z; app.key('KeyQ'); app.key('ArrowUp'); app.tick();
  assert.equal(me().guardDirection, 'overhead', 'Q + an arrow is that side'); assert.deepEqual([me().body.x, me().body.z], [x, z], 'the arrow picks the side, it does not walk');
  assert.equal(guardButton.dataset.side, 'overhead', 'the button\'s side hint follows the keyboard guard too');
  app.release('ArrowUp'); app.release('KeyQ'); for (let i = 0; i < 40; i++) app.tick();
  assert.equal(guardButton.dataset.side, 'straight', 'released: the hint shows straight again');
  app.key('ArrowUp'); for (let i = 0; i < 5; i++) app.tick(); assert.notEqual(me().body.z, z, 'without Q the arrow walks as before'); app.release('ArrowUp');
});

test('frame clock: a backward or absurd timestamp jump is a resync, never negative fight time — the simulation keeps stepping right after it', () => {
  const app = boot(); app.tick(); app.key('KeyF'); for (let i = 0; i < 30; i++) app.tick();
  const tick = () => app.rendered.duel.tick, before = tick();
  app.tick(-90000);   // the frame clock jumps 90 s backward (a fake clock installed under the page, a frozen timeline)
  for (let i = 0; i < 6; i++) app.tick();
  assert.ok(tick() > before, `six normal frames after a backward jump advance the fight: ${before} → ${tick()}`);
  const mid = tick(); app.tick(600000);   // ten minutes forward: a stall, not absence — at most one tenth of a second of fight
  assert.ok(tick() - mid <= 7, `a forward stall injects at most 0.1 s of fight: +${tick() - mid} ticks`);
  const after = tick(); for (let i = 0; i < 12; i++) app.tick(); assert.ok(tick() - after >= 8, `and the fight goes on normally after it: +${tick() - after} ticks in 12 frames`);
});

test('dodge control: a tap is an instant backstep, a hold grows it into a roll, and interruption releases it', () => {
  const app = boot(); app.tick(); app.key('KeyF'); for (let i = 0; i < 45; i++) app.tick();
  assert.equal(app.element('stamina').value, 100);
  app.key('KeyE'); app.tick(); app.release('KeyE');
  assert.equal(app.element('stamina').value, 90, 'the press itself is a backstep');
  for (let i = 0; i < 60; i++) app.tick();
  assert.ok(Number(app.element('stamina').value) >= 90, 'a released tap never becomes a roll');
  for (let i = 0; i < 120; i++) app.tick();
  app.key('KeyE'); for (let i = 0; i < 12; i++) app.tick();
  assert.ok(Number(app.element('stamina').value) <= 70.5, `holding past 150 ms rolled: ${app.element('stamina').value}`);
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
    if (needTick) { if (hitsDone) { app.key('KeyQ'); app.key('ArrowUp'); } else if (me().phase === 'ready' && !app.rendered.finish) app.key('KeyF'); app.tick(); }   // Q + up: the overhead guard that meets a heavy (directional guard)
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
  assert.deepEqual(select.children.map(o => o.value), ['veteran', 'pitborn', 'goblin', 'nightborn', 'executioner', 'dwarf'], 'live rungs only: held Season 2 creatures are not offered');
  assert.equal(select.value, 'goblin', 'the picker shows the rung this device is on');
  select.value = 'nightborn'; select.dispatchEvent(new Event('change')); app.tick();
  assert.equal(JSON.parse(app.storage.getItem('frankendom.fighter.v1')!).ladder, 'nightborn', 'the pick is saved as the rung');
  assert.equal(app.replaced.length, 1, 'one navigation'); assert.ok(!app.replaced[0].includes('opponent='), `the URL override is dropped: ${app.replaced[0]}`); assert.ok(app.replaced[0].includes('debug'), 'other query flags survive');
  select.value = 'cyclops'; select.dispatchEvent(new Event('change')); app.tick();
  assert.equal(app.replaced.length, 1, 'an unknown value does nothing'); assert.equal(JSON.parse(app.storage.getItem('frankendom.fighter.v1')!).ladder, 'nightborn');
});

test('graphics startup preserves the original failure and stack for monitoring', () => {
  const failure = new Error('GPU allocation failed');
  assert.throws(() => boot({}, failure), error => error === failure);
});

test('the identity aside shows the career rank from the saved mark count at boot', () => {
  const app = boot({ id: 'tester-1234', career: { victoryMarks: 32 } });   // the harness default id 'test' is shorter than a real guest id, so the saved profile is discarded on load
  assert.equal(app.element('rank').textContent, 'Gladiator I · ● ● ○ ○ ○');
  assert.equal(app.element('rank-sigil').textContent, 'I');
  assert.equal(boot().element('rank').textContent, 'Recruit I · ○ ○ ○');
});

test('the journal test tools stay hidden without ?debug; the roster flag is the account module\'s to set', () => {
  const app = boot();
  assert.equal(app.element('test-tools').hidden, true);
  assert.equal(app.element('test-tools').dataset.debug, undefined);
  assert.equal(app.element('opponent-select').hidden, false);
});
test('the versus card: the fight waits behind it with the buttons asleep, and it lifts the moment the rigs land with the fight on at once', () => {
  const app = boot(), versus = app.element('versus'), still = app.element('versus-still'), attack = () => app.element('attack-button').attributes.get('aria-disabled');
  app.report('Loading warriors…', 'loading'); versus.hidden = true; delete versus.dataset.out;   // the harness boots with the rigs in; back into the download
  still.dispatchEvent(new Event('load'));                       // the still arrives before the rigs: the card shows and the fight waits
  assert.equal(versus.hidden, false); assert.equal(attack(), 'true', 'buttons asleep behind the card');
  app.tick(); app.key('KeyF'); app.tick(); app.tick();
  assert.equal(app.rendered.duel.tick, 0, 'no sim ticks behind the card');
  app.report('', 'ready');                                       // the rigs are in
  assert.equal(versus.dataset.out, 'true', 'the card lifts at once'); assert.equal(app.timers.size, 0, 'no hold timer');
  assert.equal(attack(), 'false', 'buttons wake as the card lifts');
  app.tick(); app.tick(); assert.ok(app.rendered.duel.tick > 0, 'the fight runs once the card lifts');
});
test('the versus card: a display-text change alone never lifts the card — only the machine-readable kind does', () => {
  // Regression for the audit finding (2026-09-22): the hide condition used to compare the display string against the literal
  // 'Loading warriors\u2026', so any future in-progress status LINE (a download-stage message, say) would have lifted the card
  // early and shown the capsule stand-ins. main.ts now keys off scene.ts's explicit kind ('loading' | 'ready' | 'failed');
  // the display text is free to change without touching that contract.
  const app = boot(), versus = app.element('versus'), still = app.element('versus-still');
  app.report('Loading warriors…', 'loading'); versus.hidden = true; delete versus.dataset.out;
  still.dispatchEvent(new Event('load'));
  assert.equal(versus.hidden, false);
  app.report('Fetching textures…', 'loading');   // a differently worded in-progress line, still kind 'loading'
  assert.equal(versus.hidden, false, 'a re-worded in-progress status must not lift the card');
  assert.notEqual(versus.dataset.out, 'true');
  app.report('', 'ready');
  assert.equal(versus.dataset.out, 'true', 'the ready kind still lifts it');
});
test('the versus card: a load failure also lifts it, so the retry banner stays readable', () => {
  const app = boot(), versus = app.element('versus'), still = app.element('versus-still');
  app.report('Loading warriors…', 'loading'); versus.hidden = true; delete versus.dataset.out;
  still.dispatchEvent(new Event('load'));
  assert.equal(versus.hidden, false);
  app.report('Warrior art could not load. Movement still works; tap here to retry.', 'failed');
  assert.equal(versus.dataset.out, 'true', 'a failure lifts the card so the notice is readable');
});
test('every fight is recorded in memory: the record finishes on the kill with the seed and outcome, a rematch starts a fresh one, and a mid-fight warden change drops it', () => {
  const app = boot(); app.tick(); app.key('KeyF'); for (let i = 0; i < 45; i++) app.tick();
  for (let i = 0; i < 6000 && !app.rendered.finish; i++) app.tick();
  assert.ok(app.rendered.finish, 'the fight ends');
  assert.match(app.element('debug').dataset.record ?? '', /^\d{3,}\/died\/731$/, 'first fight: seed 731, hundreds of ticks, the player died');
  app.element('reset-button').click(); app.tick(); app.key('KeyF'); for (let i = 0; i < 45; i++) app.tick();
  app.element('difficulty').click();   // mid-fight change: this fight is not replayable
  for (let i = 0; i < 6000 && !app.rendered.finish; i++) app.tick();
  assert.ok(app.rendered.finish); assert.match(app.element('debug').dataset.record ?? '', /\/731$/, 'no new record: the dataset still shows the first fight');
});
test('kill links: a finished fight offers Share; the link replays the same fight tick for tick with the buttons asleep and nothing scored; Avenge him starts a live practice fight on the same seed that never touches the card', async () => {
  // The record encodes and decodes through CompressionStream off the main turn: wait for the thing itself (up to 2 s on a slow runner), never a fixed number of turns.
  const settle = async (ready: () => boolean) => { for (let i = 0; i < 400 && !ready(); i++) await new Promise((r) => setTimeout(r, 5)); };
  const a = boot(); a.tick(); a.key('KeyF'); for (let i = 0; i < 45; i++) a.tick();
  for (let i = 0; i < 6000 && !a.rendered.finish; i++) a.tick();
  assert.ok(a.rendered.finish, 'fight A ends');
  assert.equal(a.element('share-button').hidden, false, 'Share appears on the death screen');
  await settle(() => !!a.element('debug').dataset.share);
  const text = a.element('debug').dataset.share as string | undefined;
  assert.ok(text && /^[A-Za-z0-9_-]+$/.test(text), 'the encoded record is exposed for the gates');
  const ticksA = a.rendered.duel.tick, finishA = a.rendered.finish!, cardA = a.storage.getItem('frankendom.controls.v1');
  // B opens the link with nothing saved: no welcome, a replay banner, buttons asleep, the same fight.
  const b = boot({}, undefined, {}, `?opponent=veteran&replay=${text}`);
  b.tick();   // a frame lands before the record has decoded (the browser's rAF beats the async decode): it must not mark a fight
  assert.equal(b.storage.getItem('frankendom.fight.v1'), null, 'no AFK mark while the link is still decoding');
  const cardBefore = b.storage.getItem('frankendom.scorecard.v1');
  await settle(() => b.element('replay-banner').textContent !== 'Loading the fight…');   // the record decodes asynchronously
  assert.equal(b.element('welcome').hidden, true, 'no welcome on a replay link');
  assert.equal(b.element('replay-banner').hidden, false); assert.match(b.element('replay-banner').textContent, /^Replay/);
  assert.equal(b.element('attack-button').attributes.get('aria-disabled'), 'true', 'buttons asleep during a replay');
  b.tick();
  for (let i = 0; i < 6000 && !b.rendered.finish; i++) b.tick();
  assert.ok(b.rendered.finish, 'the replay reaches the finish');
  assert.equal(b.rendered.duel.tick, ticksA, 'same final tick as the recorded fight');
  assert.deepEqual(b.rendered.finish, finishA, 'same finish');
  assert.equal(b.storage.getItem('frankendom.controls.v1'), null, 'a replay writes nothing to the card');
  assert.ok(!b.storage.getItem('frankendom.fight.v1'), 'a watched fight is never marked as walked away from (the viewer\'s next boot would score a loss)');
  assert.equal(b.storage.getItem('frankendom.scorecard.v1'), cardBefore, 'a replay scores nothing');
  assert.equal(b.element('reset-button').textContent, 'Avenge him');
  assert.equal(b.element('share-button').hidden, true, 'a replay is not re-shared from the viewer');
  // Avenge him: live, same seed, practice only.
  b.element('reset-button').click(); b.tick();
  assert.equal(b.element('replay-banner').hidden, true);
  assert.equal(b.element('attack-button').attributes.get('aria-disabled'), 'false', 'the avenging fight is live');
  b.key('KeyF'); for (let i = 0; i < 45; i++) b.tick();
  for (let i = 0; i < 6000 && !b.rendered.finish; i++) b.tick();
  assert.ok(b.rendered.finish, 'the avenging fight ends');
  assert.equal(b.rendered.duel.tick, ticksA, 'standing still on the same seed meets the same warden: same ending tick');
  assert.equal(b.storage.getItem('frankendom.controls.v1'), null, 'practice only: still nothing on the card');
  assert.equal(b.element('reset-button').textContent, 'Rematch', 'after avenging, a plain rematch, never the next rung');
  assert.equal(b.element('share-button').hidden, false, 'the avenging fight itself can be shared');
  assert.ok(cardA, 'the original fight was scored on A');
});
test('kill links: a link for another opponent than the page booted, or a broken record, is refused with a banner and no fight is stepped from it', async () => {
  // The record encodes and decodes through CompressionStream off the main turn: wait for the thing itself (up to 2 s on a slow runner), never a fixed number of turns.
  const settle = async (ready: () => boolean) => { for (let i = 0; i < 400 && !ready(); i++) await new Promise((r) => setTimeout(r, 5)); };
  const rec = record.createRecorder({ weapon: 'longsword', build: 'dev', opponent: 'goblin', profile: 'normal', seed: 5 });
  rec.push({ move: { x: 0, z: 0, yaw: 0, run: false }, action: null, guard: false, lock: true });
  const text = await record.encodeRecord(rec.finish('abandoned'));
  const wrong = boot({}, undefined, {}, `?opponent=veteran&replay=${text}`); await settle(() => wrong.element('replay-banner').textContent !== 'Loading the fight…');
  assert.match(wrong.element('replay-banner').textContent, /cannot be played: the link names another opponent/);
  const broken = boot({}, undefined, {}, '?opponent=veteran&replay=AAAA');
  assert.equal((broken.window as unknown as { location: { search: string } }).location.search, '?opponent=veteran&replay=AAAA', 'the harness passes the search string');
  assert.equal(broken.element('replay-banner').textContent, 'Loading the fight…', 'the link is picked up at boot');
  await settle(() => broken.element('replay-banner').textContent !== 'Loading the fight…');
  assert.match(broken.element('replay-banner').textContent, /cannot be played/);
  broken.tick(); wrong.tick();
  assert.equal(broken.storage.getItem('frankendom.fight.v1'), null, 'a refused link leaves the page a viewer: no AFK mark');
  assert.equal(wrong.storage.getItem('frankendom.fight.v1'), null, 'a link for another opponent: no AFK mark either');
});
test('kill links: a signed-in fighter\'s Share stores the record and the link carries the short id; a guest\'s link carries the record; a short link without a fight store is refused', async () => {
  const settle = async (ready: () => boolean) => { for (let i = 0; i < 400 && !ready(); i++) await new Promise((r) => setTimeout(r, 5)); };
  const fight = () => { const a = boot(); a.tick(); a.key('KeyF'); for (let i = 0; i < 45; i++) a.tick(); for (let i = 0; i < 6000 && !a.rendered.finish; i++) a.tick(); assert.ok(a.rendered.finish, 'the fight ends'); return a; };
  const inserts: Record<string, unknown>[] = [];
  session.db = { from: () => ({ insert: async (row: Record<string, unknown>) => { inserts.push(row); return { error: null }; } }) } as never; session.userId = 'user-7';
  try {
    const a = fight(); a.element('share-button').dispatchEvent(new Event('click'));
    await settle(() => /r=|Could not|too long/.test(a.element('share-status').textContent));
    assert.match(a.element('share-status').textContent, /^https:\/\/frankendom\.com\/\?opponent=veteran&r=[A-Za-z0-9_-]{8}$/, 'the signed-in link carries the id');
    assert.equal(inserts.length, 1); assert.equal(inserts[0].user_id, 'user-7'); assert.equal(inserts[0].opponent, 'veteran'); assert.equal(inserts[0].record, a.element('debug').dataset.share, 'the stored text is the encoded record');
  } finally { session.db = null; session.userId = null; }
  const g = fight(); g.element('share-button').dispatchEvent(new Event('click'));
  await settle(() => /replay=|Could not|too long/.test(g.element('share-status').textContent));
  assert.match(g.element('share-status').textContent, /^https:\/\/frankendom\.com\/\?opponent=veteran&replay=[A-Za-z0-9_-]+$/, 'the guest link carries the record');
  const s = boot({}, undefined, {}, '?opponent=veteran&r=Ab3_-9xZ');
  assert.equal(s.element('welcome').hidden, true, 'a short link is picked up at boot');
  await settle(() => s.element('replay-banner').textContent !== 'Loading the fight…');
  assert.match(s.element('replay-banner').textContent, /cannot be played: this build has no fight store/);
});
test('autopsy: a death puts at most two plain lines on the death screen, the same lines go under the opponent\'s journal row for the last fight, and a rematch clears them', () => {
  const app = boot(); app.tick(); app.key('KeyF'); for (let i = 0; i < 45; i++) app.tick();
  for (let i = 0; i < 6000 && !app.rendered.finish; i++) app.tick();
  assert.ok(app.rendered.finish, 'the idle fighter dies'); assert.equal(app.rendered.finish.victim, 0);
  const el = app.element('autopsy');
  assert.equal(el.hidden, false, 'the autopsy shows on the death screen');
  const lines = el.children.map((c) => c.textContent);
  assert.ok(lines.length >= 1 && lines.length <= 2, `one or two lines, got ${lines.length}`);
  assert.match(lines[0], /^(Your posture broke|Your guard broke|You were out of stamina|The (cut|heavy|thrust|kick|riposte|counter|critical) landed on your (head|torso|legs)\.)/, lines[0]);
  for (const line of lines) assert.ok(!/[!?]/.test(line), 'no exclamation marks');
  const card = JSON.parse(app.storage.getItem('frankendom.scorecard.v1')!);
  assert.deepEqual(card.rows.veteran.last, lines, 'the journal keeps the last fight\'s lines under the opponent');
  app.element('reset-button').dispatchEvent(new Event('click')); app.tick();
  assert.equal(el.hidden, true, 'a rematch clears the autopsy');
});
test('daily warden: a build without the account service refuses ?daily=1 with a banner and fights as usual; the journal says so too', async () => {
  const settle = async (ready: () => boolean) => { for (let i = 0; i < 400 && !ready(); i++) await new Promise((r) => setTimeout(r, 5)); };
  const app = boot({}, undefined, {}, '?opponent=veteran&daily=1');
  assert.equal(app.element('welcome').hidden, true, 'a daily link is picked up at boot');
  await settle(() => app.element('replay-banner').textContent !== 'Asking for today\'s warden…');
  assert.match(app.element('replay-banner').textContent, /^No daily warden: this build has no daily warden/);
  app.tick(); app.key('KeyF'); app.tick(); assert.ok(app.rendered, 'the ordinary fight runs');
  app.element('journal-button').dispatchEvent(new Event('click'));
  await settle(() => app.element('daily-status').textContent !== '');
  assert.equal(app.element('daily-status').textContent, 'The daily warden needs the account service.');
  assert.equal(app.element('daily-board').hidden, true);
});
test('daily warden: the attempt is spent the moment the fight starts, a reload mid-fight finds it spent and fights as usual, and the result posts exactly once', async () => {
  const settle = async (ready: () => boolean) => { for (let i = 0; i < 400 && !ready(); i++) await new Promise((r) => setTimeout(r, 5)); };
  const fetchDaily = dailyModule.fetchDaily, inserts: Record<string, unknown>[] = [];
  dailyModule.fetchDaily = async () => ({ day: '2026-09-22', number: 0, seed: 5 }); apiModule.api = { url: 'https://x.supabase.co', key: 'pk' };
  session.db = { from: () => ({ insert: async (row: Record<string, unknown>) => { inserts.push(row); return { error: null }; } }) } as never; session.userId = 'user-7';
  try {
    const a = boot({}, undefined, {}, '?opponent=veteran&daily=1');
    await settle(() => /^Daily #0/.test(a.element('replay-banner').textContent));
    assert.equal(a.element('replay-banner').textContent, 'Daily #0 · the Veteran');
    assert.deepEqual(JSON.parse(a.storage.getItem('frankendom.daily.v1')!), { day: '2026-09-22', started: true, submitted: false }, 'the attempt is spent at the start, before any result');
    // The frustrated reload mid-fight: same device, same day, no result yet — the day is spent, the page fights as usual, nothing posts.
    const b = boot({}, undefined, { 'frankendom.daily.v1': a.storage.getItem('frankendom.daily.v1')! }, '?opponent=veteran&daily=1');
    await settle(() => /^Daily #0/.test(b.element('replay-banner').textContent));
    assert.equal(b.element('replay-banner').textContent, 'Daily #0 · today\'s attempt is spent');
    b.tick(); b.key('KeyF'); for (let i = 0; i < 6000 && !b.rendered.finish; i++) b.tick();
    assert.ok(b.rendered.finish, 'the ordinary fight ends'); await new Promise((r) => setTimeout(r, 40));
    assert.equal(inserts.length, 0, 'a spent day posts nothing');
    assert.deepEqual(JSON.parse(b.storage.getItem('frankendom.daily.v1')!), { day: '2026-09-22', started: true, submitted: false }, 'the reload changed nothing');
    // The live attempt ends: one post, then the device says posted; a second death on the same page cannot post again.
    a.tick(); a.key('KeyF'); for (let i = 0; i < 6000 && !a.rendered.finish; i++) a.tick();
    assert.ok(a.rendered.finish, 'the daily fight ends');
    await settle(() => /Posted|Not posted/.test(a.element('share-status').textContent));
    assert.equal(a.element('share-status').textContent, 'Posted to today\'s board.');
    assert.equal(inserts.length, 1); assert.equal(inserts[0].day, '2026-09-22'); assert.equal(inserts[0].user_id, 'user-7'); assert.equal(inserts[0].outcome, 'died'); assert.equal(inserts[0].number, 0);
    assert.deepEqual(JSON.parse(a.storage.getItem('frankendom.daily.v1')!), { day: '2026-09-22', started: true, submitted: true, outcome: 'died', ticks: inserts[0].ticks });
    a.element('reset-button').dispatchEvent(new Event('click')); a.tick(); a.key('KeyF'); for (let i = 0; i < 6000 && !a.rendered.finish; i++) a.tick();
    assert.ok(a.rendered.finish); await new Promise((r) => setTimeout(r, 40));
    assert.equal(inserts.length, 1, 'the rematch after the daily is practice: no second post');
  } finally { dailyModule.fetchDaily = fetchDaily; apiModule.api = null; session.db = null; session.userId = null; }
});
test('account: every persist of the fighter fires the profile beat the account listens to for its automatic cloud save', () => {
  const app = boot(); let beats = 0; app.window.addEventListener('frankendom:profile', () => { beats++; });
  (app.element('fighter-name') as unknown as { value: string }).value = 'Aldren';
  app.element('name-form').dispatchEvent(new Event('submit', { cancelable: true }));   // the name form persists, like a won fight or a journal pick
  assert.equal(beats, 1, 'persist() fires the beat once');
  assert.equal(JSON.parse(app.storage.getItem('frankendom.fighter.v1')!).name, 'Aldren', 'and the fighter is saved on the device first');
});
test('an AFK fight runs on: hidden time is simulated on return with no input, and a fight abandoned by closing the page is a loss on the card', () => {
  const app = boot({ id: 'tester-0001' }); app.tick(); app.key('KeyF'); app.tick();
  for (let i = 0; i < 60; i++) app.tick();
  assert.equal(JSON.parse(app.storage.getItem('frankendom.fight.v1')!).opponent, 'veteran', 'a live fight is marked');
  assert.equal(app.rendered.finish, null);
  (app.document as unknown as { hidden: boolean }).hidden = true; app.document.dispatchEvent(new Event('visibilitychange'));
  app.tick(120000);
  assert.equal(app.rendered.finish, null, 'nothing runs while hidden');
  (app.document as unknown as { hidden: boolean }).hidden = false; app.document.dispatchEvent(new Event('visibilitychange'));
  app.tick();
  const back = app.rendered;   // a fresh reference: assert.equal(…, null) above narrowed app.rendered.finish to null for the checker
  assert.equal(back.finish?.victim, 0, 'the idle fighter is dead when the player comes back');
  assert.equal(app.storage.getItem('frankendom.fight.v1'), '', 'a decided fight is no longer marked');
  assert.equal(JSON.parse(app.storage.getItem('frankendom.controls.v1')!).card.fights, 1);
  const { last, ...walkAway } = JSON.parse(app.storage.getItem('frankendom.scorecard.v1')!).rows.veteran; assert.deepEqual(walkAway, { fights: 1, wins: 0, losses: 1, left: 1 }, 'the scorecard shows the walk-away as a loss, flagged left'); assert.ok(Array.isArray(last) && last.length >= 1, 'the walk-away death still has its autopsy');
  const again = boot({ id: 'tester-0001' }, undefined, { 'frankendom.fight.v1': JSON.stringify({ opponent: 'goblin' }) });
  const card = JSON.parse(again.storage.getItem('frankendom.controls.v1')!).card;
  assert.deepEqual([card.fights, card.wins], [1, 0], 'closing the page mid-fight scored a loss at the next boot');
  assert.deepEqual(JSON.parse(again.storage.getItem('frankendom.scorecard.v1')!).rows.goblin, { fights: 1, wins: 0, losses: 1, left: 1, last: [] }, 'and on the scorecard against the opponent it was');
  assert.equal(again.storage.getItem('frankendom.fight.v1'), '');
  again.element('journal-button').click();
  const rows = again.element('scorecard-table').children.map(tr => tr.children.map(c => c.textContent));
  assert.deepEqual(rows[0], ['Opponent', 'Fights', 'Wins', 'Losses']);
  assert.deepEqual(rows.find(r => r[0] === 'the Goblin'), ['the Goblin', '1', '0', '1 (1 left)']);
  assert.deepEqual(rows.at(-1), ['All fights', '1', '0', '1 (1 left)']);
});

test('a failed rig load retries when the page returns to the foreground, when the network returns, and on a tap; never while loading or after success', () => {
  const app = boot(); app.tick();
  const status = app.element('art-status');
  app.document.dispatchEvent(new Event('visibilitychange')); status.dispatchEvent(new Event('click')); app.window.dispatchEvent(new Event('online'));
  assert.equal(app.retries, 0, 'rigs are in: nothing to retry');
  app.report('Warrior art could not load. Movement still works; tap here to retry.', 'failed'); app.tick();
  assert.equal(status.dataset.retry, 'true', 'the notice is a tap target only while failed');
  assert.equal(app.element('attack-button').attributes.get('aria-disabled'), 'true', 'controls stay disabled while the art is missing');
  status.dispatchEvent(new Event('click'));
  assert.equal(app.retries, 1, 'a tap retries');
  assert.equal(status.textContent, 'Loading warriors…'); assert.equal(status.dataset.retry, 'false', 'while loading the notice is not a tap target');
  status.dispatchEvent(new Event('click')); app.document.dispatchEvent(new Event('visibilitychange'));
  assert.equal(app.retries, 1, 'no second retry while the load is running');
  app.report('Warrior art could not load. Movement still works; tap here to retry.', 'failed');
  (app.document as unknown as { hidden: boolean }).hidden = true; app.document.dispatchEvent(new Event('visibilitychange'));
  assert.equal(app.retries, 1, 'going hidden does not retry');
  (app.document as unknown as { hidden: boolean }).hidden = false; app.document.dispatchEvent(new Event('visibilitychange'));
  assert.equal(app.retries, 2, 'coming back to the foreground retries');
  app.report('Warrior art could not load. Movement still works; tap here to retry.', 'failed');
  app.window.dispatchEvent(new Event('online'));
  assert.equal(app.retries, 3, 'the network returning retries');
  app.report('', 'ready'); app.tick();
  assert.equal(app.element('attack-button').attributes.get('aria-disabled'), 'false', 'the rigs landed: controls enable');
  status.dispatchEvent(new Event('click')); app.document.dispatchEvent(new Event('visibilitychange'));
  assert.equal(app.retries, 3, 'after success nothing retries');
});

test('loot: the equipped set dresses the rig at boot, the journal shows the paperdoll and the rack, and Wear / Worn / Store change both', () => {
  const app = boot({ loot: { owned: ['veteran.Helmet', 'nightborn.Body'], equipped: { head: 'veteran.Helmet' }, taken: { 'veteran.Helmet': { opponent: 'veteran', attempt: 3, healthLeft: 12, recordId: 'k7Qm2x_A', day: '2026-09-21' } } } });
  assert.deepEqual(app.worn, ['veteran.Helmet'], 'the scene is told the worn set at boot, before any fight');
  app.element('journal-button').click();
  const rack = () => app.element('loot-rack').children, row = (i: number) => rack()[i]!;
  assert.equal(rack().length, 5, 'five tiles, owned first, the rest empty');
  assert.equal(row(0).attributes.get('data-loot'), 'veteran.Helmet'); assert.equal(row(0).attributes.get('data-worn'), 'true'); assert.equal(row(0).attributes.get('tabindex'), '0');
  assert.deepEqual(row(0).children.map(c => c.textContent), ["the Veteran's helmet", '', 'Worn'], 'name, the caption (its text is in its children), the button');
  assert.deepEqual(row(0).children[1]!.children.map(c => c.textContent), ["The Veteran's helmet", ' · your 3rd attempt, 12 health left', ' ', 'Watch'], 'brief 9: the caption starts with the piece name in bold, the Watch link only once the fight is published');
  assert.equal(row(0).children[1]!.children[3]!.attributes.get('href'), '/?r=k7Qm2x_A');
  assert.equal(row(1).attributes.get('data-worn'), 'false'); assert.equal(row(1).children.length, 2, 'no provenance, no caption'); assert.equal(row(1).children[1]!.textContent, 'Wear');
  assert.equal(row(2).className, 'rack-empty'); assert.equal(row(4).className, 'rack-empty');
  assert.equal(app.element('slot-head-name').textContent, "the Veteran's helmet"); assert.ok(app.element('slot-head').classList.contains('on')); assert.equal(app.element('slot-head-off').hidden, false);
  assert.equal(app.element('slot-chest-name').textContent, 'Empty'); assert.ok(!app.element('slot-chest').classList.contains('on')); assert.equal(app.element('slot-chest-off').hidden, true);
  assert.equal(app.element('slot-main-name').textContent, 'Longsword'); assert.ok(app.element('slot-main').classList.contains('on'));
  row(1).children[1]!.click();
  assert.deepEqual(app.worn, ['veteran.Helmet', 'nightborn.Body']); assert.equal(JSON.parse(app.storage.getItem('frankendom.fighter.v1')!).loot.equipped.chest, 'nightborn.Body', 'a Wear persists');
  assert.equal(row(1).children[1]!.textContent, 'Worn'); assert.equal(app.element('slot-chest-name').textContent, "the Nightborn's body");
  row(1).children[1]!.click();
  assert.deepEqual(app.worn, ['veteran.Helmet'], 'Worn taps off again'); assert.equal(app.element('slot-chest-name').textContent, 'Empty');
  app.element('slot-head-off').click();
  assert.deepEqual(app.worn, []); assert.equal(app.element('slot-head-name').textContent, 'Empty'); assert.equal(app.element('slot-head-off').hidden, true); assert.equal(row(0).attributes.get('data-worn'), 'false');
  assert.deepEqual(JSON.parse(app.storage.getItem('frankendom.fighter.v1')!).loot.owned, ['veteran.Helmet', 'nightborn.Body'], 'nothing is lost by taking it off');
});
