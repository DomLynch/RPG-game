// Origins O2: loading world data and resolving a zone. WORLD defaults (the schema's, then the data's `world` layer) → REGION overrides →
// ZONE overrides, deep-merged as partial objects, then validated as a whole: a field may be set at any layer, and only the merged result
// has to be valid. A zone file that omits a group, or a field, gets the default.
import { Issues, LOCAL_KEY, checkEnum, checkString, fail, isPlainObject, join, ok, readObject, type Obj, type Result } from '../contracts/core.ts';
import { parseId } from '../contracts/ids.ts';
import { CHECKS, SCHEMA, type Field, type Resolved, type Schema } from './schema.ts';

export const SCHEMA_VERSION = 1;
// Version → upgrade to the next version. Empty: v1 is the first. A new GROUP needs no migration (it has a default); only a rename or a
// change of meaning does.
export const MIGRATIONS: Readonly<Record<number, (data: Obj) => Obj>> = {};

type DeepPartial<T> = { [K in keyof T]?: T[K] extends object ? DeepPartial<T[K]> : T[K] };
export type Layer = DeepPartial<Resolved<typeof SCHEMA>>;
export type WorldData = { schemaVersion: number; world?: Layer; regions: Record<string, { params?: Layer; zones: Record<string, Layer> }> };

// Own keys only, written with defineProperty so a key spelled "__proto__" lands as data (and is then refused) instead of a prototype.
const put = (target: Obj, key: string, value: unknown) => Object.defineProperty(target, key, { value, enumerable: true, writable: true, configurable: true });
export function merge(base: unknown, over: unknown): unknown {
  if (over === undefined) return base;
  if (!isPlainObject(base) || !isPlainObject(over)) return over;
  const out: Obj = {};
  for (const k of Object.keys(base)) put(out, k, base[k]);
  for (const k of Object.keys(over)) put(out, k, merge(Object.hasOwn(base, k) ? base[k] : undefined, over[k]));
  return out;
}

export const fieldDefaults = (fields: Record<string, Field>): Obj => {
  const out: Obj = {};
  for (const [k, f] of Object.entries(fields)) if ('def' in f && f.def !== undefined) out[k] = f.def;
  return out;
};
// A keyed list (regions, zones, landmarks…): any keys, each checked by the caller.
const readMap = (issues: Issues, value: unknown, path: string): Obj | undefined => {
  if (isPlainObject(value)) return value;
  issues.add('not-object', path, 'expected a keyed object');
  return undefined;
};
export const defaultsOf = (schema: Schema): Obj =>
  Object.fromEntries(Object.entries(schema).map(([g, group]) => [g, 'fields' in group ? fieldDefaults(group.fields) : {}]));

// Parse the stored file: version first (upgrading through MIGRATIONS), then the region/zone shape. Layers are checked at resolve time.
export function loadWorld(raw: unknown, migrations = MIGRATIONS, current = SCHEMA_VERSION): Result<WorldData> {
  if (!isPlainObject(raw)) return fail('not-object', '(root)', 'world data is a plain object');
  let data: Obj = raw;
  const version = data.schemaVersion;
  if (typeof version !== 'number' || !Number.isInteger(version) || version < 1) return fail('missing-version', 'schemaVersion', 'schemaVersion (a whole number >= 1) is required');
  if (version > current) return fail('unsupported-version', 'schemaVersion', `schemaVersion ${version} is newer than this build (${current})`);
  for (let v = version; v < current; v++) {
    if (!Object.hasOwn(migrations, v)) return fail('no-migration', 'schemaVersion', `no migration from ${v} to ${v + 1}`);
    data = migrations[v]!(data);
  }
  data = { ...data, schemaVersion: current };
  const issues = new Issues();
  readObject(issues, data, '', ['schemaVersion', 'world', 'regions']);
  const regions = readMap(issues, data.regions, 'regions') ?? {};
  for (const [id, region] of Object.entries(regions)) {
    const path = join('regions', id);
    issues.absorb(parseId(id, 'region', path));
    const r = readObject(issues, region, path, ['params', 'zones']);
    if (r) {
      const zones = readMap(issues, r.zones, join(path, 'zones')) ?? {};
      for (const z of Object.keys(zones)) checkString(issues, z, join(join(path, 'zones'), z), { pattern: LOCAL_KEY });
    }
  }
  if (!issues.empty) return { ok: false, issues: issues.list };
  return ok(data as WorldData);
}

function checkField(issues: Issues, value: unknown, path: string, f: Field, refs: [string, string][]): unknown {
  switch (f.t) {
    case 'num':
    case 'int':
      if (typeof value !== 'number' || !Number.isFinite(value) || (f.t === 'int' && !Number.isInteger(value))) issues.add('wrong-type', path, `expected ${f.t === 'int' ? 'a whole' : 'a'} number (${f.unit})`);
      else if (value < f.min || value > f.max) issues.add('out-of-range', path, `${value} ${f.unit} is outside ${f.min}..${f.max}`);
      return value;
    case 'bool':
      if (typeof value !== 'boolean') issues.add('wrong-type', path, 'expected a boolean');
      return value;
    case 'enum':
      return checkEnum(issues, value, path, f.values);
    case 'ref':
      if (value === null && f.def === null) return null;
      if (checkString(issues, value, path, { pattern: LOCAL_KEY }) !== undefined) refs.push([path, value as string]);
      return value;
    case 'key':
    case 'zone':
      return checkString(issues, value, path, { pattern: LOCAL_KEY });
  }
}

