// Wave A1 PR1b: what the player wears reaches the fight. `wornGear` reads the paperdoll and the rung each piece was won at (the same lookup as the Gear tab's numbers) and gives the worn SET's
// dial deltas (plate: +armour / -magic resist; robes the reverse; plus quality); `sheetOfLoot` puts it on the player's build (`buildOf`: the default build until Backend stores the real one), and a live
// career/practice Match takes that from its `sheet` port at EVERY begin(), so a piece swapped since boot counts, the record carries it (v48), and a naked player fights exactly as before.
import test from 'node:test';
import assert from 'node:assert/strict';
import { GEAR_IN_FIGHTS, fightSheet, sheetFor, buildOf, gearNumbers, sheetOfLoot } from '../src/fight/gear-numbers.ts';
import { createServerGear } from '../src/core/gear-server.ts';
import type { GearPiece, GearView } from '../src/core/gear-ledger.ts';
import { wornGear } from '../src/fight/gear-stats.ts';
import { sheetOf } from '../src/fight/sheet-rows.ts';
import { GEAR, gearDeltas } from '../src/fight/gear-rows.ts';
import { Match } from '../src/fight/match.ts';
import { OPPONENTS } from '../src/fight/moves.ts';
import { ROSTER } from '../src/roster.ts';
import { loadProfile } from '../src/core/profile.ts';
import { loadScorecard } from '../src/scorecard.ts';
import { loadTrial } from '../src/trial.ts';
import { FIRST_CAST_PENALTY_VERSION } from '../src/fight/cast-penalty-era.ts';
import { FIRST_SHEET_VERSION, RECORD_VERSION, packRecord, unpackRecord } from '../src/fight/record.ts';
import { playScaleFor, setLateNotice, setPlayScale } from '../src/fight/play-radius.ts';
import { setStab } from '../src/fight/stab-rule.ts';
import { validateBuild } from '../src/fight/sheet-rows.ts';
import { TIERS } from '../src/core/grades.ts';
import type { Loot, LootId } from '../src/core/loot.ts';

const took = (tier: number) => ({ opponent: 'veteran' as const, attempt: 1, healthLeft: 50, recordId: null, day: '2026-10-12', tier });
const origin = TIERS.length;
const plate: Loot = { owned: ['veteran.Helmet', 'veteran.Body'], equipped: { head: 'veteran.Helmet', chest: 'veteran.Body' }, taken: { 'veteran.Helmet': took(origin), 'veteran.Body': took(origin) } };
const robes: Loot = { owned: ['witch.Helmet', 'witch.Body'], equipped: { head: 'witch.Helmet', chest: 'witch.Body' }, taken: { 'witch.Helmet': took(origin), 'witch.Body': took(origin) } };

test('the owner rows: every opponent named is a real opponent and every set a real set row', () => {
  for (const [opponent, set] of Object.entries(GEAR.owners)) { assert.ok(opponent in ROSTER, opponent); assert.ok(set in GEAR.sets, `${opponent}: ${set}`); }
  assert.equal(GEAR.owners.veteran, 'plate'); assert.equal(GEAR.owners.witch, 'robes'); assert.equal(GEAR.owners.goblin, 'leathers'); assert.equal(GEAR.owners.skeleton, undefined, 'an opponent no row names gives no set');
});

test('wornGear: no piece with a rung is nothing; a part set scales the shape and the quality; ONE set is worn, the one with the most weight', () => {
  const rung = (loot: Loot) => (id: LootId) => { const l = loot.taken?.[id]?.tier; return l ? TIERS[l - 1] : undefined; };
  const top = () => TIERS[origin - 1];
  assert.deepEqual(wornGear({}, () => undefined), {});
  assert.deepEqual(wornGear({ head: 'veteran.Helmet' }, () => undefined), {}, 'a piece with no rung is the identity, never a guess');
  assert.deepEqual(wornGear(plate.equipped, rung(plate)), gearDeltas('plate', 0.5, 0.5), 'a helmet and a body at the top rung are half a set (50 of 100 slot weight), all of it top quality');
  const fullSet = Object.fromEntries(['Helmet', 'Body', 'Arms', 'Gloves', 'Greaves', 'Boots'].map((slot, i) => [`piece${i}`, `veteran.${slot}`])) as never;
  assert.deepEqual(wornGear(fullSet, top), gearDeltas('plate', 1, 1), 'a full legendary plate set is the whole 50: 25 shape, 25 quality');
  assert.deepEqual(wornGear(fullSet, () => TIERS[0]), gearDeltas('plate', 1, 0), 'a full common set is the shape alone');
  assert.deepEqual(wornGear({ head: 'veteran.Helmet', chest: 'witch.Body' }, top), gearDeltas('robes', 0.3, 0.3), 'plate helmet (20) against robes body (30): the robes are the set worn, at 30 of 100');
});

