// O1 items: ItemDefinition, ItemInstance (one canonical location, permanent provenance, append-only history, the reserved upgrade
// level), custody and one-of-each, rank-to-equip, the Attack/RES spine, and LootTable.
import assert from 'node:assert/strict';
import test from 'node:test';
import { levelOf } from '../../src/career.ts';
import { CAPS, NAKED, loadoutFor } from '../../src/gear-stats.ts';
import { ARMOUR_SLOTS } from '../../src/loot.ts';
import type { Issue, Result } from './core.ts';
import * as F from './fixtures.ts';
import type { AccountId, CharacterInstanceId, ItemId } from './ids.ts';
import {
  checkCustody, checkHistoryKept, checkInstance, checkOneOfEach, effectiveTier, equipItem, legacyUnlockMintKey, moveItem, parseItemDefinition,
  parseItemInstance, parseLootTable, piecePoints, resolveLoadout, upgradeLevelOf, type ItemDefinition, type ItemInstance, type Location,
} from './items.ts';
import type { CareerStanding } from './world.ts';

type Raw = Record<string, unknown>;
const refused = (r: Result<unknown>, code: string, path?: string): void => {
  assert.equal(r.ok, false, `expected ${code}${path ? ` at ${path}` : ''}`);
  if (r.ok) return;
  assert.ok(r.issues.some((i) => i.code === code && (path === undefined || i.path === path)), `want ${code}${path ? ` at ${path}` : ''}; got ${JSON.stringify(r.issues)}`);
};
const has = (issues: Issue[], code: string, path?: string): void =>
  assert.ok(issues.some((i) => i.code === code && (path === undefined || i.path === path)), `want ${code}${path ? ` at ${path}` : ''}; got ${JSON.stringify(issues)}`);
const def = (raw: Raw): ItemDefinition => { const r = parseItemDefinition(raw); assert.ok(r.ok, JSON.stringify(!r.ok && r.issues)); return r.value; };
const inst = (raw: Raw): ItemInstance => { const r = parseItemInstance(raw); assert.ok(r.ok, JSON.stringify(!r.ok && r.issues)); return r.value; };
const PC = F.PC as CharacterInstanceId, OTHER = F.OTHER_PC as CharacterInstanceId, ALT = 'pc:dom-2' as CharacterInstanceId;
const ACCOUNTS: Record<string, AccountId> = { [F.PC]: F.ACCOUNT as AccountId, [ALT]: F.ACCOUNT as AccountId, [F.OTHER_PC]: F.OTHER_ACCOUNT as AccountId };
const accountOf = (pc: CharacterInstanceId): AccountId | undefined => ACCOUNTS[pc];
// A legacy account's server standing: its career level is today's levelOf(marks).
const server = (marks: number): CareerStanding => ({ source: 'server', careerLevel: levelOf(marks) });
const pitProvenance = (patch: Raw = {}): Raw => ({ ...F.helmetInstance().provenance, ...patch });

// ---- definitions --------------------------------------------------------------------------------------------------------------------

test('item definition: the four fixtures parse and keep rarity, power, material, appearance and story distinct', () => {
  for (const build of [F.helmetDef, F.recordDef, F.graveIronDef, F.tokenDef]) def(build());
  const helmet = def(F.helmetDef());
  assert.deepEqual([helmet.rarity, helmet.power, helmet.material, helmet.appearance.asset, helmet.story], ['common', 'slot-weight', 'iron', 'loot.glb/veteran.Helmet', 'none']);
});

test('item definition: schema version — missing, older, newer and non-integer all fail explicitly', () => {
  const { schemaVersion: _drop, ...noVersion } = F.helmetDef();
  void _drop;
  refused(parseItemDefinition(noVersion), 'missing-version', 'schemaVersion');
  for (const v of [0, 2, 1.5, '1', null]) refused(parseItemDefinition({ ...F.helmetDef(), schemaVersion: v }), 'unsupported-version', 'schemaVersion');
});

