import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { FINISHER_POSE, FINISHER_SECONDS, ROTATION, finisherSeconds, selectFinisher, type FinisherId } from '../src/finishers.ts';
import type { Finish } from '../src/duel.ts';
import type { HitLocation } from '../src/blade.ts';
import type { MoveId, WeaponId } from '../src/moves.ts';

// Finishers & gore v1 (owner-authorized 2026-09-17; blade-kill rule owner-decided 2026-09-18 on PR #112 and broadened the
// same day after the owner's live playtest; two-finisher rotation owner-decided 2026-09-18, grown to four with Run Through
// and the plain death in the mix, owner 2026-09-18 ~23:30): selection is a pure function of the Killed event. These tests
// pin the rule; the mutation receipts are the discriminations (swap any null-row field and the pick changes).
const kill = (move: MoveId, location: HitLocation, victim: 0 | 1 = 1, draw = false): Finish => ({ victim, location, move, heading: 1.1, ...(draw ? { draw: true } : {}) });
const LONGSWORDS: readonly [WeaponId, WeaponId] = ['longsword', 'longsword'];
// Beta rotation (owner 2026-09-20): five outcomes; The Quiet One stays shipped (clip/pose/gore, picker) but is not auto-picked.
const SHIPPED = ['splitCrown', 'decapitation', 'runThrough', 'plainDeath', 'opened'] as const;
const shipped = (id: FinisherId | null): boolean => id !== null && (SHIPPED as readonly FinisherId[]).includes(id);

test('selection is the owner rule: ANY blade kill plays an outcome, whatever the move or location', () => {
  // owner 2026-09-18: every blade kill draws one of the five — Split Crown, Decapitation, Run Through, The Quiet One, or plain death —
  // picked by the kill event's seed. Light, thrust, riposte, heavy, critical, any location.
  for (const [move, location] of [['light_right', 'torso'], ['light_left', 'head'], ['thrust', 'torso'], ['riposte', 'legs'], ['heavy_overhead', 'torso'], ['heavy_overhead', 'head'], ['heavy_riposte', 'legs'], ['heavy_counter', 'head'], ['critical', 'torso'], ['critical', 'head'], ['light_right', 'legs']] as [MoveId, HitLocation][])
    assert.ok(shipped(selectFinisher(kill(move, location), LONGSWORDS)), `${move} @ ${location} draws a shipped outcome`);
});

test('the rotation is seeded from the kill event: same event, same outcome; the spread covers all five', () => {
  // pinned picks (the hash in selectFinisher — swap the seed and these change)
  assert.equal(selectFinisher(kill('heavy_overhead', 'torso'), LONGSWORDS), 'splitCrown');
  assert.equal(selectFinisher(kill('light_right', 'torso'), LONGSWORDS), 'decapitation');
  assert.equal(selectFinisher(kill('light_right', 'head'), LONGSWORDS), 'runThrough');
  assert.equal(selectFinisher(kill('thrust', 'head'), LONGSWORDS), 'decapitation');
  assert.equal(selectFinisher(kill('critical', 'legs'), LONGSWORDS) !== 'quietOne', true);   // never auto-picked in the beta rotation
  // every outcome is reachable across the kill-event space
  const picks = new Set<FinisherId>();
  for (const move of ['light_right', 'light_left', 'thrust', 'riposte', 'heavy_overhead', 'heavy_riposte', 'heavy_counter', 'critical'] as MoveId[])
    for (const location of ['head', 'torso', 'legs'] as HitLocation[])
      picks.add(selectFinisher(kill(move, location), LONGSWORDS)!);
  assert.deepEqual([...picks].sort(), [...SHIPPED].sort());
  // determinism: the same event twice is the same outcome
  const finish = kill('heavy_overhead', 'head');
  assert.equal(selectFinisher(finish, LONGSWORDS), selectFinisher({ ...finish }, LONGSWORDS));
});

