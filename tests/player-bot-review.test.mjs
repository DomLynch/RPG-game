import assert from 'node:assert/strict';
import test from 'node:test';
import { explainDecisions, intentFor, selectMoments, videoSecondAt } from '../scripts/lib/player-bot-review.mjs';

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
