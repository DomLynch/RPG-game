// The Pit duel, the arena game's own combat inside the Origins greybox. Loaded on demand (main.ts `import('./pit-duel.ts')`), so it is its own
// chunk of the greybox build and the walk never pays for it; nothing here is part of the live game's build.
// Read-only reuse of src/: the scene (src/scene.ts: rigs, arena, effects and the LIVE locked camera rig, untouched), the input layer
// (src/input.ts), the combat HUD (src/hud.ts) and the match session (src/match.ts) in its sparring mode, which records, awards and writes
// nothing (its ports here are in memory, never the game's localStorage). The simulation is the live one: stepPractice at 60 Hz on the
// career level's opponent and AI profile. What a finished duel pays is origins/pit/pit.ts's (award()), decided by the page, not here.
// The fight kit is the game's too (Strategy 2026-10-06, reuse don't copy): its controls, HUD bars and ☰ menu are the game's index.html
// markup, cut out at build time (live-kit.mjs), styled by the game's own src/style.css (imported here, on only while the duel is up) and
// sounded by its src/feedback.ts. The menu shows what a preview can honour: Sound, How to fight, and The Pit (= Leave the Pit).
import { type Fighter } from '../../src/duel.ts';
import { createFeedback } from '../../src/feedback.ts';
import { createHud } from '../../src/hud.ts';
import { createInput } from '../../src/input.ts';
import { legendForLevel, LEGEND_OPPONENTS, type LegendOpponent } from '../../src/legends.ts';
import { Match } from '../../src/match.ts';
import { OPPONENTS, RULES, weaponOf, type OpponentId } from '../../src/moves.ts';
import { bareName } from '../../src/roster.ts';
import { loadProfile, type StoragePort } from '../../src/profile.ts';
import { tierAt } from '../../src/grades.ts';
import { loadScorecard } from '../../src/scorecard.ts';
import { createScene } from '../../src/scene.ts';
import { STEP, wrapAngle } from '../../src/sim.ts';
import { loadTrial } from '../../src/trial.ts';
import liveStyle from '../../src/style.css?inline';
import type { Finished } from '../pit/pit.ts';

export type DuelFight = { opponent: string; level: number; seed: number };
export type DuelHooks = {
  ended(finish: Finished): { next?: string } | void;   // the page settles the career; `next` names the next fight for the Rematch button
  again(): void;                                       // the Rematch / Next button
};

// In-memory storage for the match's ports: the sparring mode writes nothing, and if it ever did, it would land here, never in localStorage.
const memory = (): StoragePort => { const m = new Map<string, string>(); return { getItem: (k) => m.get(k) ?? null, setItem: (k, v) => { m.set(k, String(v)); } }; };
const isLegend = (id: string): id is LegendOpponent => (LEGEND_OPPONENTS as readonly string[]).includes(id);
export const legendName = (opponent: string, level: number): string => (isLegend(opponent) ? legendForLevel(opponent, level).name : opponent);

type View = ReturnType<typeof createScene>;
type Stage = { opponent: OpponentId; level: number; canvas: HTMLCanvasElement; view: View; ready: boolean };
let stage: Stage | null = null;
let controls: ReturnType<typeof createInput> | null = null, hud: ReturnType<typeof createHud> | null = null;
let match: Match | null = null, fight: DuelFight | null = null, hooks: DuelHooks | null = null;
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
const foeHolding = (f: Fighter) => f.phase === 'attack' && f.charge > 0 && f.move !== null && f.age <= (weaponOf(f.weapon).moves[f.move].chamber ?? -1);
const paused = () => !running || !stage?.ready || document.hidden || !!journal?.open;

