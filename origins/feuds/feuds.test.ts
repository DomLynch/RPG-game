// Feuds engine (docs/specs/origins/feuds.md): the generator's determinism and caps (a 300-seed property run plus a pinned vector),
// grudge holding and the kill guardrails, succession and the stand-in, notoriety decay and pay-off, the alert spread, trade shunning,
// guard rings, and arrest as metal and jail, never gear.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { MAX_LEVEL } from '../../src/career.ts';
import {
  CLEAN, DAY_S, DEFAULT_RINGS, GENERATOR_DEFAULTS, GRUDGE_EXPIRY_S, GRUDGE_MIN_LEVEL, GRUDGE_REOFFER_S, SUCCESSOR_MAX_S, SUCCESSOR_MIN_S,
  addNotoriety, alertSpread, arrest, bailBronze, bandOf, canJoin, closeSuccession, giverPricePermille, grudgeAt, grudgeOpen, guardChallenge,
  guardDuel, jailed, markable, mayAttack, newRival, notorietyAt, payAllCost, payOff, release, ringAt, rivalAt, rivalKill, rollGrudges,
  rotationIndex, rotationSeed, serviceAccess, shun, shunUntil, sideNotoriety, standInTerms, successionOutcome, successionRewards, takeGrudge,
  townResponse, unresolvedDay,
  type GrudgeRoll, type GrudgeState, type Npc, type OfferInput, type Tables, type World,
} from './feuds.ts';

const R1 = 'region:ash-frontier';
const WORLD: World = {
  towns: [
    { id: 'town:concord-exchange', region: R1, tier: 2, safe: true, patron: null },
    { id: 'town:grey-ferry', region: R1, tier: 3, safe: false, patron: 'zeus' },
    { id: 'town:cinder-shrine', region: R1, tier: 1, safe: false, patron: null },
    { id: 'town:far-hold', region: 'region:two', tier: 3, safe: false, patron: null },
  ],
  npcs: [
    { id: 'character:smith-orla', town: 'town:concord-exchange', trade: 'smith', level: 20, rival: true, essential: true },
    { id: 'character:rival-mimir', town: 'town:grey-ferry', trade: 'smith', level: 13, rival: true },
    { id: 'character:healer-ferry', town: 'town:grey-ferry', trade: 'healer', level: 12, rival: true },
    { id: 'character:fence-cinder', town: 'town:cinder-shrine', trade: 'fence', level: 12, rival: true },
    { id: 'character:smith-cinder', town: 'town:cinder-shrine', trade: 'smith', level: 11, rival: false },
    { id: 'character:lord-cinder', town: 'town:cinder-shrine', trade: 'merchant', level: 30, rival: true, ruler: true },
    { id: 'character:smith-far', town: 'town:far-hold', trade: 'smith', level: 25, rival: true },
  ],
};
const TABLES: Tables = {
  region: R1,
  motives: [
    { id: 'undercutting', trades: 'same', weight: 30, rewardPermille: 1000 },
    { id: 'stolen-apprentice', trades: 'same', weight: 20, rewardPermille: 1100 },
    { id: 'old-debt', trades: 'any', weight: 20, rewardPermille: 1000 },
    { id: 'family-insult', trades: 'any', weight: 15, rewardPermille: 1200 },
    { id: 'rigged-duel', trades: 'any', weight: 15, rewardPermille: 1300 },
  ],
  kits: [
    { id: 'light', weight: 30, minTownTier: 1, patron: false, rivalKillNotoriety: 500 },
    { id: 'ringed', weight: 40, minTownTier: 1, patron: false, rivalKillNotoriety: 600 },
    { id: 'ringed-patron', weight: 20, minTownTier: 1, patron: true, rivalKillNotoriety: 650 },
    { id: 'bouncer', weight: 10, minTownTier: 3, patron: false, rivalKillNotoriety: 750 },
  ],
  twists: [{ id: 'flee-at', weight: 30 }, { id: 'one-health-bar', weight: 20 }, { id: 'no-block', weight: 20 }, { id: 'damage-only-on-parry', weight: 15 }, { id: 'heal-on-hit', weight: 15 }],
  config: GENERATOR_DEFAULTS,
  stories: [{ id: 'grudge:orla-mimir', giver: 'character:smith-orla', rival: 'character:rival-mimir', motive: 'undercutting', rewardBronze: 300, weight: 5 }],
};
const NONE = { dead: [], held: [] };

