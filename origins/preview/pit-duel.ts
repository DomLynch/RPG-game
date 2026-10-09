// The Pit duel, the arena game's own combat inside the Origins greybox. Loaded on demand (main.ts `import('./pit-duel.ts')`), so it is its own
// chunk of the greybox build and the walk never pays for it; nothing here is part of the live game's build.
// Read-only reuse of src/: the scene (src/scene.ts: rigs, arena, effects and the LIVE locked camera rig, untouched), the input layer
// (src/input.ts), the combat HUD (src/hud.ts) and the match session (src/match.ts) in its sparring mode, which records, awards and writes
// nothing (its ports here are in memory, never the game's localStorage). The simulation is the live one: stepPractice at 60 Hz on the
// career level's opponent and AI profile. What a finished duel pays is origins/pit/pit.ts's (award()), decided by the page, not here.
// The fight kit is the game's too (Strategy 2026-10-06, reuse don't copy): its controls, HUD bars and ☰ menu are the game's index.html
// markup, cut out at build time (live-kit.mjs), styled by the game's own src/style.css (imported here, on only while the duel is up) and
// sounded by its src/feedback.ts. The menu shows what a preview can honour: Sound, How to fight, and The Pit (= Leave the Pit).
import { idleIntent, type Duel, type Fighter, type Intent } from '../../src/duel.ts';
import { creaturesLook } from '../../src/fight/sound/creature.ts';
import { createFeedback } from '../../src/fight/sound/feedback.ts';
import { createHud } from '../../src/hud.ts';
import { initialPractice, PROFILES, stepPractice, type Practice } from '../../src/combat.ts';
import { createInput, type ControlIntent } from '../../src/input.ts';
import { legendForLevel, LEGEND_OPPONENTS, type LegendOpponent } from '../../src/legends.ts';
import { Match } from '../../src/match.ts';
import { OPPONENTS, RULES, weaponOf, type OpponentId } from '../../src/moves.ts';
import { bareName } from '../../src/roster.ts';
import { loadProfile, type StoragePort } from '../../src/profile.ts';
import { tierAt } from '../../src/grades.ts';
import { loadScorecard } from '../../src/scorecard.ts';
import { createScene, type WorldMount } from '../../src/scene.ts';
import { Matrix4, Quaternion } from 'three';
import { mobLayer } from '../mobs/kits.ts';
import type { MobStyle } from '../mobs/styles.ts';
import { STEP, wrapAngle } from '../../src/sim.ts';
import { loadTrial } from '../../src/trial.ts';
import { withBar } from '../shared/with-bar.ts';
import { recordWorldFight, worldRecord } from './world-record.ts';
import type { FightRecord } from '../../src/record.ts';
import { noTwist, stepTwist, type Twist, type TwistFlag, type TwistOutcome } from '../../src/twist.ts';
import liveStyle from '../../src/style.css?inline';
import type { Object3D, Vector3 } from 'three';
import { undressMob } from './mob-dress.ts';
import type { Finished } from '../pit/pit.ts';
import { addArenaEntry, addLeaveEntry } from './leave-entry.ts';

export type DuelFight = { opponent: string; level: number; seed: number; flags?: readonly TwistFlag[]; bar?: number; mob?: MobStyle; as?: Shown; record?: boolean };   // mob: the creature's style, which picks its signature moves (origins/mobs/kits.ts); absent = the Pit's plain warden   // flags: an encounter's twist flags (src/twist.ts), read each tick; absent = the Pit's plain duel; bar: the foe's health bar when it differs from his body's (one-health-bar: the summed pool)
// How a world creature shows in the duel (presentation only, the sim never sees it): its name and level in the HUD name slot, a one-time dressing of the
// foe rig, and the single "Back to the fields" button at the end in place of Rematch.
export type Shown = { name: string; level: number; dress?: (root: Object3D) => void };
export type DuelHooks = {
  ended(finish: Finished, record?: FightRecord | null): { next?: string } | void;   // record: only when the fight asked for one (DuelFight.record)   // the page settles the career; `next` names the next fight for the Rematch button
  again(): void;                                       // the Rematch / Next button
  stepped?(): void;                                    // once, after the duel's first simulated tick (the encounter online path marks its server token as played)
  twisted?(outcome: TwistOutcome, record?: FightRecord | null): void;               // an encounter's twist ended the fight with both fighters standing ('fled', 'escaped'); 'caught' arrives through ended() as the foe's defeat
};

