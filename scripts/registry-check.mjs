// The data gate for registry tables: finds every *.manifest.json under origins/, reads the rows beside it, runs the SAME loader the runtime uses
// (src/core/registry.ts) and prints each problem as file:row:id + the rule broken. Exit 1 on any problem. Usage: node scripts/registry-check.mjs [root]
import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { buildTables, checkTables } from '../src/core/server.ts';
import { describeDuplicates, duplicateKeys } from './lib/json-dup-keys.mjs';

const root = process.argv[2] ?? 'origins';
const walk = (d) => readdirSync(d, { withFileTypes: true }).flatMap((e) => e.isDirectory() ? (e.name === 'node_modules' ? [] : walk(join(d, e.name))) : e.name.endsWith('.manifest.json') ? [join(d, e.name)] : []);
// JSON.parse keeps the LAST of two equal keys silently, so the RAW text of every rows file is scanned first (one shared scan, scripts/lib/json-dup-keys.mjs).
export function rawDuplicates(rootDir) {
  const out = [], seen = new Set();
  for (const mf of walk(rootDir).sort()) for (const m of JSON.parse(readFileSync(mf, 'utf8')).tables) {
    if (m.from) continue;
    const file = join(dirname(mf), m.file);
    if (seen.has(file)) continue;
    seen.add(file);
    try { out.push(...describeDuplicates(relative('.', file), duplicateKeys(readFileSync(file, 'utf8')))); } catch (e) { out.push(`${relative('.', file)}: ${e.message}`); }
  }
  return out;
}
export function gather(rootDir) {
  const entries = [];
  for (const mf of walk(rootDir).sort()) {
    const dir = dirname(mf);
    for (const m of JSON.parse(readFileSync(mf, 'utf8')).tables) {
      const file = join(dir, m.file ?? '');
      entries.push({ manifest: m, parsed: m.from ? undefined : JSON.parse(readFileSync(file, 'utf8')), file: relative('.', file) });
    }
  }
  return buildTables(entries);
}
const raw = rawDuplicates(root);
for (const r of raw) console.error(r);
if (raw.length) process.exit(1);
let external = {};
try { external = (await import('../origins/region1/content.ts')).REGISTRY_EXTERNAL; } catch (e) {
  if (!e.problems) throw e;   // the runtime load threw a RegistryError: its problems are the gate's answer
  for (const p of e.problems) console.error(`${p.file}:${p.row}:${p.id} ${p.rule}: ${p.message}`);
  process.exit(1);
}
const { problems } = checkTables(gather(root), external);
for (const p of problems) console.error(`${p.file}:${p.row}:${p.id} ${p.rule}: ${p.message}`);
if (problems.length) process.exit(1);
console.log(`registry: ${gather(root).length} tables clean`);