test('sheetOfLoot: the default build with nothing worn is no sheet; plate raises armour (its magic-resist tilt sits below a normal fighter, so that dial stays at 0), robes the reverse; the build rows validate', () => {
  assert.deepEqual(validateBuild(buildOf()), []);
  assert.equal(sheetOfLoot(undefined), undefined);
  assert.equal(sheetOfLoot({ owned: ['veteran.Helmet'], equipped: { head: 'veteran.Helmet' } }), undefined);
  const a = sheetOfLoot(plate)!, b = sheetOfLoot(robes)!;
  assert.ok(a.armour! > 0 && a.magicResist === undefined && a.attack === undefined, JSON.stringify(a));
  assert.ok(b.magicResist! > 0 && b.armour === undefined, JSON.stringify(b));
  assert.ok(gearNumbers(plate).res > 0, 'the Gear tab reads the same worn pieces');
});

const mk = (sheet?: () => ReturnType<typeof sheetOfLoot>, buildRef?: () => { characterId: string; buildVersion: number } | undefined) => {
  const storage = { getItem: () => null, setItem: () => undefined };
  return new Match(OPPONENTS.veteran, 'test', { storage, profile: loadProfile(storage, () => 'test').profile, trial: loadTrial(storage), scorecard: loadScorecard(storage), ...(sheet ? { sheet } : {}), ...(buildRef ? { buildRef } : {}) }, 731, 'longsword', null, 6);
};

test('a live Match takes the sheet from its port at every begin(): the fight and its record carry it (v48), a rematch re-reads it, and no port is the fight it was', () => {
  setPlayScale(playScaleFor('veteran', RECORD_VERSION)); setLateNotice(true); setStab(true);   // a live fight
  let loot: Loot | undefined = undefined;
  const m = mk(() => sheetOfLoot(loot));
  m.rematch();
  assert.equal(m.sheet, undefined); assert.equal(m.practice.duel.fighters[0].sheet, undefined); assert.equal(m.recorder?.finish('abandoned').sheet, undefined);
  loot = plate; m.rematch();   // the player put the armour on since the page booted
  const want = sheetOfLoot(plate);
  assert.deepEqual(m.sheet, want); assert.deepEqual(m.practice.duel.fighters[0].sheet, want); assert.equal(m.practice.duel.fighters[1].sheet, undefined, 'the warden is a creature row, off the sheet');
  const rec = m.recorder!.finish('abandoned');
  assert.deepEqual(rec.sheet, want); assert.equal(rec.v, FIRST_CAST_PENALTY_VERSION, 'a sheet fight is written no lower than the cast-penalty version');
  loot = undefined; m.rematch();
  assert.equal(m.sheet, undefined, 'the armour came off: the next fight is naked');
  const plain = mk(); plain.rematch();
  assert.equal(plain.sheet, undefined); assert.deepEqual(plain.practice.duel.fighters[0], m.practice.duel.fighters[0], 'a naked fighter is the one the port-less Match builds');
});

test('a lesson and sparring never take the sheet: only career and practice fights are fought on the player\'s kit', () => {
  const m = mk(() => sheetOfLoot(plate));
  m.startLesson(() => undefined);
  assert.equal(m.sheet, undefined);
  m.startSparring({ weapon: 'longsword', skill: null, difficulty: 6 });
  assert.equal(m.sheet, undefined);
});

