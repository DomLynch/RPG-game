// Dom's rule for the shared fight engine (2026-10-09): code is MOVED into src/fight/, never copied. A file under src/fight/ has no twin elsewhere in src/ or origins/:
//   - no file in src/ outside src/fight/ has the same name: the OLD PATH IS ABSENT (a re-export shim does not count; every importer imports src/fight/ directly);
//   - no other source file shares a block of its code (10 or more identical, non-trivial lines), and none is byte-identical to it.
// Fails the PR that leaves the old copy behind (or pastes the code into a client).
import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

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

// The old home of a src/fight/<sub>/ folder when it is not src/<sub>/ (src/audio/* moved to src/fight/sound/*); a file directly in src/fight moved from src/.
const OLD_HOME: Record<string, string> = { sound: 'src/audio' };
/** The engine files whose old path is still present: src/fight/<name> against src/<name>, src/fight/<sub>/<name> against <old home of sub>/<name> (never against src/<name>: src/fight/duel.ts is not a twin of src/fight/sound/duel.ts). */
const twinsOf = (engineFiles: string[], otherFiles: string[]): string[] => {
  const present = new Set(otherFiles);
  return engineFiles.flatMap((e) => {
    const rel = e.slice('src/fight/'.length).split('/'), name = rel.pop()!, sub = rel.join('/');
    const old = sub ? `${OLD_HOME[sub] ?? `src/${sub}`}/${name}` : `src/${name}`;
    return present.has(old) && !KNOWN_SHIMS.includes(old) ? [`${old} (moved to ${e})`] : [];
  });
};

test('no file in src/ is the old path of a src/fight/ file: the old path is absent, no shim left behind', () => {
  assert.deepEqual(twinsOf(engine, others), [], 'the moved file left its old path: delete it (git mv) and import src/fight/ directly');
});

test('the twin check is path-aware: a real twin under a sub-folder fails, a same-named file elsewhere does not', () => {
  assert.deepEqual(twinsOf(['src/fight/sound/duel.ts'], ['src/fight/duel.ts']), [], 'src/fight/duel.ts is not the old path of src/fight/sound/duel.ts');
  assert.equal(twinsOf(['src/fight/sound/cues.ts'], ['src/audio/cues.ts']).length, 1, 'a copy left in src/audio fails');
  assert.equal(twinsOf(['src/fight/fx/spark.ts'], ['src/fx/spark.ts']).length, 1, 'a copy left in a same-named src/ folder fails');
  assert.equal(twinsOf(['src/fight/gore.ts'], ['src/gore.ts']).length, 1, 'a copy left in src/ fails');
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
