// Origins Zone 1 encounters: every Region 1 fight sets up from the data, outcomes follow the twist rulings, loot is seeded and lands in
// the backpack through the inventory module, and only world-mob fights roll damage.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { WEAPON_SLOTS } from '../../src/loot.ts';
import type { Result } from '../contracts/core.ts';
import type { CharacterInstanceId, EncounterId, ItemId, LootTableId } from '../contracts/ids.ts';
import { openInventory, type Inventory } from '../inventory/inventory.ts';
import { LUCK_OFF, type FightKind } from '../luck/luck.ts';
import { BOUNTIES, ENCOUNTERS } from '../region1/content.ts';
import { FRONTIER_REGION } from '../region1/world.ts';
import {
  REGION1_LOOT_TIER, fightHit, fightSeed, fightSetup, intoBackpack, loadEncounterContent, lookupOf, oneBarHealth, resolveFight, rollLoot,
  tierOfLootTier, worldMobHit, type FightReport, type FightResolution, type RolledLoot,
} from './encounters.ts';

const value = <T>(r: Result<T>): T => { assert.ok(r.ok, JSON.stringify(!r.ok && r.issues)); return r.value; };
const refused = (r: Result<unknown>, code: string, path?: string) => {
  assert.equal(r.ok, false, `expected refusal ${code}`);
  if (!r.ok) assert.ok(r.issues.some((i) => i.code === code && (path === undefined || i.path.includes(path))), JSON.stringify(r.issues));
};
const content = value(loadEncounterContent());
const resolve = (r: Partial<FightReport> & Pick<FightReport, 'fight'>): Result<FightResolution> => resolveFight({ result: 'won', twistOutcome: null, ...r }, content);
const PC = 'pc:dom-1' as CharacterInstanceId;
const ON = { monsterRolls: true, gambit: false };

test('every Region 1 encounter and open-world creature sets up from the data, as a world-mob fight', () => {
  const ids = [...content.region.registry.encounters.keys()];
  assert.deepEqual(ids.sort(), ENCOUNTERS.map((e) => e.id).sort());
  for (const id of [...ids, ...Object.keys(content.local.creatureLoot)]) {
    const s = value(fightSetup(id, content));
    assert.equal(s.kind, 'world-mob', id);
    assert.ok(s.foes.length >= 1 && s.bar > 0 && s.opponent.level >= 11, id);
    assert.equal(s.seedKey, `origins:${id}`);
  }
  const peg = value(fightSetup('encounter:bounty-peg-powler', content));
  assert.deepEqual([peg.opponent.character, peg.opponent.body, peg.opponent.level, peg.foes.length], ['character:peg-powler', 'witch', 14, 1], 'the dummy challenge stage is not a second foe');
  assert.deepEqual(peg.combatFlags, [{ kind: 'flee-at', percent: 30, catchSeconds: 15 }]);
  const hr = value(fightSetup('encounter:bounty-hrungnir', content));
  assert.deepEqual(hr.flags, [{ kind: 'hazard', hazard: 'embers', stillSeconds: 2 }]);
  assert.deepEqual(hr.combatFlags, [], 'the hazard is an Origins flag Combat v1 does not read');
  const mother = value(fightSetup('encounter:mere-mother', content));
  assert.deepEqual([mother.scope, mother.foes[0]!.character, mother.bar], ['public', 'character:mere-brood', 15_000], 'the content boss health (PROVISIONAL), one brood guardian first');
});

test('an unknown or malformed id is a typed error, never a throw', () => {
  refused(fightSetup('encounter:feud-dock', content), 'unknown-id', 'fight');
  refused(fightSetup('character:recorder-marrow', content), 'unknown-id', 'fight');
  refused(fightSetup(42, content), 'wrong-type', 'fight');
  refused(resolve({ fight: 'encounter:nope' as EncounterId }), 'unknown-id');
  refused(rollLoot('loottable:nope', 1, content), 'unknown-id', 'lootTable');
  refused(fightSetup('encounter:bounty-toll', content, { overlay: [{ kind: 'rng-seed' }] }), 'content-rule', 'overlay[0].kind');
  refused(fightSetup('encounter:bounty-toll', content, { overlay: [{ kind: 'one-health-bar' }] }), 'duplicate-id', 'overlay[0]');
  refused(fightSetup('encounter:mere-mother', content, { overlay: [{ kind: 'flee-at' }] }), 'missing-field', 'overlay[0].percent');
});

