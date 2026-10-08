import test from 'node:test';
import assert from 'node:assert/strict';
import { idleIntent } from '../src/duel.ts';
import { playScaleFor, setLateNotice, setPlayScale } from '../src/play-radius.ts';
import { setStab } from '../src/stab-rule.ts';
import { FIRST_GROUP_VERSION, NO_PATRON_VERSION, RECORD_VERSION, createRecorder, packRecord, unpackRecord, type RecordMeta } from '../src/record.ts';

// RV39 (Strategy's number, Combat 2026-10-08): a stream of a shared-health group names its group in the header.
const mk = (meta: RecordMeta) => { setPlayScale(playScaleFor(meta.opponent, RECORD_VERSION)); setLateNotice(true); setStab(true); return createRecorder(meta); };
const meta: RecordMeta = { build: 'abc1234', opponent: 'veteran', weapon: 'longsword', level: 6, seed: 4242 };
const fight = (m: RecordMeta) => { const rec = mk(m); for (let t = 0; t < 30; t++) rec.push({ ...idleIntent(), action: t === 2 ? 'light' : null }); return rec.finish('abandoned'); };

test('a group stream is written as v39 with its size and index, and round-trips', () => {
  const record = fight({ ...meta, group: { n: 3, index: 2, incoming: [], held: [] } });
  assert.equal(record.v, FIRST_GROUP_VERSION);
  const back = unpackRecord(packRecord(record));
  assert.deepEqual(back.group, { n: 3, index: 2, incoming: [], held: [] }); assert.equal(back.v, FIRST_GROUP_VERSION);
});

test('an ungrouped fight keeps its old version and its old bytes: no flag, no extra byte', () => {
  const plain = fight(meta), grouped = fight({ ...meta, group: { n: 2, index: 0, incoming: [], held: [] } });
  assert.equal(plain.v, NO_PATRON_VERSION);
  assert.equal(packRecord(grouped).length - packRecord(plain).length, 1 + 1 + 2 + 2, 'the patron byte every v32+ header carries, the group byte and the two empty list counts');
  assert.equal(unpackRecord(packRecord(plain)).group, undefined);
});

test('a group stream with a pose carries both (v39 reads both flags)', () => {
  const pose = { hero: { x: -2, z: 1 }, foe: { x: 1.5, z: -1 }, heroFacing: 0.5 };
  const back = unpackRecord(packRecord(fight({ ...meta, group: { n: 4, index: 1, incoming: [], held: [] }, pose })));
  assert.deepEqual(back.group, { n: 4, index: 1, incoming: [], held: [] }); assert.deepEqual(back.pose, pose);
});

test('bad groups are refused: size outside 2..7, an index past the size, a v39 record without its group, a group below v39', () => {
  const record = fight({ ...meta, group: { n: 3, index: 1, incoming: [], held: [] } });
  const e = { incoming: [], held: [] };
  for (const group of [{ n: 1, index: 0, ...e }, { n: 8, index: 0, ...e }, { n: 3, index: 3, ...e }, { n: 3, index: -1, ...e }, { n: 2.5, index: 0, ...e }, { n: 3, index: 1, incoming: [[5, 3], [5, 4]], held: [] }, { n: 3, index: 1, incoming: [[999, 3]], held: [] }, { n: 3, index: 1, incoming: [], held: [[4, 4]] }, { n: 3, index: 1, incoming: [[2, 0]], held: [] }] as never[]) assert.throws(() => packRecord({ ...record, group }), /unknown group/);
  assert.throws(() => packRecord({ ...record, v: 38 as never }), /group on a version/);
  const bytes = packRecord(record), at = 3 + 1 + record.build.length + 1 + record.opponent.length + 1 + record.weapon.length + 1;
  assert.equal(bytes[at], 64, 'the flag byte is the group bit alone');
  const noFlag = bytes.slice(); noFlag[at] = 0; assert.throws(() => unpackRecord(noFlag), /names its group/);
  const badByte = bytes.slice(); badByte[at + 3] = (5 << 4) | 3; assert.throws(() => unpackRecord(badByte), /unknown group|truncated|length/);
  const old = bytes.slice(); old[2] = 38; assert.throws(() => unpackRecord(old), /unknown specials flag/);
});

test('a group stream with its incoming and held lists round-trips, and an unlisted tick or a truncated list is refused', () => {
  const record = fight({ ...meta, group: { n: 3, index: 1, incoming: [[5, 12], [9, 3]], held: [[1, 4], [10, 12]] } });
  const back = unpackRecord(packRecord(record));
  assert.deepEqual(back.group, { n: 3, index: 1, incoming: [[5, 12], [9, 3]], held: [[1, 4], [10, 12]] });
  assert.throws(() => unpackRecord(packRecord(record).slice(0, 60)), /truncated|length/);
});