function bind(leave: () => void) {
  feedback = createFeedback();
  // As the game: WebKit grants audio on touchend/click/keydown, so the whole family unlocks it (src/main.ts).
  for (const type of ['pointerdown', 'pointerup', 'touchend', 'click', 'keydown']) window.addEventListener(type, () => { if (running) feedback!.unlock(); }, { passive: true });
  controls = createInput({
    element, window, paused, now: () => performance.now(), matchMedia: (q) => matchMedia(q), innerWidth: () => innerWidth,
    ready: () => !!stage?.ready, practice: () => match!.practice, quiet: () => feedback!.quiet(),
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
  element('nav-pit').addEventListener('click', () => { journal!.close(); leave(); });
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
function nameOpponent(opponent: OpponentId, level: number) {
  const label = element('opponent-name'), name = bareName(opponent), legend = isLegend(opponent) ? legendForLevel(opponent, level).name : null;
  const small = document.createElement('small');
  small.className = 'opponent-class'; small.textContent = `the ${name}`;
  if (legend) label.replaceChildren(`${legend.toUpperCase()} `, small); else label.textContent = `THE ${name.toUpperCase()}`;
  label.dataset.mobile = legend ?? name;
  const spoken = legend ? `${legend}, the ${name},` : name;
  element('target-health').setAttribute('aria-label', `${spoken} health`);
  element('target-posture').setAttribute('aria-label', `${spoken} posture`);
}

function stageFor(host: HTMLElement, opponent: OpponentId, level: number) {
  if (stage && stage.opponent === opponent && stage.level === level) {   // the same scene again: its art is in, so the page's "Loading…" goes now
    if (stage.ready) element('art-status').textContent = '';
    return stage;
  }
  if (stage) { stage.view.renderer.dispose(); stage.view.renderer.forceContextLoss(); stage.canvas.remove(); stage = null; }   // one GL context at a time
  const canvas = document.createElement('canvas');
  canvas.id = 'world'; canvas.tabIndex = 0; canvas.setAttribute('aria-label', 'The Pit duel');   // the game's #world: src/style.css places it
  host.prepend(canvas);
  const status = document.getElementById('art-status');
  const made: Stage = { opponent, level, canvas, ready: false, view: undefined as unknown as View };
  made.view = createScene(canvas, (line, kind) => {
    if (status) status.textContent = kind === 'ready' ? '' : line;
    made.ready = kind === 'ready';
  }, opponent, undefined, 'longsword', () => {}, level);
  made.view.setTier(tierAt(level - 1)); made.view.setPlayerTier(tierAt(level - 1));   // the sparring look: his kit at the fight's rung (main.ts shownTier)
  return (stage = made);
}

// Start (or restart) a duel in `host`. The same opponent at the same level keeps its scene; another one replaces it.
export function openDuel(host: HTMLElement, asked: DuelFight, page: DuelHooks, leave: () => void) {
  if (!(asked.opponent in OPPONENTS)) throw new Error(`pit duel: unknown opponent ${asked.opponent}`);
  liveLook(true);
  if (!controls) bind(leave);
  const opponent = asked.opponent as OpponentId;
  fight = asked; hooks = page; next = undefined; result = null;
  stageFor(host, opponent, asked.level);
  const ports = { storage: memory(), trial: loadTrial(memory()), scorecard: loadScorecard(memory()), profile: loadProfile(memory(), () => 'origins-preview').profile };
  match = new Match(OPPONENTS[opponent], 'origins-preview', ports, asked.seed, 'longsword', null, asked.level);
  match.startSparring({ weapon: 'longsword', skill: null, difficulty: asked.level });
  state = previous = match.practice.fighter; accumulator = 0; seen.clear();
  nameOpponent(opponent, asked.level);
  controls!.clear(); hud!.invalidate();
  if (!running) { running = true; last = performance.now(); frameId = requestAnimationFrame(frame); }
}

export function closeDuel() {
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
        return { move: { x: i.x, z: i.z, yaw: stage!.view.yaw, run: i.run }, action: i.action, guard: i.guard, guardDirection: i.guardDirection ?? undefined, held: i.held, lock: true, cancel: i.cancel };
      });
      const p = match.practice;
      for (const e of p.events) if (e.actor === 0) { if (e.type === 'ActionStarted') saw(e.action!); else if (e.type === 'AttackStarted') saw(e.move!); else if (e.type === 'Charged') saw('charged'); }
      feedback!.update(p.events, undefined, { match: match.seed, ended: !!p.finish, tick: p.duel.tick, drawing: p.duel.fighters[0].phase === 'draw', holding: foeHolding(p.duel.fighters[1]), opponent: stage.opponent,
        loiter: Math.max(p.duel.fighters[0].loiter, p.duel.fighters[1].loiter) / RULES.wall.loiter.ticks });   // the game's sound, fed as src/main.ts feeds it
      if (damageNumbers) hud!.floatDamage(p.events, p.duel.fighters, stage.view.project);
      controls!.consumed(match.practice.events);
      state = match.practice.fighter;
      accumulator -= STEP;
      if (outcome === 'ended') {
        match.end(false);   // sparring: no record, no mark, nothing written
        result = match.practice.finish;
        next = hooks?.ended(result)?.next;
      }
    }
  } else { accumulator = 0; previous = state; }
  const alpha = accumulator / STEP;
  stage.view.render({ ...state, x: previous.x + (state.x - previous.x) * alpha, z: previous.z + (state.z - previous.z) * alpha, heading: previous.heading + wrapAngle(state.heading - previous.heading) * alpha },
    true, paused() ? 0 : dt, match.practice, match.frameEvents, false, match.epoch, match.specialIdentity);   // locked: the live camera, always
  match.frameEvents = [];
  hud!.update(match.practice, { legend: legendName(fight!.opponent, fight!.level), controlsReady: stage.ready, debug: false, opponentId: stage.opponent, next: next ? { name: next } : undefined });   // not practiceOnly: a win here pays the Origins career (the page settles it), so the button names the next legend
  frameId = requestAnimationFrame(frame);
}

// For the test hook: what the duel is doing now.
export function duelState() {
  const p = match?.practice;
  return p && fight ? {
    opponent: fight.opponent, legend: legendName(fight.opponent, fight.level), level: fight.level, seed: fight.seed, ready: !!stage?.ready, running,
    tick: p.duel.tick, phase: p.phase, playerHealth: p.playerHealth, health: p.health, finish: result ?? p.finish,
    x: p.fighter.x, z: p.fighter.z, seen: Object.fromEntries(seen), menu: !!journal?.open,
  } : null;
}
