// Origins O2: zones from a template and a seed. A template is a base layer plus declared ranges for any numeric field ("group.field")
// and a layout jitter; a seed picks inside them. Same template + seed → the same zone, byte for byte (a seeded PRNG, never Math.random),
// and every generated zone goes through the same validation as authored data.
import { Issues, fail, ok, type Obj, type Result } from '../contracts/core.ts';
import { defaultsOf, fieldDefaults, merge, validate, SCHEMA_VERSION, type Layer, type WorldData } from './resolve.ts';
import { SCHEMA, type Params } from './schema.ts';

export type Template = { base: Layer; vary: Record<string, readonly [number, number]>; jitter: number };

// mulberry32: a 32-bit seed, a uniform draw in [0, 1).
export function prng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 2 ** 32;
  };
}
const round = (x: number, step: number) => Math.round(x / step) * step;

function checkTemplate(t: Template, seed: number): Issues {
  const issues = new Issues();
  if (!Number.isInteger(seed) || seed < 0 || seed > 0xffffffff) issues.add('out-of-range', 'seed', 'a seed is a whole number 0..2^32-1');
  if (!(t.jitter >= 0 && t.jitter <= 0.5)) issues.add('out-of-range', 'jitter', 'layout jitter is 0..0.5 of the zone');
  for (const [path, [lo, hi]] of Object.entries(t.vary)) {
    const [g, k] = path.split('.'), group = Object.hasOwn(SCHEMA, g!) ? SCHEMA[g as keyof typeof SCHEMA] : undefined;
    const f = group && 'fields' in group && Object.hasOwn(group.fields, k!) ? (group.fields as Obj)[k!] as { t: string; min: number; max: number } : undefined;
    if (!f || (f.t !== 'num' && f.t !== 'int')) issues.add('unknown-field', `vary.${path}`, 'only numeric fields can vary');
    else if (!(lo >= f.min && hi <= f.max && lo <= hi)) issues.add('out-of-range', `vary.${path}`, `range ${lo}..${hi} is not inside ${f.min}..${f.max}`);
  }
  return issues;
}

export function generateZone(template: Template, seed: number, overrides: Layer = {}): Result<Params> {
  const issues = checkTemplate(template, seed);
  if (!issues.empty) return { ok: false, issues: issues.list };
  const rand = prng(seed), zone = merge(defaultsOf(SCHEMA), template.base) as Record<string, Obj>;
  for (const [path, [lo, hi]] of Object.entries(template.vary)) {
    const [g, k] = path.split('.') as [keyof typeof SCHEMA, string], f = (SCHEMA[g] as { fields: Obj }).fields[k] as { t: string };
    zone[g] = { ...zone[g], [k]: f.t === 'int' ? lo + Math.floor(rand() * (hi - lo + 1)) : round(lo + rand() * (hi - lo), 0.01) };
  }
  // Landmark defaults first (as resolve does), so a landmark that leaves u/v out is nudged from 0.5, not from undefined.
  const nudge = (x: number) => round(Math.min(1, Math.max(0, x + (rand() * 2 - 1) * template.jitter)), 0.0001), entry = fieldDefaults(SCHEMA.layout.entries);
  zone.layout = Object.fromEntries(Object.entries(zone.layout ?? {}).map(([k, l]) => {
    const full = merge(entry, l) as { u: number; v: number };
    return [k, { ...full, u: nudge(full.u), v: nudge(full.v) }];
  }));
  return validate(merge(zone, overrides), SCHEMA);
}

// A region of `count` generated zones z0…zN−1: a two-way gate chain z(i) ↔ z(i+1), plus seeded two-way roads back to earlier zones.
// Each link gets its own landmark on a random edge of each zone, facing out.
export function generateRegion(template: Template, seed: number, count: number, regionId = 'region:generated'): Result<WorldData> {
  if (!Number.isInteger(count) || count < 1 || count > 10_000) return fail('out-of-range', 'count', 'a region has 1..10000 zones');
  const rand = prng(seed ^ 0x9e3779b9), zones: Record<string, Params> = {};
  for (let i = 0; i < count; i++) {
    const zone = generateZone(template, (seed + Math.imul(i, 0x85ebca6b)) >>> 0);
    if (!zone.ok) return zone;
    zones[`z${i}`] = zone.value;
  }
  const end = (z: Params, to: string) => {
    const side = Math.floor(rand() * 4), t = round(rand(), 0.0001);
    z.layout[`to-${to}`] = [{ u: t, v: 0, facing: 180 }, { u: t, v: 1, facing: 0 }, { u: 0, v: t, facing: 90 }, { u: 1, v: t, facing: -90 }][side]!;
  };
  const link = (a: number, b: number, kind: 'gate' | 'road') => {
    const [za, zb] = [zones[`z${a}`]!, zones[`z${b}`]!];
    end(za, `z${b}`); end(zb, `z${a}`);
    za.connections[`z${b}`] = { to: `z${b}`, kind, here: `to-z${b}`, there: `to-z${a}`, twoWay: true };
    zb.connections[`z${a}`] = { to: `z${a}`, kind, here: `to-z${a}`, there: `to-z${b}`, twoWay: true };
  };
  for (let i = 1; i < count; i++) {
    link(i - 1, i, 'gate');
    const back = Math.floor(rand() * i);
    if (back < i - 1 && rand() < 0.3) link(back, i, 'road');
  }
  return ok({ schemaVersion: SCHEMA_VERSION, regions: { [regionId]: { zones } } });
}
