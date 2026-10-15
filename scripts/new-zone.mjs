// New zone: `node scripts/new-zone.mjs <N> [--biome ash-wastes] [--name "The Name"] [--from row.json]` writes origins/zone-rows/zone<N>.row.json and NOTHING else (plus, from the CLI, the generated registry)
// `--like <M> [--name "The Name"] [--stem tok] [--set look.sky=marsh]...` copies zone M's row as a new zone (N = the next free number): every place id that carries M's stem (its join link, e.g. `test` in test-field, test-gate, marsh-test) is renamed to the new stem, a clash with any other zone's ids is refused, and the registry is regenerated (zone 91 by hand took 3 min 55 s; Strategy 2026-10-15) (Dom 2026-10-09, plug and play; 2026-10-11 the row IS the zone).
// The registry is generated from the rows (`npm run zones`, which the vite build also runs), so the row is all a zone costs. Without --from the row starts as a skeleton: Zone 2's kit and looks (the node names are that
// kit's contract), no spawns (a zone with no rows is valid) and an empty `world` until its place and world data exist. Level = the zone number (Dom 2026-10-08).
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { BIOMES, DEFAULT_BIOME } from '../origins/zones/biomes.ts';
import { zoneFromRow } from '../origins/zones/from-row.ts';
import { zoneProblems } from '../origins/zones/loader.ts';
import { registrySource, ROWS_DIR, ZONES_DIR, zoneRows } from './gen-zones.mjs';

/** The text of a row file: two-space JSON, so a diff of a row is a diff of its data. */
export const rowText = (row) => `${JSON.stringify(row, null, 2)}\n`;

/** The ids a zone row owns, by where they live: its world zones, the keys of names, its camp, its place zones and their layout nodes and road ends, the joins' landmark/link/here/there/to and the waypoints. */
export function rowIds(row) {
  const out = new Set(), add = (v) => { if (typeof v === 'string' && v) out.add(v); };
  (row.world ?? []).forEach(add); Object.keys(row.names ?? {}).forEach(add); add(row.look?.props?.camp);
  for (const [zid, z] of Object.entries(row.place?.zones ?? {})) {
    add(zid); Object.keys(z.layout ?? {}).forEach(add);
    for (const c of Object.values(z.connections ?? {})) { add(c.to); add(c.here); add(c.there); }
  }
  for (const j of row.place?.joins ?? []) for (const k of ['landmark', 'link', 'here', 'there', 'to']) add(j[k]);
  (row.place?.waypoints ?? []).forEach(add);
  return out;
}

/** A copy of `row` with every id that carries the hyphen-segment `from` renamed to `to` (test-field -> <to>-field, marsh-test -> marsh-<to>, test -> <to>); ids without it (drowned-marsh) stay. */
export const renameId = (id, from, to) => typeof id === 'string' ? id.split('-').map((seg) => seg === from ? to : seg).join('-') : id;
export function renameIds(row, from, to) {
  const r = (id) => renameId(id, from, to);
  const out = structuredClone(row), rekey = (o, f = (v) => v) => Object.fromEntries(Object.entries(o).map(([k, v]) => [r(k), f(v)]));
  if (out.world) out.world = out.world.map(r);
  if (out.names) out.names = rekey(out.names);
  if (out.look?.props?.camp !== undefined) out.look.props.camp = r(out.look.props.camp);
  if (out.place?.zones) out.place.zones = rekey(out.place.zones, (z) => ({ ...z, ...(z.layout ? { layout: rekey(z.layout) } : {}),
    ...(z.connections ? { connections: Object.fromEntries(Object.entries(z.connections).map(([k, c]) => [k, { ...c, ...Object.fromEntries(['to', 'here', 'there'].filter((f) => c[f] !== undefined).map((f) => [f, r(c[f])])) }])) } : {}) }));
  if (out.place?.joins) out.place.joins = out.place.joins.map((j) => ({ ...j, ...Object.fromEntries(['landmark', 'link', 'here', 'there', 'to'].filter((f) => j[f] !== undefined).map((f) => [f, r(j[f])])) }));
  if (out.place?.waypoints) out.place.waypoints = out.place.waypoints.map(r);
  return out;
}

const setPath = (obj, path, value) => { const ks = path.split('.'); let o = obj; for (const k of ks.slice(0, -1)) { if (typeof o[k] !== 'object' || o[k] === null) throw new Error(`--set ${path}: ${k} is not an object in this row`); o = o[k]; } o[ks.at(-1)] = value; };
const slug = (text) => text.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');

