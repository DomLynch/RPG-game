import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { test } from 'node:test';

// The page's entry bundle must not carry the grimoire's 700-spell catalogue (7 spells-*.json, ~300 KB; src/fight/boss-spells.ts): it is server-only (origins/server/grimoire.ts takes it directly).
const STATIC = /(?:^|\n)\s*(?:import|export)\b[^'"\n;]*?(?:from\s*)?['"](\.[^'"]+)['"]/g;
export function reaches(start: string, read: (f: string) => string = (f) => readFileSync(f, 'utf8'), exists: (f: string) => boolean = existsSync): string[] {
  const seen = new Set<string>();
  const walk = (f: string): void => {
    if (seen.has(f) || !exists(f) || !/\.(ts|mjs)$/.test(f)) { seen.add(f); return; }
    seen.add(f);
    for (const m of read(f).matchAll(STATIC)) walk(join(dirname(f), m[1]!));
  };
  walk(start); return [...seen];
}
const SPELLS = /(^|\/)(boss-spells\.ts|spells-[a-z-]+\.json)$/;

test('src/main.ts has no static import path to the spell catalogue', () => {
  const all = reaches('src/main.ts');
  assert.ok(all.length > 50 && all.includes('src/fight/server.ts'), 'the walk reaches the real graph, including the fight door');
  assert.deepEqual(all.filter((f) => SPELLS.test(f)), []);
});

test('the check sees the catalogue when the door re-exports it, or a module imports a spells json', () => {
  const read = (f: string) => readFileSync(f, 'utf8') + (f === 'src/fight/server.ts' ? "\nexport * from './boss-spells.ts';\n" : '');
  assert.ok(reaches('src/main.ts', read).some((f) => SPELLS.test(f)));
  const direct = (f: string) => readFileSync(f, 'utf8') + (f === 'src/main.ts' ? "\nimport X from './fight/spells-jade-reach.json' with { type: 'json' };\n" : '');
  assert.ok(reaches('src/main.ts', direct).some((f) => SPELLS.test(f)));
});

test('the grimoire still reaches the catalogue (it needs it)', () => {
  assert.ok(reaches('origins/server/grimoire.ts').some((f) => /spells-jade-reach\.json$/.test(f)));
});