test('pinned constants: the gate is Gladiator I, rotation a week, the generator caps', () => {
  assert.equal(GRUDGE_MIN_LEVEL, 11);
  assert.deepEqual(GENERATOR_DEFAULTS, { rotationSeconds: 604_800, livePerTownMax: 2, livePerRegionMax: 6, varietyWindow: 4, rewardBronzePerLevel: 25, storyWeight: 5 });
  assert.equal(rotationIndex(604_800 * 2931 + 5), 2931);
  assert.equal(rotationSeed(7, R1, 2931), rotationSeed(7, R1, 2931));
  assert.notEqual(rotationSeed(7, R1, 2931), rotationSeed(7, R1, 2932));
  assert.notEqual(rotationSeed(7, R1, 2931), rotationSeed(8, R1, 2931));
});

test('markable: rulers, essential figures, figures without rival data and rivals in safe towns are never grudge targets', () => {
  const by = (id: string) => WORLD.npcs.find((n) => n.id.endsWith(id))!;
  assert.equal(markable(by('mimir'), WORLD), true);
  assert.equal(markable(by('orla'), WORLD), false); // essential (and in the safe Exchange)
  assert.equal(markable(by('lord-cinder'), WORLD), false); // ruler
  assert.equal(markable(by('smith-cinder'), WORLD), false); // no rival data
  assert.equal(markable({ ...by('mimir'), town: 'town:concord-exchange' }, WORLD), false); // safe town
});

test('the roll is byte-identical for the same seed, and pinned', () => {
  const seed = rotationSeed(1234, R1, 2931), a = rollGrudges(seed, 2931, TABLES, WORLD, NONE, []);
  assert.equal(JSON.stringify(rollGrudges(seed, 2931, TABLES, WORLD, NONE, [])), JSON.stringify(a));
  assert.deepEqual(a, PINNED);
});

// Reward = 25 × level × motive permille / 1000, floored (spec §3.1 example: Mimir L13 undercutting 325, stolen apprentice 357).
test('pricing follows the spec example rows', () => {
  for (let s = 0; s < 200; s++) {
    for (const g of rollGrudges(s, 1, TABLES, WORLD, NONE, []).grudges) {
      const rival = WORLD.npcs.find((n) => n.id === g.rival)!, m = TABLES.motives.find((x) => x.id === g.motive)!;
      if (g.story) assert.equal(g.rewardBronze, 300);
      else assert.equal(g.rewardBronze, Math.floor((25 * rival.level * m.rewardPermille) / 1000));
      if (!g.story && rival.id.endsWith('mimir') && g.motive === 'undercutting') assert.equal(g.rewardBronze, 325);
      if (!g.story && rival.id.endsWith('mimir') && g.motive === 'stolen-apprentice') assert.equal(g.rewardBronze, 357);
      assert.equal(g.rivalKillNotoriety, TABLES.kits.find((k) => k.id === g.kit)!.rivalKillNotoriety);
    }
  }
});

// A wider synthetic region so every cap binds: 5 towns (one safe), 6 trades, 30 NPCs, some essential, some rulers.
const TRADES = ['smith', 'armourer', 'ferryman', 'healer', 'fence', 'merchant'];
const BIG: World = {
  towns: Array.from({ length: 5 }, (_, i) => ({ id: `town:t${i}`, region: R1, tier: 1 + (i % 3), safe: i === 0, patron: i === 2 ? 'zeus' : null })),
  npcs: Array.from({ length: 30 }, (_, i): Npc => ({
    id: `character:n${i}`, town: `town:t${i % 5}`, trade: TRADES[i % 6]!, level: 5 + (i % 20), rival: i % 7 !== 3, essential: i % 11 === 0, ruler: i % 13 === 5,
  })),
};

