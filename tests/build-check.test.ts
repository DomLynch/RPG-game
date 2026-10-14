import assert from 'node:assert/strict';
import { test } from 'node:test';
import { expectedSheet, NO_BUILD } from '../src/fight/build-check.ts';
import { sheetOf, type Build } from '../src/fight/sheet-rows.ts';
import { sheetRefusal } from '../src/fight/replay.ts';

const stored: Record<string, Build> = { 'pc:one@1': { level: 10, placed: { attack: 10 } }, 'pc:one@2': { level: 10, placed: { armour: 10 } } };
const load = async (c: string, v: number) => stored[`${c}@${v}`] ?? null;

test('no sheet needs nothing; a reference is loaded at that exact version and resolves through sheetOf', async () => {
  assert.deepEqual(await expectedSheet({}, load), { ok: true, sheet: undefined });
  const one = sheetOf(stored['pc:one@1']!)!, two = sheetOf(stored['pc:one@2']!)!;
  assert.deepEqual(await expectedSheet({ sheet: one, characterId: 'one', buildVersion: 1 }, load), { ok: true, sheet: one });
  assert.deepEqual(await expectedSheet({ sheet: one, characterId: 'one', buildVersion: 2 }, load), { ok: true, sheet: two }, 'version 2 is a different build: the caller then compares and refuses the record');
});

test('a missing character or an unknown version is refused, never defaulted', async () => {
  const one = sheetOf(stored['pc:one@1']!)!;
  for (const ref of [{ characterId: 'one', buildVersion: 9 }, { characterId: 'other', buildVersion: 1 }]) {
    assert.deepEqual(await expectedSheet({ sheet: one, ...ref }, load), { ok: false, reason: NO_BUILD });
  }
});

test('a sheet with no reference claims the default build: any placed point is a forgery', async () => {
  assert.equal((await expectedSheet({ sheet: { attack: 60 } }, load)).ok, false, 'the default build and no gear give no sheet');
  assert.equal((await expectedSheet({ sheet: { attack: 60 }, characterId: 'one', buildVersion: 1 }, async () => ({ level: 1, placed: { attack: 50 } }))).ok, false, 'an illegal stored build is refused, not thrown');
});

test('a forged record: a sheet of 100 attack against a stored build that placed 10 is refused by verifyRecord', async () => {
  const one = sheetOf(stored['pc:one@1']!)!, forged = { ...one, attack: 100 };
  const got = await expectedSheet({ sheet: forged, characterId: 'one', buildVersion: 1 }, load);
  assert.ok(got.ok && got.sheet);
  assert.match(String(sheetRefusal({ sheet: forged }, got.ok ? got.sheet : undefined)), /not the one the player's stored build/);
  assert.equal(sheetRefusal({ sheet: one }, got.ok ? got.sheet : undefined), null, 'the honest sheet passes');
});
