// A zone PACKAGE is the rows and asset references of one zone, gathered in one folder (docs/specs/zone-package.md): the zone row, its dungeon and theme rows, the exit rows it owns and the ones that arrive in it, and a manifest.
// `exportPackage` gathers it from the repo's shared tables; `importPackage` puts it back (replace by id, else append). The round trip is the proof the package loses nothing:
//   export(N) -> import into the tables WITHOUT the package's rows -> the tables hold the same rows (compared as canonical JSON, by id) and export(N) again is the same bytes.
// This is the step-1 prototype (no loader change): it reads and writes the existing row files only. Usage: node scripts/zone-package.mjs export <N> <dir> | check <N>
import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';

const ROOT = fileURLToPath(new URL('../', import.meta.url));
const SHARED = [   // the shared tables a package's rows live in: file, the array's key, the row key
  { name: 'exits', file: 'origins/zones/exit-rows.json', at: 'exits', key: 'id' },
  { name: 'dungeons', file: 'origins/zones/dungeon-rows.json', at: 'dungeons', key: 'id' },
  { name: 'themes', file: 'origins/zones/dungeon-themes.json', at: 'themes', key: 'id' },
];
export const canon = (v) => `${JSON.stringify(v, null, 2)}\n`;   // the package's own formatting: 2 spaces, a final newline
const sha = (s) => createHash('sha256').update(s).digest('hex');
const SCHEMA = 1;

export function loadTables(root = ROOT) { return Object.fromEntries(SHARED.map((t) => [t.name, JSON.parse(readFileSync(join(root, t.file), 'utf8'))[t.at]])); }
export const zoneRowText = (n, root = ROOT) => readFileSync(join(root, `origins/zone-rows/zone${n}.row.json`), 'utf8');

/** Gather zone N's package from the shared tables: { files: { name: text }, manifest }. Pure over its inputs. */
export function exportPackage(n, zoneText, tables) {
  const zone = JSON.parse(zoneText), dungeon = tables.dungeons.find((d) => d.id === zone.dungeon), usedTheme = dungeon && tables.themes.find((t) => t.id === dungeon.theme);
  // a theme two dungeons share is OWNED by the one whose id sorts first; the other only USES it (manifest uses.theme), so the generated table holds the row once
  const owner = usedTheme && tables.dungeons.filter((d) => d.theme === usedTheme.id).map((d) => d.id).sort()[0] === dungeon.id, theme = owner ? usedTheme : undefined;
  if (zone.dungeon && !dungeon) throw new Error(`zone ${n} names dungeon "${zone.dungeon}", which is not a row`);
  const worlds = new Set([...(zone.world ?? []), ...(dungeon ? [dungeon.world] : [])]);
  const owned = tables.exits.filter((e) => worlds.has(e.zone)), inbound = tables.exits.filter((e) => e.to === String(n) && !worlds.has(e.zone));
  const files = { 'zone.row.json': zoneText, ...(dungeon ? { 'dungeon.row.json': canon(dungeon) } : {}), ...(theme ? { 'theme.row.json': canon(theme) } : {}), 'exits.json': canon({ owned, inbound }) };
  const kitUrls = [...new Set([zone.kit?.url, usedTheme?.enclosure?.kit?.url].filter(Boolean))];
  const characters = (dungeon?.creatures ?? zone.spawns?.rows ?? []).map((c) => c.id).sort(), loot = (dungeon?.creatures ?? zone.spawns?.rows ?? []).map((c) => c.loot).filter(Boolean).sort();
  const manifest = { schema: SCHEMA, id: dungeon?.id ?? `zone${n}`, zone: Number(n), unlisted: zone.unlisted === true, world: [...worlds].sort(), owns: { exits: owned.map((e) => e.id).sort(), dungeon: dungeon?.id ?? null, theme: theme?.id ?? null, warps: [] }, inbound: { exits: inbound.map((e) => e.id).sort() }, uses: { kit: kitUrls, theme: usedTheme?.id ?? null, characters, loot }, files: Object.fromEntries(Object.entries(files).map(([f, t]) => [f, { bytes: Buffer.byteLength(t), sha256: sha(t) }])) };
  return { files: { ...files, 'package.json': canon(manifest) }, manifest };
}

/** Put a package's rows into the shared tables (replace the row with the same id, else append): returns the new tables and the zone row text. Pure. */
export function importPackage(files, tables) {
  const put = (list, row, key = 'id') => (list.some((r) => r[key] === row[key]) ? list.map((r) => (r[key] === row[key] ? row : r)) : [...list, row]);
  let { exits, dungeons, themes } = tables;
  const ex = JSON.parse(files['exits.json']);
  for (const e of [...ex.owned, ...ex.inbound]) exits = put(exits, e);
  if (files['dungeon.row.json']) dungeons = put(dungeons, JSON.parse(files['dungeon.row.json']));
  if (files['theme.row.json']) themes = put(themes, JSON.parse(files['theme.row.json']));
  return { tables: { exits, dungeons, themes }, zoneRow: files['zone.row.json'] };
}

/** The round trip for zone N against the repo: ok, or the first thing that differs. */
export function roundTrip(n, root = ROOT) {
  const zoneText = zoneRowText(n, root), tables = loadTables(root), first = exportPackage(n, zoneText, tables);
  const m = first.manifest, drop = (list, ids) => list.filter((r) => !ids.includes(r.id));
  const without = { exits: drop(tables.exits, [...m.owns.exits, ...m.inbound.exits]), dungeons: drop(tables.dungeons, [m.owns.dungeon]), themes: drop(tables.themes, [m.owns.theme]) };
  const back = importPackage(first.files, without), problems = [];
  if (back.zoneRow !== zoneText) problems.push('the zone row is not byte-identical');
  for (const t of SHARED) {
    const sorted = (list) => canon([...list].sort((a, b) => String(a[t.key]).localeCompare(String(b[t.key]))));
    if (sorted(back.tables[t.name]) !== sorted(tables[t.name])) problems.push(`table ${t.name} differs after the import`);
  }
  const again = exportPackage(n, back.zoneRow, back.tables);
  for (const f of Object.keys(first.files)) if (again.files[f] !== first.files[f]) problems.push(`export is not a fixed point: ${f}`);
  return { ok: problems.length === 0, problems, files: Object.fromEntries(Object.entries(first.files).map(([f, t]) => [f, { bytes: Buffer.byteLength(t), sha256: sha(t).slice(0, 12) }])), manifest: first.manifest };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const [cmd, n, dir] = process.argv.slice(2);
  if (cmd === 'export') { const { files } = exportPackage(n, zoneRowText(n), loadTables()); mkdirSync(dir, { recursive: true }); for (const [f, t] of Object.entries(files)) writeFileSync(join(dir, f), t); console.log(`wrote ${Object.keys(files).length} files to ${dir}`); }
  else if (cmd === 'check') { const r = roundTrip(n); console.log(JSON.stringify(r, null, 2)); process.exit(r.ok ? 0 : 1); }
  else { console.error('usage: node scripts/zone-package.mjs export <N> <dir> | check <N>'); process.exit(2); }
}