test('the Toll: two court thralls on one health bar, summed by the oneBarHealth rule', () => {
  const s = value(fightSetup('encounter:bounty-toll', content));
  assert.deepEqual(s.foes.map((f) => [f.character, f.body, f.level, f.health]), [['character:court-thrall', 'pitborn', 12, 190], ['character:court-thrall', 'pitborn', 12, 190]]);
  assert.deepEqual(s.combatFlags, [{ kind: 'one-health-bar' }]);
  assert.equal(s.bar, 380);
  assert.equal(s.opponent.health, 380);
  assert.equal(s.bar, oneBarHealth(s.combatFlags, s.foes.map((f) => f.health)));
  assert.equal(oneBarHealth([], [190, 190]), 190, 'without the flag: the first foe\'s own bar');
});

test('Peg Powler: caught inside the window is a kill; escaped forfeits that attempt, retry at once', () => {
  const caught = value(resolve({ fight: 'encounter:bounty-peg-powler', twistOutcome: 'caught', bountyWinsToday: 0 }));
  assert.deepEqual(caught, { cleared: true, forfeit: false, kill: true, retry: false, payout: { metal: 50, killRow: 'named', lootTable: null, bossLoot: false } });
  const escaped = value(resolve({ fight: 'encounter:bounty-peg-powler', twistOutcome: 'escaped', bountyWinsToday: 0 }));
  assert.deepEqual(escaped, { cleared: false, forfeit: true, kill: false, retry: true, payout: { metal: 0, killRow: null, lootTable: null, bossLoot: false } });
  // a killing blow from above 30% is an ordinary kill (src/twist.ts: no flight), and a flight with a catch window never ends 'fled'
  assert.equal(value(resolve({ fight: 'encounter:bounty-peg-powler', bountyWinsToday: 0 })).kill, true);
  refused(resolve({ fight: 'encounter:bounty-peg-powler', twistOutcome: 'fled', bountyWinsToday: 0 }), 'rule-violation', 'twistOutcome');
  refused(resolve({ fight: 'encounter:bounty-peg-powler', result: 'lost', twistOutcome: 'caught' }), 'rule-violation', 'result');
  refused(resolve({ fight: 'encounter:bounty-toll', twistOutcome: 'caught', bountyWinsToday: 0 }), 'rule-violation', 'twistOutcome');
});

test("Grendel's Mother, feud flee (flee-at 30, no catchSeconds): cleared, not a kill, 0 CP, no boss award", () => {
  const overlay = [{ kind: 'flee-at', percent: 30 }];   // feuds.md §3.1 grudge-twist params: percent only
  const s = value(fightSetup('encounter:mere-mother', content, { overlay }));
  assert.deepEqual(s.combatFlags, [{ kind: 'flee-at', percent: 30 }]);
  const fled = value(resolve({ fight: 'encounter:mere-mother', overlay, twistOutcome: 'fled', firstWin: true }));
  assert.deepEqual(fled, { cleared: true, forfeit: false, kill: false, retry: false, payout: { metal: 0, killRow: null, lootTable: null, bossLoot: false } });
  refused(resolve({ fight: 'encounter:mere-mother', overlay, twistOutcome: 'escaped', firstWin: true }), 'rule-violation', 'twistOutcome');
  refused(resolve({ fight: 'encounter:mere-mother', twistOutcome: 'fled', firstWin: true }), 'rule-violation', 'twistOutcome');   // no overlay, no flee
});

test('player death is a loss: nothing paid, nothing cost, retry at once', () => {
  for (const fight of ['encounter:bounty-toll', 'encounter:mere-mother', 'character:ruin-ghoul'] as const) {
    assert.deepEqual(value(resolve({ fight, result: 'lost' })), { cleared: false, forfeit: false, kill: false, retry: true, payout: { metal: 0, killRow: null, lootTable: null, bossLoot: false } });
  }
});

