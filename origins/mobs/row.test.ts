// Mob rows (row.ts), the Frontier's rows (frontier-rows.ts) and the generator (populate.ts): every validator rule has a failing row that yields exactly
// its code; the shipped rows are valid and agree with the content they sit beside; populateZone is deterministic and stays inside the zone's band.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { generateZone, type Template } from '../world/generate.ts';
import { frontierPlan } from '../preview/frontier-plan.ts';
import { mobLook } from '../preview/mob-looks.ts';
import { CREATURE_LOOT } from '../region1/content.ts';
import { FRONTIER_ROWS } from './frontier-rows.ts';
import { populateZone } from './populate.ts';
import { BOSS_CAMP_MAX, CAMP_MAX, rungWeights, validateMobRow, validateRows, type MobRow, type RowContext } from './row.ts';

const registry = frontierPlan().data.registry;
const ctx: RowContext = { look: mobLook, lootTables: new Set(registry.lootTables.keys()) };
const cited = { kind: 'folklore', work: 'A cited collection', locator: 'ch. 3' } as const;
const good: MobRow = { ...FRONTIER_ROWS[0]!, source: cited };
const codes = (row: MobRow, c: RowContext = ctx) => validateMobRow(row, c).map((i) => i.code);

test('the three shipped kinds are valid rows (their sources are pending, which the hand data may carry)', () => {
  assert.deepEqual(validateRows(FRONTIER_ROWS, ctx), []);
  assert.equal(FRONTIER_ROWS.length, 3);
});

test('the shipped rows agree with the content: loot is the creature\'s own table, the look exists, the band holds the character\'s level', () => {
  for (const r of FRONTIER_ROWS) {
    assert.equal(r.loot, CREATURE_LOOT[r.id], `${r.id}: loot is region1 creatureLoot`);
    assert.ok(mobLook(r.id), `${r.id}: has a look`);
    const form = registry.characters.get(r.id as never)!.encounterForms.find((f) => f.id === 'mob')!;
    assert.equal(r.level[0], form.level, `${r.id}: the band starts at the character's own level`);
  }
});

test('each rule has a failing row that yields exactly its code', () => {
  assert.deepEqual(codes(good), []);
  assert.deepEqual(codes({ ...good, source: undefined as never }), ['no-source']);
  assert.deepEqual(codes({ ...good, source: { kind: 'folklore', work: ' ' } }), ['no-source']);
  assert.deepEqual(codes({ ...good, role: 'archer' }), ['bad-role'], 'the old name archer is gone');
  assert.deepEqual(codes({ ...good, id: 'character:nobody' }), ['family-no-look']);
  assert.deepEqual(codes({ ...good, level: [14, 12] }), ['level-band']);
  assert.deepEqual(codes(good, { ...ctx, zone: { levelMin: 20, levelMax: 30 } }), ['level-band'], 'the band must meet the zone');
  assert.deepEqual(codes({ ...good, loot: 'loottable:gone' }), ['loot-unknown']);
  assert.deepEqual(codes({ ...good, behaviour: { ...good.behaviour, roam: 20 } }), ['roam-leash'], '20 m roam on the default 26 m leash');
  assert.deepEqual(codes({ ...good, behaviour: { ...good.behaviour, campSize: [1, CAMP_MAX + 1] } }), ['camp-size']);
  assert.deepEqual(codes({ ...good, behaviour: { ...good.behaviour, campSize: [4, 2] } }), ['camp-size']);
  assert.deepEqual(codes({ ...good, behaviour: { ...good.behaviour, campSize: [5, 5] } }), ['camp-size'], 'an ordinary camp is a leader and three');
  assert.deepEqual(codes({ ...good, bossCamp: true, behaviour: { ...good.behaviour, campSize: [6, 6] } }), [], 'a boss camp may be six');
  assert.deepEqual(codes({ ...good, bossCamp: true, behaviour: { ...good.behaviour, campSize: [1, BOSS_CAMP_MAX + 1] } }), ['camp-size']);
  assert.deepEqual(codes({ ...good, behaviour: { ...good.behaviour, aggro: 99 } }), ['behaviour-range']);
  assert.deepEqual(codes({ ...good, named: true }, { ...ctx, generated: true }), ['named-generated']);
  assert.deepEqual(validateRows([good, good], ctx).map((i) => i.code), ['dup-id']);
});