// In-memory storage for the match's ports: the sparring mode writes nothing, and if it ever did, it would land here, never in localStorage.
const memory = (): StoragePort => { const m = new Map<string, string>(); return { getItem: (k) => m.get(k) ?? null, setItem: (k, v) => { m.set(k, String(v)); } }; };
const isLegend = (id: string): id is LegendOpponent => (LEGEND_OPPONENTS as readonly string[]).includes(id);
export const legendName = (opponent: string, level: number): string => (isLegend(opponent) ? legendForLevel(opponent, level).name : opponent);

type View = ReturnType<typeof createScene>;
type Stage = { opponent: OpponentId; level: number; canvas: HTMLCanvasElement; view: View; ready: boolean; mounted: boolean; holder: Object3D | null };
// ?worldfight: the duel runs inside the page's own world scene (scene.ts WorldMount). The page lends its renderer, canvas and a `holder` the world is moved into (attach) and out of
// (detach); `at` is where the hero stands and `toward` the creature, in world metres: the duel is placed so its player stands at `at` facing `toward`.
const CAMERA_EASE_S = 0.7;   // seamless combat step 4: the duel's camera eases from the walk's pose in this long
export type WorldDuel = WorldMount & { canvas: HTMLCanvasElement; attach(): void; detach(): void; cameraFrom?(): { position: Vector3; quaternion: Quaternion }; at: { x: number; z: number }; toward: { x: number; z: number }; groundY?: number };   // groundY: the walk ground's height at `at` (the hills), so the world lands on the duel's flat sand
let mounted: WorldDuel | null = null;
let stage: Stage | null = null;
let controls: ReturnType<typeof createInput> | null = null, hud: ReturnType<typeof createHud> | null = null;
let match: Match | null = null, fight: DuelFight | null = null, hooks: DuelHooks | null = null, steppedOnce = false;
let twist: Twist = noTwist(), dressed = false, dressedRoot: Object3D | null = null;
let running = false, frameId = 0, last = 0, accumulator = 0, next: string | undefined, result: Finished = null;
let state = { x: 0, z: 0, heading: 0, distance: 0 }, previous = state;
const seen = new Map<string, number>();   // for the test hook: how often the player's inputs started each action, attack and charge this duel
const saw = (name: string) => seen.set(name, (seen.get(name) ?? 0) + 1);
let feedback: ReturnType<typeof createFeedback> | null = null, journal: HTMLDialogElement | null = null, style: HTMLStyleElement | null = null, damageNumbers = true;

// The duel's DOM is the game's kit inside the duel layer (live-kit.mjs put it there), found by the ids the game's own input and HUD use;
// the build refuses a page where the walk shares one of them.
const element = <T extends HTMLElement>(id: string): T => {
  const el = document.getElementById(id) as T | null;
  if (!el) throw new Error(`pit duel: no #${id} on the page (live-kit.mjs)`);
  return el;
};
// The opponent's foe-holding test the game's sound reads (src/main.ts foeHolding): her swing parked in its chamber.
const CREATURES = creaturesLook(location.search);
const foeHolding = (f: Fighter) => f.phase === 'attack' && f.charge > 0 && f.move !== null && f.age <= (weaponOf(f.weapon).moves[f.move].chamber ?? -1);
// World mode (Dom 2026-10-07: the open world uses the Pit's controls exactly): the same kit and the same createInput drive the WALK. No duel is
// running, so the input reads an idle practice (every press is accepted) and the page turns the stick into walking and a press into an engage.
let world = false;
// The idle fighter has his weapon DRAWN (the Pit's own state after the first FIGHT tap), so the kit shows STAB, SLASH, KICK and HEAVY as it does mid-fight.
const idle = (() => {
  const rest = { move: { x: 0, z: 0, yaw: 0, run: false }, action: null, guard: false, held: false, lock: true, cancel: false } as unknown as Parameters<typeof stepPractice>[1];
  let p = stepPractice(initialPractice(), { ...rest, action: 'light' });
  for (let i = 0; i < 240 && p.phase !== 'ready'; i++) p = stepPractice(p, rest);
  return p;
})();
const paused = () => world ? document.hidden || !!journal?.open : !running || !stage?.ready || document.hidden || !!journal?.open;