test('item definition: shape rejections', () => {
  refused(parseItemDefinition('not an object'), 'not-object');
  refused(parseItemDefinition([]), 'not-object');
  refused(parseItemDefinition({ ...F.helmetDef(), kind: 'item-instance' }), 'unknown-kind', 'kind');
  const { kind: _k, ...noKind } = F.helmetDef();
  void _k;
  refused(parseItemDefinition(noKind), 'missing-field', 'kind');
  refused(parseItemDefinition({ ...F.helmetDef(), attack: 5 }), 'unknown-field', 'attack');
  refused(parseItemDefinition({ ...F.helmetDef(), rarity: 'epic' }), 'wrong-type', 'rarity'); // four rarities only
  refused(parseItemDefinition({ ...F.helmetDef(), slot: 'Cape' }), 'wrong-type', 'slot');
  refused(parseItemDefinition({ ...F.helmetDef(), material: 'mithril' }), 'wrong-type', 'material');
  refused(parseItemDefinition({ ...F.helmetDef(), stack: 0 }), 'out-of-range', 'stack');
  refused(parseItemDefinition({ ...F.helmetDef(), name: '' }), 'out-of-range', 'name');
  refused(parseItemDefinition({ ...F.helmetDef(), name: 'bad\u0007bell' }), 'wrong-type', 'name');
  refused(parseItemDefinition({ ...F.helmetDef(), appearance: { asset: '../escape' } }), 'wrong-type', 'appearance.asset');
  refused(parseItemDefinition({ ...F.helmetDef(), appearance: { asset: 'a.glb', tint: 'red' } }), 'unknown-field', 'appearance.tint');
  const { slot: _s, ...noSlot } = F.graveIronDef();
  void _s;
  refused(parseItemDefinition(noSlot), 'missing-field', 'slot');
  refused(parseItemDefinition({ ...F.helmetDef(), id: 'item:loot.veteran.Sword' }), 'legacy-unknown', 'id');
});

test('item definition: cross-field rules', () => {
  refused(parseItemDefinition({ ...F.graveIronDef(), id: 'item:x', category: 'gear' }), 'rule-violation', 'slot');
  refused(parseItemDefinition({ ...F.graveIronDef(), slot: 'Helmet' }), 'rule-violation', 'slot');
  refused(parseItemDefinition({ ...F.tokenDef(), power: 'slot-weight' }), 'rule-violation', 'power'); // a cosmetic has no budget
  refused(parseItemDefinition({ ...F.graveIronDef(), power: 'slot-weight' }), 'rule-violation', 'power');
  refused(parseItemDefinition({ ...F.helmetDef(), stack: 2 }), 'rule-violation', 'stack');
  refused(parseItemDefinition({ ...F.recordDef(), binding: 'none' }), 'rule-violation', 'binding');
  // A legacy piece stays today's piece (same slot, gear, slot-weight) and stays tradeable (binding none).
  refused(parseItemDefinition({ ...F.helmetDef(), slot: 'Body' }), 'rule-violation', '(root)');
  refused(parseItemDefinition({ ...F.helmetDef(), power: 'none' }), 'rule-violation', '(root)');
  refused(parseItemDefinition({ ...F.helmetDef(), binding: 'on-equip' }), 'rule-violation', '(root)');
});

// ---- instances --------------------------------------------------------------------------------------------------------------------

test('item instance: fixtures parse; every location kind parses', () => {
  for (const build of [F.helmetInstance, F.ironInstance, F.recordInstance]) inst(build());
  const locations: Location[] = [
    { kind: 'equipped', owner: PC, slot: 'head' }, { kind: 'pack', owner: PC, index: 63 }, { kind: 'bank', owner: PC, index: 999 },
    { kind: 'account-vault', account: F.ACCOUNT as never, index: 0 }, { kind: 'guild-vault', container: 'container:guild.ash' as never, index: 3 },
    { kind: 'trade-escrow', container: 'container:trade.42' as never, from: PC },
  ];
  for (const location of locations) inst({ ...F.ironInstance(), location });
});

test('item instance: the upgrade level is optional — an instance without it validates and counts as level 0', () => {
  const raw = F.helmetInstance();
  assert.equal(Object.hasOwn(raw, 'upgradeLevel'), false);
  const parsed = inst(raw);
  assert.equal(parsed.upgradeLevel, undefined, 'absent stays absent (no field is invented on re-save)');
  assert.equal(upgradeLevelOf(parsed), 0);
  assert.equal(upgradeLevelOf(inst({ ...raw, upgradeLevel: 2 })), 2);
  refused(parseItemInstance({ ...raw, upgradeLevel: 10 }), 'out-of-range', 'upgradeLevel');
  refused(parseItemInstance({ ...raw, upgradeLevel: 1.5 }), 'wrong-type', 'upgradeLevel');
});

