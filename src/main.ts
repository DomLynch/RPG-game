import { swipeAction, type Flick } from './gestures.ts';
import { LABELS, SCHEMES, formatCard, loadTrial, recordFight, recordRematch, saveTrial } from './trial.ts';
import './monitoring.ts';
import { captureException } from '@sentry/browser';
import './style.css';
import { wrapAngle } from './sim.ts';
import { cleanName, loadProfile, saveProfile, type StoragePort } from './profile.ts';
import { initialPractice, stepPractice, practiceHint, accepts, describe, PROFILES, type Action, type CombatEvent } from './combat.ts';
import { RULES } from './moves.ts';
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
let scheme = trial.scheme, recorded = false, activeMs = 0;   // activeMs: real unpaused wall-clock of the current fight (hit-stop included), beside the simulation's tick count
const disc = () => scheme === 'flick';
const thrustButton = element<HTMLButtonElement>('thrust-button');
const DISC: Record<Flick, Action> = { left: 'light_left', right: 'light_right', up: 'thrust', down: 'heavy' };
function applyScheme() {
  element('actions').dataset.gestures = scheme;
  element('controls-mode').textContent = `Controls: ${LABELS[scheme]}`; element('controls-mode').setAttribute('aria-pressed', String(disc())); lastHud = '';
}
// The first match is the fixed 731 warden (the browser gate times its opener); every rematch meets a differently seeded one.
let matchSeed = 731, practice = initialPractice(matchSeed), state = practice.fighter, previous = state, accumulator = 0, locked = true;
// Input layer: at most one edge-triggered action per tick plus the held guard level. The simulation owns legality and buffering.
let action: Action | null = null, guard = false, guardId: number | null = null, cancel = false, assetsReady = false, graphicsLost = false, lastHud = '';
let difficulty: keyof typeof PROFILES = 'normal', debug = /[?&]debug\b/.test(window.location?.search ?? ''), frameEvents: CombatEvent[] = [];
// Dodge control: the press is an instant backstep; holding it past HOLD_MS grows the step into a roll. Swipe-down rolls directly.
const HOLD_MS = 150, SPRINT_PUSH = 1.4;
let dodgeHeld: { since: number; rolled: boolean } | null = null;
// Strike controls: the press swings at once; keeping it held charges (Heavy), loads (Stab) or chambers (Slash) the swing — the simulation owns
// the timing. The held level belongs to the control that raised it: releasing one never drops another's. Dragging a held strike off its
// circle turns the press into a guard press (a feint inside the wind-up's feint window, a parry or a raised guard after it) until it lifts.
type Strike = 'light' | 'heavy' | 'thrust';
const holders = new Set<Strike>(); let dragGuard = false;
const ownerOf = (move: string | null): Strike | null => move === 'heavy_overhead' ? 'heavy' : move === 'thrust' ? 'thrust' : move?.startsWith('light_') ? 'light' : null;
// The held level the simulation sees: during a swing, whether the control that threw it is still down; otherwise whether any strike control is.
const held = () => { const f = practice.duel.fighters[0], owner = f.phase === 'attack' ? ownerOf(f.move) : null; return owner ? holders.has(owner) : holders.size > 0; };
function hold(by: Strike) { holders.add(by); }
function unhold(by: Strike) { holders.delete(by); }
let recoveryTimer: ReturnType<typeof setTimeout> | undefined;
// Hit-stop: a contact freezes the simulation for a few frames while the frame keeps rendering, so the pose at impact reads. Wall-clock
// pacing only — the simulation, its tick count and determinism are untouched. Heavier contacts stop longer; a kill stops longest.
// This is the one owner of the impact pause: the renderer is told the sim is frozen and holds its combat animation (effects run on),
// the contact tick's own bodies are what the frozen frames show, and the part of a frame that outlives the pause goes on to the next tick.
// A kick's lunge carries its short cone forward: it lands on a standing target from 1.58 m (tests/duel 'kick lands'); the HUD flags 1.5.
const KICK_LANDS = 1.5;
const HIT_STOP: Partial<Record<CombatEvent['type'], number>> = { Blocked: 30, Hit: 50, Parried: 70, GuardBroken: 90, PostureBroken: 120, Killed: 220 };
const HEAVY_HIT = 90, HEAVY_BLOCK = 50;   // a heavy-class contact stops longer whether it lands or is blocked
const HEAVY_MOVES = new Set<string>(['heavy_overhead', 'heavy_riposte', 'heavy_counter', 'critical']);
const HITSTOP_KEY = 'frankendom.hitstop.v1', TEMPO_KEY = 'frankendom.tempo.v1';
// Tempo: the simulation is written in ticks; stepping it at 50 Hz instead of 60 plays the same fight a fifth slower in wall-clock (wind-ups,
// windows, reactions, movement alike — hit-stop is in ms and unchanged). A journal toggle so the owner can feel the slower tempo before any
// re-timing of the moves (which needs the blade paths re-baked).
let tempoHz: 60 | 50 = storage.getItem(TEMPO_KEY) === '50' ? 50 : 60;
const step = () => 1 / tempoHz;
let hitStop = 0, hitStopOn = storage.getItem(HITSTOP_KEY) !== 'off';
function stopFor(events: CombatEvent[]): number {
  if (!hitStopOn) return 0;
  let ms = 0;
  for (const e of events) { const base = HIT_STOP[e.type] ?? 0; if (!base) continue; const heavy = !!e.charged || HEAVY_MOVES.has(e.move ?? ''); ms = Math.max(ms, e.type === 'Hit' && heavy ? HEAVY_HIT : e.type === 'Blocked' && heavy ? HEAVY_BLOCK : base); }
  return ms;
}
function updateHud() {
  const hint = practiceHint(practice), controlsReady = assetsReady && !graphicsLost;
  const ok = (['light', 'heavy', 'kick', 'backstep', 'parry'] as const).map(a => accepts(practice, a) || (a === 'backstep' && accepts(practice, 'dodge')));
  const inKickReach = Math.hypot(practice.enemy.x - practice.fighter.x, practice.enemy.z - practice.fighter.z) <= KICK_LANDS;
  const key = `${practice.phase}:${practice.health}:${practice.playerHealth}:${Math.floor(practice.stamina)}:${Math.floor(practice.posture)}:${Math.floor(practice.enemyPosture)}:${hint}:${controlsReady}:${ok.join('')}:${practice.wound > 0}:${practice.exhausted}:${practice.threatMove}:${inKickReach}`;
  if (key === lastHud) return;
  lastHud = key;
  health.value = practice.health; element('health-value').textContent = `${practice.health} / ${RULES.health}`;
  playerHealth.value = practice.playerHealth; element('player-health-value').textContent = `${practice.playerHealth} / ${RULES.health}`;
  for (const [meter, value, max] of [[health, practice.health, RULES.health], [playerHealth, practice.playerHealth, RULES.health], [stamina, practice.stamina, 100]] as const) meter.style.setProperty('--fill', `${value / max * 100}%`);
  stamina.style.setProperty('--max', `${practice.maxStamina}%`); stamina.dataset.leg = String(practice.legWound);   // attrition: the lost ceiling is shaded; a leg wound marks the bar
  stamina.value = practice.stamina; element('stamina-value').textContent = `${Math.floor(practice.stamina)} / 100`;
  for (const [id, value] of [['posture', practice.posture], ['target-posture', practice.enemyPosture]] as const) { const meter = element<HTMLMeterElement>(id); meter.value = value; meter.style.setProperty('--fill', `${value}%`); meter.dataset.critical = String(value >= 70); }
  combatStatus.textContent = hint;
  element('stamina-label').dataset.mobile = practice.exhausted ? 'Stamina · exhausted' : practice.wound ? 'Stamina · wound' : 'Stamina';
  stamina.setAttribute('aria-label',practice.exhausted ? 'Stamina — exhausted: no attacks or guard until it recovers' : practice.wound ? 'Stamina — wounded: recovery reduced 20 percent' : 'Stamina');
  kickButton.hidden = practice.phase === 'sheathed' || practice.phase === 'draw' || !practice.health || !practice.playerHealth;
  kickButton.setAttribute('aria-disabled',String(!controlsReady || !ok[2]));
  kickButton.dataset.reach = String(inKickReach);   // a kick has a short cone: the button brightens when it can land
  combatStatus.dataset.threat = String(practice.threat); combatStatus.dataset.move = practice.threatMove ?? '';
  attackButton.textContent = practice.phase === 'sheathed' ? 'Draw sword' : 'Light attack';
  gesturePad.textContent = practice.phase === 'sheathed' ? 'Tap to draw' : '← Cut → · ↑ Thrust · ↓ Heavy';
  gesturePad.setAttribute('aria-disabled', String(!controlsReady));
  gesturePad.hidden = !practice.health || !practice.playerHealth;
  attackButton.dataset.mobile = practice.phase === 'sheathed' ? 'Draw' : disc() ? 'Light' : 'Slash'; attackButton.setAttribute('aria-label', attackButton.textContent);
  thrustButton.hidden = disc() || !practice.health || !practice.playerHealth || practice.phase === 'sheathed'; thrustButton.setAttribute('aria-disabled', String(!controlsReady || !accepts(practice, 'thrust')));
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
// Step: a tap is a backstep, a hold (150 ms) becomes a roll. With the stick already deflected (or a movement key down) the intent is a roll in
// that direction, so it rolls at once: the invulnerability arrives with the press, not 150 ms later.
const moving = () => moveX !== 0 || moveZ !== 0 || ['KeyW', 'KeyA', 'KeyS', 'KeyD', 'ArrowUp', 'ArrowLeft', 'ArrowDown', 'ArrowRight'].some(k => keys.has(k));
function pressDodge(now: number) { if (dodgeHeld) return; const roll = moving(); dodgeHeld = { since: now, rolled: roll }; request(roll ? 'dodge' : 'backstep'); }
// Releasing a control only drops its held level; a queued press survives until the next tick consumes it. Only a cancelled pointer
// (pointercancel, focus loss) withdraws the press: lostpointercapture follows every ordinary pointerup and must not eat a quick tap.
// A press the simulation has already taken into its buffer is withdrawn there too (`cancel`), but only if that control owns the
// buffered request — a cancelled thumb must not erase another finger's valid press.
let sent: Action | null = null;   // the last request handed to the simulation (the one its buffer can hold)
function withdraw(owned: Action | Action[]) { const mine = ([] as Action[]).concat(owned); if (action && mine.includes(action)) action = null; else if (sent && mine.includes(sent)) cancel = true; }
function releaseDodge(cancelled = false) { dodgeHeld = null; if (cancelled) withdraw(['backstep', 'dodge']); }
function requestParry() { request('parry'); }
function requestStrike(isHeavy = false) { request(isHeavy ? 'heavy' : 'light'); }
let run = false, stickRun = false, moveId: number | null = null, orbitId: number | null = null;
let moveX = 0, moveZ = 0, orbitX = 0, orbitY = 0;
const keys = new Set<string>();
function clearInput() {
  gestureId = null; gestureUsed = false; action = null; cancel = true; dodgeHeld = null; holders.clear(); dragGuard = false; hitStop = 0;
  feedback.quiet(); keys.clear(); guard = false; guardId = null; run = stickRun = false; moveX = moveZ = 0; moveId = orbitId = null; accumulator = 0;
  stick.style.transform = ''; stick.dataset.run = 'false'; runButton.setAttribute('aria-pressed', 'false');
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
  if (event.code === 'KeyG' && !event.repeat) { event.preventDefault(); hold('heavy'); requestStrike(true); }
  if (event.code === 'KeyT' && !event.repeat) { event.preventDefault(); hold('thrust'); request('thrust'); }
  if (event.code === 'KeyE' && !event.repeat) { event.preventDefault(); pressDodge(performance.now()); }
  if (event.code === 'KeyQ') { event.preventDefault(); keys.add(event.code); if (!event.repeat) requestParry(); }
  if (event.code === 'KeyR' && !event.repeat) element('recenter-button').click();
});
window.addEventListener('keyup', event => { keys.delete(event.code); if (event.code === 'KeyE') releaseDodge(); if (event.code === 'KeyG') unhold('heavy'); if (event.code === 'KeyT') unhold('thrust'); });
function setRun(value: boolean) { run = value; runButton.setAttribute('aria-pressed', String(value)); }
runButton.addEventListener('pointerdown', event => { if (!paused()) { runButton.setPointerCapture(event.pointerId); setRun(true); } });
for (const name of ['pointerup', 'pointercancel', 'lostpointercapture']) runButton.addEventListener(name, () => setRun(false));
runButton.addEventListener('keydown', event => { if (['Space', 'Enter'].includes(event.code) && !paused()) { event.preventDefault(); setRun(true); } });
runButton.addEventListener('keyup', () => setRun(false));
runButton.addEventListener('blur', () => setRun(false));
// A strike button with pointer capture: press = strike (held while down); the pointer leaving the circle while down = guard press (drag-off feint).
function strikeControl(button: HTMLButtonElement, name: Strike, start: () => void) {
  let id: number | null = null, dragged = false;
  const radius = () => { const r = button.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2, r: r.width / 2 + 6 }; };   // 6 px of slack before a press counts as dragged off
  button.addEventListener('pointerdown', event => {
    if (event.button !== 0 || id !== null) return;
    event.preventDefault(); id = event.pointerId; dragged = false;
    try { button.setPointerCapture(id); } catch { /* capture is a convenience: an uncaptured press still strikes */ }
    hold(name); start();
  });
  button.addEventListener('pointermove', event => {
    if (event.pointerId !== id || dragged) return;
    const c = radius(); if (Math.hypot(event.clientX - c.x, event.clientY - c.y) <= c.r) return;
    dragged = true; unhold(name); dragGuard = true; requestParry();   // off the circle: the swing is abandoned into a guard press
  });
  for (const type of ['pointerup', 'pointercancel', 'lostpointercapture']) button.addEventListener(type, event => {
    if ((event as PointerEvent).pointerId !== id) return;
    id = null; unhold(name); if (dragged) { dragged = false; dragGuard = false; }
    if (type === 'pointercancel') withdraw(name);
  });
  button.addEventListener('keydown', event => { if (['Space', 'Enter'].includes(event.code) && !event.repeat) { event.preventDefault(); hold(name); start(); } });
  button.addEventListener('keyup', () => unhold(name));
  button.addEventListener('blur', () => unhold(name));
}
strikeControl(attackButton, 'light', () => requestStrike());
kickButton.addEventListener('pointerdown', event => { if (event.button === 0) { event.preventDefault(); requestKick(); } });
kickButton.addEventListener('pointercancel', () => withdraw('kick'));
kickButton.addEventListener('keydown', event => { if (['Space','Enter'].includes(event.code) && !event.repeat) { event.preventDefault(); requestKick(); } });
strikeControl(heavyButton, 'heavy', () => requestStrike(true));
strikeControl(thrustButton, 'thrust', () => request('thrust'));
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
  if ((event as PointerEvent).pointerId === guardId) { guardId = null; guard = false; if (name === 'pointercancel') withdraw('parry'); }
});
guardButton.addEventListener('keydown', event => { if (['Space', 'Enter'].includes(event.code) && !paused()) { event.preventDefault(); guard = true; if (!event.repeat) requestParry(); } });
guardButton.addEventListener('keyup', () => { guard = false; });
guardButton.addEventListener('blur', () => { guard = false; if (action === 'parry') action = null; });
resetButton.addEventListener('click', () => { clearInput(); recordRematch(trial, scheme); saveTrial(storage, trial); recorded = false; activeMs = 0; matchSeed = (Math.imul(matchSeed, 1664525) + 1013904223) >>> 0; practice = initialPractice(matchSeed); frameEvents = []; state = previous = practice.fighter; view.recenter(); canvas.focus(); });
element('difficulty').addEventListener('click', () => { const levels = Object.keys(PROFILES) as (keyof typeof PROFILES)[]; difficulty = levels[(levels.indexOf(difficulty) + 1) % levels.length]; element('difficulty').textContent = `Warden: ${difficulty}`; });
element('debug-mode').addEventListener('click', () => { debug = !debug; element('debug-mode').textContent = `Combat debug: ${debug ? 'on' : 'off'}`; element('debug-mode').setAttribute('aria-pressed', String(debug)); lastHud = ''; });
element('controls-mode').addEventListener('click', () => { clearInput(); scheme = SCHEMES[(SCHEMES.indexOf(scheme) + 1) % SCHEMES.length]; trial.scheme = scheme; saveTrial(storage, trial); applyScheme(); element('scorecard').textContent = formatCard(trial); });
applyScheme();
// Weapon disc (the alternative to the cluster): a stroke's direction chooses the attack and the strike goes at once.
function beginStroke(event: PointerEvent, surface: HTMLElement) {
  event.preventDefault(); gestureId = event.pointerId; gestureX = event.clientX; gestureY = event.clientY; gestureUsed = false;
  if (practice.phase === 'sheathed') { requestStrike(); gestureUsed = true; }
  try { surface.setPointerCapture(gestureId); } catch { /* capture is a convenience: a pointer the browser will not capture still strokes */ }
}
function moveStroke(event: PointerEvent) {
  if (paused()) return;
  const dx = event.clientX - gestureX, dy = event.clientY - gestureY;
  if (gestureUsed) return;
  const flick = swipeAction(dx, dy);
  if (!flick) return;
  event.preventDefault(); gestureUsed = true;
  request(DISC[flick]);
}
function endStroke(cancelled: boolean) { if (cancelled) withdraw(['light_left', 'light_right', 'thrust', 'heavy', 'light']); gestureId = null; }
gesturePad.addEventListener('pointerdown', event => { if (disc() && !paused() && assetsReady && event.button === 0 && gestureId === null) beginStroke(event, gesturePad); });
gesturePad.addEventListener('pointermove', event => { if (event.pointerId === gestureId) moveStroke(event); });
gesturePad.addEventListener('keydown', event => { if (!disc() || event.repeat) return; const flick = ({ ArrowLeft: 'left', ArrowRight: 'right', ArrowUp: 'up', ArrowDown: 'down' } as Record<string, Flick>)[event.code]; if (flick || event.code === 'Enter' || event.code === 'Space') { event.preventDefault(); request(flick ? DISC[flick] : 'light'); } });
for (const name of ['pointerup','pointercancel','lostpointercapture']) gesturePad.addEventListener(name, event => { if ((event as PointerEvent).pointerId === gestureId) endStroke(name === 'pointercancel'); });
function moveStick(event: PointerEvent) {
  const rect = joystick.getBoundingClientRect();
  const x = (event.clientX - rect.left - rect.width / 2) / 42;
  const z = (event.clientY - rect.top - rect.height / 2) / 42;
  const length = Math.hypot(x, z), scale = Math.max(1, length);
  moveX = length < 0.12 ? 0 : x / scale; moveZ = length < 0.12 ? 0 : z / scale;
  // Sprint is a deliberate push well past the knob's rim (the rim is length 1; 1.4 is ~17 px beyond it), and the knob shows it.
  stickRun = (innerWidth <= 900 || matchMedia('(pointer:coarse)').matches) && length > SPRINT_PUSH;
  stick.style.transform = `translate(${moveX * 34}px, ${moveZ * 34}px)`; stick.dataset.run = String(stickRun);
}
// The stick must never stay pushed after the thumb has gone: a new touch always takes it over, and its release is honoured wherever the
// browser delivers it (a pointerup that lands outside the pad when capture was lost, or a touchend with no fingers left on the screen).
function releaseStick() { moveId = null; stickRun = false; moveX = moveZ = 0; stick.style.transform = ''; stick.dataset.run = 'false'; }
joystick.addEventListener('pointerdown', event => {
  if (paused()) return;
  moveId = event.pointerId; try { joystick.setPointerCapture(moveId); } catch { /* the pad still follows this pointer through the window listeners */ } moveStick(event);
});
joystick.addEventListener('pointermove', event => { if (event.pointerId === moveId) moveStick(event); });
for (const name of ['pointerup', 'pointercancel', 'lostpointercapture']) joystick.addEventListener(name, event => { if ((event as PointerEvent).pointerId === moveId) releaseStick(); });
for (const name of ['pointerup', 'pointercancel']) window.addEventListener(name, event => { if ((event as PointerEvent).pointerId === moveId) releaseStick(); });
window.addEventListener('touchend', event => { if (moveId !== null && event.touches.length === 0) releaseStick(); });
window.addEventListener('touchcancel', event => { if (moveId !== null && event.touches.length === 0) releaseStick(); });
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
const showTempo = () => { element('tempo-mode').textContent = `Tempo: ${tempoHz} Hz`; element('tempo-mode').setAttribute('aria-pressed', String(tempoHz === 50)); };
element('tempo-mode').addEventListener('click', () => { tempoHz = tempoHz === 60 ? 50 : 60; accumulator = 0; try { storage.setItem(TEMPO_KEY, String(tempoHz)); } catch { /* a full store just loses the preference */ } showTempo(); });
showTempo();
const showHitStop = () => { element('hitstop-mode').textContent = `Hit-stop: ${hitStopOn ? 'on' : 'off'}`; element('hitstop-mode').setAttribute('aria-pressed', String(hitStopOn)); };
element('hitstop-mode').addEventListener('click', () => { hitStopOn = !hitStopOn; hitStop = 0; try { storage.setItem(HITSTOP_KEY, hitStopOn ? 'on' : 'off'); } catch { /* a full store just loses the preference */ } showHitStop(); });
showHitStop();
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
    // The pause spends the frame's time first; whatever the frame has left after the pause ends goes on to the simulation (no discarded time).
    if (hitStop > 0) { const spent = Math.min(hitStop, elapsed * 1000); hitStop -= spent; if (!hitStop) accumulator += Math.max(0, dt - spent / 1000); } else accumulator += dt;
    activeMs += elapsed * 1000;
    const x = moveX + Number(keys.has('KeyD') || keys.has('ArrowRight')) - Number(keys.has('KeyA') || keys.has('ArrowLeft'));
    const z = moveZ + Number(keys.has('KeyS') || keys.has('ArrowDown')) - Number(keys.has('KeyW') || keys.has('ArrowUp'));
    while (accumulator >= step()) {
      previous = state;
      practice = stepPractice(practice, { move: { x, z, yaw: view.yaw, run: run || stickRun || keys.has('ShiftLeft') || keys.has('ShiftRight') }, action: assetsReady ? action : null, guard: assetsReady && (guard || dragGuard || keys.has('KeyQ')), held: assetsReady && held(), lock: locked, cancel }, PROFILES[difficulty]);
      feedback.update(practice.events); frameEvents.push(...practice.events);
      // Track what the simulation's buffer can still hold: a request we sent this tick, until something of ours starts (or a cancel).
      if (cancel || practice.events.some(e => e.actor === 0 && (e.type === 'AttackStarted' || e.type === 'ActionStarted'))) sent = null;
      if (action) sent = action;
      action = null; cancel = false; state = practice.fighter; accumulator -= step();
      if (practice.finish && !recorded) { recorded = true; recordFight(trial, scheme, practice.finish.victim === 1 && !practice.finish.draw, practice.duel.tick, RULES.health - practice.health, RULES.health - practice.playerHealth, Math.round(activeMs)); saveTrial(storage, trial); }
      // Freeze on the contact tick: the frame ends here and the leftover time is dropped, so no catch-up jump follows. The frozen frames show the
      // contact tick's bodies (previous = state), not a blend back toward the tick before it.
      const stop = stopFor(practice.events); if (stop) { hitStop = stop; accumulator = 0; previous = state; }
    }
  } else { accumulator = 0; previous = state; }
  const alpha = accumulator / step();
  try {
    view.render({ ...state, x: previous.x + (state.x - previous.x) * alpha, z: previous.z + (state.z - previous.z) * alpha, heading: previous.heading + wrapAngle(state.heading - previous.heading) * alpha }, locked, paused() ? 0 : dt, practice, frameEvents, hitStop > 0);
    frameEvents = [];
  } catch (error) {
    // Loss can happen inside a draw, before the browser delivers its context-lost event.
    if (!view.renderer.getContext().isContextLost()) throw error;
    pauseGraphics(); return;
  }
  updateHud();
  if (debug) { const d = element('debug'); d.textContent = describe(practice, difficulty); d.dataset.frozen = String(hitStop > 0); d.dataset.tick = String(practice.duel.tick); d.dataset.tip = (view.bladeTip?.() ?? []).map(v => v.toFixed(4)).join(','); }   // frame probe: frozen flag, tick and drawn blade tip
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