test('300 seeds over chained rotations: caps, towns, markability, trades, no repeat within the window, story entries obey caps', () => {
  const tables: Tables = { ...TABLES, stories: [{ id: 'grudge:story-1', giver: 'character:n1', rival: 'character:n7', motive: 'undercutting', rewardBronze: 300 }] };
  for (let s = 0; s < 300; s++) {
    const history: GrudgeRoll[] = [], dead = s % 3 === 0 ? ['character:n2', 'character:n8'] : [], held = s % 4 === 0 ? ['character:n9'] : [];
    for (let rot = 100; rot < 106; rot++) {
      const roll = rollGrudges(rotationSeed(s, R1, rot), rot, tables, BIG, { dead, held }, history);
      const g = roll.grudges, at = (id: string) => BIG.npcs.find((n) => n.id === id)!;
      assert.ok(g.length <= 6 && g.length > 0, `seed ${s} rot ${rot}: ${g.length}`);
      const perTown = new Map<string, number>();
      for (const x of g) perTown.set(at(x.rival).town, (perTown.get(at(x.rival).town) ?? 0) + 1);
      assert.ok([...perTown.values()].every((n) => n <= 2));
      assert.equal(new Set(g.map((x) => x.rival)).size, g.length);
      for (const x of g) {
        const giver = at(x.giver), rival = at(x.rival), motive = tables.motives.find((m) => m.id === x.motive)!;
        assert.notEqual(giver.town, rival.town);
        assert.ok(markable(rival, BIG) && !dead.includes(rival.id) && !held.includes(rival.id));
        if (motive.trades === 'same') assert.equal(giver.trade, rival.trade);
        const kit = tables.kits.find((k) => k.id === x.kit)!, town = BIG.towns.find((t) => t.id === rival.town)!;
        assert.ok(kit.minTownTier <= town.tier && (!kit.patron || town.patron !== null));
        for (const h of history.filter((r) => r.rotation >= rot - 4))
          assert.ok(!h.grudges.some((y) => y.giver === x.giver && y.rival === x.rival && y.motive === x.motive), 'repeat inside the window');
      }
      history.push(roll);
    }
  }
});

test('a story entry keeps its own id and reward, and is drawn by the same generator', () => {
  const only: Tables = { ...TABLES, motives: TABLES.motives.filter((m) => m.id === 'undercutting'), stories: TABLES.stories };
  const world: World = { ...WORLD, npcs: WORLD.npcs.filter((n) => n.trade === 'smith' && n.town !== 'town:far-hold') };
  let seen = 0;
  for (let s = 0; s < 200; s++) for (const g of rollGrudges(s, 1, only, world, NONE, []).grudges) {
    if (!g.story) continue;
    seen++;
    assert.deepEqual([g.id, g.giver, g.rival, g.rewardBronze], ['grudge:orla-mimir', 'character:smith-orla', 'character:rival-mimir', 300]);
  }
  assert.ok(seen > 0);
});

test('an empty pool rolls nothing; all rivals dead rolls nothing', () => {
  const dead = WORLD.npcs.map((n) => n.id);
  assert.deepEqual(rollGrudges(1, 1, TABLES, WORLD, { dead, held: [] }, []).grudges, []);
  assert.deepEqual(rollGrudges(1, 1, { ...TABLES, motives: [] }, WORLD, NONE, []).grudges, []);
});

// ---- holding a grudge, the kill guardrails, succession -------------------------------------------------------------------------
const T0 = 1_000_000_000, GRUDGE = { id: 'grudge:orla-mimir', giver: 'character:smith-orla', rival: 'character:rival-mimir', motive: 'undercutting', kit: 'ringed', twist: 'flee-at', rewardBronze: 300, rivalKillNotoriety: 600, story: true };
const offer = (o: Partial<OfferInput> = {}): OfferInput =>
  ({ careerLevel: 11, pointsInGiverTown: 0, giverAttitude: 0, held: [], rival: newRival(GRUDGE.rival, 'town:grey-ferry'), lastClosedAt: null, ...o });

