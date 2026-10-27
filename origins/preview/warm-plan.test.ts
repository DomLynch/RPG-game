import assert from 'node:assert/strict';
import test from 'node:test';
import { PLAYER, keepVerdict, medianGap, probeReadout, readReleaseId, slowVerdict, slowVerdictRecord, tooSlow, warmDone, warmKitsWithin, warmList, noMobZone, emptyWarmState } from './warm-plan.ts';
import { previewRule } from './preview-rules.ts';

test('the slow-device verdict is keyed to the release: same release kept, new release re-measured, unreadable release uses the time limit, malformed record re-measured', async () => {
  const ttl = previewRule('slowVerdictMs'), now = 1_800_000_000_000, A = 'a'.repeat(40), B = 'b'.repeat(40);
  assert.equal(previewRule('slowVerdictByRelease'), 1);
  assert.equal(slowVerdictRecord(true, now, A), `1@${A}`);
  assert.equal(slowVerdict(slowVerdictRecord(true, now, A), now + 10 * ttl, ttl, A), true, 'same release: kept however old (the release, not the clock, is the key)');
  assert.equal(slowVerdict(slowVerdictRecord(false, now, A), now, ttl, A), false);
  assert.equal(slowVerdict(slowVerdictRecord(true, now, A), now, ttl, B), undefined, 'a new release: measure again');
  assert.equal(slowVerdict(slowVerdictRecord(true, now - 1000), now, ttl, A), undefined, 'an old time record under a readable release: measure again');
  assert.equal(slowVerdict(slowVerdictRecord(true, now - 1000), now, ttl), true, 'release unreadable: a fresh time record is kept');
  assert.equal(slowVerdict(slowVerdictRecord(true, now - ttl), now, ttl), undefined, 'release unreadable: past the time limit, measure');
  assert.equal(slowVerdict(slowVerdictRecord(true, now, A), now, ttl), undefined, 'release unreadable and the record has no age: measure');
  for (const bad of [`1@${'g'.repeat(40)}`, `1@${'a'.repeat(39)}`, `3@${A}`, `1@${A}x`]) assert.equal(slowVerdict(bad, now, ttl, A), undefined, `${bad} is no record`);
  const rev = (r: unknown) => readReleaseId(async () => r, 50);
  assert.equal(await rev({ revision: A }), A);
  for (const bad of [null, {}, { revision: 'abc' }, { revision: 5 }]) assert.equal(await rev(bad), undefined, 'a body without a 40-hex revision is unreadable');
  assert.equal(await readReleaseId(async () => { throw new Error('offline'); }, 50), undefined, 'a failed read is unreadable');
  assert.equal(await readReleaseId(() => new Promise(() => {}), 20), undefined, 'a read that never answers is cut at the bound');
});

test('the slow-device verdict is sticky for the device: a fresh record is used as stored, a stale, future or malformed one is re-measured', () => {
  const ttl = previewRule('slowVerdictMs'), now = 1_800_000_000_000;
  assert.ok(ttl > 0);
  assert.equal(slowVerdict(slowVerdictRecord(true, now - 1000), now, ttl), true, 'a fresh slow verdict stays slow');
  assert.equal(slowVerdict(slowVerdictRecord(false, now - 1000), now, ttl), false, 'a fresh fast verdict stays fast');
  assert.equal(slowVerdict(slowVerdictRecord(true, now - ttl), now, ttl), undefined, 'past its ttl: measure again');
  assert.equal(slowVerdict(slowVerdictRecord(true, now - ttl + 1), now, ttl), true, 'one ms inside the ttl: kept');
  assert.equal(slowVerdict(slowVerdictRecord(true, now + 5000), now, ttl), undefined, 'a clock that went back: not trusted');
  for (const bad of [null, undefined, '', 'true', '1', '2@5', '1@x', '1@-4']) assert.equal(slowVerdict(bad, now, ttl), undefined, `${String(bad)} is no record`);
  assert.equal(slowVerdictRecord(true, 12.4), '1@12', 'the record is whole ms');
});

test('the player\'s actor is in every zone\'s warm-up list, first, whatever the creature kinds', () => {
  for (const kinds of [[], ['goblin', 'wolf'], ['goblin', 'boar', 'knight', 'pitborn', 'bear', 'witch', 'wolf'], ['player']]) {
    const list = warmList(kinds); assert.equal(list[0], PLAYER); assert.equal(list.filter((k) => k === PLAYER).length, 1); assert.deepEqual(list.slice(1), kinds.filter((k) => k !== PLAYER));
  }
});
test('a zone is ready only when the player and every kind are warmed or failed', () => {
  const list = warmList(['goblin', 'wolf']);
  assert.equal(warmDone(list, ['goblin', 'wolf'], []), false, 'creatures warmed but the player is not');
  assert.equal(warmDone(list, ['player', 'goblin'], []), false);
  assert.equal(warmDone(list, ['player', 'goblin', 'wolf'], []), true);
  assert.equal(warmDone(list, ['goblin', 'wolf'], ['player']), true, 'a player actor that failed to load does not hold the zone');
});

test('a zone row with no spawns is ready on the hero alone', () => {
  assert.equal(noMobZone(0), true); assert.equal(noMobZone(3), false);
  const list = warmList(emptyWarmState().kinds);
  assert.equal(warmDone(list, [], []), false, 'the hero still gates a creatureless zone');
  assert.equal(warmDone(list, [PLAYER], []), true);
  assert.equal(warmDone(list, [], [PLAYER]), true);
});

