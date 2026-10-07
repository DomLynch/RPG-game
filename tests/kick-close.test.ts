import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createGapHistory, kickCloseFlag, KICK_CLOSE_GROWTH, KICK_CLOSE_TICKS } from '../src/kick-close.ts';
import { createHud, type HudView } from '../src/hud.ts';
import { OPPONENTS, initialPractice, project } from '../src/combat.ts';

test('?look=kickclose: absent by default, read from the look list', () => {
  assert.equal(kickCloseFlag(''), false);
  assert.equal(kickCloseFlag('?look=kick52'), false);
  assert.equal(kickCloseFlag('?look=kick52,kickclose'), true);
});

test('the 4-tick window: grown by more than 3 cm over 4 ticks is retreating; exactly 3 cm, steady, closing or too young a history is not', () => {
  const run = (gaps: number[]) => { const h = createGapHistory(); gaps.forEach((g, i) => h.record(i, g)); return h.retreating(gaps.length - 1, gaps[gaps.length - 1]); };
  assert.equal(KICK_CLOSE_TICKS, 4); assert.equal(KICK_CLOSE_GROWTH, 0.03);
  assert.equal(run([1.0, 1.0, 1.0, 1.0, 1.04]), true, '4 cm in 4 ticks: retreating');
  assert.equal(run([1.0, 1.0, 1.0, 1.0, 1.03]), false, 'exactly 3 cm: not more than 3 cm');
  assert.equal(run([1.0, 1.0, 1.0, 1.0, 1.0]), false, 'steady');
  assert.equal(run([1.2, 1.15, 1.1, 1.05, 1.0]), false, 'closing');
  assert.equal(run([1.0, 1.0, 1.0, 1.05]), false, 'only 3 ticks of history: nothing 4 ticks old yet');
  assert.equal(run([1.0, 1.1, 1.1, 1.1, 1.1]), true, 'the window compares now with exactly 4 ticks ago (tick 4 vs tick 0: +10 cm)');
  assert.equal(run([1.0, 1.0, 1.1, 1.1, 1.1, 1.1, 1.1]), false, 'grew earlier than 4 ticks ago and has settled: tick 6 vs tick 2, steady');
  assert.equal(run([1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.05]), true, 'a late opening is seen');
});

test('a frame that carried several ticks uses the newest older sample; a tick that goes backwards (new fight) starts the history over; a repeated tick overwrites', () => {
  const h = createGapHistory(); h.record(0, 1.0); h.record(7, 1.2);
  assert.equal(h.retreating(7, 1.2), true, 'tick 0 stands in for "4 ticks ago"');
  h.record(2, 1.0);   // backwards: reset
  assert.equal(h.retreating(2, 1.0), false);
  h.record(3, 1.0); h.record(3, 1.5);   // the same tick again: the later gap stands
  h.record(7, 1.5); assert.equal(h.retreating(7, 1.5), false, 'tick 3 holds 1.5, so tick 7 at 1.5 is steady');
});

// The light end to end through the real HUD, flag on and off, fed one tick at a time.
const FakeEl = class { dataset: Record<string, string> = {}; style = { props: new Map(), setProperty(k: string, v: string) { this.props.set(k, v); } }; children: unknown[] = []; hidden = false; textContent = ''; classList = { toggle() {}, add() {}, remove() {} }; setAttribute() {} firstChild = null; value = 0; max = 0; append() {} };
const light = (flag: boolean, gaps: number[]) => {
  const els = new Map<string, InstanceType<typeof FakeEl>>(); const element = (id: string) => { if (!els.has(id)) els.set(id, new FakeEl()); return els.get(id)!; };
  element('dmg-pool').children = [new FakeEl(), new FakeEl()];
  const hud = createHud(element as never), start = initialPractice(731, OPPONENTS.veteran);
  const [me, him] = start.duel.fighters;
  let reach: string | undefined;
  gaps.forEach((gap, tick) => {
    const duel = { ...start.duel, tick, fighters: [{ ...me, phase: 'ready' as const }, { ...him, body: { ...him.body, x: me.body.x + gap, z: me.body.z } }] as typeof start.duel.fighters };
    hud.update(project(duel, start.ai), { controlsReady: true, debug: false, opponentId: 'veteran', kickClose: flag } as HudView);
    reach = element('kick-button').dataset.reach;
  });
  return reach;
};
test('through the HUD: a foe opening the gap inside 1.5 m un-lights KICK only with the flag; closing, steady and out-of-reach read as before', () => {
  const opening = [1.0, 1.0, 1.0, 1.0, 1.0, 1.05, 1.1];
  assert.equal(light(true, opening), 'false', 'flag on, opening: dark');
  assert.equal(light(false, opening), 'true', 'flag off: byte-identical to today, lit at 1.1 m');
  assert.equal(light(true, [1.2, 1.15, 1.1, 1.05, 1.0, 0.95]), 'true', 'closing: lit');
  assert.equal(light(true, [1.0, 1.0, 1.0, 1.0, 1.0, 1.0]), 'true', 'steady: lit');
  assert.equal(light(true, [1.6, 1.6, 1.6, 1.6, 1.6]), 'false', 'beyond 1.5 m: dark either way');
  assert.equal(light(false, [1.6, 1.6, 1.6, 1.6, 1.6]), 'false');
  assert.equal(light(true, opening.concat([1.1, 1.1, 1.1, 1.1, 1.1])), 'true', 'the foe stopped: the light returns once the window has settled');
});

test('wiring pins: the HUD ANDs the window onto the plain 1.5 m rule only when the flag is on, and main.ts passes the flag', () => {
  const hud = readFileSync(new URL('../src/hud.ts', import.meta.url), 'utf8'), main = readFileSync(new URL('../src/main.ts', import.meta.url), 'utf8');
  assert.match(hud, /inKickReach = gap <= KICK_LANDS && !\(view\.kickClose && gaps\.retreating\(practice\.duel\.tick, gap\)\)/);
  assert.match(hud, /gaps\.record\(practice\.duel\.tick, gap\);/);
  assert.match(main, /const KICK_CLOSE = kickCloseFlag\(window\.location\?\.search \?\? ''\)/);
  assert.match(main, /hud\.update\(shown, \{ kickClose: KICK_CLOSE,/);
});
