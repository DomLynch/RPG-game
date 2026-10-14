// The duel's RULES are rows (src/fight/rules-defs.json, built by src/fight/rules.ts; recce #2554 group B, slice 1). The move is byte-identical: the canonical JSON of the object,
// key order included, hashes to what the hand-written literal in moves.ts hashed to on trunk 63d909374 before it went (the receipt), and no object literal named RULES is kept in code.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readdirSync, readFileSync } from 'node:fs';
import test from 'node:test';
import { RULES } from '../src/fight/moves.ts';
import { checkRuleRow, nestRules } from '../src/fight/rules.ts';

test('RULES built from rows equals the old literal key for key, value for value and in the same key order', () => {
  assert.equal(createHash('sha256').update(JSON.stringify(RULES)).digest('hex'), '746433a85b2171fdd3da5e3a894a5ff790090691f9dcbb2dc24fe874074daec6');
  assert.equal(Object.keys(RULES).length, 50);
  assert.deepEqual([RULES.guardArc, RULES.kickArc, RULES.rear.arc], [Math.PI / 3, Math.PI / 4, Math.PI / 2], 'an arc row is Math.PI / piDiv exactly');
  assert.equal(RULES.regen, 2 / 3);
  assert.equal(RULES.directionalGuard, true);
});

test('a rule row carries exactly one value; the nest builds the dotted path', () => {
  assert.throws(() => checkRuleRow({ id: 'x' }), /exactly one/);
  assert.throws(() => checkRuleRow({ id: 'x', n: 1, b: true }), /exactly one/);
  assert.throws(() => checkRuleRow({ id: 'x', piDiv: 0 }), /piDiv/);
  assert.deepEqual(nestRules([{ id: 'a.b', n: 2 }, { id: 'a.c', b: false }, { id: 'd', piDiv: 2 }]), { a: { b: 2, c: false }, d: Math.PI / 2 });
});

test('no rules table is kept in code: the sim reads rows (a RULES literal in src/fight would be a hand list again)', () => {
  for (const f of readdirSync(new URL('../src/fight/', import.meta.url)).filter((x) => x.endsWith('.ts')))
    assert.doesNotMatch(readFileSync(new URL(`../src/fight/${f}`, import.meta.url), 'utf8'), /(?:const|let) RULES\s*(?::[^=]+)?=\s*\{/, `${f} declares a RULES object literal`);
});