test('a pending source is allowed in hand data and refused by the generator; later rows need no look or source', () => {
  assert.deepEqual(codes(FRONTIER_ROWS[0]!), []);
  assert.deepEqual(codes(FRONTIER_ROWS[0]!, { ...ctx, generated: true }), ['no-source']);
  assert.deepEqual(codes({ ...good, id: 'character:later', source: undefined as never, later: true }), []);
});

test('source rules: literature needs year <= 1928 or author dead by 1955; scripture and a bare legend id', () => {
  const lit = (extra: object): MobRow => ({ ...good, source: { kind: 'literature', work: 'A novel', ...extra } });
  assert.deepEqual(codes(lit({ year: 1930, authorDied: 1990 })), ['no-source']);
  assert.deepEqual(codes(lit({ year: 1897 })), []);
  assert.deepEqual(codes(lit({ year: 1960, authorDied: 1940 })), []);
  assert.deepEqual(codes({ ...good, source: { kind: 'myth', work: 'A scripture', scripture: true } }), ['no-source']);
  assert.deepEqual(codes({ ...good, source: { legendId: 'legend:0042' } }), []);
});

test('bad-role reads Combat\'s MOB_STYLE, not a copy: every id it names is valid', () => {
  for (const role of ['brute', 'skirmisher', 'caster', 'beast']) assert.deepEqual(codes({ ...good, role }), [], role);
});

// ---- the generator ----

const WILDS: Template = {
  base: { layout: { entry: { u: 0.5, v: 0.05, facing: 180 }, camp: { u: 0.3, v: 0.5 }, lair: { u: 0.7, v: 0.9 }, ford: { u: 0.5, v: 0.7 } }, spawns: { boss: 'lair' } },
  vary: { 'zoneSize.width': [80, 230], 'zoneSize.depth': [80, 230], 'density.creatures': [0.3, 0.8], 'difficulty.levelMin': [11, 12], 'difficulty.levelMax': [13, 14] },
  jitter: 0.05,
};
const cited3 = FRONTIER_ROWS.map((r) => ({ ...r, source: cited }));

test('populateZone: deterministic, inside the zone, band met, count within one camp of the budget, never the boss anchor', () => {
  for (let seed = 1; seed <= 60; seed++) {
    const zone = generateZone(WILDS, seed);
    assert.ok(zone.ok);
    const a = populateZone(zone.value, cited3, seed, ctx), b = populateZone(zone.value, cited3, seed, ctx);
    assert.deepEqual(a, b, 'same inputs, same camps');
    assert.deepEqual(a.issues, [], `seed ${seed}: the zone rules (opener within 10 s, nothing dead for 15 s) hold`);
    const w = zone.value.zoneSize.width, d = zone.value.zoneSize.depth, n = a.camps.reduce((s, c) => s + c.members.length, 0);
    assert.ok(a.camps.length > 0 && n >= a.budget && n < a.budget + CAMP_MAX, `seed ${seed}: ${n} creatures for a budget of ${a.budget}`);
    for (const c of a.camps) {
      assert.notEqual(c.at, 'lair', 'the boss anchor is not a camp site');
      assert.notEqual(c.at, 'entry');
      for (const m of c.members) {
        assert.ok(m.x >= 0 && m.x <= w && m.z >= 0 && m.z <= d, 'inside the zone');
        assert.ok(m.level >= zone.value.difficulty.levelMin && m.level <= zone.value.difficulty.levelMax, 'inside the zone\'s band');
      }
    }
  }
});

test('populateZone: pending-source rows are rejected by name, a safe zone gets no creatures, and `stand` is honoured', () => {
  const zone = generateZone(WILDS, 7, { rules: { safe: true } });
  assert.ok(zone.ok);
  assert.equal(populateZone(zone.value, cited3, 7, ctx).camps.length, 0);
  const open = generateZone(WILDS, 7);
  assert.ok(open.ok);
  const refused = populateZone(open.value, FRONTIER_ROWS, 7, ctx);
  assert.equal(refused.camps.length, 0);
  assert.deepEqual(refused.rejected.map((r) => r.row), FRONTIER_ROWS.map((r) => r.id));
  assert.ok(refused.rejected.every((r) => r.issues.some((i) => i.code === 'no-source')));
  const none = populateZone(open.value, cited3, 7, ctx, () => false);
  assert.equal(none.camps.length, 0, 'no standable ground, no creatures');
});

// ---- tier rungs (ladder + rung) ----