function bind(leave: () => void) {
  feedback = createFeedback();
  // As the game: WebKit grants audio on touchend/click/keydown, so the whole family unlocks it (src/main.ts).
  for (const type of ['pointerdown', 'pointerup', 'touchend', 'click', 'keydown']) window.addEventListener(type, () => { if (running) feedback!.unlock(); }, { passive: true });
  controls = createInput({
    element, window, paused, now: () => performance.now(), matchMedia: (q) => matchMedia(q), innerWidth: () => innerWidth,
    ready: () => world || !!stage?.ready, practice: () => (world ? wsim : match!.practice), quiet: () => feedback!.quiet(),
  });
  hud = createHud(element);
  element('reset-button').addEventListener('click', () => hooks?.again());
  // Sound: the game's two toggles (the header's and the menu's), the game's handler. Not persisted, in the game either.
  for (const id of ['sound-button', 'mobile-sound'])
    element(id).addEventListener('click', () => {
      const enabled = feedback!.toggle();
      for (const target of ['sound-button', 'mobile-sound']) {
        element(target).textContent = enabled ? 'Sound on' : 'Sound off';
        element(target).setAttribute('aria-pressed', String(enabled));
      }
    });
  // The ☰ menu: the game's dialog, opened on its Settings tab (Gear, Stats and the fighter card are the game's career: hidden here,
  // index.html). The Pit leaves the duel for the walk (the Pit room in this preview); Arena and ✕ go back to the fight.
  journal = element<HTMLDialogElement>('journal');
  element('journal-button').addEventListener('click', () => { controls!.clear(); element<HTMLInputElement>('journal-tab-settings').checked = true; journal!.showModal(); });
  element('close-journal').addEventListener('click', () => journal!.close());
  element('nav-arena').addEventListener('click', () => journal!.close());
  addLeaveEntry(element('app-nav'), () => journal!.close(), leave);   // the game's own nav no longer carries The Pit (the Pit room was removed): the Origins duel adds its exit
  addArenaEntry(element('app-nav'), () => location.assign('/arena/'));   // first in the nav (prepended after the exit): the arena and its 50-level ladder at their stable path
  journal.addEventListener('close', () => { controls!.clear(); accumulator = 0; });
  window.addEventListener('blur', () => controls!.clear());
  document.addEventListener('visibilitychange', () => controls!.clear());
  // Damage numbers: on, as the game's default; its admin toggle's key is read, never written.
  try { damageNumbers = localStorage.getItem('frankendom.damage-numbers.v1') !== 'off'; } catch { /* storage blocked: the default */ }
}

// The game's stylesheet is the page's only while a duel is up: it styles the whole document (buttons, body), and the walk keeps its own look.
function liveLook(on: boolean) {
  if (!style) { style = document.createElement('style'); style.dataset.live = 'src/style.css'; style.textContent = liveStyle; document.head.append(style); }
  style.media = on ? 'all' : 'not all';
}

