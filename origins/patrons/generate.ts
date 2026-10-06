// Regenerates patrons.data.ts from the patron rows of docs/specs/origins/legends-500.csv.
//   node origins/patrons/generate.ts [path/to/legends-500.csv]
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { patronsFromCsv, renderData } from './csv.ts';

const csv = process.argv[2] ?? fileURLToPath(new URL('../../docs/specs/origins/legends-500.csv', import.meta.url));
const rows = patronsFromCsv(readFileSync(csv, 'utf8'));
writeFileSync(new URL('./patrons.data.ts', import.meta.url), renderData(rows));
console.log(`patrons.data.ts: ${rows.length} patrons from ${csv}`);
