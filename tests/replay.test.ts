import test from 'node:test';
import assert from 'node:assert/strict';
import { initialPractice, stepPractice } from '../src/combat.ts';
import { OPPONENTS } from '../src/moves.ts';
import type { Intent } from '../src/duel.ts';
import { createRecorder, decodeRecord, type FightRecord } from '../src/record.ts';
import { MAX_SHARE_CHARS, replayParam, shareUrl, verifyRecord } from '../src/replay.ts';

const intent = (over: Partial<Intent> & { move?: Partial<Intent['move']> } = {}): Intent => ({
  move: { x: 0, z: 0, yaw: 0, run: false, ...over.move }, action: null, guard: false, lock: true,
  ...Object.fromEntries(Object.entries(over).filter(([k]) => k !== 'move')),
});

// The same scripted fight as tests/record.test.ts: busy stick, drifting yaw, bursts of attacks, against the Veteran on his own profile.
function scriptedFight(seed = 731, ticks = 1800) {
  const opponent = OPPONENTS.veteran, rec = createRecorder({ weapon: 'longsword', build: 'abc1234', opponent: 'veteran', profile: 'normal', seed });
  let practice = initialPractice(seed, opponent), yaw = 0.6;
  for (let t = 0; t < ticks && !practice.finish; t++) {
    yaw += 0.004 * Math.sin(t / 37);
    const phase = t % 240, raw = intent({
      move: { x: phase < 90 ? Math.sin(t / 25) : 0, z: phase < 90 ? 0.8 : phase < 120 ? -0.6 : 0, yaw, run: phase > 200 },
      action: phase === 95 ? 'light' : phase === 110 ? 'light' : phase === 130 ? 'heavy' : phase === 170 ? 'thrust' : phase === 190 ? 'kick' : null,
      guard: phase >= 140 && phase < 165, guardDirection: phase >= 140 && phase < 165 ? 'overhead' : undefined, held: phase > 125 && phase < 135,
    });
    practice = stepPractice(practice, rec.push(raw), opponent.profiles.normal);
  }
  return { record: rec.finish(practice.finish ? (practice.finish.victim === 1 ? 'killed' : 'died') : 'abandoned'), practice };
}

test('replay: a genuine record verifies — the headless replay ends on the recorded tick with the recorded outcome [slow]', () => {
  const { record, practice } = scriptedFight();
  assert.ok(practice.finish, 'the scripted fight ends');
  const check = verifyRecord(record);
  assert.equal(check.ok, true, check.ok ? '' : check.reason);
  if (check.ok) { assert.equal(check.practice.duel.tick, practice.duel.tick); assert.deepEqual(check.practice.finish, practice.finish); }
});

test('replay: a tampered record is refused — a lost last tick, a wrong outcome, an extra tick after the finish, an unknown warden profile [slow]', () => {
  const { record } = scriptedFight();
  const short: FightRecord = { ...record, ticks: record.ticks - 1, intents: record.intents.slice(0, -1) };
  const s = verifyRecord(short); assert.equal(s.ok, false); if (!s.ok) assert.match(s.reason, /does not reach its finish/);
  const lied: FightRecord = { ...record, outcome: record.outcome === 'died' ? 'killed' : 'died' };
  const l = verifyRecord(lied); assert.equal(l.ok, false); if (!l.ok) assert.match(l.reason, /the replay ends in/);
  const long: FightRecord = { ...record, ticks: record.ticks + 1, intents: [...record.intents, intent()] };
  const g = verifyRecord(long); assert.equal(g.ok, false); if (!g.ok) assert.match(g.reason, /before the record's last tick/);
  const odd: FightRecord = { ...record, profile: 'insane' as FightRecord['profile'] };
  const o = verifyRecord(odd); assert.equal(o.ok, false); if (!o.ok) assert.match(o.reason, /unknown opponent or warden profile/);
  const abandoned: FightRecord = { ...short, outcome: 'abandoned' };
  assert.equal(verifyRecord(abandoned).ok, true, 'an abandoned record that reaches no finish is consistent');
});

test('replay: the share link carries the opponent as its own parameter and the record as `replay`; it decodes back; over the cap it is refused', async () => {
  const { record } = scriptedFight();
  const link = await shareUrl(record, 'https://frankendom.com');
  assert.ok('url' in link, 'a scripted 30 s fight fits the link cap');
  if ('url' in link) {
    assert.match(link.url, /^https:\/\/frankendom\.com\/\?opponent=veteran&replay=[A-Za-z0-9_-]+$/);
    const text = replayParam(new URL(link.url).search);
    assert.ok(text); assert.deepEqual(await decodeRecord(text!), record);
  }
  assert.equal(replayParam('?opponent=veteran'), null);
  assert.equal(replayParam('?replay=abc*def'), 'abc', 'the parameter stops at the first non-base64url character');
  const rec = createRecorder({ weapon: 'longsword', build: 'x', opponent: 'veteran', profile: 'normal', seed: 1 });
  for (let i = 0; i < 40000; i++) rec.push(intent({ move: { x: Math.random() * 2 - 1, z: Math.random() * 2 - 1, yaw: Math.random() * 6 - 3, run: i % 2 === 0 }, action: (['light', 'heavy', 'thrust', null] as const)[i % 4] }));
  const noisy = await shareUrl(rec.finish('abandoned'), 'https://frankendom.com');
  assert.ok('tooLong' in noisy && noisy.tooLong > MAX_SHARE_CHARS, 'random noise over ten minutes does not fit a link');
});