test('no ceremony for a draw, the player\'s own death, or a killing kick', () => {
  assert.equal(selectFinisher(kill('heavy_overhead', 'head', 1, true), LONGSWORDS), null);
  assert.equal(selectFinisher(kill('light_right', 'torso', 0), LONGSWORDS), null);   // v2 review
  assert.equal(selectFinisher(kill('kick', 'torso'), LONGSWORDS), null);
  assert.equal(selectFinisher(kill('kick', 'legs'), LONGSWORDS), null);
  assert.equal(selectFinisher(kill('heavy_overhead', 'head', 0), LONGSWORDS), null);   // v2 review
});

test('selection is deterministic and reads only the event and the weapons', () => {
  const finish = kill('heavy_overhead', 'head');
  assert.equal(selectFinisher(finish, LONGSWORDS), selectFinisher({ ...finish }, LONGSWORDS));
  assert.ok(shipped(selectFinisher(kill('light_right', 'torso'), ['longsword', 'trident'])));   // v1: one table for every weapon
  assert.ok(shipped(selectFinisher(kill('thrust', 'legs'), LONGSWORDS)));   // the owner 2026-09-18 rule: blade kills are move- and location-independent
  assert.notEqual(selectFinisher(kill('heavy_overhead', 'torso'), LONGSWORDS), selectFinisher(kill('kick', 'torso'), LONGSWORDS));
  assert.notEqual(selectFinisher(kill('light_right', 'head'), LONGSWORDS), selectFinisher(kill('light_right', 'head', 0), LONGSWORDS));
});

test('Split Crown, Decapitation, Run Through Quiet One and Opened have shipped poses; unshipped outcomes play the plain Death', () => {
  const poses = Object.entries(FINISHER_POSE) as [FinisherId, 'splitCrown' | 'decapitation' | 'runThrough' | 'quietOne' | 'opened' | null][];
  assert.deepEqual(poses.map(([id]) => id), ['splitCrown', 'decapitation', 'runThrough', 'plainDeath', 'quietOne', 'opened', 'hamstrung', 'execution']);
  assert.equal(FINISHER_POSE.splitCrown, 'splitCrown');
  assert.equal(FINISHER_POSE.decapitation, 'decapitation');   // reuses the Split Crown body collapse; the severed head is the gore layer
  assert.equal(FINISHER_POSE.runThrough, 'runThrough');       // impaled on the blade, held beat gripping it, kneels with it still embedded
  assert.equal(FINISHER_POSE.quietOne, 'quietOne');
  assert.equal(FINISHER_POSE.opened, 'opened');
  assert.equal(FINISHER_POSE.plainDeath, null);               // the default fall, in the rotation by the owner's call — null = the plain Death clip
  for (const [id, pose] of poses) if (!['splitCrown', 'decapitation', 'runThrough', 'quietOne', 'opened'].includes(id)) assert.equal(pose, null, `${id} plays the plain Death`);
});

test('owner 2026-09-20: the same ceremony never plays twice in a row, the pool stays even, and the pick is still deterministic', () => {
  const moves = ['light_right', 'light_left', 'thrust', 'riposte', 'heavy_overhead', 'heavy_riposte', 'heavy_counter', 'critical'] as MoveId[];
  const locations = ['head', 'torso', 'legs'] as HitLocation[];
  let seed = 12345;
  const rnd = () => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x7fffffff; };
  const count = new Map<FinisherId, number>();
  let previous: FinisherId | null = null;
  for (let i = 0; i < 20000; i++) {
    const finish: Finish = { victim: 1, location: locations[i % 3], move: moves[(i >> 2) % 8], heading: (rnd() * 2 - 1) * Math.PI };
    const pick: FinisherId = selectFinisher(finish, LONGSWORDS, previous)!;
    assert.ok(ROTATION.includes(pick as (typeof ROTATION)[number]), 'a rotation outcome');
    assert.notEqual(pick, previous, `never the previous fight's ceremony (${previous}) again`);
    assert.equal(pick, selectFinisher({ ...finish }, LONGSWORDS, previous), 'same kill, same history, same outcome');
    count.set(pick, (count.get(pick) ?? 0) + 1);
    previous = pick;
  }
  for (const id of ROTATION) {
    const share = (count.get(id) ?? 0) / 20000;
    assert.ok(share > .16 && share < .24, `${id} draws an even share (${(share * 100).toFixed(1)} %)`);
  }
  // a first fight (no history) still draws every outcome, and never quietOne
  assert.equal(selectFinisher(kill('light_right', 'torso'), LONGSWORDS, null), 'decapitation');
  assert.ok(selectFinisher(kill('critical', 'legs'), LONGSWORDS, 'splitCrown') !== 'quietOne');
});

