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
import { BOSS_CAMP_MAX, CAMP_MAX, validateMobRow, validateRows, type MobRow, type RowContext } from './row.ts';

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
  vary: { 'zoneSize.width': [80, 160], 'zoneSize.depth': [80, 160], 'density.creatures': [0.3, 0.8], 'difficulty.levelMin': [11, 12], 'difficulty.levelMax': [13, 14] },
  jitter: 0.05,
};
const cited3 = FRONTIER_ROWS.map((r) => ({ ...r, source: cited }));

test('populateZone: deterministic, inside the zone, band met, count within one camp of the budget, never the boss anchor', () => {
  for (let seed = 1; seed <= 60; seed++) {
    const zone = generateZone(WILDS, seed);
    assert.ok(zone.ok);
    const a = populateZone(zone.value, cited3, seed, ctx), b = populateZone(zone.value, cited3, seed, ctx);
    assert.deepEqual(a, b, 'same inputs, same camps');
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