test('item instance: shape and version rejections', () => {
  refused(parseItemInstance({ ...F.helmetInstance(), schemaVersion: 2 }), 'unsupported-version');
  refused(parseItemInstance({ ...F.helmetInstance(), id: 'item:x' }), 'wrong-namespace', 'id');
  refused(parseItemInstance({ ...F.helmetInstance(), item: 'item:loot.veteran.Sword' }), 'legacy-unknown', 'item');
  refused(parseItemInstance({ ...F.helmetInstance(), version: -1 }), 'out-of-range', 'version');
  refused(parseItemInstance({ ...F.helmetInstance(), quantity: 0 }), 'out-of-range', 'quantity');
  refused(parseItemInstance({ ...F.helmetInstance(), tier: 'Emperor' }), 'wrong-type', 'tier');
  const { location: _l, ...noLocation } = F.helmetInstance();
  void _l;
  refused(parseItemInstance(noLocation), 'missing-field', 'location');
  const { boundTo: _b, ...noBound } = F.helmetInstance();
  void _b;
  refused(parseItemInstance(noBound), 'missing-field', 'boundTo');
  const { history: _h, ...noHistory } = F.helmetInstance();
  void _h;
  refused(parseItemInstance(noHistory), 'missing-field', 'history');
  refused(parseItemInstance({ ...F.helmetInstance(), owners: [F.PC] }), 'unknown-field', 'owners'); // one custodian, never a list
  refused(parseItemInstance({ ...F.helmetInstance(), location: { kind: 'floor', owner: F.PC } }), 'wrong-type', 'location.kind');
  refused(parseItemInstance({ ...F.helmetInstance(), location: { kind: 'pack', owner: F.PC, index: 64 } }), 'out-of-range', 'location.index');
  refused(parseItemInstance({ ...F.helmetInstance(), location: { kind: 'pack', owner: F.PC, index: 0, slot: 'head' } }), 'unknown-field', 'location.slot');
  refused(parseItemInstance({ ...F.helmetInstance(), location: { kind: 'equipped', owner: F.PC, slot: 'tail' } }), 'wrong-type', 'location.slot');
  refused(parseItemInstance({ ...F.helmetInstance(), location: { kind: 'bank', owner: 'faction:x', index: 0 } }), 'wrong-namespace', 'location.owner');
});

test('item instance: history entries parse, and each refuses its bad forms', () => {
  const trade = { kind: 'trade', trade: 'container:trade.42', from: F.OTHER_PC, to: F.PC, at: F.AT };
  const upgrade = { kind: 'upgrade', smith: 'character:smith-orla', level: 1, receipt: 'upgrade:req-0001', at: F.AT };
  inst({ ...F.helmetInstance(), history: [trade, upgrade] });
  refused(parseItemInstance({ ...F.helmetInstance(), history: [{ ...trade, kind: 'gift' }] }), 'wrong-type', 'history[0].kind');
  refused(parseItemInstance({ ...F.helmetInstance(), history: [{ ...trade, to: F.OTHER_PC }] }), 'rule-violation', 'history[0]');
  refused(parseItemInstance({ ...F.helmetInstance(), history: [{ ...trade, level: 1 }] }), 'unknown-field', 'history[0].level');
  refused(parseItemInstance({ ...F.helmetInstance(), history: [{ ...upgrade, level: 0 }] }), 'out-of-range', 'history[0].level');
  refused(parseItemInstance({ ...F.helmetInstance(), history: [{ ...upgrade, smith: F.PC }] }), 'wrong-namespace', 'history[0].smith');
});

test('item instance: Pit provenance names who won it, from which legend, at what rank — and must be self-consistent', () => {
  const p = 'provenance';
  const h = inst(F.helmetInstance());
  assert.ok(h.provenance.kind === 'arena-award');
  assert.deepEqual([h.provenance.wonBy, h.provenance.fromLegend, h.provenance.atRank, h.provenance.at], [F.PC, 'veteran-3', 'Gladiator', F.AT]);
  refused(parseItemInstance({ ...F.helmetInstance(), provenance: pitProvenance({ fromLegend: 'veteran-11' }) }), 'legacy-unknown', `${p}.fromLegend`);
  refused(parseItemInstance({ ...F.helmetInstance(), provenance: pitProvenance({ fromLegend: 'witch-3' }) }), 'rule-violation', `${p}.fromLegend`);
  refused(parseItemInstance({ ...F.helmetInstance(), provenance: pitProvenance({ atRank: 'Veteran' }) }), 'rule-violation', `${p}.atRank`);
  refused(parseItemInstance({ ...F.helmetInstance(), provenance: pitProvenance({ wonBy: undefined }) }), 'missing-field', `${p}.wonBy`);
  refused(parseItemInstance({ ...F.helmetInstance(), provenance: pitProvenance({ atRank: null }) }), 'wrong-type', `${p}.atRank`);
});