// The measured per-finisher durations (Lead brief 2026-09-22, for Web's loot panel). The game keys on the event
// (view.finishPhase().complete in src/scene.ts); this table is the published figure Web budgets a layout against, measured by
// `node scripts/finisher-preview.mjs --durations`. What is asserted here is the shape and the honesty of the table, not the
// numbers themselves — those are whatever the harness measured, and the harness is the thing that re-checks them.
test('finisher durations are per finisher, measured, and every shipped outcome has one', () => {
  for (const id of ROTATION) assert.equal(typeof FINISHER_SECONDS[id as keyof typeof FINISHER_SECONDS], 'number', `${id} has a measured duration`);
  assert.equal(typeof FINISHER_SECONDS.quietOne, 'number', 'The Quiet One is out of the rotation but still shipped, and still measured');
  // Not one constant for all of them (the whole point of the brief): the rotation's outcomes do not share a single number.
  assert.ok(new Set(ROTATION.map((id) => FINISHER_SECONDS[id as keyof typeof FINISHER_SECONDS])).size > 1, 'the rotation does not run on one constant');
  // The plain death is the shortest: it plays at full speed while a posed finisher runs on the 0.75x presentation clock.
  for (const [id, seconds] of Object.entries(FINISHER_SECONDS)) if (id !== 'plainDeath') assert.ok(seconds > FINISHER_SECONDS.plainDeath, `${id} outlasts the plain death (${seconds} vs ${FINISHER_SECONDS.plainDeath} s)`);
  // Every one of them is past the camera's settle floor (camera.ts SETTLE.min 1.5 s) and inside a sane ceiling.
  for (const [id, seconds] of Object.entries(FINISHER_SECONDS)) assert.ok(seconds >= 1.5 && seconds <= 12, `${id} sits in the plausible range (${seconds} s)`);
  // A finisher with no clip of its own plays the plain death, so its figure is DERIVED and says so rather than posing as measured.
  for (const id of ['splitCrown', 'decapitation', 'runThrough', 'plainDeath', 'quietOne', 'opened'] as FinisherId[]) assert.deepEqual(finisherSeconds(id).measured, true, `${id} is measured`);
  for (const id of ['hamstrung', 'execution'] as FinisherId[]) {
    assert.equal(FINISHER_POSE[id], null, `${id} has no clip of its own yet`);
    assert.deepEqual(finisherSeconds(id), { seconds: FINISHER_SECONDS.plainDeath, measured: false }, `${id} derives the plain death's figure and is labelled derived`);
  }
});

// The blood gate was one release row over all six outcomes (521 s of a 570 s release wall, Lead 2026-09-25); it is split into
// rows with disjoint --only sets so they run side by side. Nothing may drop out in the split: every measured finisher is in
// exactly one blood row, and every blood row carries the same assertions (--blood-check, --durations) at the default opponent.
test('the blood-gate rows together cover every measured finisher exactly once, with the same checks', () => {
  const gate = JSON.parse(readFileSync(new URL('../.quality-gate.json', import.meta.url), 'utf8')) as { release_commands: string[][] };
  const rows = gate.release_commands.filter((c) => c.includes('scripts/finisher-preview.mjs') && c.includes('--blood-check'));
  assert.ok(rows.length >= 2, 'the blood gate runs as parallel rows');
  const covered = rows.flatMap((c) => c[c.indexOf('--only') + 1].split(','));
  assert.deepEqual([...covered].sort(), Object.keys(FINISHER_SECONDS).sort(), 'each measured finisher is in exactly one blood row');
  for (const c of rows) {
    assert.ok(c.includes('--durations') && c.includes('--no-video'), `${c.join(' ')} keeps --durations and --no-video`);
    assert.ok(!c.includes('--opponent') && !c.includes('--seed'), `${c.join(' ')} stays on the default opponent and seed`);
  }
  assert.equal(new Set(rows.map((c) => c[c.indexOf('--label') + 1])).size, rows.length, 'each row writes its own artifacts');
});
