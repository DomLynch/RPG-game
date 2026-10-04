import test from 'node:test';
import assert from 'node:assert/strict';
import { createSparring, playableOpponents, runFight, eventDamage, damagingContacts, probeIntent } from '../scripts/lib/sim-bot.mjs';
import { opponentAt, OPPONENTS, profileAt } from '../src/moves.ts';

const url = (opponent = 'pitborn', level = 6, extra = {}) => '/?' + new URLSearchParams({ spar: '1', opponent, difficulty: String(level), weapon: 'longsword', skill: 'none', special: 'none', yourSpecial: 'none', ...extra });

test('engine bot: all ten playable opponents use actual body/profile scaling at low, threshold and boss levels', () => {
  assert.equal(playableOpponents.length, 10);
  for (const opponent of playableOpponents) for (const level of [1, 5, 6, 11, 12, 18, 46]) {
    const { match, config } = createSparring(url(opponent, level), 731);
    const body = opponentAt(OPPONENTS[opponent], level);
    assert.equal(match.mode, 'sparring');
    assert.equal(config.engineLevel, level);
    assert.equal(match.practice.duel.fighters[1].maxHealth, body.health);
    assert.equal(match.practice.duel.fighters[1].weapon, body.weapon);
    assert.deepEqual(config.aiProfile, profileAt(OPPONENTS[opponent], level));
    assert.equal(match.recorder, null);
  }
  assert.equal(createSparring(url('pitborn', 5), 731).config.displayRank, 1);
  assert.equal(createSparring(url('pitborn', 6), 731).config.displayRank, 2);
  assert.equal(createSparring(url('nightborn', 46), 731).config.displayRank, 10);
  assert.equal(createSparring(url('pitborn', 'easy'), 731).config.engineLevel, 6);
});

test('engine bot: independent specials do not silently change difficulty, weapon or legacy skill', () => {
  const { match, config } = createSparring(url('nightborn', 46, { weapon: 'trident', skill: 'miasma', special: 'nyx' }), 731);
  assert.equal(config.engineLevel, 46);
  assert.equal(match.weapon, 'trident');
  assert.equal(match.practice.duel.fighters[0].skill, 'miasma');
  assert.equal(match.practice.duel.fighters[1].specialName, 'nyxnightfall');
  assert.equal(match.practice.duel.fighters[1].maxHealth, opponentAt(OPPONENTS.nightborn, 46).health);
  const own = createSparring(url('pitborn', 46, { yourSpecial: 'nyx' }), 731).match;
  assert.equal(own.practice.duel.fighters[0].specialName, 'nyxnightfall');
  assert.equal(own.practice.duel.fighters[1].specialShare, undefined);
});

test('engine bot: refuse held/unknown opponents, invalid levels and conflicting selections', () => {
  for (const value of [url('nightborn', 5, { special: 'nyx' }), url('pitborn', 5, { yourSpecial: 'nyx' }), url('werewolf'), url('unknown'), url('pitborn', 47), url('pitborn', 0), url('pitborn', 6, { special: 'nyx' }), url('pitborn', 6, { skill: 'miasma', yourSpecial: 'nyx' }), url() + '&difficulty=12']) {
    assert.throws(() => createSparring(value, 731), value);
  }
});

test('engine bot: identical seeds reproduce full intents/events; dummy cannot attack; timeouts retained', () => {
  const first = runFight(url('pitborn', 'dummy'), 731, 'light spam', 500);
  assert.deepEqual(first, runFight(url('pitborn', 'dummy'), 731, 'light spam', 500));
  assert.equal(first.events.filter(e => e.type === 'AttackStarted' && e.actor === 1).length, 0);
  assert.equal(runFight(url(), 732, 'light spam', 1).outcome, 'timeout');
  assert.ok(first.events.some(e => e.type === 'AttackStarted' && e.actor === 0));
});

// SpecialLanded is a distinct production event, not a Hit; never silently drop it.
test('engine bot: special damage and defender chip are counted once, terminal events excluded', () => {
  const events = [
    { type: 'SpecialLanded', actor: 1, target: 0, damage: 30 },
    { type: 'Blocked', actor: 0, target: 1, damage: 4 },
    { type: 'Killed', actor: 1, target: 0, damage: 30 },
  ];
  assert.equal(eventDamage(events, 0), 34);
  assert.equal(eventDamage(events, 1), 0);
  assert.equal(damagingContacts(events, 0), 2);
  assert.equal(damagingContacts(events, 1), 0);
  assert.equal(damagingContacts([{ type: 'SpecialLanded', actor: 1, target: 0, damage: 0 }], 0), 0);
});

test('engine bot: knife probe closes the range gap instead of idling outside its shorter reach', () => {
  const { match } = createSparring(url('pitborn', 6, { weapon: 'knife' }), 731);
  const d = match.practice.duel;
  d.fighters[0].phase = 'ready';
  d.fighters[0].body = { x: 0, z: 1.27, heading: Math.PI, distance: 0 };
  d.fighters[1].body = { x: 0, z: 0, heading: 0, distance: 0 };
  const intent = probeIntent(d, 'light spam');
  assert.equal(intent.action, null);
  assert.ok(intent.move.z < 0);
});

test('engine bot: level-matched equipped special is actually cast and lands under the skill probe', () => {
  const fight = runFight(url('pitborn', 1, { special: 'cleaverset', yourSpecial: 'cleaverset' }), 731, 'skill then light', 1600);
  assert.ok(fight.events.some(e => e.type === 'SpecialStarted' && e.actor === 0));
  assert.ok(fight.events.some(e => e.type === 'SpecialLanded' && e.actor === 0));
  assert.ok(fight.damageDealt > 0);
  assert.throws(() => runFight(url(), 731, 'skill then light', 10), /equipped/);
});

test('engine bot: range-thrust probe makes space when already inside its minimum range', () => {
  const { match } = createSparring(url(), 731);
  const d = match.practice.duel;
  d.fighters[0].phase = 'ready';
  d.fighters[0].body = { x: 0, z: 1, heading: Math.PI, distance: 0 };
  d.fighters[1].body = { x: 0, z: 0, heading: 0, distance: 0 };
  const intent = probeIntent(d, 'thrust from range');
  assert.equal(intent.action, null);
  assert.ok(intent.move.z > 0);
});
