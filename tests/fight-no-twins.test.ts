// Dom's rule for the shared fight engine (2026-10-09): code is MOVED into src/fight/, never copied. A file under src/fight/ has no twin elsewhere in src/ or origins/:
//   - the same file name in src/ outside src/fight/ is allowed only as a pure re-export shim (`export ... from './fight/...'`, nothing else);
//   - no other source file shares a block of its code (10 or more identical, non-trivial lines), and none is byte-identical to it.
// Fails the PR that leaves the old copy behind (or pastes the code into a client).
import test from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { basename, join } from 'node:path';

const root = new URL('..', import.meta.url).pathname;
const walk = (dir: string): string[] => readdirSync(join(root, dir), { withFileTypes: true }).flatMap((e) => {
  const rel = `${dir}/${e.name}`;
  return e.isDirectory() ? (e.name === 'node_modules' ? [] : walk(rel)) : e.name.endsWith('.ts') && !e.name.endsWith('.test.ts') ? [rel] : [];
});
const text = (f: string): string => readFileSync(join(root, f), 'utf8');
const isShim = (src: string): boolean => src.split('\n').map((l) => l.trim()).filter((l) => l && !l.startsWith('//')).every((l) => /^export\b[^;]*\bfrom\s+'\.\/fight\/[^']+';?$/.test(l));
const solid = (src: string): string[] => src.split('\n').map((l) => l.trim()).filter((l) => l.length >= 40 && !l.startsWith('//') && !l.startsWith('*') && !l.startsWith('import '));

const engine = walk('src/fight');
const others = [...walk('src'), ...walk('origins')].filter((f) => !f.startsWith('src/fight/'));
const SHARED_LINES = 10;

test('src/fight/ has files (the scan is not empty)', () => assert.ok(engine.length >= 10, `found ${engine.length}`));

test('a file name in src/ that also exists in src/fight/ is only a re-export shim', () => {
  const names = new Set(engine.map((f) => basename(f)));
  const twins = others.filter((f) => f.startsWith('src/') && f.split('/').length === 2 && names.has(basename(f)) && !isShim(text(f)));
  assert.deepEqual(twins, [], 'the moved file left a copy in src/: delete it (git mv), or make it a pure `export * from ./fight/...` shim');
});

test('no source file copies a block of src/fight/ code or equals one byte for byte', () => {
  const owner = new Map<string, Set<string>>();
  for (const f of engine) for (const line of new Set(solid(text(f)))) (owner.get(line) ?? owner.set(line, new Set()).get(line)!).add(f);
  const copies: string[] = [];
  for (const f of others) {
    const src = text(f);
    if (isShim(src)) continue;
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
  assert.equal(isShim("export * from './fight/gore.ts';\n// note\nexport { a } from './fight/b.ts';"), true);
  assert.equal(isShim("export * from './fight/gore.ts';\nconst x = 1;"), false);
});
