import assert from 'node:assert/strict';
import test from 'node:test';
import { damageSources, explainDecisions, intentFor, selectMoments, videoSecondAt } from '../scripts/lib/player-bot-review.mjs';

test('the receipt separates attempted inputs from accepted attacks and results', () => {
  const decisions = [
    { tick: 100, intent: 'punish missed swing with thrust', press: 'KeyT', phase: 'recovery' },
    { tick: 200, intent: 'punish missed swing with thrust', press: 'KeyT', phase: 'ready' },
    { tick: 300, intent: 'charge heavy', press: null, phase: 'ready' },
    { tick: 400, intent: 'close under guard', press: null, phase: 'ready' },
  ];
  const events = [
    { tick: 202, type: 'AttackStarted', actor: 0, move: 'thrust' },
    { tick: 227, type: 'AttackMissed', actor: 0, move: 'thrust' },
    { tick: 302, type: 'AttackStarted', actor: 0, move: 'heavy_overhead' },
    { tick: 360, type: 'Hit', actor: 0, target: 1, move: 'heavy_overhead' },
    { tick: 430, type: 'Hit', actor: 1, target: 0 },
  ];
  const receipt = explainDecisions(decisions, events);
  assert.deepEqual(receipt.map(d => d.outcome), ['no attack started', 'missed', 'hit', 'got hit']);
  assert.equal(receipt[0].evidence, 'input during recovery');
  assert.equal(receipt[1].evidence, 227);
});

test('intent, clip moments and video-time mapping are grounded in observed events', () => {
  assert.equal(intentFor({ keys: [], press: 'KeyG' }, { tick: 112 }, 'counter', [{ tick: 100, type: 'Blocked', actor: 0 }]), 'counter after defence');
  const decisions = [{ tick: 400, intent: 'guard', outcome: 'got hit', evidence: 430 }];
  const events = [{ tick: 227, type: 'AttackMissed', actor: 0 }, { tick: 430, type: 'Hit', actor: 1, target: 0 }, { tick: 900, type: 'Whipped', target: 0 }];
  assert.deepEqual(selectMoments(events, decisions, 1800).map(m => m.kind), ['missed attack', 'failed guard', 'wall punishment', 'long inactivity']);
  assert.equal(videoSecondAt(150, [{ tick: 100, videoSeconds: 8 }, { tick: 200, videoSeconds: 12 }]), 10);
});

test('a later hit is not attributed to guard after the bot changed input', () => {
  const decisions = [{ tick: 100, intent: 'guard' }, { tick: 110, intent: 'close distance' }];
  const events = [{ tick: 120, type: 'Hit', actor: 1, target: 0 }];
  assert.equal(explainDecisions(decisions, events)[0].outcome, 'no contact');
});

test('timeout aftermath cannot become an active-fight highlight or a negative clip', () => {
  const events = [{ tick: 2907, type: 'Hit', actor: 0, target: 1 }, { tick: 5597, type: 'Whipped', actor: 0, target: 0 }];
  assert.ok(!selectMoments(events, [], 5400).some(m => m.tick > 5400 || m.kind === 'wall punishment'));
  const samples = [{ tick: 0, videoSeconds: 4.009 }, { tick: 5400, videoSeconds: 122.369 }];
  assert.equal(videoSecondAt(-1, samples), 4.009);
  assert.equal(videoSecondAt(5417, samples), 122.369);
});

test('damage sources count guard break once and keep arena damage separate', () => {
  const events = [
    { tick: 10, type: 'Hit', actor: 0, target: 1, move: 'heavy_overhead', damage: 12 },
    { tick: 20, type: 'GuardBroken', actor: 0, target: 1, move: 'heavy_overhead', damage: 27 },
    { tick: 20, type: 'Hit', actor: 0, target: 1, move: 'heavy_overhead', damage: 27 }, // duplicate result in a future event emitter
    { tick: 25, type: 'Blocked', actor: 1, target: 0, damage: 2 },
    { tick: 30, type: 'Whipped', actor: 1, target: 1, damage: 3 },
    { tick: 40, type: 'Hit', actor: 1, target: 0, damage: 8 },
  ];
  assert.deepEqual(damageSources(events), {
    player: { hits: 12, guardBreaks: 27, blockedChip: 2, total: 41 },
    opponent: { hits: 8, guardBreaks: 0, blockedChip: 0, total: 8 },
    arena: { toPlayer: 0, toOpponent: 3 },
  });
});

test('each defence reports what it earned: damage avoided, window opened and used, distance', async () => {
  const { defenceEarned, summarizeDefences, chargedAnswers } = await import('../scripts/lib/player-bot-review.mjs');
  const events = [
    { tick: 10, type: 'AttackStarted', actor: 1, move: 'light_right' },
    { tick: 30, type: 'Blocked', actor: 0, target: 1, move: 'light_right', perfect: false, damage: 2 },
    { tick: 40, type: 'AttackStarted', actor: 0, move: 'heavy_counter' },
    { tick: 60, type: 'Hit', actor: 0, target: 1, move: 'heavy_counter', damage: 20 },
    { tick: 100, type: 'AttackStarted', actor: 1, move: 'heavy_overhead' },
    { tick: 130, type: 'Charged', actor: 1, move: 'heavy_overhead' },
    { tick: 150, type: 'ActionStarted', actor: 0, action: 'roll' },
    { tick: 165, type: 'Dodged', actor: 0, target: 1, move: 'heavy_overhead' },
    { tick: 300, type: 'ActionStarted', actor: 0, action: 'backstep' },
  ];
  const track = [{ tick: 0, gap: 1.5, radius: 2 }, { tick: 150, gap: 1.2, radius: 3 }, { tick: 180, gap: 2.2, radius: 3.5 }, { tick: 300, gap: 2, radius: 3 }];
  const list = defenceEarned(events, track, { light_right: 10, heavy_overhead: 20 });
  assert.deepEqual(list.map(d => [d.type, d.avoided, d.windowOpened, d.windowUsed, d.counterMove, d.landed, d.result]), [
    ['block', 8, true, true, true, true, 'chip'],
    ['roll', 30, true, false, false, false, 'dodged'],
    ['backstep', 0, false, false, false, false, 'no attack in flight'],
  ]);
  assert.equal(list[1].charged, true);
  assert.equal(list[1].distance, 1);
  const summary = summarizeDefences(list);
  assert.equal(summary.roll.avoided, 30);
  assert.equal(summary.block.landed, 1);
  assert.equal(summary.backstep.underThreat, 0);
  const charged = chargedAnswers(events, [{ tick: 145, reason: 'lateral roll clear of charged overhead' }]);
  assert.deepEqual(charged, [{ tick: 130, move: 'heavy_overhead', answer: 'rolled', playerActions: ['roll'], reactedToCharge: true, damage: 0 }]);
});