// The bars name the legend as the game does (src/main.ts nameOpponent): the name large, the class small beside it.
function nameOpponent(opponent: OpponentId, level: number, as?: Shown) {
  if (as) {
    const label = element('opponent-name'), small = document.createElement('small');
    small.className = 'opponent-class'; small.textContent = `Lv ${as.level}`; label.replaceChildren(`${as.name.toUpperCase()} `, small); label.dataset.mobile = as.name;
    for (const id of ['target-health', 'target-posture']) element(id).setAttribute('aria-label', `${as.name} ${id.slice(7)}`);
    return;
  }
  const label = element('opponent-name'), name = bareName(opponent), legend = isLegend(opponent) ? legendForLevel(opponent, level).name : null;
  const small = document.createElement('small');
  small.className = 'opponent-class'; small.textContent = `the ${name}`;
  if (legend) label.replaceChildren(`${legend.toUpperCase()} `, small); else label.textContent = `THE ${name.toUpperCase()}`;
  label.dataset.mobile = legend ?? name;
  const spoken = legend ? `${legend}, the ${name},` : name;
  element('target-health').setAttribute('aria-label', `${spoken} health`);
  element('target-posture').setAttribute('aria-label', `${spoken} posture`);
}

function stageFor(host: HTMLElement, opponent: OpponentId, level: number, mount?: WorldDuel) {
  if (stage && stage.opponent === opponent && stage.level === level && stage.mounted === !!mount) {   // the same scene again: its art is in, so the page's "Loading…" goes now
    if (stage.ready) element('art-status').textContent = '';
    return stage;
  }
  if (stage?.mounted) { stage.holder?.parent?.remove(stage.holder); stage.view.dispose(); }   // the old world-mounted scene lets go of the holder, then of its own GPU memory and resize listener (scene.ts dispose); the page's renderer is never disposed here
  else if (stage) { stage.view.renderer.dispose(); stage.view.renderer.forceContextLoss(); stage.canvas.remove(); }   // one GL context at a time
  stage = null;
  const canvas = mount?.canvas ?? document.createElement('canvas');
  if (!mount) {
    canvas.id = 'world'; canvas.tabIndex = 0; canvas.setAttribute('aria-label', 'The Pit duel');   // the game's #world: src/style.css places it
    host.prepend(canvas);
  }
  const status = document.getElementById('art-status');
  const made: Stage = { opponent, level, canvas, ready: false, view: undefined as unknown as View, mounted: !!mount, holder: mount?.holder ?? null };
  made.view = createScene(canvas, (line, kind) => {
    if (status) status.textContent = kind === 'ready' ? '' : line;
    made.ready = kind === 'ready';
  }, opponent, undefined, 'longsword', () => {}, level, undefined, mount);
  made.view.setTier(tierAt(level - 1)); made.view.setPlayerTier(tierAt(level - 1));   // the sparring look: his kit at the fight's rung (main.ts shownTier)
  return (stage = made);
}

// The holder carries the world into the duel's own coordinates: a world point w maps to the duel's player spot plus the world offset from `at`, turned so the duel's player-to-foe
// direction lies along `at` -> `toward`. The duel itself (sim, rigs, camera) is never moved.
function placeInWorld(mount: WorldDuel, p: { fighter: { x: number; z: number }; enemy: { x: number; z: number } }) {
  const angle = (x: number, z: number) => Math.atan2(x, z);
  const theta = angle(mount.toward.x - mount.at.x, mount.toward.z - mount.at.z) - angle(p.enemy.x - p.fighter.x, p.enemy.z - p.fighter.z);
  mount.holder.matrixAutoUpdate = false;
  mount.holder.matrix.copy(new Matrix4().makeTranslation(p.fighter.x, 0, p.fighter.z).multiply(new Matrix4().makeRotationY(-theta)).multiply(new Matrix4().makeTranslation(-mount.at.x, -(mount.groundY ?? 0), -mount.at.z)));
  mount.holder.matrixWorldNeedsUpdate = true;
}