test('item instance: provenance kinds parse, and each refuses its bad forms', () => {
  const at = F.AT;
  const legacy = { kind: 'legacy-unlock', mintKey: legacyUnlockMintKey(F.ACCOUNT as never, 'veteran.Helmet'), at, account: F.ACCOUNT, lootId: 'veteran.Helmet', wonBy: F.PC, fromLegend: null, atRank: null };
  const good = [
    { kind: 'creator-mint', mintKey: 'mint:abc-12345', at, creator: F.OTHER_ACCOUNT },
    legacy,
    { ...legacy, fromLegend: 'veteran-2', atRank: 'Legionary' },
    // Dom, 2026-10-07: bought from an NPC shop (bound metal), or from the cash shop (real money). Tradeability is economy.ts tradeCooldown.
    { kind: 'shop', mintKey: 'shop:armourer:0001', at, boughtBy: F.PC, shop: 'service:armourer-vell' },
    { kind: 'cash-shop', mintKey: 'cash:order-0001', at, account: F.ACCOUNT, sku: 'ember-crest' },
  ];
  for (const provenance of good) inst({ ...F.helmetInstance(), provenance });
  const p = 'provenance';
  refused(parseItemInstance({ ...F.helmetInstance(), provenance: pitProvenance({ kind: 'craft' }) }), 'wrong-type', `${p}.kind`); // crafting is out
  refused(parseItemInstance({ ...F.helmetInstance(), provenance: pitProvenance({ mintKey: 'x' }) }), 'wrong-type', `${p}.mintKey`);
  refused(parseItemInstance({ ...F.helmetInstance(), provenance: pitProvenance({ at: '2026-10-06 12:00' }) }), 'wrong-type', `${p}.at`);
  refused(parseItemInstance({ ...F.helmetInstance(), provenance: pitProvenance({ at: '2026-13-45T99:00:00Z' }) }), 'wrong-type', `${p}.at`);
  refused(parseItemInstance({ ...F.helmetInstance(), provenance: pitProvenance({ lootId: 'veteran.Sword' }) }), 'legacy-unknown', `${p}.lootId`);
  refused(parseItemInstance({ ...F.helmetInstance(), provenance: pitProvenance({ claimId: 0 }) }), 'out-of-range', `${p}.claimId`);
  refused(parseItemInstance({ ...F.helmetInstance(), provenance: pitProvenance({ table: 'loottable:x' }) }), 'unknown-field', `${p}.table`);
  const shop = { kind: 'shop', mintKey: 'shop:armourer:0001', at, boughtBy: F.PC, shop: 'service:armourer-vell' };
  refused(parseItemInstance({ ...F.helmetInstance(), provenance: { ...shop, shop: 'region:concord-exchange' } }), 'wrong-namespace', `${p}.shop`);
  refused(parseItemInstance({ ...F.helmetInstance(), provenance: { ...shop, boughtBy: undefined } }), 'missing-field', `${p}.boughtBy`);
  refused(parseItemInstance({ ...F.helmetInstance(), provenance: { ...shop, wonBy: F.PC } }), 'unknown-field', `${p}.wonBy`);
  refused(parseItemInstance({ ...F.helmetInstance(), provenance: { kind: 'cash-shop', mintKey: 'cash:order-0001', at, account: F.ACCOUNT, sku: 'Ember Crest!' } }), 'wrong-type', `${p}.sku`);
  // A legacy migration copy has a derived mint key, so a re-run collides instead of minting a second copy.
  refused(parseItemInstance({ ...F.helmetInstance(), provenance: { ...legacy, mintKey: 'legacy:other-key-1' } }), 'rule-violation', `${p}.mintKey`);
  refused(parseItemInstance({ ...F.helmetInstance(), provenance: { ...legacy, fromLegend: 'veteran-2' } }), 'rule-violation', p);
});

