// Prints "<sha256 first 16> <path>" for every file the box's node services load (serverClosure), the list the writer parity check compares.
// Usage (deploy checkout at the release sha): node scripts/writer-closure-list.mjs > closure-<sha8>.txt
import { createHash } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { serverClosure } from './writer-closure.mjs';

for (const f of serverClosure((p) => readFileSync(p, 'utf8'), existsSync)) console.log(`${createHash('sha256').update(readFileSync(f)).digest('hex').slice(0, 16)} ${f}`);
