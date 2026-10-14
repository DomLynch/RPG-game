import test from 'node:test';
import assert from 'node:assert/strict';
import { createLateOpen } from './late-open.ts';

test('a saved career that arrives during a fight is held and adopted when the fight ends, once', () => {
  const adopted: string[] = []; let fighting = true;
  const late = createLateOpen<string>((o) => adopted.push(o), () => fighting);
  late.arrive('level 50');
  assert.deepEqual(adopted, [], 'not re-based mid-fight');
  assert.equal(late.held(), true);
  late.settle();
  assert.deepEqual(adopted, [], 'still fighting: still held');
  fighting = false;
  late.settle();
  assert.deepEqual(adopted, ['level 50']);
  late.settle();
  assert.deepEqual(adopted, ['level 50'], 'adopted once');
  assert.equal(late.held(), false);
});

test('arriving with no fight on adopts at once; a newer arrival mid-fight replaces an older held one', () => {
  const adopted: string[] = []; let fighting = false;
  const late = createLateOpen<string>((o) => adopted.push(o), () => fighting);
  late.arrive('first');
  assert.deepEqual(adopted, ['first']);
  fighting = true;
  late.arrive('second'); late.arrive('third');
  fighting = false; late.settle();
  assert.deepEqual(adopted, ['first', 'third']);
});