test('checkInstance: every definition-dependent rule', () => {
  const helmet = def(F.helmetDef()), iron = def(F.graveIronDef()), record = def(F.recordDef()), token = def(F.tokenDef());
  assert.deepEqual(checkInstance(inst(F.helmetInstance()), helmet), []);
  assert.deepEqual(checkInstance(inst(F.ironInstance()), iron), []);
  assert.deepEqual(checkInstance(inst(F.recordInstance()), record), []);
  has(checkInstance(inst(F.helmetInstance()), iron), 'rule-violation', 'item');
  has(checkInstance(inst({ ...F.ironInstance(), quantity: 51 }), iron), 'out-of-range', 'quantity');
  has(checkInstance(inst({ ...F.helmetInstance(), tier: null }), helmet), 'rule-violation', 'tier');
  has(checkInstance(inst({ ...F.helmetInstance(), tier: 'Veteran' }), helmet), 'rule-violation', 'tier'); // a Pit piece's tier is its atRank
  has(checkInstance(inst({ ...F.ironInstance(), tier: 'Recruit' }), iron), 'rule-violation', 'tier');
  has(checkInstance(inst({ ...F.ironInstance(), upgradeLevel: 1 }), iron), 'rule-violation', 'upgradeLevel');
  has(checkInstance(inst({ ...F.helmetInstance(), location: { kind: 'equipped', owner: F.PC, slot: 'chest' } }), helmet), 'rule-violation', 'location.slot');
  has(checkInstance(inst({ ...F.ironInstance(), location: { kind: 'equipped', owner: F.PC, slot: 'head' } }), iron), 'rule-violation', 'location');
  has(checkInstance(inst({ ...F.helmetInstance(), boundTo: F.OTHER_PC }), helmet), 'rule-violation', 'location');
  has(checkInstance(inst({ ...F.helmetInstance(), boundTo: F.PC, location: { kind: 'guild-vault', container: 'container:g', index: 0 } }), helmet), 'rule-violation', 'location');
  has(checkInstance(inst({ ...F.recordInstance(), boundTo: null }), record), 'rule-violation', 'boundTo');
  has(checkInstance(inst({ ...F.recordInstance(), boundTo: null, location: { kind: 'trade-escrow', container: 'container:t', from: F.PC } }), record), 'rule-violation', 'location');
  const minted = { kind: 'creator-mint', mintKey: 'mint:abc-12345', at: F.AT, creator: F.OTHER_ACCOUNT };
  has(checkInstance(inst({ ...F.ironInstance(), provenance: minted }), iron), 'rule-violation', 'provenance');
  assert.deepEqual(checkInstance(inst({ ...F.ironInstance(), item: 'item:ferry-token', quantity: 1, provenance: minted }), token), []);
  has(checkInstance(inst({ ...F.helmetInstance(), provenance: pitProvenance({ lootId: 'veteran.Body' }) }), helmet), 'rule-violation', 'provenance.lootId');
});

test('moveItem: compare-and-bump version within one holder; equipping and changing hands go elsewhere', () => {
  const helmet = def(F.helmetDef()), record = def(F.recordDef());
  const h = inst({ ...F.helmetInstance(), location: { kind: 'pack', owner: F.PC, index: 0 } });
  const toBank: Location = { kind: 'bank', owner: PC, index: 9 };
  const moved = moveItem(h, helmet, 3, toBank, accountOf);
  assert.ok(moved.ok);
  assert.deepEqual([moved.value.version, moved.value.location, h.version], [4, toBank, 0 + 3], 'a new instance; the input is untouched');
  assert.deepEqual(moved.value.provenance, h.provenance);
  refused(moveItem(h, helmet, 2, toBank, accountOf), 'version-conflict', 'version');
  refused(moveItem(moved.value, helmet, 3, toBank, accountOf), 'version-conflict', 'version'); // a retried request after commit
  refused(moveItem(h, helmet, 3, { kind: 'equipped', owner: PC, slot: 'head' }, accountOf), 'rule-violation', 'location');
  refused(moveItem(h, helmet, 3, { kind: 'pack', owner: OTHER, index: 0 }, accountOf), 'rule-violation', 'location'); // that is a trade
  refused(moveItem(h, helmet, 3, { kind: 'guild-vault', container: 'container:g' as never, index: 0 }, accountOf), 'rule-violation', 'location');
  // Same account: a character's bank to the account vault to another of its characters is not a change of holder.
  const vaulted = moveItem(h, helmet, 3, { kind: 'account-vault', account: F.ACCOUNT as AccountId, index: 0 }, accountOf);
  assert.ok(vaulted.ok);
  assert.ok(moveItem(vaulted.value, helmet, 4, { kind: 'pack', owner: ALT, index: 0 }, accountOf).ok);
  // on-acquire binds on the first move into a character's hands.
  const r = inst({ ...F.recordInstance(), boundTo: null, location: { kind: 'account-vault', account: F.ACCOUNT, index: 0 } });
  const taken = moveItem(r, record, 0, { kind: 'pack', owner: PC, index: 2 }, accountOf);
  assert.ok(taken.ok);
  assert.equal(taken.value.boundTo, PC);
});

