// Legend bosses: every spell-bearing legend of the Ash Frontier families is a fightable boss:<legend>, the server's real resolver prices it as its family's body at its rank's top level, a
// verified win settles it and takes the spell (the grimoire), a spellless legend or an unknown key resolves to nothing, and the spawn row kind validates against the real zones and landmarks.
import assert from 'node:assert/strict';
import test from 'node:test';
import { LEGEND_BOSSES, LEGEND_SPAWNS, bossFightId, legendBoss, legendBossesOf, legendSpawnsIn, loadLegendSpawns } from './legend-boss.ts';
import { resolveFromRegion1 } from '../server/encounter-setup.ts';
import { encounterOps } from '../server/encounter.ts';
import { ACCOUNT, CHAR, deps, fakeDb, fight } from '../server/encounter-fixtures.ts';
import { loadZone, zoneIds } from '../zones/loader.ts';
import { OPPONENTS, LEGEND_FAMILIES, isSpellless, rungTopLevel } from '../../src/fight/server.ts';
import { legendOfFight } from '../server/grimoire.ts';
import { MAX_LEVEL } from '../../src/fight/world.ts';
import { fightSetup, loadEncounterContent } from '../encounters/encounters.ts';

const ASH = 'region:ash-frontier';
const who = { account: ACCOUNT, character: CHAR };
const PLACED = [{ id: 'alvis-here', order: 1, legend: 'alvis', zone: 'cinder-fields', at: 'shrine' }] as const;   // a placement row for the resolver tests; the real table is LEGEND_SPAWNS

test('every spell-bearing legend of the Ash Frontier families is a legend boss: its family\'s body at its rank\'s top level', () => {
  const ash = legendBossesOf(ASH);
  const expected = LEGEND_FAMILIES.filter((f) => f.region === ASH).flatMap((f) => f.legends.filter((e) => !isSpellless(e.legendId) && legendOfFight(bossFightId(e.legendId)) !== null));
  assert.ok(ash.length >= 40, `${ash.length} Ash Frontier legend bosses`);
  assert.deepEqual(ash.map((b) => b.legend), expected.map((e) => e.legendId), 'in family then rank order');
  for (const b of LEGEND_BOSSES) {
    assert.ok(Object.hasOwn(OPPONENTS, b.enemy), `${b.legend}: ${b.enemy} is a body the duel can play`);
    assert.ok(b.level >= 1 && b.level <= MAX_LEVEL && b.level === rungTopLevel(b.rank), `${b.legend}: level ${b.level}`);
    assert.equal(b.fight, bossFightId(b.legend)); assert.equal(legendBoss(b.legend), b);
  }
  assert.equal(legendBoss('alvis')!.enemy, 'dwarf'); assert.equal(legendBoss('alvis')!.rank, 2);
});

test('a spellless legend, a legend no family wears and an unknown key are no boss', () => {
  assert.equal(legendBoss('crixus'), null, 'crixus teaches nothing');
  assert.equal(legendBoss('eloko'), null, 'a spell row, but no family wears it yet');
  assert.equal(legendBoss('no-such-legend'), null);
});

test('the server\'s real resolver prices boss:<legend>; a spellless, unknown or non-boss id resolves to nothing, and the old encounters still resolve', () => {
  const resolve = resolveFromRegion1(PLACED), alvis = legendBoss('alvis')!;
  assert.deepEqual(resolve(who, 'boss:alvis'), { enemy: 'dwarf', level: alvis.level, bar: null, flags: [], layer: null, instance: null });
  for (const id of ['boss:crixus', 'boss:eloko', 'boss:no-such-legend', 'boss:', 'legend:alvis']) assert.equal(resolve(who, id), null, id);
  const content = loadEncounterContent(); assert.ok(content.ok);
  const old = [...content.value.region.registry.encounters.keys()].filter((id) => fightSetup(id, content.value).ok);
  assert.ok(old.length > 0, 'the region has priceable encounters');
  for (const id of old) { const r = resolve(who, id), setup = fightSetup(id, content.value); assert.ok(r && setup.ok && r.enemy === setup.value.opponent.body && r.level === setup.value.opponent.level, `${id}: the existing path is unchanged`); }
});

test('an UNPLACED legend is refused: a direct encounter_start for a spell-row legend with no placement row resolves to nothing, starts no fight and takes no spell', async () => {
  const resolve = resolveFromRegion1(PLACED);
  for (const id of ['boss:eloko', 'boss:kobold', 'boss:bedivere', 'boss:mother-shipton']) assert.equal(resolve(who, id), null, `${id} has a spell row but no PLACED row here`);
  assert.equal(resolveFromRegion1([])(who, 'boss:alvis'), null, 'no placement rows at all: no legend resolves');
  assert.equal(resolveFromRegion1()(who, 'boss:alvis'), null, 'the shipped table does not place alvis');
  const h = fakeDb({ t: 1e6 }), ctx = { db: h.db, account: ACCOUNT };
  const ops = encounterOps(deps({ resolve: resolveFromRegion1(PLACED), verify: () => ({ ok: true, result: 'won', twist: null, ticks: 300 }) }));
  const refused = await ops.encounter_start!(ctx, { character: CHAR, encounter: bossFightId('kobold') });
  assert.ok(!('token' in (refused as object)), 'no fight token for an unplaced legend'); assert.deepEqual([...h.grimoire.keys()], [], 'no spell');
});

test('a verified win on a legend boss, started through the real resolver, settles and takes the spell; a second win takes nothing more', async () => {
  const h = fakeDb({ t: 1e6 }), ctx = { db: h.db, account: ACCOUNT };
  const ops = encounterOps(deps({ resolve: resolveFromRegion1(PLACED), verify: () => ({ ok: true, result: 'won', twist: null, ticks: 300 }) }));
  for (const round of [1, 2]) {
    const start = await ops.encounter_start!(ctx, { character: CHAR, encounter: bossFightId('alvis') }) as { token: string; seed: number; enemy: string; level: number };
    assert.deepEqual([start.enemy, start.level], ['dwarf', legendBoss('alvis')!.level], 'the client is told the server\'s foe');
    await ops.encounter_settle!(ctx, { token: start.token, record: fight(start.seed, 1) });
    assert.deepEqual([...h.grimoire.keys()], [`${ACCOUNT}:alvis`], `after win ${round}`);
  }
});

test('the legend spawn row kind ships empty, and a placement is one row the loader checks against the real zones and landmarks', () => {
  const known = { zones: new Set(zoneIds()), landmarks: (z: string) => new Set(loadZone(z).kit.landmarks) };
  assert.deepEqual(LEGEND_SPAWNS, [], 'no placement content invented');
  const zone = zoneIds()[0]!, landmark = [...known.landmarks(zone)][0]!;
  const row = (patch: object) => ({ spawns: { 'alvis-here': { order: 1, legend: 'alvis', zone, at: landmark, ...patch } } });
  const ok = loadLegendSpawns(row({}), known);
  assert.deepEqual(legendSpawnsIn(zone, ok).map((s) => s.legend), ['alvis'], 'a standing legend is one row');
  assert.deepEqual(legendSpawnsIn('z-none', ok), []);
  assert.throws(() => loadLegendSpawns(row({ legend: 'crixus' }), known), /legend boss/); assert.throws(() => loadLegendSpawns(row({ zone: 'nowhere' }), known), /zone/);
  assert.throws(() => loadLegendSpawns(row({ at: 'no-such-landmark' }), known), /landmark/);
});
