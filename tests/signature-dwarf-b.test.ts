import { test } from 'node:test';
import assert from 'node:assert/strict';
import { SHIPPED, SIGNATURES, pickSignature } from '../src/signature.ts';
import { STAMP, STAMP_B, STAMP_C } from '../src/signature-dwarf.ts';

test('the Dwarf has A and B; on still picks A, B picks the bruise at about twice the size', () => {
  assert.equal(pickSignature(SIGNATURES.dwarf, 'on')?.name, 'Hammer Stamp');
  assert.equal(pickSignature(SIGNATURES.dwarf, 'B')?.name, 'Hammer Stamp (bruise)');
  assert.equal(STAMP_B.size / STAMP.size, 2);
});

test('C is the wound: larger than B, rising over a beat, on still picks A', () => {
  assert.equal(pickSignature(SIGNATURES.dwarf, 'C')?.name, 'Hammer Wound');
  assert.ok(STAMP_C.size > STAMP_B.size);
  assert.ok(STAMP_C.fadeIn > STAMP.fadeIn);
  assert.equal(pickSignature(SIGNATURES.dwarf, 'on')?.name, 'Hammer Stamp');
});

test('the shipped Dwarf is the wound, and it is blood: it stands down while the player has blood off', () => {
  assert.equal(SHIPPED.dwarf?.variant, 'C');
  assert.equal(pickSignature(SIGNATURES.dwarf, 'C')?.blood, true);
  assert.equal(pickSignature(SIGNATURES.dwarf, 'A')?.blood, undefined, 'the stamps are not blood');
});