test('equipItem: owning is not wearing — the wearer needs the piece\'s rank, read from the server career level', () => {
  const helmet = def(F.helmetDef()), token = def(F.tokenDef());
  const h = inst({ ...F.helmetInstance(), location: { kind: 'pack', owner: F.PC, index: 0 } }); // won at Gladiator
  refused(equipItem(h, helmet, 3, PC, server(9)), 'rule-violation', 'tier'); // Legionary V
  const worn = equipItem(h, helmet, 3, PC, server(10)); // Gladiator I
  assert.ok(worn.ok);
  assert.deepEqual(worn.value.location, { kind: 'equipped', owner: PC, slot: 'head' });
  refused(equipItem(h, helmet, 3, PC, { source: 'device', careerLevel: 46 }), 'rule-violation', 'standing');
  refused(equipItem(h, helmet, 3, PC, { source: 'server', careerLevel: 51 }), 'out-of-range', 'standing.careerLevel'); // past MAX_LEVEL
  refused(equipItem(h, helmet, 3, PC, { source: 'server', careerLevel: 11.5 }), 'wrong-type', 'standing.careerLevel');
  refused(equipItem(h, helmet, 2, PC, server(10)), 'version-conflict', 'version');
  refused(equipItem(h, helmet, 3, OTHER, server(45)), 'rule-violation', 'location');
  // An upgraded piece needs the rank it now counts at: Gladiator + 2 levels = Champion.
  const up = { ...h, upgradeLevel: 2 };
  assert.equal(effectiveTier(up), 'Champion');
  refused(equipItem(up, helmet, 3, PC, server(19)), 'rule-violation', 'tier');
  assert.ok(equipItem(up, helmet, 3, PC, server(20)).ok);
  // A cosmetic has no rank requirement; on-equip binds it.
  const t = inst({ ...F.ironInstance(), item: 'item:ferry-token', quantity: 1, location: { kind: 'pack', owner: F.PC, index: 1 } });
  const crest = equipItem(t, token, 0, PC, { source: 'device', careerLevel: 1 });
  assert.ok(crest.ok);
  assert.equal(crest.value.boundTo, PC);
});

test('checkHistoryKept: provenance is never rewritten and history only grows', () => {
  const before = inst({ ...F.helmetInstance(), history: [{ kind: 'trade', trade: 'container:t1', from: F.OTHER_PC, to: F.PC, at: F.AT }] });
  const entry = { kind: 'upgrade' as const, smith: 'character:smith-orla' as never, level: 1, receipt: 'upgrade:req-0001', at: F.AT };
  assert.deepEqual(checkHistoryKept(before, { ...before, history: [...before.history, entry] }), []);
  has(checkHistoryKept(before, { ...before, history: [] }), 'rule-violation', 'history');
  has(checkHistoryKept(before, { ...before, history: [entry] }), 'rule-violation', 'history');
  has(checkHistoryKept(before, { ...before, provenance: { ...before.provenance, wonBy: OTHER } as never }), 'rule-violation', 'provenance');
});

test('checkCustody: one id, one mint, one occupant per place', () => {
  const a = inst(F.helmetInstance()), b = inst(F.ironInstance()), c = inst(F.recordInstance());
  assert.deepEqual(checkCustody([a, b, c]), []);
  has(checkCustody([a, { ...a, location: { kind: 'bank', owner: PC, index: 0 } }]), 'duplicate-id', '[1].id');
  has(checkCustody([a, { ...b, provenance: { ...b.provenance, mintKey: a.provenance.mintKey } }]), 'duplicate-id', '[1].provenance.mintKey');
  has(checkCustody([b, { ...c, location: b.location }]), 'rule-violation', '[1].location');
  has(checkCustody([a, { ...b, id: 'inst:other' as never, location: a.location }]), 'rule-violation', '[1].location');
  const escrow: Location = { kind: 'trade-escrow', container: 'container:t' as never, from: PC };
  assert.deepEqual(checkCustody([{ ...a, location: escrow }, { ...b, location: escrow }]), [], 'an escrow holds many offered items');
});

