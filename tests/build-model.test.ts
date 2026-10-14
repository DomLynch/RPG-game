import assert from 'node:assert/strict';
import test from 'node:test';
import ROW_NAMES from '../src/core/row-names.json' with { type: 'json' };
import { FREE_RESPREAD_LEVEL, ROWS, canPlace, canTakeBack, needsPoint, place, placedOn, resetAll, spent, takeBack, unspent } from '../src/core/build-model.ts';
import { viewOf, type BuildView } from '../src/core/build-net.ts';
import { DIALS, SHEET_SKILLS, pointsAt } from '../src/fight/sheet-rows.ts';

const at = (level: number, placed: Record<string, number> = {}, respreadRank = 0): BuildView => ({ level, placed, respreadRank, version: 1 });
const dial = DIALS[0]!.id, other = DIALS[1]!.id, skill = SHEET_SKILLS[0]!.id;

test('every dial and every skill row is a row to place on, from the rows and nowhere else', () => {
  assert.equal(ROWS.length, DIALS.length + SHEET_SKILLS.length);
  assert.ok(ROWS.every((r) => r.name.length > 0 && r.room > 0));
});

test('a level carries its points: a point can be placed on a dial or a skill until the budget is spent, then not', () => {
  let v = at(2);
  assert.equal(unspent(v), pointsAt(2)); assert.equal(needsPoint(v), true);
  v = place(v, dial); v = place(v, skill);
  assert.equal(placedOn(v, dial), 1); assert.equal(placedOn(v, skill), 1); assert.equal(spent(v), 2);
  assert.equal(unspent(v), pointsAt(2) - 2); assert.equal(canPlace(v, other), pointsAt(2) > 2);
  assert.equal(needsPoint(at(0)), false, 'level 0 has nothing to place');
});

test('a row stops at its own room and an unknown row is never placed', () => {
  const room = ROWS.find((r) => r.id === dial)!.room, v = at(50, { [dial]: room });
  assert.equal(canPlace(v, dial), false); assert.equal(place(v, dial), v);
  assert.equal(canPlace(at(5), 'nope'), false);
});

test('taking back is free to level 10, then once per rank, and the rank is the server\'s respreadRank', () => {
  assert.equal(canTakeBack(at(FREE_RESPREAD_LEVEL, { [dial]: 1 })), true);
  assert.equal(canTakeBack(at(11, { [dial]: 1 }, 0)), true, 'rank 1 is unspent');
  assert.equal(canTakeBack(at(11, { [dial]: 1 }, 1)), false, 'rank 1 already used');
  assert.equal(canTakeBack(at(20, { [dial]: 1 }, 1)), true, 'rank 2 comes at level 20');
  const v = at(5, { [dial]: 2, [skill]: 1 });
  assert.equal(placedOn(takeBack(v, dial), dial), 1); assert.deepEqual(resetAll(v).placed, {});
  const spentRank = at(15, { [dial]: 2 }, 1);
  assert.equal(takeBack(spentRank, dial), spentRank); assert.equal(resetAll(spentRank), spentRank);
  assert.equal(takeBack(at(5), dial).placed[dial], undefined, 'nothing placed, nothing to take');
});

test('the writer\'s reply is read strictly: a whole-number level, version, respreadRank and placed map, zeros dropped', () => {
  assert.deepEqual(viewOf({ level: 3, placed: { [dial]: 2, [other]: 0 }, respreadRank: 0, version: 4 }), { level: 3, placed: { [dial]: 2 }, respreadRank: 0, version: 4 });
  for (const bad of [null, {}, { level: 1.5, placed: {}, respreadRank: 0, version: 1 }, { level: 1, placed: [], respreadRank: 0, version: 1 }, { level: 1, placed: { a: -1 }, respreadRank: 0, version: 1 }, { level: 1, placed: {}, respreadRank: 0 }]) assert.equal(viewOf(bad), null, JSON.stringify(bad));
});

test('every dial and skill row has a display name in row-names.json, and the file names no row that does not exist', () => {
  const ids = ROWS.map((r) => r.id);
  assert.ok(ROWS.every((r) => r.name !== r.id), `a row shows its id: ${ROWS.filter((r) => r.name === r.id).map((r) => r.id)}`);
  assert.equal(new Set(ROW_NAMES.rows.map((r) => r.id)).size, ids.length, 'one name per row, none extra');
});
