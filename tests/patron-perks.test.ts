import test from 'node:test';
import assert from 'node:assert/strict';
import { idleIntent, initialDuel, stepDuel, withPerk, withPerks, createFighter, type Duel, type Intent, type Perk } from '../src/duel.ts';
import { OPPONENTS, RULES } from '../src/moves.ts';
import { hashDuel } from '../src/net/rollback.ts';
import { initialState } from '../src/sim.ts';
import { act, arena, guard, idle } from './strategies.ts';

// Patron perks in the sim (docs/specs/origins/patron-perks-sim.md): a fight with no perk is the fight it always was; each template moves its own number.
const fought = (perks: readonly [Perk | undefined, Perk | undefined] | null, seed: number): string => {
  let d: Duel = initialDuel(OPPONENTS.veteran);
  if (perks) d = withPerks(d, perks);
  let s = seed;
  const rnd = () => ((s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 2 ** 32);
  const acts = ['light', 'heavy', 'parry', 'kick', null, null] as const;
  const hashes: string[] = [];
  for (let i = 0; i < 1200; i++) {
    const mk = (): Intent => ({ move: { x: (rnd() - .5) * .4, z: rnd() * .6, yaw: 0, run: false }, action: acts[Math.floor(rnd() * acts.length)], guard: rnd() < .3, lock: true });
    d = stepDuel(d, [mk(), mk()]);
    if (i % 100 === 0) hashes.push(hashDuel(d));
  }
  return hashes.join();
};

test('no perk, an empty perk and zero weights are byte-identical to today\'s fight', () => {
  for (const seed of [1, 2, 3]) {
    const plain = fought(null, seed);
    assert.equal(fought([undefined, undefined], seed), plain);
    assert.equal(fought([{}, { thrift: 0 }], seed), plain);
  }
});

test('a perk changes the fight and replays identically', () => {
  const p: [Perk, Perk] = [{ thrift: -20, poise: 10 }, { guard: 15 }];
  assert.equal(fought(p, 7), fought(p, 7));
  assert.notEqual(fought(p, 7), fought(null, 7));
});

test('each template scales its own quantity and nothing else', () => {
  const base = createFighter(initialState(), 'ready');
  const v = withPerk(base, { vitality: 30 }), w = withPerk(base, { vitality: -30 });
  assert.equal(RULES.health, 150);   // the spec's 100 -> 103 / 97 is stale: the man has 150, so 155 / 146 (a half rounds up)
  assert.deepEqual([v.maxHealth, v.health, w.maxHealth, w.health], [155, 155, 146, 146]);
  assert.equal(withPerk(base, { wind: 20 }).regen, 1.02);
  assert.equal(withPerk(base, { stride: -10 }).speed, 0.99);
  const t = withPerk(base, { thrift: -20 });
  assert.deepEqual([t.maxHealth, t.regen, t.speed], [base.maxHealth, base.regen, base.speed]);
  assert.equal(withPerk(base, undefined), base);
});

test('thrift prices an attack', () => {
  const ready = (perk?: Perk) => withPerks({ ...initialDuel(OPPONENTS.veteran), fighters: initialDuel(OPPONENTS.veteran).fighters.map(f => ({ ...f, phase: 'ready' as const })) as Duel['fighters'] }, [perk, undefined]);
  const swing: Intent = { ...idleIntent(), action: 'light' };
  const cost = (perk?: Perk) => 100 - stepDuel(ready(perk), [swing, idleIntent()]).fighters[0].stamina;
  const plain = cost();
  assert.ok(plain > 0);
  assert.ok(Math.abs(cost({ thrift: -20 }) - plain * 0.98) < 1e-9);
  assert.ok(Math.abs(cost({ thrift: 20 }) - plain * 1.02) < 1e-9);
});

// The warden swings every 40 ticks at a player who holds the matching guard (strategies.ts guard). The first block lands on the same tick with or without a
// perk that only prices a block or posture, so the first one is compared.
const firstContact = (perk: Perk | undefined, pick: (d: Duel, prev: Duel) => number): number => {
  let d = withPerks(arena(), [perk, undefined]);
  for (let i = 0; i < 2000; i++) {
    const prev = d;
    d = stepDuel(d, [guard(d), i % 40 === 0 ? act('light') : idle()]);
    const v = pick(d, prev); if (v) return v;
  }
  throw Error(`no contact; ${d.fighters.map(f => f.phase)}`);
};

test('guard prices a block and poise prices posture, each by its own per-mille', () => {
  const block = (d: Duel) => d.events.find(e => e.type === 'Blocked' && !e.perfect)?.stamina ?? 0;
  assert.ok(Math.abs(firstContact({ guard: 30 }, block) / firstContact(undefined, block) - 1.03) < 1e-9);
  const posture = (d: Duel, prev: Duel) => (prev.fighters[0].posture === 0 ? d.fighters[0].posture : 0);
  assert.ok(Math.abs(firstContact({ poise: -30 }, posture) / firstContact(undefined, posture) - 0.97) < 1e-9);
});

test('a perk outside the rules is refused', () => {
  const base = createFighter(initialState(), 'ready');
  assert.throws(() => withPerk(base, { thrift: 31 }), /Perk/);
  assert.throws(() => withPerk(base, { wind: 1.5 }), /Perk/);
  assert.throws(() => withPerk(base, { wind: 10, thrift: 10, guard: 10 }), /Perk/);
  assert.throws(() => withPerk(base, { reach: 10 } as unknown as Perk), /Perk/);
});