test('grudge-open: every eligibility rule, with reasons', () => {
  assert.deepEqual(grudgeOpen(offer(), T0), []);
  assert.deepEqual(grudgeOpen(offer({ careerLevel: 10 }), T0), ['gate']);
  assert.deepEqual(grudgeOpen(offer({ pointsInGiverTown: 100 }), T0), ['suspect-in-giver-town']);
  assert.deepEqual(grudgeOpen(offer({ giverAttitude: -100 }), T0), ['giver-hostile']);
  const held = takeGrudge('pc:a', GRUDGE, newRival(GRUDGE.rival, 'town:grey-ferry'), T0);
  assert.deepEqual(grudgeOpen(offer({ held: [held] }), T0), ['holds-another']);
  assert.deepEqual(grudgeOpen(offer({ held: [held] }), T0 + GRUDGE_EXPIRY_S), [], 'an expired grudge no longer counts');
  assert.deepEqual(grudgeOpen(offer({ lastClosedAt: T0 }), T0 + GRUDGE_REOFFER_S - 1), ['reoffer-wait']);
  assert.deepEqual(grudgeOpen(offer({ lastClosedAt: T0 }), T0 + GRUDGE_REOFFER_S), []);
});

test('only a holder on the current cycle may attack; the first kill settles it and lapses every other holder', () => {
  const rival = newRival(GRUDGE.rival, 'town:grey-ferry', 3);
  const gs: GrudgeState[] = ['pc:a', 'pc:b'].map((c) => takeGrudge(c, GRUDGE, rival, T0));
  assert.equal(mayAttack('pc:a', rival, gs, T0 + 10), true);
  assert.equal(mayAttack('pc:z', rival, gs, T0 + 10), false);
  assert.deepEqual(rivalKill(rival, gs, 'pc:z', T0 + 10), { ok: false, reason: 'not-holder' });
  assert.deepEqual(rivalKill(rival, gs, 'pc:a', T0 + GRUDGE_EXPIRY_S), { ok: false, reason: 'not-holder' }, 'an expired grudge cannot kill');
  assert.equal(grudgeAt(gs[0]!, T0 + GRUDGE_EXPIRY_S).status, 'expired');
  const k = rivalKill(rival, gs, 'pc:a', T0 + 10);
  assert.ok(k.ok);
  assert.equal(k.rival.status, 'dead');
  assert.equal(k.rival.killedBy, 'pc:a');
  assert.ok(k.rival.successorAt! - T0 - 10 <= SUCCESSOR_MAX_S, 'never later than 14 days');
  assert.deepEqual(k.grudges.map((g) => g.status), ['settled', 'lapsed']);
  assert.deepEqual(rivalKill(k.rival, k.grudges, 'pc:b', T0 + 20), { ok: false, reason: 'rival-dead' }, 'one death per cycle');
  assert.deepEqual(grudgeOpen(offer({ rival: k.rival }), T0 + 20), ['rival-dead']);
});