/** The row for a new zone copied from zone `like` in `dir`: ids with the source stem renamed to `stem`, `set` overrides applied (['look.sky=marsh', ...]), clashes with every other zone's ids refused. Pure: returns { n, row }. */
export function likeRow({ like, n, name, stem, set = [], dir = ROWS_DIR }) {
  const src = `${dir}zone${like}.row.json`; if (!existsSync(src)) throw new Error(`--like ${like}: no ${src}`);
  const base = JSON.parse(readFileSync(src, 'utf8')), srcStem = base.place?.joins?.[0]?.link;
  if (!srcStem) throw new Error(`--like ${like}: the row has no place.joins[0].link to name its stem`);
  const numbers = zoneRows(dir).map((z) => z.n); n ??= Math.max(like, ...numbers) + 1;
  name = (name ?? '').trim() || `${base.name} ${n}`; stem = stem ?? slug(name); if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(stem)) throw new Error(`--stem ${JSON.stringify(stem)} is not a lower-case hyphen token`);
  if (stem === srcStem) throw new Error(`--stem ${stem} is the source zone's own stem: its ids would repeat`);
  const row = renameIds(base, srcStem, stem), mine = rowIds(row), theirs = new Map();
  for (const z of zoneRows(dir)) for (const id of rowIds(JSON.parse(readFileSync(`${dir}${z.file}`, 'utf8')))) if (!theirs.has(id)) theirs.set(id, z.id);
  const renamed = [...rowIds(base)].map((id) => renameId(id, srcStem, stem)).filter((id, k) => id !== [...rowIds(base)][k]), clash = [...new Set(renamed)].filter((id) => theirs.has(id));   // every id the rename PRODUCES must be new to every zone, the source included (shared ids such as drowned-marsh are not produced)
  if (clash.length) throw new Error(`ids already used by another zone: ${clash.map((id) => `${id} (zone ${theirs.get(id)})`).join(', ')}; pick another --stem`);
  row.name = name; if (row.names && Object.keys(row.names).length === 1 && row.world?.[0]) row.names = { [row.world[0]]: name };   // a one-place zone is named for its zone
  if (row.look?.props && row.world?.[0]) row.look.props.camp = row.world[0];   // the camp is in the zone's own world zone, never the source's
  row.notes = { ...(row.notes ?? {}), zone: `Zone ${n} (${name}): made by scripts/new-zone.mjs --like ${like} (ids renamed ${srcStem} -> ${stem}).` };
  for (const kv of set) { const i = kv.indexOf('='); if (i < 1) throw new Error(`--set ${kv}: expected path=value`); let v = kv.slice(i + 1); try { v = JSON.parse(v); } catch { /* a bare word is a string */ } setPath(row, kv.slice(0, i), v); }
  return { n, row };
}

/** Regenerates the registry from the rows in `dir` (what `npm run zones` does), so a new zone needs no manual step. */
export const register = ({ dir = ROWS_DIR, file = `${ZONES_DIR}registry.ts` } = {}) => { writeFileSync(file, registrySource(dir)); return file; };

export function newZone({ n, biome = DEFAULT_BIOME, name = `Zone ${n}`, dir = ROWS_DIR, row = /** @type {Record<string, any> | undefined} */ (undefined), like = undefined, stem = undefined, set = [] }) {
  if (like !== undefined) { const made = likeRow({ like, n, name: name === `Zone ${n}` ? undefined : name, stem, set, dir }); n = made.n; row = made.row; }
  if (!Number.isInteger(n) || n < 1) throw new Error(`zone number must be a positive integer, got ${n}`);
  if (row) { biome = row.biome ?? DEFAULT_BIOME; name = row.name ?? ''; }
  if (!Object.hasOwn(BIOMES, biome)) throw new Error(`unknown biome ${biome} (known: ${Object.keys(BIOMES).join(', ')})`);
  if (!name.trim()) throw new Error('zone name is empty');
  const file = `${dir}zone${n}.row.json`;
  if (existsSync(file)) throw new Error(`zone${n} already exists`);
  let made = row ? { ...row, name } : null;
  if (!made) {
    const base = JSON.parse(readFileSync(`${ROWS_DIR}zone2.row.json`, 'utf8'));
    made = { name, ...(biome === DEFAULT_BIOME ? {} : { biome }), names: {}, world: [], spawns: { openers: {}, rows: [] }, kit: base.kit, looks: base.looks,
      notes: { zone: `Zone ${n} (${name}): made by scripts/new-zone.mjs. \`level\` is the zone number = its base level (Dom 2026-10-08).`, kit: `Zone ${n}'s kit: a copy of Zone 2's until Characters ship this zone's own (the kit's node names are a contract).` } };
  }
  const bad = zoneProblems(zoneFromRow(n, made));   // checked before anything is written: a bad row leaves nothing behind
  if (bad.length) throw new Error(`row for zone ${n} is invalid: ${bad.join('; ')}`);
  writeFileSync(file, rowText(made));
  return file;
}

if (process.argv[1] === new URL(import.meta.url).pathname) {
  const args = process.argv.slice(2), opt = (flag) => { const i = args.indexOf(flag); return i < 0 ? undefined : args[i + 1]; }, all = (flag) => args.flatMap((a, i) => a === flag ? [args[i + 1]] : []);
  try {
    const like = opt('--like') === undefined ? undefined : Number(opt('--like')), first = args[0] && !args[0].startsWith('--') ? Number(args[0]) : undefined;
    if (like === undefined && first === undefined) throw new Error('a zone number (or --like <N>) is required');
    const from = opt('--from'), row = from ? JSON.parse(readFileSync(from, 'utf8')) : undefined;
    const file = newZone({ n: first, biome: opt('--biome'), name: opt('--name'), row, like, stem: opt('--stem'), set: all('--set') });
    register();   // the registry is generated from the rows: a new zone is never a manual step
    console.log(`wrote ${file} and regenerated origins/zones/registry.ts`);
  } catch (e) { console.error(`new-zone: ${e.message}\nusage: node scripts/new-zone.mjs <N> [--biome ${DEFAULT_BIOME}] [--name "The Name"] [--from row.json]\n       node scripts/new-zone.mjs --like <M> [N] [--name "The Name"] [--stem token] [--set look.sky=marsh]...`); process.exit(1); }
}
