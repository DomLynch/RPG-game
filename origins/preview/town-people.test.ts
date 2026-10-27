import assert from 'node:assert/strict';
import test from 'node:test';
import { PLAN_ROWS, loadPlanRows } from '../zones/plan.ts';
import { exchangePlan } from './exchange-plan.ts';
import { bodyUrlOf, reachOf, standers, within } from './town-people.ts';
import { glbStats } from '../../scripts/lib/glb-stats.mjs';

test('every exchange person row names a body that has a world file, a pose, a facing and a range (rows only)', () => {
  const people = exchangePlan().people;
  assert.equal(people.length, 14);
  for (const f of people) {
    assert.ok(f.npc, `${f.color}: a person row carries its body`);
    assert.ok(bodyUrlOf(f.npc!.body), `${f.npc!.id}: ${f.npc!.body} has a world body file`);
    assert.ok(f.npc!.pose.length > 0 && f.npc!.near > 0 && Number.isFinite(f.npc!.face), `${f.npc!.id}: pose, facing and range`);
  }
});

test('the town people are different characters where the cast allows, and each row names the role it will run (no shop data yet)', () => {
  const rows = PLAN_ROWS.people.filter((r) => r.zone === 'exchange');
  assert.ok(new Set(rows.map((r) => r.body)).size >= 9, 'nine different characters among fourteen people');
  assert.ok(rows.every((r) => !!r.role));
  assert.equal(new Set(rows.map((r) => r.role)).size, rows.length, 'one role each');
});

test('standers skips a row whose body has no file (it keeps its capsule); within() is the row\'s own range', () => {
  const people = exchangePlan().people;
  assert.equal(standers(people).length, 14);
  assert.equal(standers(people, () => undefined).length, 0);
  const one = standers(people)[0]!;
  assert.ok(within(one, one.x, one.z) && within(one, one.x + one.near - 0.01, one.z) && !within(one, one.x + one.near + 0.01, one.z));
});

test('the far band is the row\'s own: full inside `full`, the far body out to `near`, none beyond; a row with no far body draws the full one to `near`', () => {
  const people = exchangePlan().people;
  const s = standers(people)[0]!;
  assert.ok(s.far && s.full !== undefined && s.full > 0 && s.full < s.near, 'the exchange people carry a far body and a band inside their near range');
  assert.deepEqual(reachOf(s, s.x + s.full! - 0.01, s.z), { inFull: true, inNear: true });
  assert.deepEqual(reachOf(s, s.x + s.full! + 0.01, s.z), { inFull: false, inNear: true });
  assert.deepEqual(reachOf(s, s.x + s.near - 0.01, s.z), { inFull: false, inNear: true });
  assert.deepEqual(reachOf(s, s.x + s.near + 0.01, s.z), { inFull: false, inNear: false });
  const plain = { x: 0, z: 0, near: 22 };
  assert.deepEqual(reachOf(plain, 21, 0), { inFull: true, inNear: true }); assert.deepEqual(reachOf(plain, 23, 0), { inFull: false, inNear: false });
});

test('every far body a person row names is a file the phone budget holds, a lighter body than its full one, with the same pose clip', () => {
  const rows = PLAN_ROWS.people.filter((r) => r.zone === 'exchange' && r.far);
  assert.equal(rows.length, 14);
  for (const r of rows) {
    const far = glbStats(`public${r.far}`), full = glbStats(`public${bodyUrlOf(r.body!)}`);
    assert.ok(far.tris < full.tris / 3, `${r.id}: the far body (${far.tris}) is under a third of the full one (${full.tris})`);
    assert.equal(far.joints, full.joints, `${r.id}: the same rig`);
    assert.ok(far.clips.includes(r.pose!), `${r.id}: the far body carries the pose clip ${r.pose}`);
  }
});

test('a far body needs a body and a full range inside its near range', () => {
  const row = PLAN_ROWS.people[0]!;
  assert.throws(() => loadPlanRows({ ...PLAN_ROWS, people: [{ ...row, full: undefined }] } as never), /far body needs/);
  assert.throws(() => loadPlanRows({ ...PLAN_ROWS, people: [{ ...row, full: row.near! + 1 }] } as never), /far body needs/);
});

test('a people row with a body but no pose, facing or range is refused', () => {
  const rows = { ...PLAN_ROWS, people: [{ ...PLAN_ROWS.people[0]!, pose: undefined, face: undefined, near: undefined }] };
  assert.throws(() => loadPlanRows(rows as never), /pose, its facing and a near range/);
});