test('Bounty metal comes from the bounty-definition, capped at dailyCap paid wins per character per UTC day; the kill still pays its row', () => {
  for (const b of BOUNTIES) {
    const won = (n: number) => value(resolve({ fight: b.encounter as EncounterId, twistOutcome: b.twist.kind === 'flee-at' ? 'caught' : null, bountyWinsToday: n }));
    for (let n = 0; n < b.dailyCap; n++) assert.equal(won(n).payout.metal, b.metal, `${b.id} win ${n + 1}`);
    assert.deepEqual(won(b.dailyCap).payout, { metal: 0, killRow: b.id === 'bounty:toll' ? 'elite' : 'named', lootTable: null, bossLoot: false }, `${b.id} past the cap`);
    refused(resolve({ fight: b.encounter as EncounterId, twistOutcome: b.twist.kind === 'flee-at' ? 'caught' : null }), 'missing-field', 'bountyWinsToday');
  }
  assert.deepEqual(BOUNTIES.map((b) => [b.metal, b.dailyCap]), [[40, 3], [30, 3], [50, 2]]);
  refused(rollLoot('loottable:bounty-unrolled', 1, content), 'rule-violation', 'lootTable');
});

test('boss loot on the first win only (ruling 9); a repeat pays the normal row and rolls no table', () => {
  const first = value(resolve({ fight: 'encounter:mere-mother', firstWin: true }));
  assert.deepEqual(first.payout, { metal: 0, killRow: 'world-boss', lootTable: 'loottable:mere-mother', bossLoot: true });
  const repeat = value(resolve({ fight: 'encounter:mere-mother', firstWin: false }));
  assert.deepEqual(repeat.payout, { metal: 0, killRow: 'world-boss', lootTable: null, bossLoot: false });
  assert.equal(repeat.kill, true);
  refused(resolve({ fight: 'encounter:mere-mother' }), 'missing-field', 'firstWin');
  // the rift boss (PROPOSED weekly cap 5) and an open-world creature
  assert.equal(value(resolve({ fight: 'encounter:rift-worm', bossRollsThisWeek: 4 })).payout.lootTable, 'loottable:rift-worm');
  assert.equal(value(resolve({ fight: 'encounter:rift-worm', bossRollsThisWeek: 5 })).payout.lootTable, null);
  assert.deepEqual(value(resolve({ fight: 'character:court-thrall' })).payout, { metal: 0, killRow: 'elite', lootTable: 'loottable:court-thrall', bossLoot: false });
});

const ROLLED = ['loottable:cinder-scavenger', 'loottable:ruin-ghoul', 'loottable:mere-brood', 'loottable:court-thrall', 'loottable:mere-mother', 'loottable:rift-worm'] as const;

test('loot is deterministic: the same table and seed give the same drops; take-one bosses always drop exactly one piece', () => {
  for (const t of ROLLED) for (let seed = 0; seed < 50; seed++) assert.deepEqual(value(rollLoot(t, seed, content)), value(rollLoot(t, seed, content)), `${t} @ ${seed}`);
  const seen = new Set<string>();
  for (let seed = 0; seed < 400; seed++) {
    const r = value(rollLoot('loottable:mere-mother', seed, content));
    assert.equal(r.items.length, 1, 'weighted p100, limit 1, min 1');
    assert.ok(r.metal >= 100 && r.metal <= 250);
    seen.add(r.items[0]!.item);
  }
  assert.deepEqual([...seen].sort(), ['item:frontier.ferryman-boots', 'item:frontier.mere-arms', 'item:frontier.mere-shield']);
  // seeds come from the fight: same attempt, same seed; a retry rolls afresh
  const key = value(fightSetup('encounter:mere-mother', content)).seedKey;
  assert.equal(fightSeed(key, PC, 0), fightSeed(key, PC, 0));
  assert.notEqual(fightSeed(key, PC, 0), fightSeed(key, PC, 1));
  // the level gate: gear entries need a level-11 foe
  for (let seed = 0; seed < 200; seed++) assert.deepEqual(value(rollLoot('loottable:court-thrall', seed, content, { foeLevel: 10 })).items, []);
});

