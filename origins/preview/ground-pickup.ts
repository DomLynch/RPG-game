// The pickup prompt for ground loot (ground loot slice 3, Backend's #2775 plan; donors EQEmu ground_spawns and 2004Scape Obj). The page asks ground_state, draws the rows the server says are visible with Characters' view
// (ground-item-view.ts), prompts "Take the <item>" inside a row's pickup radius and posts ground_take on the tap. The server decides reach and the race; this keeps no number and no label of its own:
// the poll period, the labels and each refusal's line and cue are the ground-pickup.json row, read ONCE here; the radius is the row ground_state sends (the ground-items.json row's).
// The poll (main.ts's timer) asks `poll(x, z, hidden)`: a hidden page or a hero farther than pollRangeM from every known item reads nothing, so an idle phone does not hammer the writer.
// Signed out: ground_state needs a session, so the static rows draw as the brief says ("signed out = shown, cannot take") with "Sign in to take".
import { loadRegistry, tableFromFile, type Manifest, type Offline } from '../../src/core/index.ts';
import { GROUND_ITEMS, GROUND_LIMITS } from '../world/ground-items.ts';
import { groundPointOf } from '../world/ground-point.ts';
import MANIFEST from './ground-pickup.manifest.json' with { type: 'json' };
import RULES from './ground-pickup.json' with { type: 'json' };
import type { GroundRow, GroundState, GroundTaken } from './ground-net.ts';

export type Outcome = { line: string; cue: 'refuse' | null };
export type PickupRules = { readonly pollSec: number; readonly emptyPollSec: number; readonly pollRangeM: number; readonly lineSec: number; readonly labels: { readonly take: string; readonly signedOut: string; readonly taken: string }; readonly outcomes: Readonly<Record<string, Outcome>> };

const text = (what: string, v: unknown): string => { if (typeof v !== 'string' || !v.trim()) throw new Error(`ground-pickup: ${what} is a line of text`); return v; };
/** The one loader: the registry's duplicate / missing / mistyped checks, then the rules the manifest cannot say (a poll period above 0, labels that name the {item}, every outcome a line and a cue of refuse or null, and the two the page falls back on: offline and taken). */
export function loadPickupRules(raw: unknown): PickupRules {
  const table = tableFromFile(MANIFEST.tables[0] as Manifest, raw, 'ground-pickup.json');
  loadRegistry([table]);
  const f = (table.rows as unknown as { id: string; fields: Record<string, unknown> }[]).find((r) => r.id === 'ground')?.fields;
  if (!f) throw new Error('ground-pickup: the "ground" row is missing');
  if (typeof f.pollSec !== 'number' || !(f.pollSec >= 1)) throw new Error('ground-pickup: pollSec is at least 1');
  if (typeof f.emptyPollSec !== 'number' || !(f.emptyPollSec >= f.pollSec)) throw new Error('ground-pickup: emptyPollSec is at least pollSec');
  if (typeof f.pollRangeM !== 'number' || !(f.pollRangeM > 0)) throw new Error('ground-pickup: pollRangeM is above 0');
  if (typeof f.lineSec !== 'number' || !(f.lineSec > 0)) throw new Error('ground-pickup: lineSec is above 0');
  const l = f.labels as Record<string, unknown> | undefined;
  if (!l) throw new Error('ground-pickup: labels is missing');
  const labels = { take: text('labels.take', l.take), signedOut: text('labels.signedOut', l.signedOut), taken: text('labels.taken', l.taken) };
  for (const [k, v] of Object.entries(labels)) if (!v.includes('{item}')) throw new Error(`ground-pickup: labels.${k} names the {item}`);
  const outcomes: Record<string, Outcome> = {};
  for (const [k, v] of Object.entries((f.outcomes ?? {}) as Record<string, { line?: unknown; cue?: unknown }>)) {
    if (v.cue !== null && v.cue !== 'refuse') throw new Error(`ground-pickup: outcomes.${k}.cue is "refuse" or null`);
    outcomes[k] = { line: text(`outcomes.${k}.line`, v.line), cue: v.cue };
  }
  for (const need of ['offline', 'taken']) if (!outcomes[need]) throw new Error(`ground-pickup: outcomes.${need} is missing`);
  return { pollSec: f.pollSec, emptyPollSec: f.emptyPollSec, pollRangeM: f.pollRangeM, lineSec: f.lineSec, labels, outcomes };
}
export const PICKUP: PickupRules = loadPickupRules(RULES);

/** The rows a signed-out page draws: the static ground-items rows, all visible and available (the take itself is the server's). */
export const staticRows = (): GroundRow[] => Object.entries(GROUND_ITEMS).map(([instance, r]) => ({ instance, item: r.item, zone: r.zone, place: r.place, ...(r.offsetX !== undefined ? { offsetX: r.offsetX, offsetZ: r.offsetZ } : {}), radiusM: r.radiusM ?? GROUND_LIMITS.defaultRadiusM, available: true, visible: true }));

