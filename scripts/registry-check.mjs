// The data gate for registry tables: finds every *.manifest.json under origins/, reads the rows beside it, runs the SAME loader the runtime uses
// (src/core/registry.ts) and prints each problem as file:row:id + the rule broken. Exit 1 on any problem. Usage: node scripts/registry-check.mjs [root]
import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { checkTables, tableFromFile } from '../src/core/server.ts';

const root = process.argv[2] ?? 'origins';
const walk = (d) => readdirSync(d, { withFileTypes: true }).flatMap((e) => e.isDirectory() ? (e.name === 'node_modules' ? [] : walk(join(d, e.name))) : e.name.endsWith('.manifest.json') ? [join(d, e.name)] : []);
export function gather(rootDir) {
  const tables = [];
  for (const mf of walk(rootDir).sort()) {
    const dir = dirname(mf);
    for (const m of JSON.parse(readFileSync(mf, 'utf8')).tables) {
      const file = join(dir, m.file);
      tables.push(tableFromFile(m, JSON.parse(readFileSync(file, 'utf8')), relative('.', file)));
    }
  }
  return tables;
}
const { problems } = checkTables(gather(root));
for (const p of problems) console.error(`${p.file}:${p.row}:${p.id} ${p.rule}: ${p.message}`);
if (problems.length) process.exit(1);
console.log(`registry: ${gather(root).length} tables clean`);