test('no weapon drops in Region 1 (ruling 6): no table can award a weapon, over many seeds', () => {
  const lookup = lookupOf(content), weapon = (id: ItemId) => (WEAPON_SLOTS as readonly string[]).includes(lookup(id)?.slot ?? '');
  for (const t of content.region.registry.lootTables.values()) for (const roll of t.rolls) for (const e of roll.entries) assert.ok(!weapon(e.item), `${t.id} lists ${e.item}`);
  for (const t of ROLLED) for (let seed = 0; seed < 1000; seed++) for (const d of value(rollLoot(t, seed, content, { foeLevel: 15 })).items) assert.ok(!weapon(d.item), `${t} @ ${seed} dropped ${d.item}`);
});

const pack = (size = 4): Inventory => value(openInventory({ owner: PC, account: 'account:00000000-0000-4000-8000-000000000001' as never, items: [], packSize: size, bankSize: 4 }, lookupOf(content)));
const mint = (killId: string) => ({ wonBy: PC, killId, encounter: 'encounter:mere-mother' as EncounterId, at: '2026-10-07T12:00:00Z' });
const drops = (items: { item: string; quantity: number }[], metal = 0): RolledLoot => ({ table: 'loottable:mere-mother' as LootTableId, items: items as RolledLoot['items'], metal });

test('loot goes into the backpack through the inventory module: loot provenance, the zone tier, all or nothing', () => {
  assert.equal(tierOfLootTier(content.region.zones.get(FRONTIER_REGION as never)!.get('cinder-fields')!.difficulty.lootTier), REGION1_LOOT_TIER);
  const rolled = value(rollLoot('loottable:mere-mother', 3, content));
  const got = value(intoBackpack(pack(), rolled, mint('k7xq2m4a:1:pc:dom-1'), content));
  assert.equal(got.metal, rolled.metal);
  assert.equal(got.inventory.items.length, 1);
  const inst = got.inventory.items[0]!;
  assert.deepEqual([inst.item, inst.tier, inst.location.kind, inst.provenance.kind, inst.provenance.mintKey], [rolled.items[0]!.item, 'Gladiator', 'pack', 'loot', 'loot:k7xq2m4a:1:pc:dom-1:0']);
  // grave iron is a material: no tier
  const iron = value(intoBackpack(pack(), drops([{ item: 'item:grave-iron', quantity: 3 }]), mint('ghoul-kill-0001'), content));
  assert.equal(iron.inventory.items[0]!.tier, null);
  // one of each (the inventory's rule): a second copy of a held piece refuses the whole delivery and leaves the pack unchanged
  const before = got.inventory;
  const dup = intoBackpack(before, drops([{ item: 'item:grave-iron', quantity: 1 }, { item: inst.item, quantity: 1 }]), mint('k7xq2m4a:2:pc:dom-1'), content);
  refused(dup, 'rule-violation', 'drops.items[1]');
  assert.equal(before.items.length, 1);
  // a full pack refuses (the inventory's capacity, not ours)
  refused(intoBackpack(pack(1), drops([{ item: 'item:grave-iron', quantity: 1 }, { item: 'item:frontier.ash-helm', quantity: 1 }]), mint('scav-kill-0001'), content), 'out-of-range', 'drops.items[1].pack');
});

test('world-mob damage rolls ±10% both ways, seeded; the Pit, PvP and the ladder get no roll', () => {
  const seed = fightSeed('origins:encounter:bounty-toll', PC, 0);
  const seen = new Set<number>();
  for (let hit = 0; hit < 400; hit++) {
    const r = worldMobHit(ON, 20, seed, hit);   // even hits the player's, odd the foe's: one numbering, both directions roll
    assert.ok(r.percent >= -10 && r.percent <= 10);
    assert.deepEqual(r, worldMobHit(ON, 20, seed, hit), 'replays exactly');
    seen.add(Math.sign(r.percent));
  }
  assert.deepEqual([...seen].sort(), [-1, 0, 1], 'up and down');
  for (const kind of ['pit', 'pvp', 'ladder'] as FightKind[]) for (let hit = 0; hit < 50; hit++) assert.deepEqual(fightHit(kind, ON, 20, seed, hit), { base: 20, percent: 0, damage: 20 }, kind);
  assert.deepEqual(worldMobHit(LUCK_OFF, 20, seed, 3), { base: 20, percent: 0, damage: 20 }, 'flag off: no roll');
});
