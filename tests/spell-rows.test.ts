// Grimoire cast + per-legend kill provenance (Lead's queue 2026-10-13). ONE spell table (the 700-row catalogue) and ONE legend key (the spell id without `spell:`, what Backend's grimoire grants by).
import test from 'node:test';
import assert from 'node:assert/strict';
import { SPELL_OF_LEGEND, SPELL_ROWS, legendIdFor, legendOf } from '../src/fight/spell-legends.ts';
import { castOfLegend, specialOf, spellCast } from '../src/fight/spell-rows.ts';
import { SPECIALS } from '../src/fight/special-rows.ts';
import { CATALOGUE } from '../src/fight/catalogue-rows.ts';
import { cleanProvenance, decline, killAt, store } from '../src/core/loot.ts';
import { legendAt, rungTopLevel } from '../src/legends.ts';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

test('every one of the 700 catalogue spells casts through a special row of its root template, under its own id', () => {
  assert.equal(SPELL_ROWS.length, 700);
  assert.equal(Object.keys(SPELL_OF_LEGEND).length, 700, 'the legend key (id without spell:) is unique');
  for (const s of SPELL_ROWS) {
    const base = specialOf(s)!;
    assert.ok(base, `${s.id}: root "${s.bricks.root}" is a special template`);
    assert.deepEqual({ ...spellCast(s), id: base.id }, base, `${s.id} differs from its special in the id only`);
    assert.equal(spellCast(s).id, s.id);
  }
  assert.equal(castOfLegend('surtr')!.template, 'ashfall');
  assert.equal(castOfLegend('nobody'), undefined);
  assert.ok(SPECIALS.some((r) => r.template === 'crack'));
});

test('a kill carries the legend actually fought, resolved through the catalogue: the spell id without spell:, never a constructed string', () => {
  const surtr = killAt('pitborn', rungTopLevel(9), 1, 10, '2026-10-13', legendIdFor('pitborn', 9));
  assert.equal(surtr.tier, 9);
  assert.equal(legendAt('pitborn', 9).name, 'Surtr');
  assert.equal(surtr.legendId, 'surtr');
  assert.deepEqual(cleanProvenance(surtr), surtr, 'survives the loader');
  assert.equal(legendIdFor('pitborn', 1), undefined, 'a rank with no spell row is no legend');
  assert.equal(killAt('pitborn', rungTopLevel(1), 1, 10, '2026-10-13').legendId, undefined, 'no id given, none written');
  assert.equal(killAt('pitborn', rungTopLevel(9), 1, 10, '2026-10-13', 'Not An Id').legendId, undefined, 'a malformed id is not written');
  assert.equal(cleanProvenance({ ...surtr, legendId: 'Not An Id' })?.tier, 9, 'a malformed id is dropped on load, the kill kept');
  assert.equal(cleanProvenance({ ...surtr, legendId: 'Not An Id' })?.legendId, undefined);
  assert.equal(store(undefined, 'pitborn.Body', surtr).taken!['pitborn.Body']!.legendId, 'surtr', 'a take keeps it');
  assert.equal(decline(undefined, surtr).declined![0]!.legendId, 'surtr', 'a refusal keeps it');
});

test('every legendId killAt can write names a spell row Backend\'s grimoire would grant (or none); the ranked legends line up with the catalogue', () => {
  const grantable = new Set(SPELL_ROWS.filter((s) => s.id.startsWith('spell:')).map(legendOf));   // Backend: SPELL_BRICKS keys = the id without spell:
  let written = 0;
  for (const row of CATALOGUE) for (let rung = 1; rung <= 10; rung++) {
    const k = killAt(row.id as never, rungTopLevel(rung), 1, 10, '2026-10-13', legendIdFor(row.id, rung));
    assert.equal(k.legendId, legendIdFor(row.id, k.tier!), `${row.id}@${rung}`);
    if (k.legendId !== undefined) { written++; assert.ok(grantable.has(k.legendId), `${row.id}@${rung}: ${k.legendId} is a spell row`); }
    if (row.ranks.length && k.legendId) assert.equal(SPELL_OF_LEGEND[k.legendId]!.boss_legend, legendAt(row.id as never, k.tier!).name, `${row.id}@${rung} is the rank fought`);
  }
  assert.ok(written >= 50, 'the catalogue names legends on the ladder (58 today)');
});

// The page (src/main.ts) must not statically pull the 700-row catalogue into the entry chunk (Lead 2026-10-13): it loads on idle with a dynamic import. Walk the STATIC import graph from main.ts
// (`import ... from`, `export ... from`, side-effect imports; not `import type`, not `import(`) and refuse spell-legends.ts and every spells-*.json.
test('the entry chunk does not contain the spell catalogue: no static import path from src/main.ts reaches spell-legends.ts or spells-*.json', () => {
  const seen = new Set<string>(), bad: string[] = [], stack = [resolve('src/main.ts')];
  const edge = /^\s*(?:import|export)\s+(?!type\b)(?:[^'";]*?\sfrom\s+)?['"]([^'"]+)['"]/gm;
  while (stack.length) {
    const file = stack.pop()!;
    if (seen.has(file)) continue;
    seen.add(file);
    if (/spell-legends\.ts$|spells-[a-z-]+\.json$/.test(file)) { bad.push(file); continue; }
    if (!/\.ts$/.test(file)) continue;
    const src = readFileSync(file, 'utf8');
    for (const m of src.matchAll(edge)) if (m[1]!.startsWith('.')) stack.push(resolve(dirname(file), m[1]!));
  }
  assert.ok(seen.size > 100, `the walk reached the page's modules (${seen.size})`);
  assert.deepEqual(bad, [], 'a static import path reaches the spell catalogue');
  assert.match(readFileSync('src/main.ts', 'utf8'), /import\('\.\/fight\/spell-legends\.ts'\)/, 'main.ts loads it dynamically');
});