test('succession: outcomes, the successor day, the next cycle, and a stale grudge cannot touch it', () => {
  assert.equal(successionOutcome([]), 'unresolved');
  assert.equal(successionOutcome([{ character: 'a', side: 'back', permille: 300 }, { character: 'b', side: 'settle', permille: 300 }]), 'unresolved');
  assert.equal(successionOutcome([{ character: 'a', side: 'back', permille: 301 }, { character: 'b', side: 'settle', permille: 300 }]), 'backed');
  assert.equal(successionOutcome([{ character: 'b', side: 'settle', permille: 1 }]), 'settled');
  assert.deepEqual(successionRewards([{ character: 'a', side: 'back', permille: 50 }, { character: 'b', side: 'settle', permille: 200 }], 100), [{ character: 'b', bronze: 100 }]);
  assert.equal(sideNotoriety('settle'), 100);
  assert.equal(sideNotoriety('back'), -100);

  const rival = newRival(GRUDGE.rival, 'town:grey-ferry', 3), g = takeGrudge('pc:a', GRUDGE, rival, T0);
  const k = rivalKill(rival, [g], 'pc:a', T0);
  assert.ok(k.ok);
  assert.equal(canJoin(k.rival, 'pc:a', 'back'), false);
  assert.equal(canJoin(k.rival, 'pc:a', 'settle'), true);
  assert.equal(canJoin(k.rival, 'pc:b', 'back'), true);
  assert.equal(closeSuccession(k.rival, 'backed').successorAt, T0 + SUCCESSOR_MIN_S);
  assert.equal(closeSuccession(k.rival, 'settled').successorAt, T0 + SUCCESSOR_MAX_S);
  for (let c = 0; c < 200; c++) {
    const d = unresolvedDay('character:rival-mimir', c);
    assert.ok(Number.isInteger(d) && d >= 7 && d <= 14);
    assert.equal(d, unresolvedDay('character:rival-mimir', c));
  }
  const days = new Set(Array.from({ length: 200 }, (_, c) => unresolvedDay('character:rival-mimir', c)));
  assert.equal(days.size, 8, 'every day 7..14 is reachable');

  const backed = closeSuccession(k.rival, 'backed');
  assert.equal(rivalAt(backed, T0 + SUCCESSOR_MIN_S - 1).status, 'dead');
  const next = rivalAt(backed, T0 + SUCCESSOR_MIN_S);
  assert.deepEqual([next.status, next.cycle], ['alive', 4]);
  const stale = { ...g, expiresAt: T0 + 30 * DAY_S }; // even a still-held grudge from cycle 3 cannot attack cycle 4
  assert.equal(mayAttack('pc:a', backed, [stale], T0 + SUCCESSOR_MIN_S), false);
});

test('the stand-in runs the service worse; a backed event eases it; a settled event discounts the giver', () => {
  const rival = newRival(GRUDGE.rival, 'town:grey-ferry'), k = rivalKill(rival, [takeGrudge('pc:a', GRUDGE, rival, T0)], 'pc:a', T0);
  assert.ok(k.ok);
  assert.equal(standInTerms(rival, T0, 10, 3), null, 'no stand-in while the rival lives');
  assert.deepEqual(standInTerms(k.rival, T0, 10, 3), { buyPermille: 1500, sellPermille: 667, upgradeCostPermille: 1500, upgradeTierCap: 9, vendorTier: 2 });
  assert.equal(standInTerms(closeSuccession(k.rival, 'backed'), T0, 10, 1)!.buyPermille, 1250);
  assert.equal(standInTerms(k.rival, T0, 10, 1)!.vendorTier, 1);
  assert.equal(giverPricePermille(closeSuccession(k.rival, 'settled'), T0 + DAY_S), 900);
  assert.equal(giverPricePermille(closeSuccession(k.rival, 'settled'), T0 + SUCCESSOR_MAX_S), 1000, 'until the successor arrives');
  assert.equal(giverPricePermille(closeSuccession(k.rival, 'backed'), T0 + DAY_S), 1000);
});

// ---- notoriety, alert, shun ------------------------------------------------------------------------------------------------------
test('notoriety: the worked example (600 → below Wanted after 3 days, 0 at 6), clamps, pay-off at 3 bronze a point', () => {
  const n = addNotoriety(CLEAN, 600, T0);
  assert.equal(bandOf(notorietyAt(n, T0)), 'hunted');
  assert.equal(notorietyAt(n, T0 + 3 * DAY_S), 300);
  assert.equal(bandOf(notorietyAt(n, T0 + 3 * DAY_S + 1)), 'suspect');
  assert.equal(notorietyAt(n, T0 + 6 * DAY_S), 0);
  assert.equal(notorietyAt(n, T0 + 60 * DAY_S), 0);
  assert.equal(notorietyAt(n, T0 + 1), 599, 'rounded down when read');
  assert.equal(addNotoriety(n, 900, T0).points, 1000);
  assert.equal(addNotoriety(n, -900, T0).points, 0);
  assert.deepEqual(payOff(n, 1800, T0), { notoriety: { points: 0, at: T0 }, points: 600, costBronze: 1800 });
  assert.deepEqual(payOff(n, 5000, T0).costBronze, 1800, 'never charges for more than is owed');
  assert.deepEqual(payOff(n, 100, T0), { notoriety: { points: 567, at: T0 }, points: 33, costBronze: 99 });
  assert.equal(payAllCost({ a: n, b: addNotoriety(CLEAN, 300, T0) }, T0), 2700);
});

