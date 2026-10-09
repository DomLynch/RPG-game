// What a verified world creature kill pays (mob-rewards.ts): the kill's CP through award(), the loot rolled on the server's seed into the pack as mints,
// and nothing for a token without a fight id, a run the fight does not describe, a loss-shaped twist, a full pack or a capped Bounty.
import test from 'node:test';
import assert from 'node:assert/strict';
import { ACCOUNT, PC } from '../contracts/fixtures.ts';
import type { CharacterInstanceId } from '../contracts/ids.ts';
import { fightSetup, loadEncounterContent, lookupOf, rollLoot, type EncounterContent } from '../encounters/encounters.ts';
import { openInventory, type Inventory } from '../inventory/inventory.ts';
import { killIdOf, mobBatch, mobRewards, RESPAWN_MS, respawnMsOf, type Kill } from './mob-rewards.ts';
import type { Db } from './db.ts';
import type { CareerRow } from './store.ts';

const loaded = loadEncounterContent();
if (!loaded.ok) throw new Error('Region 1 content must load for these tests');
const content: EncounterContent = loaded.value, lookup = lookupOf(content);
const AT = '2026-10-08T10:00:00.000Z', UID = '0b8e2a6c-1f3d-4c5e-9a7b-2c4d6e8f0a1b';
const row = (over: Partial<CareerRow> = {}): CareerRow => ({ seed_credit: 5000, world_credit: 0, total_credit: 5000, rested: 0, rested_at: 0, heat: {}, beaten: [], story: [], version: 3, ...over });
const pack = (size = 20): Inventory => { const inv = openInventory({ owner: PC as CharacterInstanceId, account: ACCOUNT as never, items: [], packSize: size, bankSize: 10 }, lookup); if (!inv.ok) throw new Error(JSON.stringify(inv.issues)); return inv.value; };
const kill = (fight: string, seed: number, over: Partial<Kill> = {}): Kill => {
  const s = fightSetup(fight, content); if (!s.ok) throw new Error(fight);
  return { account: UID, character: PC, token: `TOKEN${seed}`.padEnd(40, 'x'), fight, seed, enemy: s.value.opponent.body, level: s.value.opponent.level, twist: null, ...over };
};
// The open-world creatures with a loot table (the Zone 1 hunt's ordinary kills), and a seed whose roll drops something for each.
const creatures = Object.keys(content.local.creatureLoot).filter((id) => fightSetup(id, content).ok);
const droppingSeed = (fight: string, min = 1, foeLevel?: number): number => {
  const s = fightSetup(fight, content); if (!s.ok) throw new Error(fight);
  for (let seed = 1; seed < 5000; seed++) { const r = rollLoot(content.local.creatureLoot[fight], seed, content, { foeLevel: foeLevel ?? s.value.opponent.level }); if (r.ok && r.value.items.length >= min) return seed; }
  throw new Error(`no seed under 5000 drops ${min}+ items for ${fight}`);
};

test('a creature kill pays its CP (career_set at the row version) and mints exactly what the server-seeded roll dropped, with unique loot:<kill key>:<n> keys', () => {
  assert.ok(creatures.length > 0, 'Region 1 has open-world creatures with loot');
  for (const fight of creatures) {
    const seed = droppingSeed(fight), k = kill(fight, seed), paid = mobBatch(k, { career: row(), inventory: pack() }, content, AT);
    const career = paid.batch.filter((l) => l.op === 'career_set'), mints = paid.batch.filter((l) => l.op === 'mint');
    assert.equal(career.length, 1, `${fight}: one career_set`);
    assert.equal(career[0]!.expected_version, 3); assert.equal(career[0]!.account, UID);
    assert.ok(paid.summary.cp > 0 && career[0]!.world_credit === paid.summary.cp, `${fight}: world_credit grows by the kill's CP`);
    const rolled = rollLoot(content.local.creatureLoot[fight], seed, content, { foeLevel: k.level });
    assert.ok(rolled.ok);
    assert.deepEqual(mints.map((m) => (m.item as { item: string }).item), rolled.value.items.map((d) => d.item), `${fight}: the mints are the roll the page makes on the same seed`);
    const keys = mints.map((m) => (m.item as { mint_key: string }).mint_key);
    assert.deepEqual(keys, keys.map((_, n) => `loot:${killIdOf(k.token)}:${n}`), 'each drop is keyed by the kill event, so a replayed settle cannot mint it twice');
    for (const m of mints) assert.deepEqual((m.item as { loc: { kind: string; owner: string } }).loc.kind, 'pack');
    assert.equal(paid.summary.lootRefused, null);
  }
});

