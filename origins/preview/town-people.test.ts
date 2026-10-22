import assert from 'node:assert/strict';
import test from 'node:test';
import { PLAN_ROWS, loadPlanRows } from '../zones/plan.ts';
import { exchangePlan } from './exchange-plan.ts';
import { bodyUrlOf, standers, within } from './town-people.ts';

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

test('a people row with a body but no pose, facing or range is refused', () => {
  const rows = { ...PLAN_ROWS, people: [{ ...PLAN_ROWS.people[0]!, pose: undefined, face: undefined, near: undefined }] };
  assert.throws(() => loadPlanRows(rows as never), /pose, its facing and a near range/);
});
