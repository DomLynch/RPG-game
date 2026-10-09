// The ?look=<field.path>=<value> overlay (zone schema step C, Lead 2026-10-09): any schema field laid over the page's zone for one load, so a look is judged from a URL, no edit and no deploy.
// `?look=look.fog.density=0.03&look=look.exposure=1.6&look=look.timeOfDay.follow=false&look=look.timeOfDay.hour=22`. A `?look=` value with no `=` is a look PRESET name (zone1, duel, night, ...) and is not read here.
// Every key goes through the registry's own check (overlayProblem): an unknown field or a bad value is refused with the nearest known name, the rest still apply. Pure: no DOM, no three.js.
import { FIELDS, type Field } from '../zones/schema.ts';
import { overlayProblem } from '../zones/resolve.ts';
import type { ZoneFields } from './look.ts';

export type Overlay = { fields: Record<string, unknown>; set: string[]; problems: string[] };

const HEX6 = /^[0-9a-f]{6}$/i, HEX3 = /^[0-9a-f]{3}$/i;
// The URL gives text; the field's kind says what it should be. A value that cannot become that kind stays text, so overlayProblem refuses it by the same words as a zone file.
function coerce(f: Field, raw: string): unknown {
  switch (f.kind) {
    case 'number': return raw.trim() === '' ? raw : Number(raw);
    case 'boolean': return /^(true|1|on)$/i.test(raw) ? true : /^(false|0|off)$/i.test(raw) ? false : raw;
    case 'color': return HEX6.test(raw) || HEX3.test(raw) ? `#${raw}` : raw;   // '#' is a fragment in a URL: allow it left off
    case 'list': case 'point': case 'map': case 'terrain':
      try { return JSON.parse(raw); } catch { /* not JSON: a comma list of numbers is the short form for a point or list */ }
      return raw.split(',').every((p) => p.trim() !== '' && Number.isFinite(Number(p))) ? raw.split(',').map(Number) : raw;
    default: return raw;
  }
}

export function parseOverlay(search: string, fields: readonly Field[] = FIELDS): Overlay {
  const out: Overlay = { fields: {}, set: [], problems: [] }, byPath = new Map(fields.map((f) => [f.path, f]));
  for (const item of new URLSearchParams(search).getAll('look')) {
    const eq = item.indexOf('='); if (eq < 0) continue;   // a preset name, not an overlay
    const path = item.slice(0, eq).trim(), raw = item.slice(eq + 1), field = byPath.get(path);
    const value = field ? coerce(field, raw) : raw, why = overlayProblem(path, value, fields);
    if (why) { out.problems.push(`?look=${item}: ${why}`); continue; }
    out.fields[path] = value; if (!out.set.includes(path)) out.set.push(path);   // a repeated key: the last one wins
  }
  return out;
}

/** The zone's fields with the overlay laid over them: the overlay's paths count as SET, so the A2a readers act on them. */
export function withOverlay(z: ZoneFields, o: Overlay): ZoneFields {
  return o.set.length ? { fields: { ...z.fields, ...o.fields }, set: [...new Set([...(z.set ?? []), ...o.set])] } : z;
}
