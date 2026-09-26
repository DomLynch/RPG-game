import test from 'node:test';
import assert from 'node:assert/strict';
import { initialPractice, stepPractice } from '../src/combat.ts';
import { OPPONENTS } from '../src/moves.ts';
import type { Intent } from '../src/duel.ts';
import { RECORD_VERSION, createRecorder, decodeRecord, encodeRecord, fromBase64Url, packRecord, quantizeIntent, toBase64Url, unpackRecord, type FightRecord } from '../src/record.ts';

const intent = (over: Partial<Intent> & { move?: Partial<Intent['move']> } = {}): Intent => ({
  move: { x: 0, z: 0, yaw: 0, run: false, ...over.move }, action: null, guard: false, lock: true,
  ...Object.fromEntries(Object.entries(over).filter(([k]) => k !== 'move')),
});

test('record: quantization is idempotent, keeps every field, and maps the stick and yaw onto the record grid', () => {
  const raw = intent({ move: { x: 0.3333, z: -0.71, yaw: 2.9, run: true }, action: 'heavy', guard: true, guardDirection: 'low', held: true, cancel: true, lock: false });
  const q = quantizeIntent(raw);
  assert.deepEqual(quantizeIntent(q), q, 'quantizing twice changes nothing');
  assert.ok(Math.abs(q.move.x - raw.move.x) <= 1 / 254 && Math.abs(q.move.z - raw.move.z) <= 1 / 254, 'stick within half a step');
  assert.ok(Math.abs(q.move.yaw - raw.move.yaw) <= Math.PI / 256, 'yaw within half a step');
  assert.equal(q.action, 'heavy'); assert.equal(q.guard, true); assert.equal(q.guardDirection, 'low'); assert.equal(q.held, true); assert.equal(q.cancel, true); assert.equal(q.move.run, true); assert.equal(q.lock, false);
  const plain = quantizeIntent(intent());
  assert.deepEqual(plain, { move: { x: 0, z: 0, yaw: 0, run: false }, action: null, guard: false, lock: true }, 'absent optionals stay absent');
});

test('record: pack/unpack and encode/decode round-trip every intent shape, the seed and the metadata; the version comes first and an unknown one is refused', async () => {
  const rec = createRecorder({ weapon: 'longsword', build: 'abc1234', opponent: 'goblin', profile: 'hard', seed: 0xdeadbeef });
  const shapes: Intent[] = [
    intent(), intent({ move: { x: 1, z: -1, yaw: -3.1, run: true } }), intent({ action: 'light_left', guardDirection: 'left' }),
    intent({ action: 'parry', guard: true, guardDirection: 'overhead' }), intent({ action: 'dodge', held: true }), intent({ action: 'kick', cancel: true, lock: false }),
    intent({ action: 'backstep', move: { x: -0.5, z: 0.25, yaw: 3.1, run: false } }), intent({ action: 'thrust', guardDirection: 'thrust' }), intent({ action: 'light_right', guardDirection: 'right' }),
  ];
  for (let i = 0; i < 300; i++) rec.push(shapes[i % shapes.length]);
  const record = rec.finish('killed');
  assert.equal(record.v, RECORD_VERSION); assert.equal(record.ticks, 300); assert.equal(record.intents.length, 300);
  const bytes = packRecord(record);
  assert.deepEqual([...bytes.subarray(0, 3)], [0x46, 0x4b, RECORD_VERSION], 'magic then version, first');
  const back = unpackRecord(bytes);
  assert.deepEqual(back, record, 'binary round trip is exact (quantized intents, seed, opponent, profile, build, outcome)');
  const text = await encodeRecord(record);
  assert.match(text, /^[A-Za-z0-9_-]+$/, 'base64url, no padding');
  assert.deepEqual(await decodeRecord(text), record, 'transport round trip is exact');
  assert.equal(back.v, bytes[2], 'the record carries the version that was PARSED, not this build\'s constant');
  const other = new Uint8Array(bytes); other[2] = RECORD_VERSION + 1;
  assert.throws(() => unpackRecord(other), new RegExp(`version ${RECORD_VERSION + 1} is not supported`));
  assert.throws(() => unpackRecord(new Uint8Array([1, 2, 3])), /not a fight record/);
  assert.throws(() => unpackRecord(bytes.subarray(0, bytes.length - 1)), /length does not match/);
  await assert.rejects(decodeRecord('not*base64'), /not base64url/);
  await assert.rejects(decodeRecord(toBase64Url(new Uint8Array([1, 2, 3, 4]))), /cannot decode/);
  const seeded = rec.finish('died');
  assert.equal(seeded.outcome, 'killed', 'finish is idempotent: the first outcome stands');
  assert.deepEqual(fromBase64Url(toBase64Url(new Uint8Array([0, 255, 1, 254, 2]))), new Uint8Array([0, 255, 1, 254, 2]));
});

// A scripted 30 s fight against the Veteran: the stick circles, the camera yaw drifts as the lock blends, attacks and guards come in
// bursts. This is the shape of a real fight's intent stream (busy stick, busy yaw) — the worst case for the encoder, not the best.
function scriptedFight(seed = 731, ticks = 1800) {
  const rec = createRecorder({ weapon: 'longsword', build: 'abc1234', opponent: 'veteran', profile: 'normal', seed });
  let practice = initialPractice(seed, OPPONENTS.veteran), yaw = 0.6;
  for (let t = 0; t < ticks && !practice.finish; t++) {
    yaw += 0.004 * Math.sin(t / 37);
    const phase = t % 240, raw = intent({
      move: { x: phase < 90 ? Math.sin(t / 25) : 0, z: phase < 90 ? 0.8 : phase < 120 ? -0.6 : 0, yaw, run: phase > 200 },
      action: phase === 95 ? 'light' : phase === 110 ? 'light' : phase === 130 ? 'heavy' : phase === 170 ? 'thrust' : phase === 190 ? 'kick' : null,
      guard: phase >= 140 && phase < 165, guardDirection: phase >= 140 && phase < 165 ? 'overhead' : undefined, held: phase > 125 && phase < 135,
    });
    practice = stepPractice(practice, rec.push(raw), OPPONENTS.veteran.profiles.normal);
  }
  return { record: rec.finish(practice.finish ? (practice.finish.victim === 1 ? 'killed' : 'died') : 'abandoned'), practice };
}