// The kit warm-up is bounded: at the cap it stops before its next kit, reports failed, and compiles nothing further (the Auditor on #2938).
const timeoutSettle = async (_label: string, work: Promise<unknown>, boundMs: number) => Promise.race([work.then(() => true, () => true), new Promise<false>((r) => setTimeout(() => r(false), boundMs))]);
const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

test('a kit warm-up that hits its cap stops before the next kit, waits for the ONE kit in flight, reports failed, and compiles nothing after it returns', async () => {
  const compiled: number[] = []; let running = 0, cleaned = 0;
  const result = await warmKitsWithin([1, 2, 3, 4, 5, 6], async (k) => { running++; await sleep(40); compiled.push(k); running--; }, 70, timeoutSettle, () => { cleaned++; }, 500);
  assert.equal(result.failed, true);
  assert.equal(running, 0, 'the kit that was compiling at the cap has finished by the time the warm-up returns (zone ready waits for exactly that one)');
  assert.equal(cleaned, 1, 'cleanup ran when the loop really ended, before the return');
  const atReturn = compiled.length;
  assert.ok(atReturn >= 1 && atReturn < 6, `some kits ran before the cap, not all (${atReturn})`);
  await sleep(200);   // the loop would have finished all six by now
  assert.equal(compiled.length, atReturn, 'nothing compiles after the warm-up has returned');
});

test('a kit that never settles cannot hold the zone past the hard bound', async () => {
  const t0 = Date.now();
  const result = await warmKitsWithin([1, 2], () => new Promise<void>(() => {}), 30, timeoutSettle, () => {}, 80);
  assert.equal(result.failed, true); assert.ok(Date.now() - t0 < 400, 'returned at about cap + hard bound');
});

test('a kit that outlasts the hard bound is still compiling when the warm-up returns: `ended` resolves only when the loop has truly ended, and nothing compiles after it', async () => {
  const compiled: number[] = []; let cleaned = 0;
  const result = await warmKitsWithin([1, 2, 3], async (k) => { await sleep(150); compiled.push(k); }, 30, timeoutSettle, () => { cleaned++; }, 60);
  assert.equal(result.failed, true); assert.equal(compiled.length, 0, 'the first kit is still compiling when the hard bound returns'); assert.equal(cleaned, 0, 'and the loop has not ended');
  await result.ended;
  assert.equal(compiled.length, 1, 'ended waited for that one kit'); assert.equal(cleaned, 1, 'cleanup ran once, at the end');
  await sleep(300);
  assert.equal(compiled.length, 1, 'nothing compiles after `ended`');
});

test('medianGap and the ?probe=1 readout: the median is the one tooSlow compares, the readout names it, the limit, the verdict and the release', () => {
  assert.equal(medianGap([16, 17, 16, 33, 16]), 16);
  assert.equal(medianGap([250, 300, 280]), 280);
  assert.equal(medianGap([]), undefined);
  assert.equal(tooSlow([167, 167, 167], previewRule('kitSlowFrameMs')), true, 'the quiet-Mac reading that prompted the window move');
  assert.equal(previewRule('kitProbeSettleMs'), 1000, 'the settle after the cover lifts is a row');
  assert.equal(probeReadout(167.4, 100, 'a'.repeat(40)), 'probe 167 ms median (limit 100 ms): slow | release aaaaaaaaa');
  assert.equal(probeReadout(16, 100, undefined), 'probe 16 ms median (limit 100 ms): ok | release unread');
  assert.equal(probeReadout(undefined, 100, undefined), 'probe no sample (limit 100 ms): ok | release unread');
});

test('tooSlow: the median frame gap above the limit is slow; one spike in a smooth run is not; an empty sample is not', () => {
  assert.equal(tooSlow([16, 17, 16, 33, 16], 100), false, 'a phone');
  assert.equal(tooSlow([16, 16, 400, 16, 16], 100), false, 'one hitch in a smooth run');
  assert.equal(tooSlow([250, 300, 280, 260, 310], 100), true, 'a software-GL runner');
  assert.equal(tooSlow([101, 101, 101], 100), true, 'just over');
  assert.equal(tooSlow([100, 100, 100], 100), false, 'at the limit');
  assert.equal(tooSlow([], 100), false);
});

test('a warm-up inside its cap warms every kit and is not failed; a kit that throws fails it and stops', async () => {
  const ok: number[] = [];
  const clean = await warmKitsWithin([1, 2, 3], async (k) => { ok.push(k); }, 1000, timeoutSettle);
  assert.deepEqual({ failed: clean.failed, warmed: clean.warmed }, { failed: false, warmed: 3 });
  const seen: number[] = [];
  const bad = await warmKitsWithin([1, 2, 3], async (k) => { seen.push(k); if (k === 2) throw new Error('compile failed'); }, 1000, timeoutSettle);
  assert.equal(bad.failed, true); assert.deepEqual(seen, [1, 2]);
});

test('a slow verdict is stored only when the page stayed visible through the whole probe (a hidden tab measures slow and would stick for the ttl)', () => {
  assert.equal(keepVerdict(true, true, false), true, 'visible throughout: keep');
  assert.equal(keepVerdict(false, true, false), false, 'hidden at the start: not kept');
  assert.equal(keepVerdict(true, false, false), false, 'hidden at the end: not kept');
  assert.equal(keepVerdict(true, true, true), false, 'hidden and shown again during the probe: not kept');
});
