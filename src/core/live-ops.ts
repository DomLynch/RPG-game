// Live-ops rows (top-30 item 28): scheduled events with a cron, and feature kill switches. Both are ROWS (the database tables of migration 202610120023, read by the writer once a minute),
// validated here through the shared registry loader; a row the loader refuses is dropped and reported, never applied, and never blocks the rows around it (a kill switch must still
// work when someone typos an event). Time is UTC. Pure: no clock, no database; the writer owns both (origins/server/live-ops.ts).
import { checkTables, type Manifest } from './registry.ts';

export type LiveEvent = { readonly id: string; readonly cron: string; readonly lengthMin: number; readonly kind: string; readonly params: Readonly<Record<string, unknown>>; readonly enabled: boolean };
export type LiveOps = { readonly events: readonly LiveEvent[]; readonly switches: ReadonlyMap<string, boolean> };
export type Rejected = { readonly table: string; readonly id: string; readonly why: string };

export const MAX_EVENT_MINUTES = 7 * 24 * 60;
export const EMPTY_LIVE_OPS: LiveOps = { events: [], switches: new Map() };

export const EVENT_MANIFEST: Manifest = { table: 'live-events', key: 'id', required: { id: 'string', cron: 'string', lengthMin: 'integer', kind: 'string', enabled: 'boolean' }, optional: { params: 'object' } };
export const SWITCH_MANIFEST: Manifest = { table: 'switches', key: 'key', required: { key: 'string', enabled: 'boolean' } };

type Field = { readonly any: boolean; readonly set: ReadonlySet<number> };
export type Cron = { readonly min: Field; readonly hour: Field; readonly dom: Field; readonly mon: Field; readonly dow: Field };

const RANGES: readonly [string, number, number][] = [['minute', 0, 59], ['hour', 0, 23], ['day-of-month', 1, 31], ['month', 1, 12], ['day-of-week', 0, 7]];

function field(text: string, name: string, lo: number, hi: number): Field | string {
  const set = new Set<number>();
  for (const part of text.split(',')) {
    const m = /^(\*|\d{1,2}(?:-\d{1,2})?)(?:\/(\d{1,2}))?$/.exec(part);
    if (!m) return `${name}: cannot read "${part}"`;
    const step = m[2] === undefined ? 1 : Number(m[2]);
    if (step < 1) return `${name}: step must be at least 1`;
    let a = lo, b = hi;
    if (m[1] !== '*') { const [x, y] = m[1]!.split('-'); a = Number(x); b = y === undefined ? (m[2] === undefined ? a : hi) : Number(y); }
    if (a < lo || b > hi || a > b) return `${name}: ${part} is outside ${lo}..${hi}`;
    for (let v = a; v <= b; v += step) set.add(v);
  }
  return { any: text === '*' || text === '*/1', set };
}

// Five fields: minute hour day-of-month month day-of-week. `*`, `a`, `a-b`, `*/n`, `a-b/n` and comma lists. Day-of-week 0 and 7 are both Sunday. As in cron, when BOTH day fields are
// restricted a time matches if EITHER does.
export function parseCron(text: string): Cron | string {
  const parts = text.trim().split(/\s+/);
  if (parts.length !== 5) return 'cron: five fields (minute hour day-of-month month day-of-week)';
  const out: Field[] = [];
  for (let i = 0; i < 5; i++) {
    const [name, lo, hi] = RANGES[i]!;
    const f = field(parts[i]!, name, lo, hi);
    if (typeof f === 'string') return f;
    out.push(f);
  }
  const dow = out[4]!;
  const set = new Set([...dow.set].map(v => v % 7));
  return { min: out[0]!, hour: out[1]!, dom: out[2]!, mon: out[3]!, dow: { any: dow.any, set } };
}

export function cronMatches(c: Cron, ms: number): boolean {
  const d = new Date(ms);
  if (!c.min.set.has(d.getUTCMinutes()) || !c.hour.set.has(d.getUTCHours()) || !c.mon.set.has(d.getUTCMonth() + 1)) return false;
  const domOk = c.dom.set.has(d.getUTCDate()), dowOk = c.dow.set.has(d.getUTCDay());
  return c.dom.any || c.dow.any ? domOk && dowOk : domOk || dowOk;
}

// Active at `ms`: some matching minute m exists with m <= ms < m + lengthMin.
export function eventActive(e: LiveEvent, ms: number): boolean {
  if (!e.enabled) return false;
  const c = parseCron(e.cron);
  if (typeof c === 'string') return false;
  const now = Math.floor(ms / 60_000) * 60_000;
  for (let k = 0; k < e.lengthMin; k++) if (cronMatches(c, now - k * 60_000)) return true;
  return false;
}

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);

// The rows as the database function returns them ({events:[...], switches:[...]}); anything wrong with a row drops that row only.
export function loadLiveOps(raw: unknown): { ops: LiveOps; rejected: Rejected[] } {
  const rejected: Rejected[] = [];
  const src = isObj(raw) ? raw : {};
  const rows = (v: unknown): Record<string, unknown>[] => (Array.isArray(v) ? v.filter(isObj) : []);
  const events: LiveEvent[] = [];
  for (const row of rows(src.events)) {
    const id = typeof row.id === 'string' ? row.id : '?';
    const { problems } = checkTables([{ manifest: EVENT_MANIFEST, rows: [row] }]);
    const cron = typeof row.cron === 'string' ? parseCron(row.cron) : 'cron: missing';
    const why = problems[0]?.message ?? (typeof cron === 'string' ? cron : !(Number(row.lengthMin) >= 1 && Number(row.lengthMin) <= MAX_EVENT_MINUTES) ? `lengthMin: 1..${MAX_EVENT_MINUTES}` : null);
    if (why) { rejected.push({ table: 'live-events', id, why }); continue; }
    events.push({ id, cron: row.cron as string, lengthMin: row.lengthMin as number, kind: row.kind as string, params: (row.params as Record<string, unknown> | undefined) ?? {}, enabled: row.enabled as boolean });
  }
  const switches = new Map<string, boolean>();
  for (const row of rows(src.switches)) {
    const id = typeof row.key === 'string' ? row.key : '?';
    const { problems } = checkTables([{ manifest: SWITCH_MANIFEST, rows: [row] }]);
    if (problems.length) { rejected.push({ table: 'switches', id, why: problems[0]!.message }); continue; }
    switches.set(id, row.enabled as boolean);
  }
  return { ops: { events, switches }, rejected };
}

// A key with no row is ON.
export const switchOn = (ops: LiveOps, key: string): boolean => ops.switches.get(key) ?? true;
export const activeEvents = (ops: LiveOps, ms: number): LiveEvent[] => ops.events.filter(e => eventActive(e, ms));
