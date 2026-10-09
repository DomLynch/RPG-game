// Resolve a zone spec through the field registry (A1): defaults < biome < the zone's own overrides, arrays and maps replace whole, a missing field is filled, a version-1 zone loads after later schema versions,
// and an unknown or ill-typed field is REFUSED with its path (the nearest known field named, so a typo is obvious in one line). The later ?look= overlay validates through validateValue, the same registry.
// Pure: no DOM, no three.js, no clock (the server reads zones too).
import { BIOMES, DEFAULT_BIOME, type Spec } from './biomes.ts';
import { FIELDS, SCHEMA_VERSION, byPath, type Field } from './schema.ts';

export type Resolved = { values: Record<string, unknown>; tree: Spec; problems: string[]; unwired: string[] };
export type Migrations = Readonly<Record<number, (spec: Spec) => Spec>>;   // MIGRATIONS[v] upgrades a version-v spec to v+1
export const MIGRATIONS: Migrations = {};

const HEX = /^#[0-9a-f]{6}$/i, plain = (v: unknown): v is Spec => !!v && typeof v === 'object' && !Array.isArray(v);

/** Why `value` is not a legal value of `field`, or null. The ?look= overlay calls this too. */
export function badValue(field: Field, value: unknown): string | null {
  if (value === null) return field.nullable ? null : `${field.path} may not be null`;
  const num = (v: unknown) => typeof v === 'number' && Number.isFinite(v);
  switch (field.kind) {
    case 'string': return typeof value === 'string' ? null : `${field.path} must be a string`;
    case 'boolean': return typeof value === 'boolean' ? null : `${field.path} must be true or false`;
    case 'color': return typeof value === 'string' && HEX.test(value) ? null : `${field.path} must be a #rrggbb colour`;
    case 'number': return !num(value) ? `${field.path} must be a number` : field.min !== undefined && (value as number) < field.min ? `${field.path} is below ${field.min}` : field.max !== undefined && (value as number) > field.max ? `${field.path} is above ${field.max}` : null;
    case 'enum': return typeof value === 'string' && field.values!.includes(value) ? null : `${field.path} must be one of ${field.values!.join(' | ')}`;
    case 'list': return Array.isArray(value) ? null : `${field.path} must be a list`;
    case 'map': return plain(value) ? null : `${field.path} must be an object`;
    case 'point': return plain(value) && num(value.x) && num(value.z) ? null : `${field.path} must be {x, z}`;
    case 'terrain': {   // a tagged union, one per zone, never both (Strategy): the generator writes `generated`, Dom swaps to `heightmap`
      if (!plain(value)) return `${field.path} must be {kind: generated, seed, params} or {kind: heightmap, path}`;
      if (value.kind === 'generated') return num(value.seed) && plain(value.params) && Object.keys(value).length === 3 ? null : `${field.path}: generated needs exactly seed and params`;
      if (value.kind === 'heightmap') return typeof value.path === 'string' && value.path !== '' && Object.keys(value).length === 2 ? null : `${field.path}: heightmap needs exactly a path`;
      return `${field.path}.kind must be generated or heightmap`;
    }
  }
}

const distance = (a: string, b: string): number => {
  const d = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array(b.length).fill(0)] as number[]);
  for (let j = 1; j <= b.length; j++) d[0]![j] = j;
  for (let i = 1; i <= a.length; i++) for (let j = 1; j <= b.length; j++) d[i]![j] = Math.min(d[i - 1]![j]! + 1, d[i]![j - 1]! + 1, d[i - 1]![j - 1]! + (a[i - 1] === b[j - 1] ? 0 : 1));
  return d[a.length]![b.length]!;
};
export function nearest(path: string, fields: readonly Field[] = FIELDS): string {
  const names = new Set(fields.flatMap((f) => f.path.split('.').map((_, i, parts) => parts.slice(0, i + 1).join('.'))));
  return [...names].sort((x, y) => distance(path, x) - distance(path, y))[0] ?? '';
}