// ?worldfight, seamless combat: build (and so warm: createScene compiles its shaders) the world-mounted stage for a creature BEFORE its tap, so the engage reuses it (stageFor's same-opponent rule).
let warmedFor: Stage | null = null;
let ownWarmed: Stage | null = null;
export type Warm = { world: Object3D; lights: Object3D[]; dress?: (root: Object3D) => void };   // the page's world scene, its lights (borrowed for the compile) and the foe's cloth
export function warmStage(host: HTMLElement, opponent: string, level: number, mount: WorldDuel, warm?: Warm): void {
  if (!(opponent in OPPONENTS)) return;
  const made = stageFor(host, opponent as OpponentId, level, mount);
  if (warm && warmedFor !== made) { warmedFor = made; void made.view.warmWorld(warm.world); }   // once per stage
  if (made.ready && ownWarmed !== made && !running) {   // the rigs are in: compile them, with the foe in its cloth (the creature's look is a material variant, so its program is cached for the fight), then take the cloth off again
    ownWarmed = made; const root = made.view.opponentRoot();
    if (root && warm?.dress) { warm.dress(root); void made.view.warmOwn(warm.lights).then(() => { if (!running && stage === made && dressedRoot !== root) undressMob(root); }); }
    else if (warm) void made.view.warmOwn(warm.lights);
  }
}

// Start (or restart) a duel in `host`. The same opponent at the same level keeps its scene; another one replaces it.
export function openDuel(host: HTMLElement, asked: DuelFight, page: DuelHooks, leave: () => void, mount?: WorldDuel) {
  if (!(asked.opponent in OPPONENTS)) throw new Error(`pit duel: unknown opponent ${asked.opponent}`);
  world = false; liveLook(true);
  if (!controls) bind(leave);
  const opponent = asked.opponent as OpponentId;
  if (dressedRoot) { undressMob(dressedRoot); dressedRoot = null; }   // the scene is reused for the same body and level: it goes back to its own cloth before any next fight
  fight = asked; hooks = page; steppedOnce = false; next = undefined; result = null; twist = noTwist();
  mounted?.detach(); mounted = null;   // a rematch in the same world: back out of the last mount, then in again below
  stageFor(host, opponent, asked.level, mount);
  const ports = { storage: memory(), trial: loadTrial(memory()), scorecard: loadScorecard(memory()), profile: loadProfile(memory(), () => 'origins-preview').profile };
  match = new Match(OPPONENTS[opponent], 'origins-preview', ports, asked.seed, 'longsword', null, asked.level);
  if (asked.mob) match.layer = mobLayer(asked.mob);
  match.startSparring({ weapon: 'longsword', skill: null, difficulty: asked.level });
  if (asked.record) recordWorldFight(match, asked.opponent, asked.level, asked.seed);
  if (asked.bar && asked.flags?.some((f) => f.kind === 'one-health-bar')) {   // the preview's sparring state only: the foe starts with the summed pool (nothing in src/ changes)
    match.practice = withBar(match.practice, asked.bar);
  }
  if (mount) { mount.attach(); mounted = mount; placeInWorld(mount, match.practice); const from = mount.cameraFrom?.(); if (from) { const m = mount.holder.matrix; stage!.view.easeCamera({ position: from.position.clone().applyMatrix4(m), quaternion: new Quaternion().setFromRotationMatrix(m).multiply(from.quaternion) }, CAMERA_EASE_S); } stage!.view.setWorldCamera(mount.walkCam ?? null); }   // the walk camera is in WORLD metres, the duel camera in the duel's own: carried through the holder first, or the ease swings through the arena
  if (!mount) stage!.view.setWorldCamera(null);
  state = previous = match.practice.fighter; accumulator = 0; seen.clear();
  nameOpponent(opponent, asked.level, asked.as); dressed = false;
  controls!.clear(); hud!.invalidate();
  if (!running) { running = true; last = performance.now(); frameId = requestAnimationFrame(frame); }
}