// Validate one fully merged parameter object against the schema: unknown groups and fields refused, every field typed and in range,
// every landmark ref names a landmark, then the cross-field CHECKS.
export function validate<S extends Schema>(merged: unknown, schema: S, path = ''): Result<Resolved<S>> {
  const issues = new Issues(), refs: [string, string][] = [], out: Obj = {};
  const root = readObject(issues, merged, path, Object.keys(schema));
  if (!root) return { ok: false, issues: issues.list };
  for (const [g, group] of Object.entries(schema)) {
    const gp = join(path, g);
    if ('fields' in group) {
      const obj = readObject(issues, root[g], gp, Object.keys(group.fields));
      if (obj) for (const [k, f] of Object.entries(group.fields)) checkField(issues, obj[k], join(gp, k), f, refs);
      out[g] = obj;
      continue;
    }
    const entries = readMap(issues, root[g], gp), list: Obj = {};
    out[g] = list;
    if (entries) for (const [name, raw] of Object.entries(entries)) {
      const ep = join(gp, name);
      if (checkString(issues, name, ep, { pattern: LOCAL_KEY }) === undefined) continue;
      const entry = readObject(issues, merge(fieldDefaults(group.entries), raw), ep, Object.keys(group.entries));
      if (!entry) continue;
      put(list, name, entry);
      for (const [k, f] of Object.entries(group.entries)) {
        if (!Object.hasOwn(entry, k)) issues.add('missing-field', join(ep, k), `required field "${k}" is missing`);
        else checkField(issues, entry[k], join(ep, k), f, refs);
      }
    }
  }
  const layout = out.layout as Obj;
  for (const [p, name] of refs) if (!Object.hasOwn(layout, name)) issues.add('unknown-id', p, `no landmark "${name}" in this zone's layout`);
  if (!issues.empty) return { ok: false, issues: issues.list };
  for (const check of CHECKS) {
    const bad = check(out as never);
    if (bad) issues.add('rule-violation', join(path, bad[0]), bad[1]);
  }
  return issues.finish(out as Resolved<S>);
}

const regionOf = (data: WorldData, regionId: unknown) => {
  const id = parseId(regionId, 'region', 'regionId');
  if (!id.ok) return id;
  if (data.schemaVersion !== SCHEMA_VERSION) return fail('unsupported-version', 'schemaVersion', 'load world data through loadWorld first');
  if (!Object.hasOwn(data.regions, id.value)) return fail('unknown-id', 'regionId', `no region "${id.value}"`);
  return ok(data.regions[id.value]!);
};

export function resolveZone<S extends Schema = typeof SCHEMA>(data: WorldData, regionId: unknown, zoneId: unknown, schema: S = SCHEMA as unknown as S): Result<Resolved<S>> {
  const region = regionOf(data, regionId);
  if (!region.ok) return region;
  if (typeof zoneId !== 'string' || !LOCAL_KEY.test(zoneId)) return fail('bad-id', 'zoneId', `${JSON.stringify(zoneId)} is not a zone id`);
  if (!Object.hasOwn(region.value.zones, zoneId)) return fail('unknown-id', 'zoneId', `no zone "${zoneId}" in ${String(regionId)}`);
  const merged = [data.world, region.value.params, region.value.zones[zoneId]].reduce<unknown>(merge, defaultsOf(schema));
  return validate(merged, schema, zoneId);
}

// Every zone of a region, plus the links between them: each connection's target zone exists, its far landmark exists there, and a
// two-way link is answered by a link back between the same two landmarks.
export function resolveRegion(data: WorldData, regionId: unknown): Result<Map<string, Resolved<typeof SCHEMA>>> {
  const region = regionOf(data, regionId);
  if (!region.ok) return region;
  const issues = new Issues(), zones = new Map<string, Resolved<typeof SCHEMA>>();
  for (const id of Object.keys(region.value.zones)) {
    const zone = issues.absorb(resolveZone(data, regionId, id));
    if (zone) zones.set(id, zone);
  }
  if (!issues.empty) return { ok: false, issues: issues.list };
  for (const [id, zone] of zones) for (const [name, c] of Object.entries(zone.connections)) {
    const p = join(join(id, 'connections'), name), target = zones.get(c.to);
    if (!target) issues.add('unknown-id', join(p, 'to'), `no zone "${c.to}" in this region`);
    else if (!Object.hasOwn(target.layout, c.there)) issues.add('unknown-id', join(p, 'there'), `zone "${c.to}" has no landmark "${c.there}"`);
    else if (c.twoWay && !Object.values(target.connections).some((back) => back.to === id && back.here === c.there && back.there === c.here)) {
      issues.add('rule-violation', p, `two-way link to "${c.to}" has no link back`);
    }
  }
  return issues.finish(zones);
}
