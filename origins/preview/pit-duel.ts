// The Pit duel, the arena game's own combat inside the Origins greybox. Loaded on demand (main.ts `import('./pit-duel.ts')`), so it is its own
// chunk of the greybox build and the walk never pays for it; nothing here is part of the live game's build.
// Read-only reuse of src/: the scene (src/scene.ts: rigs, arena, effects and the LIVE locked camera rig, untouched), the input layer
// (src/input.ts), the combat HUD (src/hud.ts) and the match session (src/match.ts) in its sparring mode, which records, awards and writes
// nothing (its ports here are in memory, never the game's localStorage). The simulation is the live one: stepPractice at 60 Hz on the
// career level's opponent and AI profile. What a finished duel pays is origins/pit/pit.ts's (award()), decided by the page, not here.
import { createHud } from '../../src/hud.ts';
import { createInput } from '../../src/input.ts';
import { legendForLevel, LEGEND_OPPONENTS, type LegendOpponent } from '../../src/legends.ts';
import { Match } from '../../src/match.ts';
import { OPPONENTS, type OpponentId } from '../../src/moves.ts';
import { loadProfile, type StoragePort } from '../../src/profile.ts';
import { tierAt } from '../../src/grades.ts';
import { loadScorecard } from '../../src/scorecard.ts';
import { createScene } from '../../src/scene.ts';
import { STEP, wrapAngle } from '../../src/sim.ts';
import { loadTrial } from '../../src/trial.ts';
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

// The duel's DOM is the page's: every control the live input and HUD bind to, looked up by data-ctl inside the duel layer (so the walk's
// own ids never collide with the game's).
function bind(host: HTMLElement) {
  const element = <T extends HTMLElement>(id: string): T => {
    const el = host.querySelector<T>(`[data-ctl="${id}"]`);
    if (!el) throw new Error(`pit duel: no [data-ctl="${id}"] in the duel layer`);
    return el;
  };
  const paused = () => !running || !stage?.ready || document.hidden;
  controls = createInput({
    element, window, paused, now: () => performance.now(), matchMedia: (q) => matchMedia(q), innerWidth: () => innerWidth,
    ready: () => !!stage?.ready, practice: () => match!.practice, quiet: () => {},
  });
  hud = createHud(element);
  element('reset-button').addEventListener('click', () => hooks?.again());
}

function stageFor(host: HTMLElement, opponent: OpponentId, level: number) {
  if (stage && stage.opponent === opponent && stage.level === level) return stage;
  if (stage) { stage.view.renderer.dispose(); stage.view.renderer.forceContextLoss(); stage.canvas.remove(); stage = null; }   // one GL context at a time
  const canvas = document.createElement('canvas');
  canvas.dataset.ctl = 'world';
  host.prepend(canvas);
  const status = host.querySelector<HTMLElement>('[data-ctl="art-status"]');
  const made: Stage = { opponent, level, canvas, ready: false, view: undefined as unknown as View };
  made.view = createScene(canvas, (line, kind) => {
    if (status) status.textContent = kind === 'ready' ? '' : line;
    made.ready = kind === 'ready';
  }, opponent, undefined, 'longsword', () => {}, level);
  made.view.setTier(tierAt(level - 1)); made.view.setPlayerTier(tierAt(level - 1));   // the sparring look: his kit at the fight's rung (main.ts shownTier)
  return (stage = made);
}

// Start (or restart) a duel in `host`. The same opponent at the same level keeps its scene; another one replaces it.
export function openDuel(host: HTMLElement, asked: DuelFight, page: DuelHooks) {
  if (!(asked.opponent in OPPONENTS)) throw new Error(`pit duel: unknown opponent ${asked.opponent}`);
  if (!controls) bind(host);
  const opponent = asked.opponent as OpponentId;
  fight = asked; hooks = page; next = undefined; result = null;
  stageFor(host, opponent, asked.level);
  const ports = { storage: memory(), trial: loadTrial(memory()), scorecard: loadScorecard(memory()), profile: loadProfile(memory(), () => 'origins-preview').profile };
  match = new Match(OPPONENTS[opponent], 'origins-preview', ports, asked.seed, 'longsword', null, asked.level);
  match.startSparring({ weapon: 'longsword', skill: null, difficulty: asked.level });
  state = previous = match.practice.fighter; accumulator = 0;
  const label = host.querySelector('[data-ctl="opponent-label"]');
  if (label) label.textContent = legendName(asked.opponent, asked.level);
  controls!.clear(); hud!.invalidate();
  if (!running) { running = true; last = performance.now(); frameId = requestAnimationFrame(frame); }
}

export function closeDuel() {
  running = false; cancelAnimationFrame(frameId); controls?.clear();
}

function frame(now: number) {
  if (!running || !stage || !match) return;
  const raw = (now - last) / 1000, dt = Math.min(raw >= 0 && raw < 60 ? raw : 0, 0.1);
  last = now;
  if (stage.ready && !document.hidden) {
    accumulator += dt;
    while (accumulator >= STEP) {
      previous = state;
      const outcome = match.step(() => {
        const i = controls!.intent();
        return { move: { x: i.x, z: i.z, yaw: stage!.view.yaw, run: i.run }, action: i.action, guard: i.guard, guardDirection: i.guardDirection ?? undefined, held: i.held, lock: true, cancel: i.cancel };
      });
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
    true, stage.ready ? dt : 0, match.practice, match.frameEvents, false, match.epoch, match.specialIdentity);   // locked: the live camera, always
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
  } : null;
}
