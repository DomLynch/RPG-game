import { swipeAction } from './gestures.ts';
import './monitoring.ts';
import { captureException } from '@sentry/browser';
import './style.css';
import { STEP, wrapAngle } from './sim.ts';
import { cleanName, loadProfile, saveProfile, type StoragePort } from './profile.ts';
import { initialPractice, stepPractice, practiceHint, canStrike, canDefend, DEFENCE } from './combat.ts';
import { createFeedback } from './feedback.ts';
import { SWORD, ATTACKS, KICK } from './combat.ts';
import { createScene } from './scene.ts';

const element = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
const canvas = element<HTMLCanvasElement>('world');
const feedback = createFeedback();
window.addEventListener('pointerdown', () => feedback.unlock());
window.addEventListener('keydown', () => feedback.unlock());
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
let gestureMode = false, gestureId: number | null = null, gestureX = 0, gestureY = 0, gestureUsed = false;
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
let practice = initialPractice(), state = practice.fighter, previous = state, accumulator = 0, locked = true;
let kick = false;
let dodge = false, parry = false, guard = false, guardId: number | null = null;
let strike = false, strikeBuffer = 0, heavy = false, bufferHeavy = false, dodgeBuffer = 0, assetsReady = false, graphicsLost = false, lastHud = '';
let recoveryTimer: ReturnType<typeof setTimeout> | undefined;
function bufferWindow() { return (practice.phase === 'attack' && practice.age >= ATTACKS[practice.attack].recovery - 8) || (practice.phase === 'draw' && practice.age >= SWORD.draw - 8); }
function acceptsStrike(isHeavy = false) { return practice.health > 0 && practice.playerHealth > 0 && (!isHeavy || (practice.phase !== 'sheathed' && practice.stamina >= ATTACKS.heavy.cost)) && (canStrike(practice) || bufferWindow()); }
function updateHud() {
  const hint = practiceHint(practice), controlsReady = assetsReady && !graphicsLost;
  const key = `${practice.phase}:${practice.health}:${practice.playerHealth}:${Math.floor(practice.stamina)}:${hint}:${controlsReady}:${bufferWindow()}:${practice.wound > 0}`;
  if (key === lastHud) return;
  lastHud = key;
  health.value = practice.health; element('health-value').textContent = `${practice.health} / 100`;
  playerHealth.value = practice.playerHealth; element('player-health-value').textContent = `${practice.playerHealth} / 100`;
  for (const [meter, value] of [[health, practice.health], [playerHealth, practice.playerHealth], [stamina, practice.stamina]] as const) meter.style.setProperty('--fill', `${value}%`);
  stamina.value = practice.stamina; element('stamina-value').textContent = `${Math.floor(practice.stamina)} / 100`;
  combatStatus.textContent = hint;
  element('stamina-label').dataset.mobile = practice.wound ? 'Stamina · wound' : 'Stamina';
  stamina.setAttribute('aria-label',practice.wound ? 'Stamina — wounded: recovery reduced 20 percent' : 'Stamina');
  kickButton.hidden = practice.phase === 'sheathed' || practice.phase === 'draw' || !practice.health || !practice.playerHealth;
  kickButton.setAttribute('aria-disabled',String(!controlsReady || !canDefend(practice) || practice.stamina < KICK.cost));
  combatStatus.dataset.threat = String(practice.enemyAttacking && !practice.enemyHit && practice.enemyAge < DEFENCE.enemyContact + 4);
  attackButton.textContent = practice.phase === 'sheathed' ? 'Draw sword' : 'Light attack';
  gesturePad.textContent = practice.phase === 'sheathed' ? 'Tap to draw' : '← Light → · ↑ Heavy · ↓ Dodge';
  gesturePad.setAttribute('aria-disabled', String(!controlsReady));
  gesturePad.hidden = !practice.health || !practice.playerHealth;
  attackButton.dataset.mobile = practice.phase === 'sheathed' ? 'Draw' : 'Light'; attackButton.setAttribute('aria-label', attackButton.textContent);
  // Keep receiving repeated touches while busy; native disabled can surrender them to browser zoom.
  attackButton.setAttribute('aria-disabled', String(!controlsReady || !acceptsStrike()));
  const ended = !practice.health || !practice.playerHealth;
  heavyButton.hidden = ended; heavyButton.setAttribute('aria-disabled', String(!controlsReady || !acceptsStrike(true)));
  attackButton.hidden = ended; resetButton.hidden = !ended;
  dodgeButton.setAttribute('aria-disabled', String(!controlsReady || (!canDefend(practice) && !(practice.phase === 'attack' && bufferWindow())) || practice.stamina < DEFENCE.rollCost));
  guardButton.setAttribute('aria-disabled', String(!controlsReady || (!canDefend(practice) && !(practice.phase === 'attack' && bufferWindow())) || practice.stamina <= 0));
  guardButton.setAttribute('aria-pressed', String(practice.phase === 'guard'));
}
function requestKick() { if (!paused() && assetsReady && canDefend(practice) && practice.stamina >= KICK.cost) { kick = true; strike = heavy = false; strikeBuffer = dodgeBuffer = 0; } }
function requestDodge() { if (!paused() && assetsReady && practice.stamina >= DEFENCE.rollCost) { if (canDefend(practice)) dodge = true; else if (practice.phase === 'attack' && practice.age >= ATTACKS[practice.attack].recovery - 8) dodgeBuffer = 9; } }
function requestParry() { if (!paused() && assetsReady && canDefend(practice)) parry = true; }
function requestStrike(isHeavy = false) {
  if (paused() || !assetsReady) return;
  if (isHeavy && (practice.phase === 'sheathed' || practice.stamina < ATTACKS.heavy.cost)) return;
  if (canStrike(practice)) { strike = !isHeavy; heavy = isHeavy; }
  else if (bufferWindow()) { strikeBuffer = 9; bufferHeavy = isHeavy; }
}
let run = false, stickRun = false, moveId: number | null = null, orbitId: number | null = null;
let moveX = 0, moveZ = 0, orbitX = 0, orbitY = 0;
const keys = new Set<string>();
function clearInput() {
  gestureId = null; gestureUsed = false; kick = false;
  strikeBuffer = dodgeBuffer = 0; heavy = bufferHeavy = false; feedback.quiet(); keys.clear(); dodge = parry = guard = false; guardId = null; strike = false; run = stickRun = false; moveX = moveZ = 0; moveId = orbitId = null; accumulator = 0;
  stick.style.transform = ''; runButton.setAttribute('aria-pressed', 'false');
}
element('name-form').addEventListener('submit', event => {
  event.preventDefault(); profile.name = cleanName(input.value); persist(); welcome.hidden = true; clearInput(); canvas.focus();
});
element('name-button').addEventListener('click', () => { clearInput(); input.value = profile.name; welcome.hidden = false; input.focus(); });
element('journal-button').addEventListener('click', () => { clearInput(); journal.showModal(); });
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
  if (event.code === 'KeyG' && !event.repeat) { event.preventDefault(); requestStrike(true); }
  if (event.code === 'KeyE' && !event.repeat) { event.preventDefault(); requestDodge(); }
  if (event.code === 'KeyQ') { event.preventDefault(); keys.add(event.code); if (!event.repeat) requestParry(); }
  if (event.code === 'KeyR' && !event.repeat) element('recenter-button').click();
});
window.addEventListener('keyup', event => keys.delete(event.code));
function setRun(value: boolean) { run = value; runButton.setAttribute('aria-pressed', String(value)); }
runButton.addEventListener('pointerdown', event => { if (!paused()) { runButton.setPointerCapture(event.pointerId); setRun(true); } });
for (const name of ['pointerup', 'pointercancel', 'lostpointercapture']) runButton.addEventListener(name, () => setRun(false));
runButton.addEventListener('keydown', event => { if (['Space', 'Enter'].includes(event.code) && !paused()) { event.preventDefault(); setRun(true); } });
runButton.addEventListener('keyup', () => setRun(false));
runButton.addEventListener('blur', () => setRun(false));
attackButton.addEventListener('pointerdown', event => { if (event.button === 0) { event.preventDefault(); requestStrike(); } });
kickButton.addEventListener('pointerdown', event => { if (event.button === 0) { event.preventDefault(); requestKick(); } });
kickButton.addEventListener('pointercancel', () => { kick = false; });
kickButton.addEventListener('keydown', event => { if (['Space','Enter'].includes(event.code) && !event.repeat) { event.preventDefault(); requestKick(); } });
heavyButton.addEventListener('pointerdown', event => { if (event.button === 0) { event.preventDefault(); requestStrike(true); } });
heavyButton.addEventListener('pointercancel', () => { heavy = false; });
heavyButton.addEventListener('keydown', event => { if (['Space', 'Enter'].includes(event.code) && !event.repeat) { event.preventDefault(); requestStrike(true); } });
attackButton.addEventListener('pointercancel', () => { strike = false; });
attackButton.addEventListener('keydown', event => { if (['Space', 'Enter'].includes(event.code) && !event.repeat) { event.preventDefault(); requestStrike(); } });
dodgeButton.addEventListener('pointerdown', event => { if (event.button === 0) { event.preventDefault(); requestDodge(); } });
dodgeButton.addEventListener('pointercancel', () => { dodge = false; });
dodgeButton.addEventListener('keydown', event => { if (['Space', 'Enter'].includes(event.code) && !event.repeat) { event.preventDefault(); requestDodge(); } });
guardButton.addEventListener('pointerdown', event => {
  if (event.button !== 0 || paused() || guardId !== null) return;
  event.preventDefault(); guardId = event.pointerId; guardButton.setPointerCapture(guardId); guard = true; requestParry();
});
for (const name of ['pointerup', 'pointercancel', 'lostpointercapture']) guardButton.addEventListener(name, event => {
  if ((event as PointerEvent).pointerId === guardId) { guardId = null; guard = false; if (name !== 'pointerup') parry = false; }
});
guardButton.addEventListener('keydown', event => { if (['Space', 'Enter'].includes(event.code) && !paused()) { event.preventDefault(); guard = true; if (!event.repeat) requestParry(); } });
guardButton.addEventListener('keyup', () => { guard = false; });
guardButton.addEventListener('blur', () => { guard = parry = false; });
resetButton.addEventListener('click', () => { clearInput(); practice = initialPractice(); state = previous = practice.fighter; view.recenter(); canvas.focus(); });
element('controls-mode').addEventListener('click', () => {
  clearInput(); gestureMode = !gestureMode; element('actions').dataset.gestures = String(gestureMode);
  element('controls-mode').textContent = gestureMode ? 'Controls: swipes (trial)' : 'Controls: buttons';
  element('controls-mode').setAttribute('aria-pressed', String(gestureMode));
});
gesturePad.addEventListener('pointerdown', event => {
  if (!gestureMode || paused() || !assetsReady || event.button !== 0 || gestureId !== null) return;
  event.preventDefault(); gestureId = event.pointerId; gestureX = event.clientX; gestureY = event.clientY; gestureUsed = false; gesturePad.setPointerCapture(gestureId);
  if (practice.phase === 'sheathed') { requestStrike(); gestureUsed = true; }
});
gesturePad.addEventListener('pointermove', event => {
  if (event.pointerId !== gestureId || gestureUsed || paused()) return;
  const action = swipeAction(event.clientX-gestureX,event.clientY-gestureY);
  if (!action) return;
  event.preventDefault(); gestureUsed = true;
  if (action === 'dodge') requestDodge(); else requestStrike(action === 'heavy');
});
gesturePad.addEventListener('keydown', event => { if (!gestureMode || event.repeat) return; if (['Enter','Space','ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(event.code)) { event.preventDefault(); if (event.code === 'ArrowDown') requestDodge(); else requestStrike(event.code === 'ArrowUp'); } });
for (const name of ['pointerup','pointercancel','lostpointercapture']) gesturePad.addEventListener(name, event => {
  if ((event as PointerEvent).pointerId === gestureId) { if (name !== 'pointerup') { strike = heavy = dodge = false; strikeBuffer = dodgeBuffer = 0; } gestureId = null; }
});
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
    accumulator += dt;
    const x = moveX + Number(keys.has('KeyD') || keys.has('ArrowRight')) - Number(keys.has('KeyA') || keys.has('ArrowLeft'));
    const z = moveZ + Number(keys.has('KeyS') || keys.has('ArrowDown')) - Number(keys.has('KeyW') || keys.has('ArrowUp'));
    while (accumulator >= STEP) {
      const before = practice;
      if (strikeBuffer > 0 && canStrike(practice)) { heavy = bufferHeavy; strike = !heavy; strikeBuffer = 0; }
      else strikeBuffer = Math.max(0, strikeBuffer - 1);
      if (dodgeBuffer > 0 && canDefend(practice)) { dodge = true; dodgeBuffer = strikeBuffer = 0; strike = heavy = false; }
      else dodgeBuffer = Math.max(0, dodgeBuffer - 1);
      previous = state; practice = stepPractice(practice, { x, z, yaw: view.yaw, run: run || stickRun || keys.has('ShiftLeft') || keys.has('ShiftRight') }, strike, locked, assetsReady ? { kick, heavy, dodge, parry, guard: guard || keys.has('KeyQ') } : {});
      feedback.update(before, practice);
      kick = heavy = strike = dodge = parry = false; state = practice.fighter; accumulator -= STEP;
    }
  } else { accumulator = 0; previous = state; }
  const alpha = accumulator / STEP;
  try {
    view.render({ ...state, x: previous.x + (state.x - previous.x) * alpha, z: previous.z + (state.z - previous.z) * alpha, heading: previous.heading + wrapAngle(state.heading - previous.heading) * alpha }, locked, paused() ? 0 : dt, practice);
  } catch (error) {
    // Loss can happen inside a draw, before the browser delivers its context-lost event.
    if (!view.renderer.getContext().isContextLost()) throw error;
    pauseGraphics(); return;
  }
  updateHud();
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