/** The leaf values of a nested spec as {path: value}; keys the registry does not know come back in `unknown`. */
function flatten(spec: Spec, fields: readonly Field[], into: Record<string, unknown>, unknown: string[], prefix = ''): void {
  const known = byPath(fields), groups = fields.map((f) => f.path);
  for (const [key, value] of Object.entries(spec)) {
    const path = prefix ? `${prefix}.${key}` : key;
    if (known.has(path)) into[path] = value;
    else if (plain(value) && groups.some((p) => p.startsWith(`${path}.`))) flatten(value, fields, into, unknown, path);
    else unknown.push(path);
  }
}
const nest = (values: Record<string, unknown>): Spec => {
  const tree: Spec = {};
  for (const [path, value] of Object.entries(values)) { const parts = path.split('.'); let at = tree; for (const p of parts.slice(0, -1)) at = (at[p] ??= {}) as Spec; at[parts.at(-1)!] = value; }
  return tree;
};

export type Options = { fields?: readonly Field[]; biomes?: Readonly<Record<string, Spec>>; migrations?: Migrations; version?: number };
export function resolveSpec(input: Spec, { fields = FIELDS, biomes = BIOMES, migrations = MIGRATIONS, version = SCHEMA_VERSION }: Options = {}): Resolved {
  const problems: string[] = [];
  let spec = input, v = typeof spec.schemaVersion === 'number' ? spec.schemaVersion : 1;
  if (v > version) problems.push(`schemaVersion ${v} is newer than this build (${version})`);
  for (; v < version; v++) { const step = migrations[v]; if (step) spec = step(spec); }   // a version with no step changed no meaning
  const values: Record<string, unknown> = {}, known = byPath(fields);
  for (const f of fields) values[f.path] = f.default;
  const biomeName = typeof spec.biome === 'string' ? spec.biome : DEFAULT_BIOME, biome = biomes[biomeName];
  if (!biome) problems.push(`biome "${biomeName}" is not a preset (${Object.keys(biomes).join(', ')})`);
  const layer = (src: Spec, label: string) => {
    const flat: Record<string, unknown> = {}, bad: string[] = []; flatten(src, fields, flat, bad);
    for (const p of bad) problems.push(`${label}: unknown field "${p}" (nearest: "${nearest(p, fields)}")`);
    for (const [p, val] of Object.entries(flat)) { const why = badValue(known.get(p)!, val); if (why) problems.push(`${label}: ${why}`); else values[p] = val; }
  };
  if (biome) layer(biome, `biome ${biomeName}`);
  layer(spec, 'zone');
  values.schemaVersion = version;
  return { values, tree: nest(values), problems, unwired: fields.filter((f) => !f.wired).map((f) => f.path) };
}

/** A zone's own spec resolved; `id` fills `id`, and a missing name falls to "Zone N" (a placeholder Dom renames, not a required field). */
export function resolveZone(id: string, zone: Spec, options?: Options): Resolved {
  const r = resolveSpec({ id, ...zone }, options);
  if (!r.values.name) { r.values.name = `Zone ${id}`; r.tree = nest(r.values); }
  return r;
}

/** The wired report: which fields take effect today and which do not (informational; the unwired count only goes down). */
export const wiredReport = (fields: readonly Field[] = FIELDS) => ({ wired: fields.filter((f) => f.wired).map((f) => f.path), unwired: fields.filter((f) => !f.wired).map((f) => ({ path: f.path, group: f.group, owner: f.owner })) });
/** For the ?look= overlay: `key=value` against the registry, the same refusal as a zone file. */
export function overlayProblem(path: string, value: unknown, fields: readonly Field[] = FIELDS): string | null {
  const f = byPath(fields).get(path); return f ? badValue(f, value) : `unknown field "${path}" (nearest: "${nearest(path, fields)}")`;
}