test('the build reference: a sheet fight names the stored build it claims (character id + build version) on the record; no sheet, no reference; with no ports the page writes the plain record', async () => {
  setPlayScale(playScaleFor('veteran', RECORD_VERSION)); setLateNotice(true); setStab(true);
  assert.equal(GEAR_IN_FIGHTS, true, 'the flip: gear counts in fights now that the sweeps expect the worn set');
  const rung = (loot: Loot) => (id: LootId) => { const l = loot.taken?.[id]?.tier; return l ? TIERS[l - 1] : undefined; };
  const saved = { level: 20, placed: { attack: 12, armour: 8 } };
  assert.equal(sheetFor(plate, undefined), undefined, 'no sheet is recorded until the stored build is known');
  assert.deepEqual(sheetFor(plate, saved), sheetOf(saved, wornGear(plate.equipped, rung(plate))), 'with the build, the worn set counts on top of the placed points');
  assert.equal(sheetFor(undefined, { level: 0, placed: {} }), undefined, 'a naked default build has no sheet');
  assert.equal(sheetFor(plate, { level: 3, placed: { attack: 9 } }), undefined, 'an illegal stored build (9 points at level 3) gives none: the server would refuse it too');
  assert.deepEqual(Object.keys(sheetFor(plate, { level: 0, placed: {} })!), Object.keys(sheetOfLoot(plate)!), 'version 0 (never saved) is the default build: the page fights on it');
  const ref = { characterId: 'char-42_a', buildVersion: 7 };
  const on = mk(() => sheetOfLoot(plate), () => ref); on.rematch();
  const rec = on.recorder!.finish('abandoned');
  assert.equal(rec.characterId, 'char-42_a'); assert.equal(rec.buildVersion, 7); assert.ok(rec.sheet);
  assert.deepEqual(unpackRecord(packRecord(rec)), rec, 'the reference survives the wire');
  const naked = mk(() => sheetOfLoot(undefined), () => ref); naked.rematch();
  const bare = naked.recorder!.finish('abandoned');
  assert.equal(bare.sheet, undefined); assert.equal(bare.characterId, undefined, 'no sheet: no reference (a reference without a sheet is refused)');
  const off = mk(); off.rematch();   // a page with neither port (a guest, or a fight begun before the reference resolved): the plain record
  const today = off.recorder!.finish('abandoned');
  assert.equal(today.sheet, undefined); assert.equal(today.characterId, undefined); assert.equal(today.buildVersion, undefined);
  assert.deepEqual(unpackRecord(packRecord(today)), today);
  const { fetchOwnBuild, ownBuildOf } = await import('../src/core/build-ref.ts');
  assert.deepEqual(ownBuildOf({ level: 20, placed: { attack: 12 }, version: 3, respreadRank: 1 }, 'c1'), { level: 20, placed: { attack: 12 }, ref: { characterId: 'c1', buildVersion: 3 } });
  assert.deepEqual(ownBuildOf({ level: 0, placed: {}, version: 0 }, 'c1'), { level: 0, placed: {}, ref: null }, 'version 0 is the default build: a real answer, and the record names no reference');
  for (const bad of [null, {}, { level: 1, placed: [], version: 1 }, { level: 1, placed: { a: 1.5 }, version: 1 }, { level: 1, placed: {}, version: -1 }, { level: 'x', placed: {}, version: 1 }]) assert.equal(ownBuildOf(bad, 'c1'), null, JSON.stringify(bad));
  assert.equal(await fetchOwnBuild({ storage: null, search: '' }), null, 'a guest has no character: no build, so no sheet');
});

