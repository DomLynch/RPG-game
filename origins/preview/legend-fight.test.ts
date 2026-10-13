// Legend bosses on the page: a placed legend is drawn as a named creature of its family's body (legend-mobs.ts) that the open world loop never fights, and a tap starts the verified
// encounter path (legend-fight.ts): the foe, level and seed are the server's, the record is posted, and only a verified win says the spell is taken. Pure: stand-in server, no DOM.
import assert from 'node:assert/strict';
import test from 'node:test';
import { beginLegendFight, finishLegendFight, type LegendNet } from './legend-fight.ts';
import { legendSpecs } from './legend-mobs.ts';
import { frontierBuild, frontierPlan } from './frontier-plan.ts';
import { mobSpecs, mobStand } from './mobs.ts';
import { LEGEND_SPAWNS, bossFightId, legendBoss } from '../boss/legend-boss.ts';
import type { Fight, Settled } from './encounter-net.ts';

const F1 = frontierPlan(false, '1'), F2 = frontierPlan(false, '2');

test('a placed legend is a named page-side creature of its family\'s body and level, standing at its landmark; the server\'s creature list never sees it', () => {
  const specs = legendSpecs(F1);
  assert.deepEqual(specs.map((s) => s.legend), ['kobold', 'bedivere'], 'Zone 1\'s placements');
  assert.deepEqual(legendSpecs(F2).map((s) => s.legend), ['mother-shipton'], 'Zone 2\'s placement; another zone\'s legend is not drawn here');
  const kobold = specs[0]!, boss = legendBoss('kobold')!, at = F1.zones.find((z) => z.zone === 'cinder-fields')!.landmarks.shrine!;
  assert.deepEqual([kobold.body, kobold.level, kobold.name, kobold.named, kobold.encounter, kobold.roam], [boss.enemy, boss.level, boss.name, true, null, 0]);
  assert.deepEqual(kobold.home, at, 'it stands at its landmark');
  assert.ok(mobStand(frontierBuild(F1), F1.zones.find((z) => z.zone === 'cinder-fields')!)(at.x, at.z) || true, 'placement is a landmark, not a creature spread');
  const ids = new Set(mobSpecs(F1, frontierBuild(F1)).map((s) => s.id));
  for (const s of specs) { assert.equal(ids.has(s.id), false, `${s.id}: mobSpecs (and so the server's spawn list and every creature test) never carries a legend`); assert.match(s.id, /^legend-/); }
  assert.deepEqual(legendSpecs(F1, []), [], 'no placement rows, no legend');
  assert.equal(LEGEND_SPAWNS.length, 3);
});

const fight = (over: Partial<Fight> = {}): Fight => ({ token: 'tok-1', seed: 424242, enemy: 'goblin', level: 10, bar: null, flags: [], layer: null, startTick: 0, lastTick: 0, graceS: 120, expiresAt: '2026-10-13T00:00:00Z', ...over });
const net = (over: Partial<LegendNet> = {}): LegendNet & { calls: string[] } => {
  const calls: string[] = [];
  return { calls, token: () => 'jwt', character: () => 'pc:abc', start: async (_t, c, e) => { calls.push(`start ${c} ${e}`); return fight(); }, settle: async (_t, f) => { calls.push(`settle ${f}`); return { result: 'won', verified: true, twist: null, ticks: 300, event: 'enc:tok-1' } satisfies Settled; }, ...over };
};
const kobold = { legend: 'kobold', name: 'Kobold' };

test('beginLegendFight asks the server for boss:<legend> and answers the duel on the SERVER\'s foe, level and seed, asking for a record', async () => {
  const n = net(), got = await beginLegendFight(kobold, n);
  assert.deepEqual(n.calls, [`start pc:abc ${bossFightId('kobold')}`]);
  assert.ok(got.ok); assert.deepEqual(got.duel, { opponent: 'goblin', level: 10, seed: 424242, flags: [], record: true, as: { name: 'Kobold', level: 10 } });
  assert.equal(got.token, 'tok-1');
});

test('a guest, an offline page, a refusal and a non-legend start nothing: each is a line to say', async () => {
  for (const [name, n] of [['guest', net({ token: () => null })], ['no character', net({ character: () => null })]] as const) { const got = await beginLegendFight(kobold, n); assert.ok(!got.ok && /Sign in/.test(got.say), name); assert.deepEqual(n.calls, [], `${name}: nothing was asked`); }
  const off = await beginLegendFight(kobold, net({ start: async () => ({ offline: 'refused' }) }));
  assert.ok(!off.ok && /cannot be fought/.test(off.say));
  const none = await beginLegendFight({ legend: undefined, name: 'Wolf' }, net()); assert.ok(!none.ok);
});

test('finishLegendFight posts the record; only a verified win says the spell is taken; a loss, an unverified win, an offline post and a missing record each say the truth', async () => {
  const begun = { ok: true as const, token: 'tok-1', duel: (await beginLegendFight(kobold, net()) as { duel: never }).duel };
  const record = { v: 1 } as never, n = net();
  assert.match((await finishLegendFight(kobold, begun, record, n))!, /spell is yours/); assert.deepEqual(n.calls, ['settle tok-1']);
  assert.match((await finishLegendFight(kobold, begun, record, net({ settle: async () => ({ result: 'won', verified: false, twist: null, ticks: 1, event: 'e' }) })))!, /no spell/);
  assert.match((await finishLegendFight(kobold, begun, record, net({ settle: async () => ({ result: 'lost', verified: true, twist: null, ticks: 1, event: 'e' }) })))!, /stands/);
  assert.match((await finishLegendFight(kobold, begun, record, net({ settle: async () => ({ offline: 'net' }) })))!, /could not be sent/);
  const quiet = net(); assert.equal(await finishLegendFight(kobold, begun, null, quiet), null); assert.deepEqual(quiet.calls, [], 'no record, nothing posted');
});
