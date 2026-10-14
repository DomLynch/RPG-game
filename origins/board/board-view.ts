// What the daily board screen shows, as data (top-30 #20, Web): today's tasks from the pure `dailyBoardFor`, each as a line built from its row and a text template, its reward, how many slots, and when the board resets.
// Pure: the clock and the names come in, no DOM, no storage. No task, creature, item or landmark is named here: the tasks are rows (daily-board.json), the sentences are rows (board-text.json), and every name
// is asked of the injected `Namer` (the page gives it the Region 1 registry's names, the catalogue's and the zone rows').
import TEXT from './board-text.json' with { type: 'json' };
import { boardDay, boardRule, dailyBoardFor, discoveryById, rewardById, type BoardRule, type BoardTask } from './daily-board.ts';

/** The shared board's seed. The server and every client must pass the same one for the same board; there is no per-player board. */
export const BOARD_SEED = 0;
export type Namer = { character(id: string): string; item(id: string): string; family(id: string): string; zone(id: string): string };
export type TaskView = { id: string; text: string; reward: string };
export type BoardView = { day: number; slots: number; cap: number; tasks: TaskView[]; resetsAtMs: number; resetsInMs: number; resetHourUtc: number };

const { chrome: CHROME, kinds: KINDS, rewardKinds: REWARD_KINDS, landmarks: LANDMARKS } = TEXT;
const fill = (template: string, values: Record<string, string | number>): string => template.replace(/\{(\w+)\}/g, (_, key: string) => String(values[key] ?? ''));
export const chromeText = (key: keyof typeof CHROME, values: Record<string, string | number> = {}): string => fill(CHROME[key], values);

// A target names what it is by its own prefix (`character:`, `item:`, `family:`); a bare id is a discovery row (a landmark in a zone).
function targetName(task: BoardTask, namer: Namer): string {
  const [scheme, rest] = task.target.includes(':') ? (task.target.split(/:(.*)/s) as [string, string]) : ['', task.target];
  if (scheme === 'character') return namer.character(task.target);
  if (scheme === 'item') return namer.item(task.target);
  if (scheme === 'family') return namer.family(rest);
  const d = discoveryById(task.target);
  return d ? fill(TEXT.discoverTarget, { landmark: LANDMARKS.find((l) => l.id === d.landmark)?.name ?? d.landmark, zone: namer.zone(d.zone) }) : task.target;
}
function rewardText(id: string, namer: Namer): string {
  const r = rewardById(id), t = r && REWARD_KINDS.find((k) => k.id === r.kind);
  return r && t ? fill(t.template, { amount: r.amount, item: r.item ? namer.item(r.item) : '' }) : '';
}
export const taskText = (task: BoardTask, namer: Namer): string => fill(KINDS.find((k) => k.id === task.kind)?.template ?? '{target}', { count: task.count, target: targetName(task, namer) });
export const resetAtMs = (day: number, rule: BoardRule): number => (day + 1) * 86_400_000 + rule.resetHourUtc * 3_600_000;
export function timeUntil(ms: number): string {
  const minutes = Math.max(0, Math.ceil(ms / 60_000)), h = Math.floor(minutes / 60), m = minutes % 60;
  return [h > 0 ? chromeText('hours', { n: h }) : '', m > 0 || h === 0 ? chromeText('minutes', { n: m }) : ''].filter(Boolean).join(' ');
}

/** Today's board at `nowMs`; null when there is no `daily` rule (then the screen says so). */
export function boardView(nowMs: number, namer: Namer, seed = BOARD_SEED, rule: BoardRule | null = boardRule()): BoardView | null {
  if (!rule) return null;
  const day = boardDay(nowMs, rule), at = resetAtMs(day, rule);
  return { day, slots: rule.slots, cap: rule.completionCap, resetHourUtc: rule.resetHourUtc, resetsAtMs: at, resetsInMs: at - nowMs,
    tasks: dailyBoardFor(seed, day, rule).map((t) => ({ id: t.id, text: taskText(t, namer), reward: rewardText(t.reward, namer) })) };
}