/** The walk uses the kit: bind it, switch the game's stylesheet on, and hand back the controls' intent each frame (a press is consumed when read). */
export function enterWorld(leave: () => void) { world = true; liveLook(true); if (!controls) bind(leave); controls!.clear(); }
// ROLL and GUARD in the open world are the Pit's own: a private practice (the same sim, the same stamina, the same roll distance and guard rules) is stepped at
// 60 Hz beside the walk. Its fighter is held at the arena's centre between rolls and its foe frozen 6 m ahead, so only what the sim DOES to the hero comes
// back: the ground a roll or backstep covers, and the phase (roll / backstep / guard) the page plays the rig's clip for. Attack presses are not sent here:
// they start the duel (main.ts), which is the same sim with a real foe.
let wsim: Practice = idle, wacc = 0;
const frozen = (): Intent => idleIntent();
export type WorldMove = { dx: number; dz: number; phase: string; stamina: number; facing: number };   // facing: the way the fighter faces (a roll turns him)
export function worldStep(dt: number, heading: number, i: ControlIntent): WorldMove {
  wacc = Math.min(wacc + dt, STEP * 6);
  let dx = 0, dz = 0;
  const rolling = (p: Practice) => p.phase === 'roll' || p.phase === 'backstep';
  while (wacc >= STEP) {
    wacc -= STEP;
    const [me, foe] = wsim.duel.fighters, from = rolling(wsim) ? me.body : { ...me.body, x: 0, z: 0 };
    const ahead = { ...foe.body, x: Math.sin(heading) * 6, z: Math.cos(heading) * 6 };
    wsim = { ...wsim, duel: { ...wsim.duel, fighters: [{ ...me, body: rolling(wsim) ? me.body : { ...from, heading }}, { ...foe, body: ahead }] as unknown as Duel['fighters'] } };
    const before = wsim.duel.fighters[0].body, action = i.action === 'dodge' || i.action === 'backstep' ? i.action : null;
    wsim = stepPractice(wsim, { move: { x: i.x, z: i.z, yaw: heading + Math.PI, run: i.run }, action, guard: i.guard, guardDirection: i.guardDirection ?? undefined, held: false, lock: false }, PROFILES.normal, frozen);
    const after = wsim.duel.fighters[0].body;
    if (rolling(wsim)) { dx += after.x - before.x; dz += after.z - before.z; }
  }
  return { dx, dz, phase: wsim.phase, stamina: wsim.duel.fighters[0].stamina, facing: wsim.duel.fighters[0].body.heading };
}
export function worldIntent(): ControlIntent {
  hud!.update(wsim, { controlsReady: true, debug: false, opponentId: 'veteran' });   // the game's own button states and labels (STAB, SLASH, KICK, HEAVY...) for an idle fighter
  const i = controls!.intent(); controls!.consumed([]); return i;
}

export function closeDuel() {
  mounted?.detach(); mounted = null;
  running = false; cancelAnimationFrame(frameId); controls?.clear(); feedback?.quiet();
  if (journal?.open) journal.close();
  liveLook(false);
}

