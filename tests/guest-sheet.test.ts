// A guest wields what they pick up this session (SCOPE 2026-10-16: guest loot works for the session): fightSheet takes any view with ready() and profileFor(real), so Web's in-memory guest
// GearView is the `server` argument and the worn deltas come from IT, exactly as for a signed-in player. Nothing in this path writes: the view is a plain object, the sheet a pure value.
import test from 'node:test';
import assert from 'node:assert/strict';
import { fightSheet, gearNumbers, sheetFor } from '../src/fight/gear-numbers.ts';
import { wornGear } from '../src/fight/gear-stats.ts';
import { sheetOf } from '../src/fight/sheet-rows.ts';
import { TIERS } from '../src/core/grades.ts';
import type { Loot, LootId } from '../src/core/loot.ts';

const own = { level: 0, placed: {} }, bare: Loot = { owned: [], equipped: {} };
const rung = (l: Loot) => (id: LootId) => { const t = l.taken?.[id]?.tier; return t ? TIERS[t - 1] : undefined; };
const guestView = (loot: Loot, ready = true) => ({ ready: () => ready, profileFor: (real: { loot?: Loot }) => ({ ...real, loot }) });   // the shape Web's guest view provides

test('guest view: fightSheet reads the worn set from it, on the base build, and not before it answers', () => {
  const profile = { loot: bare };   // the device ledger knows nothing of what the guest picked up
  const worn: Loot = { owned: ['veteran.Helmet', 'veteran.Body'], equipped: { head: 'veteran.Helmet', chest: 'veteran.Body' }, taken: { 'veteran.Helmet': { tier: 3 }, 'veteran.Body': { tier: 3 } } } as Loot;
  assert.equal(fightSheet(profile, own, guestView(worn, false)), undefined, 'not ready: no sheet (a bare fight)');
  assert.equal(fightSheet(profile, own, undefined), undefined, 'no view at all: a guest fights bare, as before');
  const sheet = fightSheet(profile, own, guestView(worn))!;
  assert.ok(sheet, 'a guest view with worn pieces gives a sheet');
  assert.deepEqual(sheet, sheetOf(own, wornGear(worn.equipped, rung(worn))), 'the sheet is the guest view\'s worn set on the base build');
  assert.ok(sheet.armour! > (sheetFor(bare, own)?.armour ?? 0), 'plate raises armour over a bare fight');
  assert.ok(gearNumbers(worn).res !== gearNumbers(bare).res || gearNumbers(worn).attack !== gearNumbers(bare).attack, 'the strip numbers move with the same loot');
});

test('guest view: a piece with no recorded rung counts as no gear (the view must write loot.taken[id].tier on pickup)', () => {
  const norung: Loot = { owned: ['veteran.Helmet'], equipped: { head: 'veteran.Helmet' } };
  assert.deepEqual(fightSheet({ loot: bare }, own, guestView(norung)), sheetFor(bare, own), 'no rung recorded: identical to wearing nothing');
});

test('guest view: the sheet is a pure value; the view and the profile are untouched', () => {
  const worn: Loot = { owned: ['veteran.Helmet'], equipped: { head: 'veteran.Helmet' }, taken: { 'veteran.Helmet': { tier: 3 } } } as Loot, profile = { loot: bare };
  const before = JSON.stringify([worn, profile]);
  fightSheet(profile, own, guestView(worn)); fightSheet(profile, own, guestView(worn));
  assert.equal(JSON.stringify([worn, profile]), before, 'nothing was written');
});