test('record: a real 30 s fight against the Veteran encodes under 2 KB and replays to the identical fight (determinism) [slow]', async () => {
  const { record, practice } = scriptedFight();
  assert.ok(record.ticks >= 600, `the scripted fight ran ${record.ticks} ticks`);
  const text = await encodeRecord(record);
  assert.ok(text.length < 2048, `encoded ${record.ticks}-tick fight is ${text.length} chars (target < 2048)`);
  const decoded = await decodeRecord(text);
  let replay = initialPractice(decoded.seed, OPPONENTS[decoded.opponent]);
  for (const it of decoded.intents) replay = stepPractice(replay, it, OPPONENTS[decoded.opponent].profiles[decoded.profile]);
  assert.equal(replay.duel.tick, practice.duel.tick, 'same final tick');
  assert.deepEqual(replay.duel.fighters, practice.duel.fighters, 'same fighters, bit for bit');
  assert.deepEqual(replay.finish, practice.finish, 'same finish');
  assert.equal(replay.events.length, practice.events.length);
});

test('record: the recorder steps what it records — the quantized intent, not the raw one — and stops recording after finish', () => {
  const rec = createRecorder({ weapon: 'longsword', build: 'x', opponent: 'veteran', profile: 'normal', seed: 1 });
  const stepped = rec.push(intent({ move: { x: 0.123456, z: 0, yaw: 1.2345, run: false } }));
  assert.equal(stepped.move.x, Math.round(0.123456 * 127) / 127, 'the returned intent is the quantized one');
  assert.deepEqual(rec.finish('abandoned').intents[0], stepped);
  rec.push(intent({ action: 'light' }));
  assert.equal(rec.finished!.ticks, 1, 'nothing recorded after finish');
});

test('record: packing refuses a record whose tick count and intents disagree, or an unknown profile/outcome', () => {
  const rec = createRecorder({ weapon: 'longsword', build: 'x', opponent: 'veteran', profile: 'normal', seed: 1 });
  rec.push(intent()); const r = rec.finish('draw');
  assert.throws(() => packRecord({ ...r, ticks: 2 }), /ticks does not match/);
  assert.throws(() => packRecord({ ...r, profile: 'insane' as FightRecord['profile'] }), /unknown profile or outcome/);
  assert.throws(() => packRecord({ ...r, build: 'sha-é' }), /non-ASCII/);
});

test('record: an opponent-only weapon (the reaper) is refused at decode — the hero rig bakes no blade table for it and a replay would throw mid-frame', () => {
  const rec = createRecorder({ weapon: 'longsword', build: 'x', opponent: 'veteran', profile: 'normal', seed: 1 });
  const r = rec.finish('abandoned');
  assert.throws(() => unpackRecord(packRecord({ ...r, weapon: 'reaper' })), /unknown weapon/);
  assert.equal(unpackRecord(packRecord({ ...r, weapon: 'warhammer' })).weapon, 'warhammer', 'a player weapon still decodes');
  assert.equal(unpackRecord(packRecord({ ...r, weapon: 'maul' })).weapon, 'maul', 'the maul decodes since it took a hero blade table (2026-09-23)');
});

// GPT audit 2026-09-22 (E): a cap on the compressed text is not a cap on what it expands to; direct replay links reach this decoder.
import { MAX_RECORD_BYTES, MAX_RECORD_TICKS } from '../src/record.ts';
test('a record past the tick limit or the expanded-size limit is refused, not allocated', async () => {
  // A real 2-tick record with its tick count forged to MAX+1: refused before the intent array exists.
  const rec = createRecorder({ build: 'dev', opponent: 'goblin', weapon: 'longsword', profile: 'normal', seed: 7 });
  rec.push(intent()); rec.push(intent());
  const bytes = packRecord(rec.finish('killed')), dv = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const o = 3 + 1 + 3 + 1 + 6 + 1 + 9 + 1 + 1 + 4;   // magic+v, build 'dev', opponent 'goblin', weapon 'longsword', skill (v12), profile, seed → the tick count
  assert.equal(dv.getUint32(o, true), 2, 'found the tick count field');
  dv.setUint32(o, MAX_RECORD_TICKS + 1, true);
  assert.throws(() => unpackRecord(bytes), /past the 108000-tick limit/);
  // A gzip bomb: MAX_RECORD_BYTES + 1 zero bytes compress to a few KB and are refused while expanding.
  const zeros = new Uint8Array(MAX_RECORD_BYTES + 1);
  const cs = new CompressionStream('gzip'), w = cs.writable.getWriter(); void w.write(zeros).then(() => w.close());
  const parts: Uint8Array[] = []; const r = cs.readable.getReader(); for (;;) { const { value, done } = await r.read(); if (done) break; parts.push(value); }
  const packed = new Uint8Array(parts.reduce((n, p) => n + p.length, 0)); let at = 0; for (const p of parts) { packed.set(p, at); at += p.length; }
  assert.ok(packed.length < 5000, `the bomb is small on the wire (${packed.length} bytes)`);
  await assert.rejects(decodeRecord(toBase64Url(packed)), /expands past 1000000 bytes/);
});
