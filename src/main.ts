import { FLICK_THRESHOLD, swipeAction, type Flick } from './gestures.ts';
import { LABELS, SCHEMES, formatCard, loadTrial, recordFight, recordRematch, saveTrial } from './trial.ts';
import './monitoring.ts';
import { captureException } from '@sentry/browser';
import './style.css';
import { STEP, wrapAngle } from './sim.ts';
import { cleanName, loadProfile, saveProfile, type StoragePort } from './profile.ts';
import { initialPractice, stepPractice, practiceHint, accepts, describe, PROFILES, RULES, type Action, type CombatEvent } from './combat.ts';
import { createFeedback } from './feedback.ts';
import { createScene } from './scene.ts';

const element = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
const canvas = element<HTMLCanvasElement>('world');
const feedback = createFeedback();
// WebKit grants audio activation on touchend/click/keydown, not the touch-start phase; the combat buttons also
// preventDefault on pointerdown, which suppresses click. Listen to the whole family so the first tap unlocks on iOS.
for (const type of ['pointerdown', 'pointerup', 'touchend', 'click', 'keydown']) window.addEventListener(type, () => feedback.unlock(), { passive: true });
for (const id of ['sound-button', 'mobile-sound']) element(id).addEventListener('click', () => { const enabled = feedback.toggle(); for (const target of ['sound-button', 'mobile-sound']) { element(target).textContent = enabled ? 'Sound on' : 'Sound off'; element(target).setAttribute('aria-pressed', String(enabled)); } });
const welcome = element('welcome');
const journal = element<HTMLDialogElement>('journal');
const message = element('message');
const cameraButton = element<HTMLButtonElement>('camera-button');
const attackButton = element<HTMLButtonElement>('attack-button');
const kickButton = element<HTMLButtonElement>('kick-button');
const heavyButton = element<HTMLButtonElement>('heavy-button');
const dodgeButton = element<HTMLButtonElement>('dodge-button');
const guardButton = element<HTMLButtonElement>('guard-button');
const playerHealth = element<HTMLMeterElement>('player-health');
const stamina = element<HTMLMeterElement>('stamina');
const resetButton = element<HTMLButtonElement>('reset-button');
const health = element<HTMLMeterElement>('target-health');
const combatStatus = element('combat-status');
const runButton = element<HTMLButtonElement>('run-button');
const joystick = element('joystick');
const gesturePad = element('gesture-pad');
let gestureId: number | null = null, gestureX = 0, gestureY = 0, gestureUsed = false;
const stick = element('stick');
const input = element<HTMLInputElement>('fighter-name');
const storage: StoragePort = { getItem: key => localStorage.getItem(key), setItem: (key, value) => localStorage.setItem(key, value) };
const loaded = loadProfile(storage, () => crypto.randomUUID());
const profile = loaded.profile;
input.value = profile.name === 'Wanderer' ? '' : profile.name;
welcome.hidden = loaded.returning;
function persist() {
  element('name-button').textContent = profile.name;
  element('save-status').textContent = saveProfile(storage, profile) ? 'Guest · saved on this device' : 'Storage unavailable · name will not be saved';
}
persist();
// Control-scheme trial: the right thumb is buttons (v0) or the weapon disc in one of three grammars; the scorecard is per scheme.
const trial = loadTrial(storage);
let scheme = trial.scheme, recorded = false;
const disc = () => scheme === 'flick' || scheme === 'drag' || scheme === 'charge';   // the stroke grammars share the weapon disc
const layout = () => disc() ? 'true' : scheme === 'buttons' ? 'false' : scheme;   // actions layout: 'false' buttons · 'true' disc · 'cluster' · 'sectors'
const thrustButton = element<HTMLButtonElement>('thrust-button');
const DISC: Record<Flick, Action> = { left: 'light_left', right: 'light_right', up: 'thrust', down: 'heavy' };
function applyScheme() {
  element('actions').dataset.gestures = layout();
  element('controls-mode').textContent = `Controls: ${LABELS[scheme]}`; element('controls-mode').setAttribute('aria-pressed', String(disc())); lastHud = '';
}
// The first match is the fixed 731 warden (the browser gate times its opener); every rematch meets a differently seeded one.
let matchSeed = 731, practice = initialPractice(matchSeed), state = practice.fighter, previous = state, accumulator = 0, locked = true;
// Input layer: at most one edge-triggered action per tick plus the held guard level. The simulation owns legality and buffering.
let action: Action | null = null, guard = false, guardId: number | null = null, cancel = false, assetsReady = false, graphicsLost = false, lastHud = '';
let difficulty: keyof typeof PROFILES = 'normal', debug = /[?&]debug\b/.test(window.location?.search ?? ''), frameEvents: CombatEvent[] = [];
// Dodge control: the press is an instant backstep; holding it past HOLD_MS grows the step into a roll. Swipe-down rolls directly.
const HOLD_MS = 150;
let dodgeHeld: { since: number; rolled: boolean } | null = null;
// Heavy control: the press swings at once; keeping it held charges the swing (the simulation owns the timing).
let held = false;
let recoveryTimer: ReturnType<typeof setTimeout> | undefined;
function updateHud() {
  const hint = practiceHint(practice), controlsReady = assetsReady && !graphicsLost;
  const ok = (['light', 'heavy', 'kick', 'backstep', 'parry'] as const).map(a => accepts(practice, a) || (a === 'backstep' && accepts(practice, 'dodge')));
  const key = `${practice.phase}:${practice.health}:${practice.playerHealth}:${Math.floor(practice.stamina)}:${hint}:${controlsReady}:${ok.join('')}:${practice.wound > 0}:${practice.exhausted}:${practice.threatMove}`;
  if (key === lastHud) return;
  lastHud = key;
  health.value = practice.health; element('health-value').textContent = `${practice.health} / 100`;
  playerHealth.value = practice.playerHealth; element('player-health-value').textContent = `${practice.playerHealth} / 100`;
  for (const [meter, value] of [[health, practice.health], [playerHealth, practice.playerHealth], [stamina, practice.stamina]] as const) meter.style.setProperty('--fill', `${value}%`);
  stamina.value = practice.stamina; element('stamina-value').textContent = `${Math.floor(practice.stamina)} / 100`;
  combatStatus.textContent = hint;
  element('stamina-label').dataset.mobile = practice.exhausted ? 'Stamina · exhausted' : practice.wound ? 'Stamina · wound' : 'Stamina';
  stamina.setAttribute('aria-label',practice.exhausted ? 'Stamina — exhausted: no attacks or guard until it recovers' : practice.wound ? 'Stamina — wounded: recovery reduced 20 percent' : 'Stamina');
  kickButton.hidden = practice.phase === 'sheathed' || practice.phase === 'draw' || !practice.health || !practice.playerHealth || scheme === 'sectors';   // v6 kicks from the disc's bottom sector
  kickButton.setAttribute('aria-disabled',String(!controlsReady || !ok[2]));
  combatStatus.dataset.threat = String(practice.threat); combatStatus.dataset.move = practice.threatMove ?? '';
  attackButton.textContent = practice.phase === 'sheathed' ? 'Draw sword' : 'Light attack';
  gesturePad.textContent = practice.phase === 'sheathed' ? 'Tap to draw' : scheme === 'flick' ? '← Cut → · ↑ Thrust · ↓ Heavy' : scheme === 'drag' ? 'Drag to load · release to strike' : 'Drag · release · hold ↓ to charge';
  if (scheme === 'sectors') gesturePad.textContent = practice.phase === 'sheathed' ? 'Tap to draw' : '';
  element('sectors').hidden = scheme !== 'sectors' || practice.phase === 'sheathed' || !practice.health || !practice.playerHealth;
  gesturePad.setAttribute('aria-disabled', String(!controlsReady));
  gesturePad.hidden = !practice.health || !practice.playerHealth;
  attackButton.dataset.mobile = practice.phase === 'sheathed' ? 'Draw' : scheme === 'cluster' ? 'Slash' : 'Light'; attackButton.setAttribute('aria-label', attackButton.textContent);
  thrustButton.hidden = scheme !== 'cluster' || !practice.health || !practice.playerHealth || practice.phase === 'sheathed'; thrustButton.setAttribute('aria-disabled', String(!controlsReady || !accepts(practice, 'thrust')));
  // Keep receiving repeated touches while busy; native disabled can surrender them to browser zoom.
  attackButton.setAttribute('aria-disabled', String(!controlsReady || !ok[0]));
  const ended = !practice.health || !practice.playerHealth;
  heavyButton.hidden = ended; heavyButton.setAttribute('aria-disabled', String(!controlsReady || !ok[1]));
  attackButton.hidden = ended; resetButton.hidden = !ended;
  dodgeButton.setAttribute('aria-disabled', String(!controlsReady || !ok[3]));
  guardButton.setAttribute('aria-disabled', String(!controlsReady || !(ok[4] || practice.phase === 'guard')));
  guardButton.setAttribute('aria-pressed', String(practice.phase === 'guard'));
  element('debug').hidden = !debug;
}
function request(next: Action) { if (!paused() && assetsReady && accepts(practice, next)) action = next; }
function requestKick() { request('kick'); }
function pressDodge(now: number) { if (dodgeHeld) return; dodgeHeld = { since: now, rolled: false }; request('backstep'); }
// Releasing a control only drops its held level; a queued press survives until the next tick consumes it. Only a cancelled pointer
// (pointercancel, focus loss) withdraws the press: lostpointercapture follows every ordinary pointerup and must not eat a quick tap.
function releaseDodge(cancelled = false) { dodgeHeld = null; if (cancelled && action === 'backstep') action = null; }
function requestParry() { request('parry'); }
function requestStrike(isHeavy = false) { request(isHeavy ? 'heavy' : 'light'); }
let run = false, stickRun = false, moveId: number | null = null, orbitId: number | null = null;
let moveX = 0, moveZ = 0, orbitX = 0, orbitY = 0;
const keys = new Set<string>();
function clearInput() {
  gestureId = null; gestureUsed = false; action = null; cancel = true; dodgeHeld = null; held = false;
  feedback.quiet(); keys.clear(); guard = false; guardId = null; run = stickRun = false; moveX = moveZ = 0; moveId = orbitId = null; accumulator = 0;
  stick.style.transform = ''; runButton.setAttribute('aria-pressed', 'false');
}
element('name-form').addEventListener('submit', event => {
  event.preventDefault(); profile.name = cleanName(input.value); persist(); welcome.hidden = true; clearInput(); canvas.focus();
});
element('name-button').addEventListener('click', () => { clearInput(); input.value = profile.name; welcome.hidden = false; input.focus(); });
element('journal-button').addEventListener('click', () => { clearInput(); element('scorecard').textContent = formatCard(trial); journal.showModal(); });
element('mobile-name').addEventListener('click', () => { journal.close(); element('name-button').click(); });
element('close-journal').addEventListener('click', () => journal.close());
journal.addEventListener('close', clearInput);
window.addEventListener('blur', clearInput);
document.addEventListener('visibilitychange', clearInput);
const paused = () => graphicsLost || !welcome.hidden || journal.open || document.hidden;
window.addEventListener('keydown', event => {
  if (paused() || event.target instanceof HTMLInputElement) return;
  if (['KeyW', 'KeyA', 'KeyS', 'KeyD', 'ArrowUp', 'ArrowLeft', 'ArrowDown', 'ArrowRight', 'ShiftLeft', 'ShiftRight'].includes(event.code)) {
    event.preventDefault(); keys.add(event.code);
  }
  if (event.code === 'KeyF' && !event.repeat) { event.preventDefault(); requestStrike(); }
  if (event.code === 'KeyC' && !event.repeat) { event.preventDefault(); requestKick(); }
  if (event.code === 'KeyG' && !event.repeat) { event.preventDefault(); held = true; requestStrike(true); }
  if (event.code === 'KeyT' && !event.repeat) { event.preventDefault(); held = true; request('thrust'); }
  if (event.code === 'KeyE' && !event.repeat) { event.preventDefault(); pressDodge(performance.now()); }
  if (event.code === 'KeyQ') { event.preventDefault(); keys.add(event.code); if (!event.repeat) requestParry(); }
  if (event.code === 'KeyR' && !event.repeat) element('recenter-button').click();
});
window.addEventListener('keyup', event => { keys.delete(event.code); if (event.code === 'KeyE') releaseDodge(); if (event.code === 'KeyG' || event.code === 'KeyT') held = false; });
function setRun(value: boolean) { run = value; runButton.setAttribute('aria-pressed', String(value)); }
runButton.addEventListener('pointerdown', event => { if (!paused()) { runButton.setPointerCapture(event.pointerId); setRun(true); } });
for (const name of ['pointerup', 'pointercancel', 'lostpointercapture']) runButton.addEventListener(name, () => setRun(false));
runButton.addEventListener('keydown', event => { if (['Space', 'Enter'].includes(event.code) && !paused()) { event.preventDefault(); setRun(true); } });
runButton.addEventListener('keyup', () => setRun(false));
runButton.addEventListener('blur', () => setRun(false));
attackButton.addEventListener('pointerdown', event => { if (event.button === 0) { event.preventDefault(); requestStrike(); } });
kickButton.addEventListener('pointerdown', event => { if (event.button === 0) { event.preventDefault(); requestKick(); } });
kickButton.addEventListener('pointercancel', () => { if (action === 'kick') action = null; });
kickButton.addEventListener('keydown', event => { if (['Space','Enter'].includes(event.code) && !event.repeat) { event.preventDefault(); requestKick(); } });
heavyButton.addEventListener('pointerdown', event => { if (event.button === 0) { event.preventDefault(); heavyButton.setPointerCapture(event.pointerId); held = true; requestStrike(true); } });
for (const name of ['pointerup', 'pointercancel', 'lostpointercapture']) heavyButton.addEventListener(name, () => { held = false; if (name === 'pointercancel' && action === 'heavy') action = null; });
heavyButton.addEventListener('keydown', event => { if (['Space', 'Enter'].includes(event.code) && !event.repeat) { event.preventDefault(); held = true; requestStrike(true); } });
heavyButton.addEventListener('keyup', () => { held = false; });
heavyButton.addEventListener('blur', () => { held = false; });
thrustButton.addEventListener('pointerdown', event => { if (event.button === 0) { event.preventDefault(); thrustButton.setPointerCapture(event.pointerId); held = true; request('thrust'); } });
for (const name of ['pointerup', 'pointercancel', 'lostpointercapture']) thrustButton.addEventListener(name, () => { held = false; if (name === 'pointercancel' && action === 'thrust') action = null; });
thrustButton.addEventListener('keydown', event => { if (['Space', 'Enter'].includes(event.code) && !event.repeat) { event.preventDefault(); held = true; request('thrust'); } });
thrustButton.addEventListener('keyup', () => { held = false; });
thrustButton.addEventListener('blur', () => { held = false; });
attackButton.addEventListener('pointercancel', () => { if (action === 'light') action = null; });
attackButton.addEventListener('keydown', event => { if (['Space', 'Enter'].includes(event.code) && !event.repeat) { event.preventDefault(); requestStrike(); } });
dodgeButton.addEventListener('pointerdown', event => { if (event.button === 0) { event.preventDefault(); dodgeButton.setPointerCapture(event.pointerId); pressDodge(performance.now()); } });
for (const name of ['pointerup', 'pointercancel', 'lostpointercapture']) dodgeButton.addEventListener(name, () => releaseDodge(name === 'pointercancel'));
dodgeButton.addEventListener('keydown', event => { if (['Space', 'Enter'].includes(event.code) && !event.repeat) { event.preventDefault(); pressDodge(performance.now()); } });
dodgeButton.addEventListener('keyup', () => releaseDodge());
dodgeButton.addEventListener('blur', () => releaseDodge(true));
guardButton.addEventListener('pointerdown', event => {
  if (event.button !== 0 || paused() || guardId !== null) return;
  event.preventDefault(); guardId = event.pointerId; guardButton.setPointerCapture(guardId); guard = true; requestParry();
});
for (const name of ['pointerup', 'pointercancel', 'lostpointercapture']) guardButton.addEventListener(name, event => {
  if ((event as PointerEvent).pointerId === guardId) { guardId = null; guard = false; if (name === 'pointercancel' && action === 'parry') action = null; }
});
guardButton.addEventListener('keydown', event => { if (['Space', 'Enter'].includes(event.code) && !paused()) { event.preventDefault(); guard = true; if (!event.repeat) requestParry(); } });
guardButton.addEventListener('keyup', () => { guard = false; });
guardButton.addEventListener('blur', () => { guard = false; if (action === 'parry') action = null; });
resetButton.addEventListener('click', () => { clearInput(); recordRematch(trial, scheme); saveTrial(storage, trial); recorded = false; matchSeed = (Math.imul(matchSeed, 1664525) + 1013904223) >>> 0; practice = initialPractice(matchSeed); frameEvents = []; state = previous = practice.fighter; view.recenter(); canvas.focus(); });
element('difficulty').addEventListener('click', () => { const levels = Object.keys(PROFILES) as (keyof typeof PROFILES)[]; difficulty = levels[(levels.indexOf(difficulty) + 1) % levels.length]; element('difficulty').textContent = `Warden: ${difficulty}`; });
element('debug-mode').addEventListener('click', () => { debug = !debug; element('debug-mode').textContent = `Combat debug: ${debug ? 'on' : 'off'}`; element('debug-mode').setAttribute('aria-pressed', String(debug)); lastHud = ''; });
element('controls-mode').addEventListener('click', () => { clearInput(); scheme = SCHEMES[(SCHEMES.indexOf(scheme) + 1) % SCHEMES.length]; trial.scheme = scheme; saveTrial(storage, trial); applyScheme(); element('scorecard').textContent = formatCard(trial); });
applyScheme();
// One stroke grammar for the weapon disc and the invisible field: the stroke's direction chooses the attack; in every grammar but v1
// the thumb staying down loads the swing (held = chambered, and charges a heavy in v3/v4); returning to the origin before release feints.
function beginStroke(event: PointerEvent, surface: HTMLElement) {
  event.preventDefault(); gestureId = event.pointerId; gestureX = event.clientX; gestureY = event.clientY; gestureUsed = false;
  if (practice.phase === 'sheathed') { requestStrike(); gestureUsed = true; }
  try { surface.setPointerCapture(gestureId); } catch { /* capture is a convenience: a pointer the browser will not capture still strokes */ }
}
function moveStroke(event: PointerEvent) {
  if (paused()) return;
  const dx = event.clientX - gestureX, dy = event.clientY - gestureY;
  if (gestureUsed) { if (held && Math.hypot(dx, dy) < FLICK_THRESHOLD / 2) { held = false; requestParry(); } return; }
  const flick = swipeAction(dx, dy);
  if (!flick) return;
  event.preventDefault(); gestureUsed = true; held = scheme !== 'flick';
  request(DISC[flick]);
}
function endStroke(cancelled: boolean) { if (cancelled) action = null; gestureId = null; held = false; }
// v6: the disc is four sectors — tap toward one to attack (↑ thrust · ← slash · → heavy · ↓ kick); the thumb staying down loads or charges it.
const SECTORS: Record<Flick, Action> = { up: 'thrust', left: 'light', right: 'heavy', down: 'kick' };
function tapSector(event: PointerEvent) {
  event.preventDefault(); gestureId = event.pointerId; gestureUsed = true;
  if (practice.phase === 'sheathed') { requestStrike(); return; }
  const rect = gesturePad.getBoundingClientRect(), flick = swipeAction(event.clientX - rect.left - rect.width / 2, event.clientY - rect.top - rect.height / 2);
  if (flick) { held = true; request(SECTORS[flick]); }
  try { gesturePad.setPointerCapture(gestureId); } catch { /* as above */ }
}
gesturePad.addEventListener('pointerdown', event => { if (paused() || !assetsReady || event.button !== 0 || gestureId !== null) return; if (disc()) beginStroke(event, gesturePad); else if (scheme === 'sectors') tapSector(event); });
gesturePad.addEventListener('pointermove', event => { if (event.pointerId === gestureId && disc()) moveStroke(event); });
gesturePad.addEventListener('keydown', event => { if (!disc() || event.repeat) return; const flick = ({ ArrowLeft: 'left', ArrowRight: 'right', ArrowUp: 'up', ArrowDown: 'down' } as Record<string, Flick>)[event.code]; if (flick || event.code === 'Enter' || event.code === 'Space') { event.preventDefault(); held = scheme !== 'flick'; request(flick ? DISC[flick] : 'light'); } });
gesturePad.addEventListener('keyup', () => { held = false; });
for (const name of ['pointerup','pointercancel','lostpointercapture']) gesturePad.addEventListener(name, event => { if ((event as PointerEvent).pointerId === gestureId) endStroke(name === 'pointercancel'); });
function moveStick(event: PointerEvent) {
  const rect = joystick.getBoundingClientRect();
  const x = (event.clientX - rect.left - rect.width / 2) / 42;
  const z = (event.clientY - rect.top - rect.height / 2) / 42;
  const length = Math.hypot(x, z), scale = Math.max(1, length);
  moveX = length < 0.12 ? 0 : x / scale; moveZ = length < 0.12 ? 0 : z / scale;
  stickRun = (innerWidth <= 900 || matchMedia('(pointer:coarse)').matches) && length > 1.15;
  stick.style.transform = `translate(${moveX * 34}px, ${moveZ * 34}px)`;
}
joystick.addEventListener('pointerdown', event => {
  if (moveId !== null || paused()) return;
  moveId = event.pointerId; joystick.setPointerCapture(moveId); moveStick(event);
});
joystick.addEventListener('pointermove', event => { if (event.pointerId === moveId) moveStick(event); });
for (const name of ['pointerup', 'pointercancel', 'lostpointercapture']) joystick.addEventListener(name, event => {
  if ((event as PointerEvent).pointerId === moveId) { moveId = null; stickRun = false; moveX = moveZ = 0; stick.style.transform = ''; }
});
let view: ReturnType<typeof createScene>;
try { view = createScene(canvas, status => { element('art-status').textContent = status; assetsReady = status === ''; }); }
catch {
  element('performance').textContent = '3D unavailable';
  message.hidden = false; message.textContent = 'The courtyard needs WebGL 2. Try an up-to-date browser with hardware acceleration enabled.';
  cameraButton.disabled = runButton.disabled = true;
  attackButton.setAttribute('aria-disabled', 'true');
  throw new Error('Unable to initialise the WebGL2 courtyard');
}
let bloodMode = 0;
element('blood-mode').addEventListener('click', () => { bloodMode=(bloodMode+1)%3; const mode=(['red','dark','off'] as const)[bloodMode]; view.setBloodMode(mode); element('blood-mode').textContent=`Blood: ${mode}`; });
function graphicsFailure() {
  message.hidden = false; message.textContent = 'Graphics could not recover. Reload to return to the courtyard. ';
  const reload = document.createElement('button'); reload.textContent = 'Reload game';
  reload.addEventListener('click', () => location.reload()); message.append(reload);
}
function pauseGraphics() {
  if (graphicsLost) return;
  graphicsLost = true; clearInput(); previous = state; cancelAnimationFrame(frameId); updateHud();
  message.hidden = false; message.textContent = 'Restoring graphics… Your fight is paused.';
  recoveryTimer = setTimeout(graphicsFailure, 10000);
}
canvas.addEventListener('webglcontextlost', event => { event.preventDefault(); pauseGraphics(); });
canvas.addEventListener('webglcontextrestored', () => {
  if (!graphicsLost) return;
  // Three.js restores its renderer first; generated environment pixels must be rebuilt too.
  try { view.restoreGraphics(); }
  catch (error) { if (!view.renderer.getContext().isContextLost()) { captureException(error); graphicsFailure(); } return; }
  if (view.renderer.getContext().isContextLost()) return;
  clearTimeout(recoveryTimer); clearInput(); previous = state;
  last = reportAt = performance.now(); frames = []; graphicsLost = false; message.hidden = true;
  updateHud(); frameId = requestAnimationFrame(frame);
});
for (const id of ['camera-button', 'mobile-camera']) element(id).addEventListener('click', () => {
  locked = !locked; for (const target of ['camera-button', 'mobile-camera']) { element(target).setAttribute('aria-pressed', String(locked)); element(target).textContent = locked ? 'Camera locked' : 'Lock camera'; }
});
element('recenter-button').addEventListener('click', () => view.recenter());
canvas.addEventListener('pointerdown', event => {
  if (paused() || orbitId !== null || event.button !== 0) return;
  canvas.focus(); orbitId = event.pointerId; orbitX = event.clientX; orbitY = event.clientY; canvas.setPointerCapture(orbitId);
});
canvas.addEventListener('pointermove', event => {
  if (orbitId === event.pointerId && !locked && !paused()) { view.orbit(event.clientX - orbitX, event.clientY - orbitY); orbitX = event.clientX; orbitY = event.clientY; }
});
for (const name of ['pointerup', 'pointercancel', 'lostpointercapture']) canvas.addEventListener(name, event => { if ((event as PointerEvent).pointerId === orbitId) orbitId = null; });
let last = performance.now(), reportAt = last, frames: number[] = [], frameId = 0;
document.addEventListener('visibilitychange', () => { last = performance.now(); frames = []; reportAt = last; });
function frame(now: number) {
  if (view.renderer.getContext().isContextLost()) { pauseGraphics(); return; }
  const elapsed = (now - last) / 1000; last = now;
  const dt = Math.min(elapsed, 0.1);
  if (!paused()) {
    if (dodgeHeld && !dodgeHeld.rolled && now - dodgeHeld.since >= HOLD_MS) { dodgeHeld.rolled = true; request('dodge'); }
    accumulator += dt;
    const x = moveX + Number(keys.has('KeyD') || keys.has('ArrowRight')) - Number(keys.has('KeyA') || keys.has('ArrowLeft'));
    const z = moveZ + Number(keys.has('KeyS') || keys.has('ArrowDown')) - Number(keys.has('KeyW') || keys.has('ArrowUp'));
    while (accumulator >= STEP) {
      previous = state;
      practice = stepPractice(practice, { move: { x, z, yaw: view.yaw, run: run || stickRun || keys.has('ShiftLeft') || keys.has('ShiftRight') }, action: assetsReady ? action : null, guard: assetsReady && (guard || keys.has('KeyQ')), held: assetsReady && held, lock: locked, cancel }, PROFILES[difficulty]);
      feedback.update(practice.events); frameEvents.push(...practice.events);
      action = null; cancel = false; state = practice.fighter; accumulator -= STEP;
      const me = practice.duel.fighters[0];
      if (held && scheme === 'drag' && me.move === 'heavy_overhead' && me.charge >= RULES.charge.min - 1) held = false;   // v2 loads and releases but never charges
      if (practice.finish && !recorded) { recorded = true; recordFight(trial, scheme, practice.finish.victim === 1, practice.duel.tick, 100 - practice.health, 100 - practice.playerHealth); saveTrial(storage, trial); }
    }
  } else { accumulator = 0; previous = state; }
  const alpha = accumulator / STEP;
  try {
    view.render({ ...state, x: previous.x + (state.x - previous.x) * alpha, z: previous.z + (state.z - previous.z) * alpha, heading: previous.heading + wrapAngle(state.heading - previous.heading) * alpha }, locked, paused() ? 0 : dt, practice, frameEvents);
    frameEvents = [];
  } catch (error) {
    // Loss can happen inside a draw, before the browser delivers its context-lost event.
    if (!view.renderer.getContext().isContextLost()) throw error;
    pauseGraphics(); return;
  }
  updateHud();
  if (debug) element('debug').textContent = describe(practice, difficulty);
  if (!document.hidden && elapsed > 0) frames.push(elapsed * 1000);
  if (now - reportAt >= 2000 && frames.length) {
    const sorted = frames.sort((a, b) => a - b), median = sorted[Math.floor(sorted.length / 2)], p95 = sorted[Math.floor(sorted.length * 0.95)];
    element('performance').textContent = `${Math.round(1000 / median)} fps · p95 ${Math.round(p95)} ms`;
    element('menu-performance').textContent = element('performance').textContent;
    if (median > 22) view.lowerResolution();
    frames = []; reportAt = now;
  }
  frameId = requestAnimationFrame(frame);
}
frameId = requestAnimationFrame(frame);