// Auditor 2026-10-13: a signed-in player's equips go to the SERVER (gear-server.ts), never to the device ledger, and the sweeps check the worn gear the server holds. The Pit's sheet must follow the server's view,
// and only once it has answered; otherwise every claim after a Gear equip would carry a sheet the server does not expect.
test('device != server: the sheet follows the server\'s worn gear, waits for its view, and a claim after a Gear equip carries the new worn set', async () => {
  const NOW = 1_800_000_000_000, session = JSON.stringify({ access_token: 'tok', expires_at: NOW / 1000 + 3600 });
  const storage = { getItem: (k: string) => (k === 'frankendom.auth.v1' ? session : null) };
  const top = TIERS[origin - 1]!;
  const piece = (id: string, lootId: string, where: GearPiece['where'], paperdoll: string | null = null): GearPiece => ({ id, item: `item:loot.${lootId}`, lootId, slot: null, where, index: where === 'equipped' ? null : 0, paperdoll, tier: top, version: 1, level: 0 });
  const view = (pieces: GearPiece[], worn: Record<string, string>): GearView => ({ pieces, stock: [], worn, packSize: 8, bankSize: 100 });
  const platePack = view([piece('i1', 'veteran.Helmet', 'pack'), piece('i2', 'veteran.Body', 'pack'), piece('i3', 'witch.Body', 'pack')], {});
  const plateWorn = view([piece('i1', 'veteran.Helmet', 'equipped', 'head'), piece('i2', 'veteran.Body', 'equipped', 'chest'), piece('i3', 'witch.Body', 'pack')], { head: 'i1', chest: 'i2' });
  const robesWorn = view([piece('i1', 'veteran.Helmet', 'pack'), piece('i2', 'veteran.Body', 'pack'), piece('i3', 'witch.Body', 'equipped', 'chest')], { chest: 'i3' });
  const answers: Record<string, unknown[]> = { open: [{ career: { totalCredit: 0 }, characters: [{ id: 'c1', name: 'Dom' }], marks: 0 }], gear_open: [plateWorn], gear_equip: [robesWorn], gear_unequip: [view([piece('i1', 'veteran.Helmet', 'pack'), piece('i2', 'veteran.Body', 'pack'), piece('i3', 'witch.Body', 'pack')], {})] };
  const fetcher = (async (url: string) => { const a = answers[String(url).split('/').at(-1)!]?.shift(); return a === undefined ? { status: 503, json: async () => ({}) } : { status: 200, json: async () => ({ ok: true, result: a }) }; }) as never;
  const device: Loot = { owned: [], equipped: {} };   // the device ledger knows nothing of what the server holds
  const profile = { loot: device }, own: { level: number; placed: Record<string, number> } = { level: 20, placed: { attack: 12 } };
  const gear = createServerGear({ storage, search: '', now: () => NOW, fetch: fetcher, getLoot: () => profile.loot, show: () => {} });
  const rung = (l: Loot) => (id: LootId) => { const t = l.taken?.[id]?.tier; return t ? TIERS[t - 1] : undefined; };
  assert.equal(fightSheet(profile, own, gear), undefined, 'the server has not answered: no sheet (a naked fight, as before the flip)');
  assert.equal(gear.ready(), false);
  assert.equal(await gear.refresh(), true); assert.ok(gear.ready());
  const serverLoot = gear.profileFor(profile).loot!;
  const first = fightSheet(profile, own, gear)!;
  assert.deepEqual(first, sheetOf(own, wornGear(serverLoot.equipped, rung(serverLoot))), 'the sheet is the SERVER\'s worn set on the stored build');
  assert.notDeepEqual(first, sheetFor(device, own), 'the device ledger (nothing worn) would have built another sheet: the claim would be refused');
  assert.ok(first.armour! > (sheetFor(device, own)!.armour ?? 0), 'plate raises armour');
  // The player opens Gear and wears robes: the server answers, the shadow follows, the next fight's sheet is the robes.
  assert.equal(gear.act({ kind: 'wear', id: 'witch.Body' as never }), true); await new Promise((r) => setTimeout(r, 30));
  const second = fightSheet(profile, own, gear)!, nowLoot = gear.profileFor(profile).loot!;
  assert.deepEqual(nowLoot.equipped, { chest: 'witch.Body' });
  assert.deepEqual(second, sheetOf(own, wornGear(nowLoot.equipped, rung(nowLoot))), 'after the equip the sheet is the new worn set');
  assert.ok(second.magicResist! > 0 && second.armour === undefined, 'robes tilt to magic resist and leave armour at its base');
  // The claim: a Match fight begun now records exactly the sheet the server will compute from its worn_gear.
  setPlayScale(playScaleFor('veteran', RECORD_VERSION)); setLateNotice(true); setStab(true);
  const m = mk(() => fightSheet(profile, own, gear), () => ({ characterId: 'c1', buildVersion: 3 })); m.rematch();
  const rec = m.recorder!.finish('abandoned');
  assert.deepEqual(rec.sheet, second, 'the record carries the server\'s worn set, not the device\'s');
  assert.equal(profile.loot, device, 'the device ledger was never written');
  void platePack;
});