export type GroundView = { show(id: string, itemId: string, at: { x: number; z: number }): void; hide(id: string): void };
export type GroundDeps = {
  view: GroundView;
  /** ground_state for this session, or the Offline answer (no session / failed). */
  read: () => Promise<GroundState | Offline>;
  /** ground_take for this session, or the Offline answer. */
  take: (instance: string) => Promise<GroundTaken | Offline>;
  signedIn: () => boolean;
  nameOf: (item: string) => string;
  /** The pack, read again after a take. */
  refreshPack: () => Promise<void>;
  /** feedback.groundLoot: the cue for a take (pickup) or a lost race (refuse). */
  cue: (kind: 'pickup' | 'refuse') => void;
  say: (line: string) => void;
  rules?: PickupRules;
};
type Placed = GroundRow & { at: { x: number; z: number } };

export function createGroundPickup(deps: GroundDeps) {
  const rules = deps.rules ?? PICKUP;
  let rows: Placed[] = [], busy = false, lastRead = -Infinity;
  const placed = (list: GroundRow[]): Placed[] => list.flatMap((r) => { const at = groundPointOf(r); return at ? [{ ...r, at }] : []; });   // a row this build cannot place is not drawn
  const apply = (list: GroundRow[]): void => {
    const next = placed(list), keep = new Set(next.filter((r) => r.visible).map((r) => r.instance));
    for (const old of rows) if (!keep.has(old.instance)) deps.view.hide(old.instance);
    for (const r of next) if (r.visible) deps.view.show(r.instance, r.item, r.at);
    rows = next;
  };
  const refuse = (code: string | undefined): Outcome => rules.outcomes[code ?? ''] ?? rules.outcomes.offline!;
  const nearest = (x: number, z: number): { instance: string; label: string } | null => {
    let best: Placed | null = null, bestD = Infinity;
    for (const r of rows) { const d = Math.hypot(x - r.at.x, z - r.at.z); if (r.visible && r.available && d <= r.radiusM && d < bestD) { best = r; bestD = d; } }
    return best && { instance: best.instance, label: (deps.signedIn() ? rules.labels.take : rules.labels.signedOut).replace('{item}', deps.nameOf(best.item)) };
  };
  /** Read the state (signed in) or take the static rows (signed out), then show and hide to match. A failed read leaves what is drawn. */
  const refresh = async (nowMs = Date.now()): Promise<void> => {
    lastRead = nowMs;
    if (!deps.signedIn()) { apply(staticRows()); return; }
    const got = await deps.read();
    if ('items' in got) apply(got.items);
  };
  return {
    pollSec: rules.pollSec,
    /** How long a result line holds the prompt's slot. */
    lineSec: rules.lineSec,
    refresh,
    /** The timer's tick: read only while the page is visible and the hero is within pollRangeM of an item. With no row known (nothing read yet, a failed read, a build that places none) it retries no faster than emptyPollSec, so the short poll never hammers the writer. */
    async poll(x: number, z: number, hidden: boolean, nowMs = Date.now()): Promise<void> {
      if (hidden) return;
      if (!rows.length) { if (nowMs - lastRead < rules.emptyPollSec * 1000) return; }
      else if (!rows.some((r) => Math.hypot(x - r.at.x, z - r.at.z) <= rules.pollRangeM)) return;
      await refresh(nowMs);
    },
    /** The row to prompt for at this point, within its radius: the nearest one that is visible and available. */
    nearest,
    /** The tap. Signed out: the line only. One take at a time. Success: hide it, refresh the pack, play the cue. A refusal: its row's line and cue; a lost race drops the item at once (the next state read confirms it). */
    async tap(instance: string): Promise<'taken' | 'refused' | 'signed-out' | 'busy'> {
      const row = rows.find((r) => r.instance === instance);
      if (!row) return 'refused';
      if (!deps.signedIn()) { deps.say(rules.labels.signedOut.replace('{item}', deps.nameOf(row.item))); return 'signed-out'; }
      if (busy) return 'busy';
      busy = true;
      try {
        const got = await deps.take(instance);
        if ('instance' in got) {
          deps.view.hide(instance); rows = rows.map((r) => (r.instance === instance ? { ...r, available: false } : r));
          deps.cue('pickup'); deps.say(rules.labels.taken.replace('{item}', deps.nameOf(got.item)));
          await deps.refreshPack().catch(() => {}); return 'taken';
        }
        const out = refuse(got.code ?? got.offline);
        deps.say(out.line); if (out.cue) deps.cue(out.cue);
        if (got.code === 'taken') { deps.view.hide(instance); rows = rows.filter((r) => r.instance !== instance); void refresh(); }   // the race is lost: gone from the screen and from here at once; the state read follows and keeps it gone while the server says so
        return 'refused';
      } finally { busy = false; }
    },
  };
}
