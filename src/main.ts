import './monitoring.ts';
import './style.css';
import { STEP, wrapAngle } from './sim.ts';
import { cleanName, loadProfile, saveProfile, type StoragePort } from './profile.ts';
import { initialPractice, stepPractice, practiceHint, canStrike } from './combat.ts';
import { createScene } from './scene.ts';

const element = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
const canvas = element<HTMLCanvasElement>('world');
const welcome = element('welcome');
const journal = element<HTMLDialogElement>('journal');
const message = element('message');
const cameraButton = element<HTMLButtonElement>('camera-button');
const attackButton = element<HTMLButtonElement>('attack-button');
const resetButton = element<HTMLButtonElement>('reset-button');
const health = element<HTMLMeterElement>('target-health');
const combatStatus = element('combat-status');
const runButton = element<HTMLButtonElement>('run-button');
const joystick = element('joystick');
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
let practice = initialPractice(), state = practice.fighter, previous = state, accumulator = 0, locked = false;
let strike = false, assetsReady = false, lastHud = '';
function updateHud() {
  const key = `${practice.phase}:${practice.health}:${practice.result}:${assetsReady}`;
  if (key === lastHud) return;
  lastHud = key;
  health.value = practice.health; element('health-value').textContent = `${practice.health} / 100`;
  combatStatus.textContent = practiceHint(practice);
  attackButton.textContent = practice.phase === 'sheathed' ? 'Draw sword' : 'Light attack';
  // Keep receiving repeated touches while busy; native disabled can surrender them to browser zoom.
  attackButton.setAttribute('aria-disabled', String(!assetsReady || !canStrike(practice)));
  attackButton.hidden = !practice.health; resetButton.hidden = practice.health > 0;
}
function requestStrike() { if (!paused() && assetsReady && canStrike(practice)) strike = true; }
let run = false, moveId: number | null = null, orbitId: number | null = null;
let moveX = 0, moveZ = 0, orbitX = 0, orbitY = 0;
const keys = new Set<string>();
function clearInput() {
  keys.clear(); strike = false; run = false; moveX = moveZ = 0; moveId = orbitId = null; accumulator = 0;
  stick.style.transform = ''; runButton.setAttribute('aria-pressed', 'false');
}
element('name-form').addEventListener('submit', event => {
  event.preventDefault(); profile.name = cleanName(input.value); persist(); welcome.hidden = true; clearInput(); canvas.focus();
});
element('name-button').addEventListener('click', () => { clearInput(); input.value = profile.name; welcome.hidden = false; input.focus(); });
element('journal-button').addEventListener('click', () => { clearInput(); journal.showModal(); });
element('close-journal').addEventListener('click', () => journal.close());
journal.addEventListener('close', clearInput);
window.addEventListener('blur', clearInput);
document.addEventListener('visibilitychange', clearInput);
const paused = () => !welcome.hidden || journal.open || document.hidden;
window.addEventListener('keydown', event => {
  if (paused() || event.target instanceof HTMLInputElement) return;
  if (['KeyW', 'KeyA', 'KeyS', 'KeyD', 'ArrowUp', 'ArrowLeft', 'ArrowDown', 'ArrowRight', 'ShiftLeft', 'ShiftRight'].includes(event.code)) {
    event.preventDefault(); keys.add(event.code);
  }
  if (event.code === 'KeyF' && !event.repeat) { event.preventDefault(); requestStrike(); }
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
attackButton.addEventListener('pointercancel', () => { strike = false; });
attackButton.addEventListener('keydown', event => { if (['Space', 'Enter'].includes(event.code) && !event.repeat) { event.preventDefault(); requestStrike(); } });
resetButton.addEventListener('click', () => { clearInput(); practice = initialPractice(); state = previous = practice.fighter; view.recenter(); canvas.focus(); });
function moveStick(event: PointerEvent) {
  const rect = joystick.getBoundingClientRect();
  const x = (event.clientX - rect.left - rect.width / 2) / 42;
  const z = (event.clientY - rect.top - rect.height / 2) / 42;
  const length = Math.hypot(x, z), scale = Math.max(1, length);
  moveX = length < 0.12 ? 0 : x / scale; moveZ = length < 0.12 ? 0 : z / scale;
  stick.style.transform = `translate(${moveX * 34}px, ${moveZ * 34}px)`;
}
joystick.addEventListener('pointerdown', event => {
  if (moveId !== null || paused()) return;
  moveId = event.pointerId; joystick.setPointerCapture(moveId); moveStick(event);
});
joystick.addEventListener('pointermove', event => { if (event.pointerId === moveId) moveStick(event); });
for (const name of ['pointerup', 'pointercancel', 'lostpointercapture']) joystick.addEventListener(name, event => {
  if ((event as PointerEvent).pointerId === moveId) { moveId = null; moveX = moveZ = 0; stick.style.transform = ''; }
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
canvas.addEventListener('webglcontextlost', event => {
  event.preventDefault(); clearInput(); cancelAnimationFrame(frameId);
  message.hidden = false; message.textContent = 'The graphics connection was interrupted. Reload this page to return to the courtyard.';
});
cameraButton.addEventListener('click', () => {
  locked = !locked; cameraButton.setAttribute('aria-pressed', String(locked)); cameraButton.textContent = locked ? 'Camera locked' : 'Lock camera';
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
  const elapsed = (now - last) / 1000; last = now;
  const dt = Math.min(elapsed, 0.1);
  if (!paused()) {
    accumulator += dt;
    const x = moveX + Number(keys.has('KeyD') || keys.has('ArrowRight')) - Number(keys.has('KeyA') || keys.has('ArrowLeft'));
    const z = moveZ + Number(keys.has('KeyS') || keys.has('ArrowDown')) - Number(keys.has('KeyW') || keys.has('ArrowUp'));
    while (accumulator >= STEP) {
      previous = state; practice = stepPractice(practice, { x, z, yaw: view.yaw, run: run || keys.has('ShiftLeft') || keys.has('ShiftRight') }, strike, locked);
      strike = false; state = practice.fighter; accumulator -= STEP;
    }
  } else { accumulator = 0; previous = state; }
  const alpha = accumulator / STEP;
  view.render({ ...state, x: previous.x + (state.x - previous.x) * alpha, z: previous.z + (state.z - previous.z) * alpha, heading: previous.heading + wrapAngle(state.heading - previous.heading) * alpha }, locked, paused() ? 0 : dt, practice);
  updateHud();
  if (!document.hidden && elapsed > 0) frames.push(elapsed * 1000);
  if (now - reportAt >= 2000 && frames.length) {
    const sorted = frames.sort((a, b) => a - b), median = sorted[Math.floor(sorted.length / 2)], p95 = sorted[Math.floor(sorted.length * 0.95)];
    element('performance').textContent = `${Math.round(1000 / median)} fps · p95 ${Math.round(p95)} ms`;
    if (median > 22) view.lowerResolution();
    frames = []; reportAt = now;
  }
  frameId = requestAnimationFrame(frame);
}
frameId = requestAnimationFrame(frame);