test('the same kill priced twice gives the very same lines (deterministic: the retry is refused by the event id, never re-rolled differently)', () => {
  const fight = creatures[0]!, k = kill(fight, droppingSeed(fight));
  assert.deepEqual(mobBatch(k, { career: row(), inventory: pack() }, content, AT), mobBatch(k, { career: row(), inventory: pack() }, content, AT));
});

test('nothing is paid without a fight id, for a run the fight does not describe, or for a fled twist', () => {
  const fight = creatures[0]!, seed = droppingSeed(fight), state = { career: row(), inventory: pack() };
  assert.deepEqual(mobBatch(kill(fight, seed, { fight: null }), state, content, AT).batch, [], 'a token issued before the fight id: event only');
  assert.deepEqual(mobBatch(kill(fight, seed, { level: 99 }), state, content, AT).summary.cpReason, 'fight-mismatch');
  assert.deepEqual(mobBatch(kill(fight, seed, { enemy: 'dragon' }), state, content, AT).batch, []);
  assert.deepEqual(mobBatch(kill(fight, seed, { fight: 'character:nobody' }), state, content, AT).batch, []);
});

test('a full pack mints nothing (all or nothing, as the page says) but the kill still pays its CP; no career row pays no CP but still mints', () => {
  const fight = creatures[0]!, seed = droppingSeed(fight);
  // Zone 1's creatures are level 1 (Dom 2026-10-08) and a level-1 roll drops one item at most; the two-drop / one-slot case needs a higher one, so the fight's mob form is lifted to level 11 for the two-drop part and restored.
  const form = content.region.registry.characters.get(fight as never)!.encounterForms.find((f) => f.id === 'mob')! as { level: number | null }, was = form.level;
  form.level = 11;
  try {
    const two = droppingSeed(fight, 2), full = mobBatch(kill(fight, two), { career: row(), inventory: pack(1) }, content, AT);   // two drops, one slot: the second does not fit, so neither is minted
    assert.equal(full.batch.filter((l) => l.op === 'mint').length, 0); assert.ok(full.summary.lootRefused);
    assert.equal(full.batch.filter((l) => l.op === 'career_set').length, 1);
  } finally { form.level = was; }
  const noCareer = mobBatch(kill(fight, seed), { career: null, inventory: pack() }, content, AT);
  assert.equal(noCareer.batch.filter((l) => l.op === 'career_set').length, 0); assert.equal(noCareer.summary.cpReason, 'no-career');
  assert.ok(noCareer.batch.some((l) => l.op === 'mint'));
});

test('bronze: the rolled currency is one metal award in the same batch, versioned by the balance row; without the 0004 read it is reported unpaid, never written', () => {
  let seen = 0;
  for (const fight of creatures) {
    const s = fightSetup(fight, content); if (!s.ok) continue;
    for (let seed = 1; seed <= 40; seed++) {
      const rolled = rollLoot(content.local.creatureLoot[fight], seed, content, { foeLevel: s.value.opponent.level });
      if (!rolled.ok || rolled.value.metal === 0) continue;
      seen++;
      const k = kill(fight, seed), absent = mobBatch(k, { career: row(), inventory: pack() }, content, AT);
      assert.ok(!absent.batch.some((l) => l.op === 'metal') && absent.summary.unpaid.includes(`bronze ${rolled.value.metal}`), `${fight} ${seed}: no read, no metal op`);
      const first = mobBatch(k, { career: row(), inventory: pack(), metal: null }, content, AT).batch.filter((l) => l.op === 'metal');
      assert.deepEqual(first, [{ op: 'metal', account: UID, delta_bronze: rolled.value.metal, reason: 'award', event_id: `enc:${k.token}` }], 'the first award inserts the row');
      const later = mobBatch(k, { career: row(), inventory: pack(), metal: { bronze: 7, version: 4 } }, content, AT).batch.filter((l) => l.op === 'metal');
      assert.deepEqual(later, [{ ...first[0], expected_version: 4 }], 'a later award names the row version');
    }
  }
  assert.ok(seen > 0, 'some Region 1 creature drops bronze');
});

