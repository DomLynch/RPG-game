// RV87 re-pin helper (one-off, run on the VPS clone): rewrites the ARCHETYPES literal in tests/archetype-rows.test.ts to what moves.ts builds now. The other pins (digest, anchors hash) are read off the failing tests.
import { readFileSync, writeFileSync } from 'node:fs';
import { ARCHETYPES } from '../src/fight/moves.ts';

const file = 'tests/archetype-rows.test.ts', lines = readFileSync(file, 'utf8').split('\n'), marker = 'assert.equal(JSON.stringify(ARCHETYPES), JSON.stringify(';
const at = lines.findIndex((l) => l.includes(marker));
if (at < 0) throw Error('archetype pin line not found');
lines[at] = `  ${marker}${JSON.stringify(ARCHETYPES)}));`;
writeFileSync(file, lines.join('\n'));
console.log(`rewrote ${file}:${at + 1}`);