test('the escalation table by band', () => {
  assert.deepEqual(townResponse(99), { band: 'clean', shopPricePermille: 1000, shuns: false, rings: [], patronStrikes: false, bouncer: false, hunters: false });
  assert.deepEqual(townResponse(100), { band: 'suspect', shopPricePermille: 1250, shuns: true, rings: [], patronStrikes: false, bouncer: false, hunters: false });
  assert.deepEqual(townResponse(300), { band: 'wanted', shopPricePermille: null, shuns: false, rings: ['outer', 'middle'], patronStrikes: true, bouncer: false, hunters: false });
  assert.deepEqual(townResponse(600), { band: 'hunted', shopPricePermille: null, shuns: false, rings: ['outer', 'middle', 'inner'], patronStrikes: true, bouncer: true, hunters: true });
});

test('the alert spreads half to same-trade towns of the region only', () => {
  assert.deepEqual(alertSpread(WORLD, 'town:grey-ferry', 'smith'), [
    { town: 'town:grey-ferry', delta: 600 }, { town: 'town:concord-exchange', delta: 300 }, { town: 'town:cinder-shrine', delta: 300 },
  ]);
  assert.deepEqual(alertSpread(WORLD, 'town:grey-ferry', 'healer', 650), [{ town: 'town:grey-ferry', delta: 650 }]);
  assert.deepEqual(alertSpread(WORLD, 'town:nowhere', 'smith'), []);
});

test('trade shunning: same trade only, the giver exempt, 6 days from 600, the later expiry wins, wanted refuses outright', () => {
  assert.equal(shunUntil(600, T0), T0 + 6 * DAY_S);
  assert.equal(shunUntil(99, T0), T0);
  const s = shun(undefined, 'smith', 'town:grey-ferry', 'character:smith-orla', 600, T0);
  const by = (id: string) => WORLD.npcs.find((n) => n.id.endsWith(id))!;
  assert.deepEqual(serviceAccess(by('smith-cinder'), 0, [s], T0), { kind: 'refused', reason: 'shunned', stance: 'turned-away', prompt: 'Closed to you' });
  assert.deepEqual(serviceAccess(by('smith-cinder'), 0, [s], T0 + 6 * DAY_S), { kind: 'open', pricePermille: 1000 });
  assert.deepEqual(serviceAccess(by('orla'), 0, [s], T0), { kind: 'open', pricePermille: 1000 }, 'the giver commissioned it');
  assert.deepEqual(serviceAccess(by('fence-cinder'), 150, [s], T0), { kind: 'open', pricePermille: 1250 }, 'other trades: suspect price only');
  assert.equal(serviceAccess(by('fence-cinder'), 300, [], T0).kind, 'refused');
  const s2 = shun(s, 'smith', 'town:far-hold', 'character:smith-far', 200, T0 + DAY_S);
  assert.equal(s2.until, s.until, 'a shorter second shun keeps the later until');
  assert.deepEqual(s2.exempt, ['character:smith-orla', 'character:smith-far']);
});