test('checkOneOfEach: one of each single-copy definition per player, bank, vault and open offers included', () => {
  const defs = new Map<ItemId, ItemDefinition>([[ 'item:loot.veteran.Helmet' as ItemId, def(F.helmetDef()) ], [ 'item:grave-iron' as ItemId, def(F.graveIronDef()) ]]);
  const lookup = (id: ItemId) => defs.get(id);
  const a = inst(F.helmetInstance());
  const second = (location: Location): ItemInstance => ({ ...a, id: 'inst:second' as never, location, provenance: { ...a.provenance, mintKey: 'claim:9999' } });
  assert.deepEqual(checkOneOfEach([a], lookup, accountOf), []);
  has(checkOneOfEach([a, second({ kind: 'bank', owner: PC, index: 0 })], lookup, accountOf), 'rule-violation', '[1]');
  has(checkOneOfEach([a, second({ kind: 'pack', owner: ALT, index: 0 })], lookup, accountOf), 'rule-violation', '[1]'); // same account
  has(checkOneOfEach([a, second({ kind: 'account-vault', account: F.ACCOUNT as AccountId, index: 0 })], lookup, accountOf), 'rule-violation', '[1]');
  has(checkOneOfEach([a, second({ kind: 'trade-escrow', container: 'container:t' as never, from: PC })], lookup, accountOf), 'rule-violation', '[1]');
  assert.deepEqual(checkOneOfEach([a, second({ kind: 'pack', owner: OTHER, index: 0 })], lookup, accountOf), [], 'two players may each hold one');
  const iron = inst(F.ironInstance());
  assert.deepEqual(checkOneOfEach([iron, { ...iron, id: 'inst:iron2' as never, location: { kind: 'pack', owner: PC, index: 5 } }], lookup, accountOf), [], 'stackables are exempt');
  has(checkOneOfEach([inst(F.recordInstance())], lookup, accountOf), 'unknown-id', '[0].item');
});

test('resolveLoadout: the fixed spine — a full Origin set lands exactly on the caps, and upgrades cannot pass them', () => {
  const defs = new Map<ItemId, ItemDefinition>();
  const instances: ItemInstance[] = [];
  const paperdoll: Record<string, string> = { Helmet: 'head', Body: 'chest', Arms: 'arms', Gloves: 'hands', Greaves: 'legs', Boots: 'feet' };
  const piece = (slot: string, i: number | string, tier: string, location: string, upgradeLevel?: number): void => {
    const id = `item:loot.veteran.${slot}` as ItemId;
    defs.set(id, def({ ...F.helmetDef(), id, slot, rarity: 'relic' }));
    instances.push(inst({
      ...F.helmetInstance(), id: `inst:set-${i}`, item: id, tier, ...(upgradeLevel === undefined ? {} : { upgradeLevel }), location: { kind: 'equipped', owner: F.PC, slot: location },
      provenance: pitProvenance({ mintKey: `claim:set-${i}`, lootId: `veteran.${slot}`, atRank: tier, fromLegend: `veteran-${['Recruit', 'Legionary', 'Gladiator', 'Veteran', 'Champion', 'Praetorian', 'Master', 'Primus', 'Invictus', 'Origin'].indexOf(tier) + 1}` }),
    }));
  };
  ARMOUR_SLOTS.filter((s) => paperdoll[s]).forEach((slot, i) => piece(slot, i, 'Origin', paperdoll[slot]!, 9));
  piece('Trident', 'w', 'Origin', 'main', 9);
  const full = resolveLoadout(PC, instances, (id) => defs.get(id));
  assert.ok(full.ok);
  assert.deepEqual(full.value, { attack: CAPS.attack, res: CAPS.res }, 'nine upgrade levels on an Origin set change nothing');
  const common = new Map([...defs].map(([id, d]) => [id, { ...d, rarity: 'common' as const }]));
  assert.deepEqual(resolveLoadout(PC, instances, (id) => common.get(id)), full, 'rarity is not power');
  assert.deepEqual(resolveLoadout(OTHER, instances, (id) => defs.get(id)), { ok: true, value: NAKED });
  // A Gladiator helmet resolves exactly as src/gear-stats.ts prices it today; +1 level prices it as a Veteran helmet; it clamps at Origin.
  const helmet = def(F.helmetDef()), h = inst(F.helmetInstance());
  assert.deepEqual(resolveLoadout(PC, [h], () => helmet), { ok: true, value: loadoutFor({ Helmet: 'Gladiator' }) });
  assert.deepEqual(resolveLoadout(PC, [{ ...h, upgradeLevel: 1 }], () => helmet), { ok: true, value: loadoutFor({ Helmet: 'Veteran' }) });
  assert.deepEqual(resolveLoadout(PC, [{ ...h, upgradeLevel: 9 }], () => helmet), { ok: true, value: loadoutFor({ Helmet: 'Origin' }) });
  assert.equal(piecePoints({ ...h, upgradeLevel: 7 }, helmet), piecePoints({ ...h, upgradeLevel: 9 }, helmet), 'Gladiator + 7 is already Origin');
  refused(resolveLoadout(PC, [h], () => undefined), 'unknown-id');
});

