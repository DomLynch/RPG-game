// Dom's rule for the shared fight engine (2026-10-09): code is MOVED into src/fight/, never copied. A file under src/fight/ has no twin elsewhere in src/ or origins/:
//   - no file in src/ outside src/fight/ has the same name: the OLD PATH IS ABSENT (a re-export shim does not count; every importer imports src/fight/ directly);
//   - no other source file shares a block of its code (10 or more identical, non-trivial lines), and none is byte-identical to it.
// Fails the PR that leaves the old copy behind (or pastes the code into a client).
import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { basename, join } from 'node:path';

const root = new URL('..', import.meta.url).pathname;
const walk = (dir: string): string[] => readdirSync(join(root, dir), { withFileTypes: true }).flatMap((e) => {
  const rel = `${dir}/${e.name}`;
  return e.isDirectory() ? (e.name === 'node_modules' ? [] : walk(rel)) : e.name.endsWith('.ts') && !e.name.endsWith('.test.ts') ? [rel] : [];
});
const text = (f: string): string => readFileSync(join(root, f), 'utf8');
const solid = (src: string): string[] => src.split('\n').map((l) => l.trim()).filter((l) => l.length >= 40 && !l.startsWith('//') && !l.startsWith('*') && !l.startsWith('import '));

const engine = walk('src/fight');
const others = [...walk('src'), ...walk('origins')].filter((f) => !f.startsWith('src/fight/'));
const SHARED_LINES = 10;
// Debt, not a licence: a re-export shim another lane left (K10 step 1, e37ac574d). Its owner deletes src/hud.ts and imports src/fight/hud.ts; the next test fails when it is gone, so this list is emptied then.
const KNOWN_SHIMS = ['src/hud.ts'];
test('every KNOWN_SHIMS entry still exists (delete the entry with the shim)', () => assert.deepEqual(KNOWN_SHIMS.filter((f) => !existsSync(join(root, f))), []));

test('src/fight/ has files (the scan is not empty)', () => assert.ok(engine.length >= 10, `found ${engine.length}`));

test('no file in src/ has the name of a src/fight/ file: the old path is absent, no shim left behind', () => {
  const names = new Set(engine.filter((f) => f.split('/').length === 3).map((f) => basename(f)));   // the files directly in src/fight (a sub-folder such as sound/ moved from src/audio/, not from src/)
  const twins = others.filter((f) => f.startsWith('src/') && f.split('/').length === 2 && names.has(basename(f)) && !KNOWN_SHIMS.includes(f));
  assert.deepEqual(twins, [], 'the moved file left its old path in src/: delete it (git mv) and import src/fight/ directly');
});

test('no source file copies a block of src/fight/ code or equals one byte for byte', () => {
  const owner = new Map<string, Set<string>>();
  for (const f of engine) for (const line of new Set(solid(text(f)))) (owner.get(line) ?? owner.set(line, new Set()).get(line)!).add(f);
  const copies: string[] = [];
  for (const f of others) {
    const src = text(f);
    const hits = new Map<string, number>();
    for (const line of new Set(solid(src))) for (const e of owner.get(line) ?? []) hits.set(e, (hits.get(e) ?? 0) + 1);
    for (const [e, n] of hits) if (n >= SHARED_LINES) copies.push(`${f} shares ${n} lines with ${e}`);
    for (const e of engine) if (src.length > 200 && src === text(e)) copies.push(`${f} is byte-identical to ${e}`);
  }
  assert.deepEqual(copies, [], 'code in src/fight/ is the one copy: import it, do not paste it');
});

test('the scan sees a copy (the check is not vacuous)', () => {
  const sample = solid(text(engine.find((f) => f.endsWith('fx.ts')) ?? engine[0]!));
  assert.ok(sample.length >= SHARED_LINES, 'fx.ts has enough solid lines to be detected as a copy');
  assert.ok(engine.some((f) => f.endsWith('/characters.ts')), 'characters.ts is an engine file whose old src/characters.ts path must stay absent');
});
