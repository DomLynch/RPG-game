// Prints "<sha256 first 16> <path>" for every file the box's node services load (serverClosure), the list the writer parity check compares.
// Usage (deploy checkout at the release sha): node scripts/writer-closure-list.mjs > closure-<sha8>.txt
//   node scripts/writer-closure-list.mjs --paths verifier|writer|<entry,entry>   -> the install list, one path per line (deploy.sh's verifier step);
//                                                                                  exit 1 naming any import that resolves to no file
import { createHash } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { installList, serverClosure, VERIFIER_ENTRIES, WRITER_ENTRY } from './writer-closure.mjs';

const read = (p) => readFileSync(p, 'utf8');
if (process.argv[2] === '--paths') {
  const which = process.argv[3] || '';
  const entries = which === 'verifier' ? VERIFIER_ENTRIES : which === 'writer' ? [WRITER_ENTRY] : which.split(',').filter(Boolean);
  if (!entries.length) { console.error('usage: writer-closure-list.mjs --paths verifier|writer|<entry,entry>'); process.exit(2); }
  try { for (const f of installList(read, existsSync, entries)) console.log(f); } catch (error) { console.error(`writer-closure-list: ${error.message}`); process.exit(1); }
} else {
  for (const f of serverClosure(read, existsSync)) console.log(`${createHash('sha256').update(readFileSync(f)).digest('hex').slice(0, 16)} ${f}`);
}
