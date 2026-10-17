// SPECIAL 2 in the Pit record (the specials PR, RV75): a fight with a slot-b class skill is stamped no lower than FIRST_SKILL2_VERSION, the pick rides the second flag byte (bit 1) and one skill-code byte, the 'skill2' press
// is a recordable action, and nothing older changes: a record with no pick is byte for byte what it was, an older version cannot carry one, an unknown code is refused.
import test from 'node:test';
import assert from 'node:assert/strict';
import { FIRST_SKILL2_VERSION, RECORD_VERSION, createRecorder, packRecord, unpackRecord } from '../src/fight/record.ts';
import { playScaleFor, setLateNotice, setPlayScale } from '../src/fight/play-radius.ts';
import { setStab } from '../src/fight/stab-rule.ts';

const base = { build: 't', opponent: 'veteran' as const, weapon: 'longsword' as const, level: 1, seed: 7 };
const fight = (extra: object = {}, press: 'skill2' | null = null) => {
  setPlayScale(playScaleFor(base.opponent, RECORD_VERSION)); setLateNotice(true); setStab(true);
  const rec = createRecorder({ ...base, ...extra });
  for (let i = 0; i < 30; i++) rec.push({ move: { x: 0, z: 0, yaw: 0, run: false }, action: i === 3 ? press : null, guard: false, lock: true });
  return rec.finish('abandoned');
};

test('a SPECIAL 2 fight is stamped at the skill2 era, round-trips its pick and its skill2 press', () => {
  const rec = fight({ skill2: 'stomp' }, 'skill2');
  assert.ok(rec.v >= FIRST_SKILL2_VERSION && rec.skill2 === 'stomp');
  const back = unpackRecord(packRecord(rec));
  assert.equal(back.skill2, 'stomp'); assert.equal(back.v, rec.v); assert.equal(back.intents[3]!.action, 'skill2');
  assert.deepEqual(back, rec);
});

test('every pick of the six round-trips, and a fight with no pick has no skill2 field and the same bytes as before', () => {
  for (const p of ['lunge', 'ironrush', 'pommel', 'shove', 'cleave', 'stomp'] as const) assert.equal(unpackRecord(packRecord(fight({ skill2: p }))).skill2, p);
  const plain = fight(); assert.ok(!('skill2' in plain) && !('skill2' in unpackRecord(packRecord(plain))));
  const a = fight({ skill2: 'lunge' }), b = fight({ skill2: 'stomp' });
  assert.equal(packRecord(a).length, packRecord(b).length, 'a pick is one fixed byte whichever skill it names');
  assert.equal(unpackRecord(packRecord(plain)).v, plain.v, 'a plain fight keeps the version its features stamp (nothing is pulled up to the skill2 era)');
});

test('an older version cannot carry a SPECIAL 2, and an unknown skill code is refused', () => {
  const rec = fight({ skill2: 'pommel' });
  assert.throws(() => packRecord({ ...rec, v: (FIRST_SKILL2_VERSION - 1) as never }), /cannot pack|no flag/);
  const bytes = packRecord(rec).slice();
  const at = bytes.length - (6 * 30) - 4 - 4 - 1 - 1 - 1;   // the skill byte sits just before the level byte, seed u32, n u32 and outcome byte
  assert.ok(bytes[at]! > 0); bytes[at] = 250;
  assert.throws(() => unpackRecord(bytes), /unknown skill/);
});