// ---- guards, arrest, jail ----------------------------------------------------------------------------------------------------------
test('rings: stronger toward the centre, armed by band, guard level max(floor, you + over) capped at the ladder top', () => {
  assert.equal(ringAt(40, 299), null, 'suspect: no guards');
  assert.equal(ringAt(40, 300)!.id, 'outer');
  assert.equal(ringAt(20, 300)!.id, 'middle');
  assert.equal(ringAt(5, 300)!.id, 'middle', 'a wanted player in the yard meets the middle guard, never nobody');
  assert.equal(ringAt(5, 600)!.id, 'inner');
  assert.equal(ringAt(30, 600)!.id, 'outer');
  assert.deepEqual(guardChallenge(40, 300, 1, 0, T0), { ring: 'outer', level: 25, damagePermille: 1000 });
  assert.deepEqual(guardChallenge(20, 300, 30, 0, T0), { ring: 'middle', level: 40, damagePermille: 1500 });
  assert.deepEqual(guardChallenge(0, 600, 35, 0, T0), { ring: 'inner', level: MAX_LEVEL, damagePermille: 4000 });
  assert.equal(guardChallenge(0, 600, 35, T0 + 1, T0), null, 'grace after a win or a release');
  assert.equal(DEFAULT_RINGS.length, 3);
});

test('a guard loss is an arrest: fine from metal (min 100), unpaid rest as jail, capped; never gear', () => {
  assert.deepEqual(arrest('town:grey-ferry', 600, 5000, T0), { finePaidBronze: 1200, unpaidBronze: 0, balanceBronze: 3800, jail: { town: 'town:grey-ferry', until: T0 + 600, fineBronze: 1200 } });
  assert.equal(arrest('t', 10, 5000, T0).finePaidBronze, 100);
  assert.deepEqual(arrest('t', 600, 1000, T0).jail.until, T0 + 800);
  assert.deepEqual(arrest('t', 1000, 0, T0), { finePaidBronze: 0, unpaidBronze: 2000, balanceBronze: 0, jail: { town: 't', until: T0 + 1800, fineBronze: 2000 } });
  const n = addNotoriety(CLEAN, 400, T0), lost = guardDuel('loss', 't', n, 50, T0);
  assert.equal(lost.outcome, 'loss');
  assert.deepEqual(Object.keys(lost).sort(), ['arrest', 'notoriety', 'outcome'], 'no item, equipment or bank field exists to take');
  const won = guardDuel('win', 't', n, 50, T0);
  assert.ok(won.outcome === 'win');
  assert.equal(won.notoriety.points, 450);
  assert.equal(won.graceUntil, T0 + 120);
  const jail = arrest('t', 400, 0, T0).jail;
  assert.equal(jailed(jail, T0 + 100), true);
  assert.equal(bailBronze(jail, T0 + 100), jail.until - T0 - 100);
  assert.equal(jailed(jail, jail.until), false);
  const out = release(n, jail.until);
  assert.equal(out.notoriety.points, notorietyAt(n, jail.until) - 200);
  assert.equal(out.graceUntil, jail.until + 120);
});

// Seed-to-roll vector (serverSeed 1234, region 1, rotation 2931): pins the hash, the PRNG use and the draw order.
const PINNED: GrudgeRoll = {
  kind: 'grudge-roll', schemaVersion: 1, region: R1, rotation: 2931, seed: 3361335922,
  grudges: [
    { id: 'grudge:ash-frontier-r2931-1', giver: 'character:lord-cinder', rival: 'character:rival-mimir', motive: 'old-debt', kit: 'ringed-patron', twist: 'no-block', rewardBronze: 325, rivalKillNotoriety: 650, story: false },
    { id: 'grudge:ash-frontier-r2931-2', giver: 'character:smith-cinder', rival: 'character:healer-ferry', motive: 'family-insult', kit: 'light', twist: 'no-block', rewardBronze: 360, rivalKillNotoriety: 500, story: false },
    { id: 'grudge:ash-frontier-r2931-3', giver: 'character:rival-mimir', rival: 'character:fence-cinder', motive: 'old-debt', kit: 'ringed', twist: 'flee-at', rewardBronze: 300, rivalKillNotoriety: 600, story: false },
  ],
};