function frame(now: number) {
  if (!running || !stage || !match) return;
  const raw = (now - last) / 1000, dt = Math.min(raw >= 0 && raw < 60 ? raw : 0, 0.1);
  last = now;
  if (!paused()) {
    accumulator += dt;
    while (accumulator >= STEP) {
      previous = state;
      const outcome = match.step(() => {
        const i = controls!.intent();
        // A world fight starts drawn: the engage press IS the fight, so the sheathed 'Fight' gate never shows. The draw is the fight's own first input (recorded like any other), taken on the first tick.
        const action = mounted && match!.practice.duel.fighters[0].phase === 'sheathed' ? 'light' : i.action;
        return { move: { x: i.x, z: i.z, yaw: stage!.view.yaw, run: i.run }, action, guard: i.guard, guardDirection: i.guardDirection ?? undefined, held: i.held, lock: true, cancel: i.cancel };
      });
      const p = match.practice;
      if (!steppedOnce) { steppedOnce = true; hooks?.stepped?.(); }
      for (const e of p.events) if (e.actor === 0) { if (e.type === 'ActionStarted') saw(e.action!); else if (e.type === 'AttackStarted') saw(e.move!); else if (e.type === 'Charged') saw('charged'); }
      feedback!.update(p.events, undefined, { match: match.seed, ended: !!p.finish, tick: p.duel.tick, drawing: p.duel.fighters[0].phase === 'draw', holding: foeHolding(p.duel.fighters[1]), opponent: stage.opponent,
        loiter: Math.max(p.duel.fighters[0].loiter, p.duel.fighters[1].loiter) / RULES.wall.loiter.ticks });   // the game's sound, fed as src/main.ts feeds it
      if (CREATURES && fight!.flags) for (const e of p.events) { if (e.type === 'Hit' && e.target === 0) feedback!.creature(stage.opponent, 'bite'); else if (e.type === 'Killed' && e.target === 1) feedback!.creature(stage.opponent, 'death'); }   // ?look=creatures: an encounter foe's bite on a landed blow and its death cry
      if (damageNumbers) hud!.floatDamage(p.events, p.duel.fighters, stage.view.project);
      controls!.consumed(match.practice.events);
      state = match.practice.fighter;
      accumulator -= STEP;
      if (fight!.flags?.length && outcome !== 'ended') {
        const t = stepTwist(p.duel, fight!.flags, twist);
        twist = t.twist;
        if (twist.outcome === 'fled' || twist.outcome === 'escaped') {   // no catch window / the window ran out: the fight ends with the foe alive
          running = false; hooks?.twisted?.(twist.outcome, worldRecord(match, null));   // no match.end(): it throws without a finish, which froze the duel here (sparring keeps nothing for end() to write)
          break;
        }
      }
      if (outcome === 'ended') {
        if (fight!.flags?.length && p.duel.finish?.victim === 1) twist = stepTwist(p.duel, fight!.flags, twist).twist;   // 'caught' inside the window
        match.end(false);   // sparring: no record, no mark, nothing written
        result = match.practice.finish;
        next = hooks?.ended(result, worldRecord(match, result))?.next;
      }
    }
  } else { accumulator = 0; previous = state; }
  const alpha = accumulator / STEP;
  stage.view.render({ ...state, x: previous.x + (state.x - previous.x) * alpha, z: previous.z + (state.z - previous.z) * alpha, heading: previous.heading + wrapAngle(state.heading - previous.heading) * alpha },
    true, paused() ? 0 : dt, match.practice, match.frameEvents, false, match.epoch, match.specialIdentity);   // locked: the live camera, always
  match.frameEvents = [];
  if (fight!.as?.dress && !dressed && stage.ready) { const root = stage.view.opponentRoot(); if (root) { fight!.as.dress(root); dressed = true; dressedRoot = root; } }
  hud!.update(match.practice, { legend: fight!.as?.name ?? legendName(fight!.opponent, fight!.level), controlsReady: stage.ready, debug: false, opponentId: stage.opponent, next: next ? { name: next } : undefined });   // not practiceOnly: a win here pays the Origins career (the page settles it), so the button names the next legend
  if (fight!.as) {   // a creature, not a legend: no rematch
    const again = element('reset-button'), status = element('combat-status');
    if (stage.mounted) { again.hidden = true; if (match.practice.finish) status.textContent = ''; }   // the wild has no fight end: no button, no win/lose line (main.ts worldEnded)
    else { again.textContent = 'Back to the fields'; status.textContent = status.textContent!.replace(' Ready for a rematch?', ''); }
  }
  frameId = requestAnimationFrame(frame);
}

// An encounter's twist state (src/twist.ts): read by encounter-duel.ts when the fight ends.
export const duelTwist = (): Twist => twist;

// For the test hook: what the duel is doing now.
export function duelState() {
  const p = match?.practice;
  return p && fight ? {
    opponent: fight.opponent, legend: legendName(fight.opponent, fight.level), level: fight.level, seed: fight.seed, ready: !!stage?.ready, running,
    tick: p.duel.tick, phase: p.phase, playerHealth: p.playerHealth, health: p.health, finish: result ?? p.finish,
    x: p.fighter.x, z: p.fighter.z, foe: { x: p.enemy.x, z: p.enemy.z }, gap: Math.hypot(p.enemy.x - p.fighter.x, p.enemy.z - p.fighter.z), seen: Object.fromEntries(seen), menu: !!journal?.open,
  } : null;
}
