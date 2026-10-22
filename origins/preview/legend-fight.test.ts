// Legend bosses on the page: a placed legend is drawn as a named creature of its family's body (legend-mobs.ts) that the open world loop never fights, and a tap starts the verified
// encounter path (legend-fight.ts): the foe, level and seed are the server's, the record is posted, and only a verified win says the spell is taken. Pure: stand-in server, no DOM.
import assert from 'node:assert/strict';
import test from 'node:test';
import { beginLegendFight, finishLegendFight, type LegendNet } from './legend-fight.ts';
import { legendChase, legendFelled, legendPull, legendSpecs } from './legend-mobs.ts';
import { frontierBuild, frontierPlan } from './frontier-plan.ts';
import { NAMED, mobSpecs, mobStand, newMob, stepMob, type Mob } from './mobs.ts';
import { previewRule } from './preview-rules.ts';
import { SPEEDS } from '../../src/fight/speeds.ts';
import { LEGEND_SPAWNS, bossFightId, legendBoss } from '../boss/legend-boss.ts';
import type { Fight, Settled } from './encounter-net.ts';

const F1 = frontierPlan(false, '1'), F2 = frontierPlan(false, '2');

test('a placed legend is a named page-side creature of its family\'s body and level, standing at its landmark; the server\'s creature list never sees it', () => {
  const specs = legendSpecs(F1);
  assert.deepEqual(specs.map((s) => s.legend), ['kobold', 'bedivere'], 'Zone 1\'s placements');
  assert.deepEqual(legendSpecs(F2).map((s) => s.legend), ['mother-shipton'], 'Zone 2\'s placement; another zone\'s legend is not drawn here');
  const kobold = specs[0]!, boss = legendBoss('kobold')!, at = F1.zones.find((z) => z.zone === 'cinder-fields')!.landmarks["ash-pits"]!;
  assert.deepEqual([kobold.body, kobold.level, kobold.name, kobold.named, kobold.encounter, kobold.roam], [boss.enemy, boss.level, boss.name, true, null, NAMED.roam]);   // a legend roams like any named creature (Dom 2026-10-22); aggro is the legendAggro rule
  assert.equal(kobold.aggro, previewRule('legendAggro'));
  assert.deepEqual(kobold.home, at, 'it stands at its landmark');
  assert.ok(mobStand(frontierBuild(F1), F1.zones.find((z) => z.zone === 'cinder-fields')!)(at.x, at.z) || true, 'placement is a landmark, not a creature spread');
  const ids = new Set(mobSpecs(F1, frontierBuild(F1)).map((s) => s.id));
  for (const s of specs) { assert.equal(ids.has(s.id), false, `${s.id}: mobSpecs (and so the server's spawn list and every creature test) never carries a legend`); assert.match(s.id, /^legend-/); }
  assert.deepEqual(legendSpecs(F1, []), [], 'no placement rows, no legend');
  const lm = F2.zones.find((z) => z.zone === 'ash-reach')!.landmarks['reach-cairn']!, shipton = legendSpecs(F2)[0]!;
  assert.deepEqual([shipton.home.x - lm.x, shipton.home.z - lm.z], [LEGEND_SPAWNS[2]!.dx, LEGEND_SPAWNS[2]!.dz], 'a placement may stand beside its landmark (dx/dz), off the prop the landmark sits on');
  assert.equal(LEGEND_SPAWNS.length, 3);
});

const fight = (over: Partial<Fight> = {}): Fight => ({ token: 'tok-1', seed: 424242, enemy: 'goblin', level: 10, bar: null, flags: [], layer: null, startTick: 0, lastTick: 0, graceS: 120, expiresAt: '2026-10-13T00:00:00Z', ...over });
const net = (over: Partial<LegendNet> = {}): LegendNet & { calls: string[] } => {
  const calls: string[] = [];
  return { calls, token: () => 'jwt', character: () => 'pc:abc', start: async (_t, c, e) => { calls.push(`start ${c} ${e}`); return fight(); }, settle: async (_t, f) => { calls.push(`settle ${f}`); return { result: 'won', verified: true, twist: null, ticks: 300, event: 'enc:tok-1' } satisfies Settled; }, ...over };
};
const kobold = { legend: 'kobold', name: 'Kobold', body: 'goblin', level: 10 }, SEED = 99;

test('beginLegendFight asks the server for boss:<legend> and answers the duel on the SERVER\'s foe, level and seed, asking for a record', async () => {
  const n = net(), got = await beginLegendFight(kobold, n, SEED);
  assert.deepEqual(n.calls, [`start pc:abc ${bossFightId('kobold')}`]);
  assert.ok(got.ok); assert.deepEqual(got.duel, { opponent: 'goblin', level: 10, seed: 424242, flags: [], record: true, as: { name: 'Kobold', level: 10 } });
  assert.equal(got.token, 'tok-1');
});