const rung = (id: string, n: number, level: [number, number], ladder = 'goblin'): MobRow => ({ ...good, id, ladder, rung: n, level });
const lad = [rung('character:cinder-scavenger', 1, [11, 12]), rung('character:ruin-ghoul', 2, [12, 14]), rung('character:mere-brood', 3, [14, 16])];

test('ladder rules: each has a failing set that yields exactly its code', () => {
  const rc = (rows: MobRow[]) => validateRows(rows, ctx).map((i) => i.code);
  assert.deepEqual(rc(lad), []);
  assert.deepEqual(codes({ ...good, ladder: 'goblin' }), ['rung-ladder'], 'a ladder with no rung');
  assert.deepEqual(codes({ ...good, rung: 2 }), ['rung-ladder'], 'a rung with no ladder');
  assert.deepEqual(codes({ ...good, ladder: 'goblin', rung: 0 }), ['rung-ladder']);
  assert.deepEqual(rc([lad[0]!, { ...lad[1]!, rung: 1 }]), ['dup-rung']);
  assert.deepEqual(rc([lad[0]!, rung('character:ruin-ghoul', 2, [9, 10])]), ['rung-order'], 'rung 2 below rung 1');
  assert.deepEqual(rc([lad[0]!, rung('character:mere-mother', 2, [13, 14])]), ['ladder-body'], 'a witch on a goblin ladder');
});

test('rungWeights: the zone window picks the home rung; a row with no ladder keeps its weight', () => {
  const w = (lo: number, hi: number) => rungWeights(lad, { levelMin: lo, levelMax: hi });
  assert.deepEqual(w(11, 12), [10, 10 / 3, 0], 'rung 3 is outside a 11..12 zone');
  assert.deepEqual(w(15, 16), [0, 0, 10 * 2 / 3], 'only the top rung sits in 15..16');
  assert.deepEqual(rungWeights(FRONTIER_ROWS, { levelMin: 11, levelMax: 13 }), FRONTIER_ROWS.map((r) => r.weight ?? 10), 'Zone 1 rows have no ladder: unchanged');
});

// ---- rarity: uncommon curve, rares that take over a placeholder's camp ----

const common = { ...FRONTIER_ROWS[0]!, source: cited }, rare: MobRow = { ...FRONTIER_ROWS[1]!, source: cited, rarity: 'rare', replaces: common.id, chance: 0.2, level: [11, 13] };

test('rarity rules: each failing row yields exactly its code', () => {
  const rc = (rows: MobRow[]) => validateRows(rows, ctx).map((i) => i.code);
  assert.deepEqual(rc([common, rare]), []);
  assert.deepEqual(codes({ ...good, rarity: 'mythic' as never }), ['rarity-field']);
  assert.deepEqual(codes({ ...rare, replaces: undefined }), ['rarity-field'], 'a rare names its placeholder');
  assert.deepEqual(codes({ ...good, replaces: 'character:x' }), ['rarity-field'], 'only a rare replaces');
  assert.deepEqual(codes({ ...rare, chance: 0.9 }), ['rarity-field']);
  assert.deepEqual(codes({ ...good, chance: 0.1 }), ['rarity-field'], 'only a rare has a chance');
  assert.deepEqual(rc([rare]), ['rare-placeholder'], 'its placeholder is not in the set');
  assert.deepEqual(rc([common, { ...rare, replaces: rare.id }]), ['rare-placeholder'], 'not itself');
  assert.deepEqual(rungWeights([common, { ...common, id: 'character:ruin-ghoul', rarity: 'uncommon' }, rare], { levelMin: 11, levelMax: 13 }), [10, 3, 0], 'uncommon is x0.3, a rare is never drawn');
});

test('populateZone: a rare takes some placeholder camps, never stands alone, and a zone with no rare draws as before', () => {
  let rares = 0, camps = 0;
  for (let seed = 1; seed <= 60; seed++) {
    const zone = generateZone(WILDS, seed);
    assert.ok(zone.ok);
    const withRare = populateZone(zone.value, [common, rare], seed, ctx), again = populateZone(zone.value, [common, rare], seed, ctx);
    assert.deepEqual(withRare, again, 'seeded');
    for (const c of withRare.camps) { camps++; if (c.row === rare.id) rares++; else assert.equal(c.row, common.id); }
    assert.equal(populateZone(zone.value, [rare], seed, ctx).camps.length, 0, 'a rare alone makes nothing');
  }
  assert.ok(rares > 0 && rares < camps * 0.5, `${rares} rare camps of ${camps}: some, not most (chance 0.2)`);
});
