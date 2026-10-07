// The hunt (hunt.ts): a tapped creature's fight set up, a duel result settled through the existing resolveFight / rollLoot / intoBackpack, a
// Bounty paid only when it is taken. Pure: no DOM, no duel (the duel's result is the input).
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { fightOf, newHunt, prepare, settle, PACK, type Hunt } from './hunt.ts';
import { frontierBuild, frontierPlan } from './frontier-plan.ts';
import { mobSpecs, type MobSpec } from './mobs.ts';

const F = frontierPlan(), SPECS = mobSpecs(F, frontierBuild(F)), AT = '2026-10-07T12:00:00Z';
const common = SPECS.find((s) => !s.named)!, bountyEnc = F.giver.bounty.encounter;
const bountyFoe = SPECS.find((s) => s.encounter === bountyEnc)!, other = SPECS.find((s) => s.named && s.encounter !== bountyEnc)!;
const won = { result: 'won', twistOutcome: null } as const, lost = { result: 'lost', twistOutcome: null } as const;
const fight = (h: Hunt, s: MobSpec, end: typeof won | typeof lost, open = true) => {
  const p = prepare(h, s); assert.ok(p.ok, JSON.stringify(!p.ok && p.issues));
  return { run: p.value, out: settle(h, s, p.value, end, AT, () => open) };
};

test('every creature on the Frontier sets up as a fight from the content, with a seed that depends on the attempt', () => {
  const h = newHunt();
  for (const s of SPECS) {
    const p = prepare(h, s);
    assert.ok(p.ok, `${s.id}: ${!p.ok && p.issues[0]!.message}`);
    assert.equal(p.value.fight, fightOf(s));
    assert.equal(p.value.setup.kind, 'world-mob');
    assert.equal(prepare(h, s).ok && (prepare(h, s) as { value: { seed: number } }).value.seed, p.value.seed, 'the same attempt, the same seed');
  }
  const a = fight(newHunt(), common, lost), h2 = newHunt(); fight(h2, common, lost);
  assert.equal(a.run.attempt, 1);
  const again = prepare(h2, common); assert.ok(again.ok); assert.equal(again.value.attempt, 2);
  assert.notEqual(again.value.seed, a.run.seed, 'a retry rolls afresh');
});

test('a plain creature: a win is a kill with its table rolled into the pack, the same drops on a replay of the attempt', () => {
  let lootSeen = false;
  for (let i = 0; i < 40 && !lootSeen; i++) {
    const h = newHunt(); h.attempts.set(fightOf(common), i);
    const { out } = fight(h, common, won);
    assert.ok(out.won); assert.equal(h.kills, 1); assert.equal(out.bounty, null);
    if (out.drops.length) { lootSeen = true; assert.ok(h.inventory.items.length > 0, 'the drops are in the pack'); assert.match(out.text, /Loot:/); }
    const h2 = newHunt(); h2.attempts.set(fightOf(common), i);
    assert.deepEqual(fight(h2, common, won).out, out, 'the same attempt rolls the same');
  }
  assert.ok(lootSeen, 'a creature drops something within 40 attempts');
});

test('a loss pays and costs nothing, and the next attempt is a new roll', () => {
  const h = newHunt(), { out } = fight(h, bountyFoe, lost);
  assert.equal(out.won, false); assert.equal(out.metal, 0); assert.equal(out.bounty, null);
  assert.equal(h.kills, 0); assert.equal(h.metal, 0); assert.equal(h.inventory.items.length, 0);
  assert.match(out.text, /try again/i);
  assert.equal(prepare(h, bountyFoe).ok && (prepare(h, bountyFoe) as { value: { attempt: number } }).value.attempt, 2);
});

test('the Bounty pays when taken, only up to its daily cap, and says so when it was not taken', () => {
  const b = F.giver.bounty, h = newHunt();
  const open = fight(h, bountyFoe, won, true).out;
  assert.deepEqual(open.bounty, { encounter: bountyEnc, metal: b.metal }); assert.ok(open.won); assert.equal(h.bountyWins, 1); assert.equal(h.metal, b.metal);
  assert.match(open.text, /Bounty paid/); assert.match(open.text, new RegExp(`\\+${b.metal} bronze`));
  for (let i = 1; i < b.dailyCap; i++) assert.ok(fight(h, bountyFoe, won, true).out.bounty);
  assert.equal(h.bountyWins, b.dailyCap);
  const capped = fight(h, bountyFoe, won, true).out;
  assert.equal(capped.bounty, null, 'past the daily cap a win pays nothing'); assert.equal(h.metal, b.metal * b.dailyCap);
  const closed = fight(newHunt(), bountyFoe, won, false), hc = closed.out;
  assert.equal(hc.bounty, null); assert.ok(hc.won); assert.match(hc.text, /No Bounty taken/);
});

test("a named creature's own table rolls on the first win only", () => {
  const h = newHunt(), first = fight(h, other, won).out, again = fight(h, other, won).out;
  assert.ok(first.won && again.won);
  assert.deepEqual(again.drops, [], 'a repeat kill rolls nothing from the boss table');
});

test('a pack that refuses the loot says so and keeps the kill', () => {
  const h = newHunt();
  assert.equal(PACK, 12);
  h.inventory = { ...h.inventory, packSize: 0 };
  let said = false;
  for (let i = 0; i < 40 && !said; i++) { h.attempts.set(fightOf(common), i); const { out } = fight(h, common, won); if (/could not take the loot/i.test(out.text)) { said = true; assert.ok(out.won); assert.deepEqual(out.drops, []); } }
  assert.ok(said, 'a pack with no room refuses the drops and tells the player');
});