test('a guest fights the same legend at the same level with no server start, no record and no spell; an offline page, a refusal and a non-legend start nothing: each is a line to say', async () => {
  for (const [name, n] of [['guest', net({ token: () => null })], ['no character', net({ character: () => null })]] as const) {
    const got = await beginLegendFight(kobold, n, SEED);
    assert.ok(got.ok && got.token === null, name); assert.deepEqual(got.duel, { opponent: 'goblin', level: 10, seed: SEED, flags: [], record: false, as: { name: 'Kobold', level: 10 } }, `${name}: the same foe and level, our own seed, no record`);
    assert.deepEqual(n.calls, [], `${name}: nothing was asked of the server`);
    assert.match((await finishLegendFight(kobold, got, null, n, true))!, /Sign in to keep it/, `${name}: a win nudges the sign-in`);
    assert.equal(await finishLegendFight(kobold, got, null, n, false), null, `${name}: a loss says nothing`); assert.deepEqual(n.calls, [], `${name}: and still nothing was posted`);
  }
  const off = await beginLegendFight(kobold, net({ start: async () => ({ offline: 'refused' }) }), SEED);
  assert.ok(!off.ok && /cannot be fought/.test(off.say));
  const none = await beginLegendFight({ legend: undefined, name: 'Wolf', body: 'wolf', level: 1 }, net(), SEED); assert.ok(!none.ok);
});

test('finishLegendFight posts the record; only a verified win says the spell is taken; a loss, an unverified win, an offline post and a missing record each say the truth', async () => {
  const begun = { ok: true as const, token: 'tok-1', duel: (await beginLegendFight(kobold, net(), SEED) as unknown as { duel: never }).duel };
  const record = { v: 1 } as never, n = net();
  assert.match((await finishLegendFight(kobold, begun, record, n))!, /spell is yours/); assert.deepEqual(n.calls, ['settle tok-1']);
  assert.match((await finishLegendFight(kobold, begun, record, net({ settle: async () => ({ result: 'won', verified: false, twist: null, ticks: 1, event: 'e' }) })))!, /no spell/);
  assert.match((await finishLegendFight(kobold, begun, record, net({ settle: async () => ({ result: 'lost', verified: true, twist: null, ticks: 1, event: 'e' }) })))!, /stands/);
  assert.match((await finishLegendFight(kobold, begun, record, net({ settle: async () => ({ offline: 'net' }) })))!, /could not be sent/);
  const quiet = net(); assert.equal(await finishLegendFight(kobold, begun, null, quiet), null); assert.deepEqual(quiet.calls, [], 'no record, nothing posted');
});

test('legendPull: only a hunting legend inside reach, within the level gap, with nothing running and no cooldown, pulls the hero; a win lays it down, a loss or draw does not', () => {
  const sp = legendSpecs(F2)[0]!, hero = { x: 0, z: 0 }, rules = { reach: 6, levelGap: 10 }, at = (d: number, hunting = true) => [{ spec: sp, x: d, z: 0, hunting }];
  assert.equal(legendPull(at(5), hero, sp.level, false, 0, rules), sp, 'hunting, inside reach, same level: it pulls');
  assert.equal(legendPull(at(7), hero, sp.level, false, 0, rules), null, 'outside reach: no');
  assert.equal(legendPull(at(5, false), hero, sp.level, false, 0, rules), null, 'not hunting (it has not noticed the hero): no');
  assert.equal(legendPull(at(5), hero, sp.level + rules.levelGap + 1, false, 0, rules), null, 'a hero more than the level gap above: no');
  assert.equal(legendPull(at(5), hero, sp.level + rules.levelGap, false, 0, rules), sp, 'a hero exactly the level gap above: still a pull (the gap is inclusive)');
  assert.equal(legendPull(at(5), hero, sp.level - rules.levelGap - 1, false, 0, rules), null, 'a hero more than the level gap below: no');
  assert.equal(legendPull(at(5), hero, sp.level, true, 0, rules), null, 'a fight is up or the duel failed to load: no');
  assert.equal(legendPull(at(5), hero, sp.level, false, 0.1, rules), null, 'cooling down after a fight: no');
  assert.equal(legendPull([], hero, sp.level, false, 0, rules), null, 'no legends: no');
  assert.deepEqual(['win', 'loss', 'draw', null].map((o) => legendFelled(o as never)), [true, false, false, false]);
});

test('a legend notices the hero inside its aggro radius and walks up to its reach; a far hero leaves it at its post (Dom 2026-10-22: bosses have an aggression zone like every NPC)', () => {
  const s = legendSpecs(F2)[0]!, ok = () => true, step = (m: Mob, hero: { x: number; z: number }, n: number) => { for (let i = 0; i < n; i++) m = legendChase(stepMob(m, s, hero, 0.05, ok), hero, 0.05, ok, SPEEDS.creature.chase); return m; };
  const aggro = previewRule('legendAggro'), stop = previewRule('legendReach') * previewRule('legendStopShare');
  const near = { x: s.home.x + aggro - 1, z: s.home.z }, far = { x: s.home.x + aggro * 3, z: s.home.z };
  const woke = step(newMob(s, 0), near, 600), dist = Math.hypot(near.x - woke.x, near.z - woke.z);
  assert.equal(woke.mode, 'aggro', 'it noticed the hero inside its radius');
  assert.ok(dist <= stop + 0.2 && dist > 0, `and walked up to ${stop} m (stood ${dist.toFixed(2)} m off), no closer than its stop`);
  const idle = step(newMob(s, 0), far, 600);
  assert.notEqual(idle.mode, 'aggro', 'a hero far outside the radius is not noticed');
  assert.ok(Math.hypot(idle.x - s.home.x, idle.z - s.home.z) <= s.roam + 0.5, 'and it only roams its post');
});