// ---- loot tables --------------------------------------------------------------------------------------------------------------------

test('loot table: fixtures parse', () => {
  for (const build of [F.bossLoot, F.ghoulLoot]) assert.ok(parseLootTable(build()).ok);
});

test('loot table: every rejection path', () => {
  const roll = (patch: Raw) => parseLootTable({ ...F.bossLoot(), rolls: [{ ...F.bossLoot().rolls[0], ...patch }] });
  const entry = (patch: Raw) => roll({ entries: [{ ...F.bossLoot().rolls[0]!.entries[0], ...patch }] });
  refused(parseLootTable({ ...F.bossLoot(), schemaVersion: 3 }), 'unsupported-version');
  refused(parseLootTable({ ...F.bossLoot(), distribution: 'shared' }), 'wrong-type', 'distribution');
  refused(parseLootTable({ ...F.bossLoot(), presentation: 'roll' }), 'wrong-type', 'presentation');
  refused(parseLootTable({ ...F.bossLoot(), rolls: [] }), 'out-of-range', 'rolls');
  refused(roll({ probability: 0 }), 'out-of-range', 'rolls[0].probability');
  refused(roll({ probability: 150 }), 'out-of-range', 'rolls[0].probability');
  refused(roll({ repeat: 0 }), 'out-of-range', 'rolls[0].repeat');
  refused(roll({ dropLimit: 0 }), 'rule-violation', 'rolls[0].dropLimit');
  refused(roll({ dropLimit: 1, minDrop: 2 }), 'rule-violation', 'rolls[0].minDrop');
  refused(roll({ mode: 'independent' }), 'rule-violation', 'rolls[0]');
  refused(roll({ entries: [] }), 'out-of-range', 'rolls[0].entries');
  refused(roll({ noDrop: -1 }), 'out-of-range', 'rolls[0].noDrop');
  refused(roll({ noDrop: 1.5 }), 'wrong-type', 'rolls[0].noDrop');
  refused(roll({ mode: 'independent', dropLimit: 0, minDrop: 0, noDrop: 10 }), 'rule-violation', 'rolls[0].noDrop');
  refused(roll({ entries: [F.bossLoot().rolls[0]!.entries[0], F.bossLoot().rolls[0]!.entries[0]] }), 'duplicate-id', 'rolls[0].entries[1]');
  refused(entry({ chance: 0 }), 'out-of-range', 'rolls[0].entries[0].chance');
  refused(entry({ chance: 101 }), 'out-of-range', 'rolls[0].entries[0].chance');
  refused(entry({ chance: 12.5 }), 'wrong-type', 'rolls[0].entries[0].chance');
  refused(entry({ item: 'faction:x' }), 'wrong-namespace', 'rolls[0].entries[0].item');
  refused(entry({ levelMin: 20, levelMax: 10 }), 'rule-violation', 'rolls[0].entries[0]');
  refused(entry({ levelMax: 51 }), 'out-of-range', 'rolls[0].entries[0].levelMax');
  refused(parseLootTable({ ...F.bossLoot(), currency: { min: 300, max: 200 } }), 'rule-violation', 'currency');
  refused(parseLootTable({ ...F.bossLoot(), currency: { min: -1, max: 200 } }), 'out-of-range', 'currency.min');
  refused(parseLootTable({ ...F.bossLoot(), fallback: { kind: 'gold', amount: 5 } }), 'wrong-type', 'fallback.kind');
  const { fallback: _f, ...noFallback } = F.bossLoot();
  void _f;
  refused(parseLootTable(noFallback), 'missing-field', 'fallback');
});

test('loot table: noDrop is an optional weight on a weighted roll; 0 is the same as absent', () => {
  const t = parseLootTable({ ...F.bossLoot(), rolls: [{ ...F.bossLoot().rolls[0], noDrop: 300 }] });
  assert.ok(t.ok); if (t.ok) assert.equal(t.value.rolls[0]!.noDrop, 300);
  const z = parseLootTable({ ...F.bossLoot(), rolls: [{ ...F.bossLoot().rolls[0], noDrop: 0 }] });
  assert.ok(z.ok); if (z.ok) assert.equal('noDrop' in z.value.rolls[0]!, false, 'a zero weight is not stored: the table reads as before');
});