test('Bounty bronze is never written yet (no "wins today" read): reported unpaid, with or without the metal read', () => {
  for (const fight of content.region.bounties.map((b) => b.encounter)) {
    if (!fightSetup(fight, content).ok) continue;
    const paid = mobBatch(kill(fight, 1), { career: row(), inventory: pack(), metal: null }, content, AT);
    assert.ok(!paid.batch.some((l) => l.op === 'metal'), `${fight}: no metal op`);
  }
});

// The respawn window (202610080006): a stub db answers origins_open with an empty pack and the career row, origins_metal_of as absent, and origins_last_paid_kill
// from `paid` (account|fight -> the database time it paid) on the stub's own clock, as the real function reads committed events on the database clock.
let dbClock = 0;
const paid = new Map<string, number>();
const fakeOpen = (lastPaid: 'absent' | 'present' = 'present'): Db => ({ run: async (sql: string, v?: Record<string, string>) => {
  if (/origins_last_paid_kill/.test(sql)) { if (lastPaid === 'absent') return 'absent'; const at = paid.get(`${v?.a}|${v?.f}`); return at === undefined ? 'null' : String(dbClock - at); }
  if (/origins_metal_of/.test(sql)) return 'absent';
  return JSON.stringify({ marks: 0, career: row(), characters: [{ id: PC, pack_slots: 20, bank_slots: 10 }], items: [], quests: [], journal: [], talk: [] });
} } as Db);
test('respawn window from the database: a paid kill of the same fight inside the window pays nothing; another fight or account, and after the window, pays', async () => {
  const fight = creatures[0]!, other = creatures[1]!, seedA = droppingSeed(fight), seedB = droppingSeed(other), db = fakeOpen(), hook = mobRewards(content, () => new Date(AT), () => {});
  paid.clear(); dbClock = 1_000_000;
  const first = await hook(kill(fight, seedA), db);
  assert.ok(first.some((l) => l.op === 'mint'), 'no paid kill on record: it pays');
  assert.ok((await hook(kill(fight, seedA, { token: 'UNCOMMITTED'.padEnd(40, 'u') }), db)).length > 0, 'the first kill has not committed (no paid event yet): a second token is not blocked');
  paid.set(`${UID}|${fight}`, dbClock); dbClock += 10_000;   // it committed; 10 s later
  assert.deepEqual(await hook(kill(fight, seedA, { token: 'SECOND'.padEnd(40, 'y') }), db), [], 'inside the 300 s window: pays nothing');
  assert.ok((await hook(kill(other, seedB), db)).length > 0, 'another fight is its own window');
  assert.ok((await hook(kill(fight, seedA, { account: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc', token: 'THIRD'.padEnd(40, 'z') }), db)).length > 0, 'another account is its own window');
  dbClock += RESPAWN_MS; assert.ok((await hook(kill(fight, seedA, { token: 'FOURTH'.padEnd(40, 'w') }), db)).length > 0, 'after the window it pays again');
  const restarted = mobRewards(content, () => new Date(AT), () => {});   // a writer restart: nothing in memory
  paid.set(`${UID}|${fight}`, dbClock); dbClock += 10_000;
  assert.deepEqual(await restarted(kill(fight, seedA, { token: 'FIFTH'.padEnd(40, 'v') }), db), [], 'a restarted writer still sees the window (it lives in the database)');
});

test('respawn window: a row with respawnSeconds binds that (the bear: 75 s), a row without keeps 300 s; the migration absent pays nothing (fail closed)', async () => {
  const [a, b] = creatures as [string, string];
  assert.equal(respawnMsOf(a, content, new Map([[a, 75_000]])), 75_000);
  assert.equal(respawnMsOf(b, content, new Map([[a, 75_000]])), RESPAWN_MS);
  assert.equal(respawnMsOf('character:nobody', content), RESPAWN_MS);
  const logs: string[] = [], hook = mobRewards(content, () => new Date(AT), (l) => logs.push(l));
  assert.deepEqual(await hook(kill(a, droppingSeed(a)), fakeOpen('absent')), []);
  assert.match(logs.join('\n'), /202610080006\) is not applied, recorded, pays nothing/);
});

test('no fight id (a token from before the fight was carried): the hook pays nothing and records no window (L3)', async () => {
  const hook = mobRewards(content, () => new Date(AT), () => {}), db = fakeOpen();
  assert.deepEqual(await hook(kill(creatures[0]!, droppingSeed(creatures[0]!), { fight: null }), db), []);
});
