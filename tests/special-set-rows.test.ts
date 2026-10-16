// Which named special an opponent casts is a ROW (src/fight/special-set-defs.json, built by src/fight/special-set-rows.ts; recce #2554 group B, slice 3). The move is byte-identical: the canonical JSON
// of SPECIAL_SETS and of specialOf for every opponent at every level 0..50 hashes to what the hand-written literal and the 36 / 41 / 46 thresholds in moves.ts hashed to on slice 2's chain before they went.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readdirSync, readFileSync } from 'node:fs';
import test from 'node:test';
import { OPPONENTS, RULES, SPECIAL_SETS, specialOf } from '../src/fight/moves.ts';
import { initialDuel, withSpecials } from '../src/fight/duel.ts';
import { SPECIAL_FROM, SPECIAL_RANK_LEVELS, specialStartOf } from '../src/fight/special-set-rows.ts';
import { bossSpecialId } from '../src/fight/special-identity.ts';

test('the special sets and the rank levels built from rows equal the old literal and thresholds', () => {
  const table: Record<string, (string | null)[]> = {};
  for (const id of Object.keys(OPPONENTS)) { table[id] = []; for (let level = 0; level <= 50; level++) table[id]!.push(specialOf(id as keyof typeof OPPONENTS, level)); }
  assert.equal(createHash('sha256').update(JSON.stringify({ SPECIAL_SETS, table })).digest('hex'), '8f4657e1b6f0394c550ae082a6b82e6f4a7a2fe913e945cec371e9373f0404ca');
  assert.deepEqual([...SPECIAL_RANK_LEVELS], [36, 41, 46]);
  assert.equal(Object.keys(SPECIAL_SETS).length, 11);
});

// A set row's optional `from` (a creature boss below the ladder's rank 8): only the Cave Troll carries one, every other opponent is the legacy rule (the first rank level, one special per rank), byte for byte.
test('from: the Cave Troll fires crackingground from level 2 and shares at the boss rate; every other opponent is unchanged', () => {
  assert.deepEqual({ ...SPECIAL_FROM }, { 'cave-troll': 2 });
  assert.equal(specialOf('cave-troll', 1), null); assert.equal(specialOf('cave-troll', 2), 'crackingground'); assert.equal(specialOf('cave-troll', 3), 'crackingground'); assert.equal(specialOf('cave-troll', 50), 'crackingground');
  for (const id of Object.keys(OPPONENTS).filter((o) => o !== 'cave-troll') as (keyof typeof OPPONENTS)[]) for (let level = 0; level <= 50; level++) {
    const set = Object.hasOwn(SPECIAL_SETS, id) ? SPECIAL_SETS[id]! : undefined, legacy = set && level >= SPECIAL_RANK_LEVELS[0]! ? set[SPECIAL_RANK_LEVELS.filter((from) => level >= from).length - 1]! : null;
    assert.equal(specialOf(id, level), legacy, `${id} L${level}`);
    assert.equal(specialStartOf(id), SPECIAL_RANK_LEVELS[0], `${id}: a ladder opponent starts at the first rank level`);
  }
  const share = (id: keyof typeof OPPONENTS, level: number) => withSpecials(initialDuel(OPPONENTS[id]), level, 'lunge', RULES, specialOf(id, level)).fighters[1].specialShare;
  assert.equal(share('cave-troll', 3), RULES.special.bossDamage, 'the troll casts its named special at the boss share');
  assert.equal(share('goblin', 3), RULES.special.damage, 'a level-3 goblin is the plain class skill');
  assert.equal(share('goblin', 36), RULES.special.bossDamage);
});

test('every special in a set row has a boss id, and a name no row has gets none', () => {
  for (const [opponent, specials] of Object.entries(SPECIAL_SETS)) for (const name of specials) assert.ok(bossSpecialId(name), `${opponent}: ${name} has no boss special id (special-identity.ts)`);
  for (const name of ['unknown', 'constructor', 'toString']) assert.equal(bossSpecialId(name), null);
  assert.equal(specialOf('constructor' as keyof typeof OPPONENTS, 46), null, 'an inherited property is not an opponent');
});

test('no src/fight file keeps a SPECIAL_SETS object literal: the rows are the one source', () => {
  for (const f of readdirSync(new URL('../src/fight/', import.meta.url)).filter((n) => n.endsWith('.ts'))) {
    const src = readFileSync(new URL(`../src/fight/${f}`, import.meta.url), 'utf8');
    assert.ok(!/(?:const|let|var)\s+SPECIAL_SETS\s*(?::[^=]+)?=\s*\{\s*\n?\s*\w+:\s*\[/.test(src), `${f} must not hand-write SPECIAL_SETS`);
  }
});
