// Dom's trade ruling, 2026-10-07: no hard trade limit and no permanent binding of earned or shop gear; instead an escalating PER-ITEM
// cooldown. A fresh piece waits FIRST_TRADE_DELAY_S (72 h) after it was looted, minted or bought; after its 1st, 2nd and 3rd change of
// hands the new owner waits 7, 14 and 30 days, and 30 days after every later trade. The hop count is derived from history (never decays).
// Cash-shop items, metal, shop consumables and stackables never trade. Enforced by changeOffer and re-checked by settleTrade.
import assert from 'node:assert/strict';
import test from 'node:test';
import type { Result } from './core.ts';
import {
  COOLDOWN_SCOPE_PROVENANCE, COOLDOWN_SCOPE_RARITIES, COOLDOWN_STEPS_S, FIRST_TRADE_DELAY_S, changeOffer, cooldownScopeFor, cooldownSecondsFor,
  inCooldownScope, parseTrade, settleTrade, tradeCooldown, tradeHops, type Trade, type TradeCooldownScope,
} from './economy.ts';
import * as F from './fixtures.ts';
import type { AccountId, CharacterInstanceId, ItemId, ItemInstanceId } from './ids.ts';
import {
  PACK_SLOTS, checkHistoryKept, moveItem, parseItemDefinition, parseItemInstance, type HistoryEntry, type ItemDefinition, type ItemInstance,
} from './items.ts';

type Raw = Record<string, unknown>;
const must = <T>(r: Result<T>): T => { assert.ok(r.ok, JSON.stringify(!r.ok && r.issues)); return r.value; };
const refused = (r: Result<unknown>, code: string, path?: string, text?: string): void => {
  assert.equal(r.ok, false, `expected ${code}${path ? ` at ${path}` : ''}`);
  if (r.ok) return;
  assert.ok(
    r.issues.some((i) => i.code === code && (path === undefined || i.path === path) && (text === undefined || i.message.includes(text))),
    `want ${code}${path ? ` at ${path}` : ''}${text ? ` saying "${text}"` : ''}; got ${JSON.stringify(r.issues)}`,
  );
};

const S = 1000, H = 3600 * S, D = 24 * H;
const T0 = Date.parse(F.AT); // every fixture piece was minted at F.AT
const iso = (ms: number): string => new Date(ms).toISOString();
const PC = F.PC as CharacterInstanceId, OTHER = F.OTHER_PC as CharacterInstanceId;
const ACCOUNTS: Record<string, AccountId> = { [F.PC]: F.ACCOUNT as AccountId, [F.OTHER_PC]: F.OTHER_ACCOUNT as AccountId };
const accountOf = (pc: CharacterInstanceId): AccountId | undefined => ACCOUNTS[pc];
const packs = (): number => PACK_SLOTS;
const ids = (...xs: string[]): ItemInstanceId[] => xs as ItemInstanceId[];

// Definitions: today's Pit helmet, a looted cosmetic, a stackable material, a story-critical record, and three shop wares.
const shopCapDef = { ...F.helmetDef(), id: 'item:shop.iron-cap', name: 'Iron cap', appearance: { asset: 'items/iron-cap.glb' } };
const whetstoneDef = { ...F.graveIronDef(), id: 'item:shop.whetstone', name: 'Whetstone', stack: 1 }; // single-copy, not gear
const tonicDef = { ...F.graveIronDef(), id: 'item:shop.tonic', name: 'Tonic', stack: 20 }; // a stackable consumable
const crestDef = { ...F.tokenDef(), id: 'item:cash.ember-crest', name: 'Ember crest', story: 'none', binding: 'none' };
const DEFS = new Map<ItemId, ItemDefinition>(
  [F.helmetDef(), F.tokenDef(), F.graveIronDef(), F.recordDef(), shopCapDef, whetstoneDef, tonicDef, crestDef].map((raw) => {
    const d = must(parseItemDefinition(raw));
    return [d.id, d];
  }),
);
const lookup = (id: ItemId): ItemDefinition | undefined => DEFS.get(id);
const defOf = (inst: ItemInstance): ItemDefinition => DEFS.get(inst.item)!;

const helmet = (patch: Raw = {}): ItemInstance => must(parseItemInstance({ ...F.helmetInstance(), location: { kind: 'pack', owner: F.PC, index: 0 }, ...patch }));
const SHOP_PROV = { kind: 'shop', mintKey: 'shop:armourer:0001', at: F.AT, boughtBy: F.PC, shop: 'service:armourer-vell' };
const CASH_PROV = { kind: 'cash-shop', mintKey: 'cash:order-0001', at: F.AT, account: F.ACCOUNT, sku: 'ember-crest' };
const ware = (item: string, provenance: Raw, patch: Raw = {}): ItemInstance =>
  must(parseItemInstance({ ...F.ironInstance(), id: 'inst:ware-1', item, quantity: 1, tier: item === shopCapDef.id ? 'Recruit' : null, location: { kind: 'pack', owner: F.PC, index: 1 }, provenance, ...patch }));
// The k-th trade entry; `toPC` says which way it went (the piece's current holder is the last entry's `to`).
const tradeEntry = (k: number, at: number, toPC = k % 2 === 1): HistoryEntry =>
  ({ kind: 'trade', trade: `container:trade.${k}` as never, from: toPC ? OTHER : PC, to: toPC ? PC : OTHER, at: iso(at) });
const upgradeEntry = (level: number, at: number): HistoryEntry => ({ kind: 'upgrade', smith: 'character:smith-orla' as never, level, receipt: `upgrade:req-${String(level).padStart(4, '0')}`, at: iso(at) });
// A helmet that has changed hands `hops` times, the last at `last`, earlier ones a day apart before it.
const traded = (hops: number, last: number, extra: HistoryEntry[] = []): ItemInstance => {
  const history = Array.from({ length: hops }, (_, k) => tradeEntry(k, last - (hops - 1 - k) * D, (hops - 1 - k) % 2 === 0)); // ends with PC holding it
  return { ...helmet(), history: [...history, ...extra] };
};

test('trade cooldown: the constants are data, in one place, read-only', () => {
  assert.equal(FIRST_TRADE_DELAY_S, 72 * 3600);
  assert.deepEqual([...COOLDOWN_STEPS_S], [7 * 86_400, 14 * 86_400, 30 * 86_400]);
  assert.ok(Object.isFrozen(COOLDOWN_STEPS_S));
  assert.throws(() => { (COOLDOWN_STEPS_S as number[])[0] = 1; });
  assert.throws(() => { (COOLDOWN_STEPS_S as number[]).push(1); });
});

test('trade cooldown: a fresh piece (looted, Pit-won or bought) is refused before 72 h and allowed from 72 h', () => {
  const fresh = [helmet(), ware(shopCapDef.id, SHOP_PROV), must(parseItemInstance({ ...F.ironInstance(), id: 'inst:tok-1', item: 'item:ferry-token', quantity: 1 }))];
  for (const inst of fresh) {
    const before = tradeCooldown(inst, defOf(inst), T0 + 72 * H - 1);
    assert.deepEqual(before, { tradeable: false, until: T0 + 72 * H, hops: 0, reason: 'cooling' }, inst.id);
    assert.deepEqual(tradeCooldown(inst, defOf(inst), T0 + 72 * H), { tradeable: true, until: T0 + 72 * H, hops: 0, reason: 'ok' }, inst.id);
    assert.equal(tradeCooldown(inst, defOf(inst), T0 + 400 * D).tradeable, true);
  }
});

test('trade cooldown: after hop 1/2/3/4 the new owner waits 7/14/30/30 days (capped at 30 forever)', () => {
  const last = T0 + 100 * D;
  const want = [7, 14, 30, 30, 30, 30];
  want.forEach((days, k) => {
    const hops = k + 1, inst = traded(hops, last);
    assert.equal(tradeHops(inst), hops);
    assert.equal(cooldownSecondsFor(hops), days * 86_400);
    assert.deepEqual(tradeCooldown(inst, defOf(inst), last + days * D - 1), { tradeable: false, until: last + days * D, hops, reason: 'cooling' }, `hop ${hops}`);
    assert.equal(tradeCooldown(inst, defOf(inst), last + days * D).tradeable, true, `hop ${hops}`);
  });
  assert.equal(cooldownSecondsFor(0), FIRST_TRADE_DELAY_S);
  assert.equal(cooldownSecondsFor(1000), 30 * 86_400);
});

test('trade cooldown: the hop count comes from history and survives version bumps, upgrades, moves and splits', () => {
  const last = T0 + 50 * D;
  // Two trades with upgrades between and after: hops 2, and the clock runs from the last TRADE (an upgrade never restarts it).
  const inst: ItemInstance = { ...traded(2, last, [upgradeEntry(1, last + D), upgradeEntry(2, last + 2 * D)]), version: 17, upgradeLevel: 2 };
  const cd = tradeCooldown(inst, defOf(inst), last + 3 * D);
  assert.deepEqual(cd, { tradeable: false, until: last + 14 * D, hops: 2, reason: 'cooling' });
  // A move within its holder bumps the version; nothing about the cooldown changes.
  const moved = must(moveItem(inst, defOf(inst), 17, { kind: 'bank', owner: PC, index: 9 }, accountOf));
  assert.equal(moved.version, 18);
  assert.deepEqual(tradeCooldown(moved, defOf(moved), last + 3 * D), cd);
  // A split copies history, so the child carries the same hops (and a stack never trades either way).
  const stack: ItemInstance = { ...must(parseItemInstance(F.ironInstance())), history: [tradeEntry(0, last)] };
  const child: ItemInstance = { ...stack, id: 'inst:split-1' as ItemInstanceId, quantity: 4, version: 0 };
  assert.deepEqual([tradeHops(stack), tradeHops(child)], [1, 1]);
  assert.deepEqual(tradeCooldown(child, defOf(child), last + 400 * D), { tradeable: false, until: null, hops: 1, reason: 'stackable' });
});

test('trade cooldown: cash-shop items, metal, shop consumables and stackables never trade', () => {
  const later = T0 + 1000 * D;
  const never: [ItemInstance, string][] = [
    [ware(crestDef.id, CASH_PROV), 'cash-shop'],
    [ware(tonicDef.id, SHOP_PROV, { quantity: 5 }), 'stackable'],
    [ware(whetstoneDef.id, SHOP_PROV), 'shop-not-gear'],
    [must(parseItemInstance(F.ironInstance())), 'stackable'],
    [must(parseItemInstance({ ...F.recordInstance(), boundTo: null })), 'story-critical'],
    [must(parseItemInstance(F.recordInstance())), 'bound'],
    [helmet({ boundTo: F.PC }), 'bound'],
  ];
  for (const [inst, reason] of never) {
    assert.deepEqual(tradeCooldown(inst, defOf(inst), later), { tradeable: false, until: null, hops: 0, reason }, `${inst.item}`);
  }
  // The same crest looted rather than bought for cash would trade: the cash-shop origin is what blocks it.
  assert.equal(tradeCooldown(ware(crestDef.id, { ...F.ironInstance().provenance }), DEFS.get(crestDef.id as ItemId)!, later).tradeable, true);
  // Metal is an account balance, not an item: the Trade contract has no field that could carry it, on the trade or on a side.
  const raw = {
    kind: 'trade', schemaVersion: 1, id: 'container:trade.9', region: 'region:concord-exchange', version: 0,
    sides: [{ character: F.PC, account: F.ACCOUNT, offered: ['inst:h'], accepted: false }, { character: F.OTHER_PC, account: F.OTHER_ACCOUNT, offered: [], accepted: false }],
  };
  must(parseTrade(raw));
  refused(parseTrade({ ...raw, metal: 50 }), 'unknown-field', 'metal');
  refused(parseTrade({ ...raw, sides: [{ ...raw.sides[0], metal: 50 }, raw.sides[1]] }), 'unknown-field', 'sides[0].metal');
  // A wrong definition or an unreadable clock fails closed.
  assert.equal(tradeCooldown(helmet(), DEFS.get('item:ferry-token' as ItemId)!, later).reason, 'wrong-definition');
  assert.deepEqual(tradeCooldown(helmet(), defOf(helmet()), Number.NaN), { tradeable: false, until: null, hops: 0, reason: 'bad-clock' });
});

test('trade cooldown: shop gear trades under the same cooldown and keeps its origin "shop" through the trade', () => {
  const cap = ware(shopCapDef.id, SHOP_PROV, { id: 'inst:cap-1', location: { kind: 'trade-escrow', container: 'container:trade.5', from: F.PC } });
  assert.equal(tradeCooldown(cap, defOf(cap), T0 + 71 * H).reason, 'cooling');
  const t = gift(['inst:cap-1'], 'container:trade.5');
  const at = T0 + 72 * H;
  const [out] = must(settleTrade(t, [cap], lookup, accountOf, iso(at), packs));
  assert.deepEqual(out!.provenance, cap.provenance);
  assert.equal(out!.provenance.kind, 'shop');
  assert.deepEqual(checkHistoryKept(cap, out!), []);
  assert.deepEqual(tradeCooldown(out!, defOf(out!), at), { tradeable: false, until: at + 7 * D, hops: 1, reason: 'cooling' });
});

// PC gives `offered` to OTHER at the Exchange, both accepted.
const gift = (offered: string[], id = 'container:trade.1'): Trade => must(parseTrade({
  kind: 'trade', schemaVersion: 1, id, region: 'region:concord-exchange', version: 4,
  sides: [{ character: F.PC, account: F.ACCOUNT, offered, accepted: true }, { character: F.OTHER_PC, account: F.OTHER_ACCOUNT, offered: [], accepted: true }],
}));
const escrowed = (inst: ItemInstance, container = 'container:trade.1'): ItemInstance => ({ ...inst, location: { kind: 'trade-escrow', container: container as never, from: PC } });

test('changeOffer refuses a piece still cooling down, with the time it trades again; it is accepted once the cooldown ends', () => {
  const g = gift(['inst:h']), open: Trade = { ...g, sides: [{ ...g.sides[0], offered: [], accepted: false }, { ...g.sides[1], accepted: false }] };
  const h = helmet({ id: 'inst:h' });
  const until = T0 + 72 * H;
  const r = changeOffer(open, PC, ['inst:h' as ItemInstanceId], 4, [h], lookup, iso(until - S));
  refused(r, 'rule-violation', 'offered[0].cooldown', `tradeable again at ${iso(until)}`);
  const ok = must(changeOffer(open, PC, ['inst:h' as ItemInstanceId], 4, [h], lookup, iso(until)));
  assert.deepEqual([ok.version, ok.sides[0].offered], [5, ['inst:h']]);
  // A traded piece: the message names its hop count and the new owner's wait.
  const last = T0 + 10 * D, twice = { ...traded(2, last), id: 'inst:h' as ItemInstanceId };
  refused(changeOffer(open, PC, ['inst:h' as ItemInstanceId], 4, [twice], lookup, iso(last + 13 * D)), 'rule-violation', 'offered[0].cooldown', `after 2 trades: tradeable again at ${iso(last + 14 * D)}`);
  // Never-tradeable pieces and unknown ids are refused at their own index, and a refusal changes nothing.
  const iron = must(parseItemInstance({ ...F.ironInstance(), id: 'inst:iron' }));
  refused(changeOffer(open, PC, ids('inst:h', 'inst:iron'), 4, [h, iron], lookup, iso(until)), 'rule-violation', 'offered[1]', 'stackable');
  refused(changeOffer(open, PC, ids('inst:ghost'), 4, [h], lookup, iso(until)), 'unknown-id', 'offered[0]');
  refused(changeOffer(open, PC, ids('inst:h'), 4, [h], lookup, 'not a time'), 'rule-violation', 'offered[0]', 'no readable trade clock');
  assert.equal(open.version, 4);
});

test('settleTrade re-checks the cooldown at settle time and moves nothing when a piece is still cooling', () => {
  const h = escrowed(helmet({ id: 'inst:h' }));
  refused(settleTrade(gift(['inst:h']), [h], lookup, accountOf, iso(T0 + 71 * H), packs), 'rule-violation', 'sides[0].offered[0].cooldown', `tradeable again at ${iso(T0 + 72 * H)}`);
  // A once-traded piece: refused one second before the 7-day mark, settles at it, and the receiver then waits 14 days.
  const last = T0 + 20 * D, once = escrowed({ ...traded(1, last), id: 'inst:h' as ItemInstanceId });
  refused(settleTrade(gift(['inst:h']), [once], lookup, accountOf, iso(last + 7 * D - S), packs), 'rule-violation', 'sides[0].offered[0].cooldown');
  const [out] = must(settleTrade(gift(['inst:h']), [once], lookup, accountOf, iso(last + 7 * D), packs));
  assert.deepEqual(tradeCooldown(out!, defOf(out!), last + 7 * D), { tradeable: false, until: last + 21 * D, hops: 2, reason: 'cooling' });
  // Never-tradeable pieces are refused at settle too, even if an offer was built around changeOffer.
  const cash = escrowed(ware(crestDef.id, CASH_PROV, { id: 'inst:h' }));
  refused(settleTrade(gift(['inst:h']), [cash], lookup, accountOf, iso(T0 + 400 * D), packs), 'rule-violation', 'sides[0].offered[0]', 'cash shop');
});

function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

test('[property] 500 random hop sequences: the until-time only grows, each wait is the step for its hop, capped at 30 days', () => {
  const CAP = COOLDOWN_STEPS_S.at(-1)! * S;
  for (let seq = 0; seq < 500; seq++) {
    const rand = mulberry32(0xc001 + seq);
    let inst: ItemInstance = helmet({ provenance: { ...F.helmetInstance().provenance, at: iso(T0 + Math.floor(rand() * 365) * D) } });
    const def = defOf(inst);
    let prevUntil = -Infinity, prevWait = 0;
    const hopsTotal = 1 + Math.floor(rand() * 12);
    for (let hop = 0; hop <= hopsTotal; hop++) {
      const cd = tradeCooldown(inst, def, 0);
      assert.equal(cd.hops, hop);
      const since = hop === 0 ? Date.parse(inst.provenance.at) : Date.parse((inst.history.filter((e) => e.kind === 'trade').at(-1)!).at);
      const wait = cd.until! - since;
      assert.equal(wait, cooldownSecondsFor(hop) * S, `seq ${seq} hop ${hop}`);
      assert.ok(wait <= CAP, 'capped');
      assert.ok(wait >= prevWait, 'each wait is at least the last one');
      assert.ok(cd.until! > prevUntil, 'until only grows');
      // Tradeable exactly from `until`, and stays tradeable as time passes with no new trade.
      const probe = cd.until! + Math.floor((rand() - 0.5) * 4 * D);
      assert.equal(tradeCooldown(inst, def, probe).tradeable, probe >= cd.until!);
      assert.equal(tradeCooldown(inst, def, cd.until! + Math.floor(rand() * 1000) * D).tradeable, true);
      // An upgrade at any time never moves the clock.
      if (rand() < 0.3) {
        const level = Math.min(9, (inst.upgradeLevel ?? 0) + 1);
        inst = { ...inst, upgradeLevel: level, version: inst.version + 1, history: [...inst.history, upgradeEntry(level, cd.until! - Math.floor(rand() * D))] };
        assert.equal(tradeCooldown(inst, def, 0).until, cd.until);
      }
      prevUntil = cd.until!;
      prevWait = wait;
      // The next legal trade lands at or after `until`.
      const before = inst;
      inst = { ...inst, version: inst.version + 1, history: [...inst.history, tradeEntry(hop, cd.until! + Math.floor(rand() * 60) * D)] };
      assert.deepEqual(checkHistoryKept(before, inst), []);
    }
  }
});

// ---- Cooldown scope (Strategy, 2026-10-08; trading.md D5, launch gate G3): rare-and-up gear or a Pit piece, as 0005's trade_cooldown_scope.
const rareDef = { ...F.helmetDef(), id: 'item:gear.rare-helm', name: 'Rare helm', rarity: 'rare' };
const relicDef = { ...F.helmetDef(), id: 'item:gear.relic-helm', name: 'Relic helm', rarity: 'relic' };
const fineDef = { ...F.helmetDef(), id: 'item:gear.fine-helm', name: 'Fine helm', rarity: 'fine' };
const SCOPE_DEFS = new Map<ItemId, ItemDefinition>([...DEFS, ...[rareDef, relicDef, fineDef].map((raw) => {
  const d = must(parseItemDefinition(raw));
  return [d.id, d] as const;
})]);
const LOOT_PROV = { ...F.ironInstance().provenance };
const LEGACY_PROV = { kind: 'legacy-unlock', mintKey: 'legacy:dom-1:veteran.Helmet', at: F.AT, account: F.ACCOUNT, lootId: 'veteran.Helmet', wonBy: F.PC, fromLegend: null, atRank: null };
// A fresh (hop 0, minted at T0) single-copy gear piece of `item` with `provenance`; built directly, the cooldown reads only item, provenance and history.
const piece = (item: string, provenance: Raw, id = 'inst:p'): ItemInstance =>
  ({ ...helmet(), id: id as ItemInstanceId, item: item as ItemId, provenance: provenance as never, location: { kind: 'pack', owner: PC, index: 2 } });
// The value the DB row must hold for this content: 0005 ships `items` generated from content (gate G6) and these two provenance kinds.
const SCOPE: TradeCooldownScope = cooldownScopeFor(SCOPE_DEFS.values());
const fresh = T0 + 1 * H; // well inside the 72 h first-trade delay

test('cooldown scope: the constants are data and the generated scope is rare and relic GEAR ids plus the two Pit provenance kinds', () => {
  assert.deepEqual([...COOLDOWN_SCOPE_RARITIES], ['rare', 'relic']);
  assert.deepEqual([...COOLDOWN_SCOPE_PROVENANCE], ['arena-award', 'legacy-unlock']);
  assert.ok(Object.isFrozen(COOLDOWN_SCOPE_RARITIES) && Object.isFrozen(COOLDOWN_SCOPE_PROVENANCE));
  // The rare cosmetic token and the relic quest record are not gear, so they are not listed; common and fine gear is not listed.
  assert.deepEqual(SCOPE, { items: ['item:gear.rare-helm', 'item:gear.relic-helm'], provenance: ['arena-award', 'legacy-unlock'] });
});

test('cooldown scope: a common or fine non-Pit piece is out of scope and trades at once; rare and relic gear is cooled', () => {
  for (const [item, prov] of [[F.helmetDef().id, LOOT_PROV], [fineDef.id, LOOT_PROV], [shopCapDef.id, SHOP_PROV]] as const) {
    const p = piece(item, prov);
    assert.equal(inCooldownScope(p, SCOPE), false, item);
    assert.deepEqual(tradeCooldown(p, SCOPE_DEFS.get(p.item)!, fresh, SCOPE), { tradeable: true, until: null, hops: 0, reason: 'ok' }, item);
    // Out of scope means no cooldown after a trade either: the hop count still grows, the wait does not.
    const after = { ...p, history: [tradeEntry(0, fresh)] };
    assert.deepEqual(tradeCooldown(after, SCOPE_DEFS.get(p.item)!, fresh, SCOPE), { tradeable: true, until: null, hops: 1, reason: 'ok' }, item);
  }
  for (const item of [rareDef.id, relicDef.id]) {
    const p = piece(item, LOOT_PROV), def = SCOPE_DEFS.get(p.item)!;
    assert.equal(inCooldownScope(p, SCOPE), true, item);
    assert.deepEqual(tradeCooldown(p, def, fresh, SCOPE), { tradeable: false, until: T0 + 72 * H, hops: 0, reason: 'cooling' }, item);
    assert.equal(tradeCooldown(p, def, T0 + 72 * H, SCOPE).tradeable, true, item);
    // The cooldown numbers are unchanged in scope: 7 days after the first trade.
    assert.deepEqual(tradeCooldown({ ...p, history: [tradeEntry(0, fresh)] }, def, fresh, SCOPE), { tradeable: false, until: fresh + 7 * D, hops: 1, reason: 'cooling' }, item);
  }
});

test('cooldown scope: an arena-award or legacy-unlock piece is in scope at any rarity', () => {
  for (const item of [F.helmetDef().id, fineDef.id, rareDef.id, relicDef.id]) {
    for (const prov of [F.helmetInstance().provenance, LEGACY_PROV]) {
      const p = piece(item, prov);
      assert.equal(inCooldownScope(p, SCOPE), true, `${item} ${prov.kind}`);
      assert.equal(tradeCooldown(p, SCOPE_DEFS.get(p.item)!, fresh, SCOPE).reason, 'cooling', `${item} ${prov.kind}`);
    }
  }
});

test('cooldown scope: no scope, or a scope missing either list, cools every piece (fail closed, as 0005 with no row)', () => {
  const common = piece(F.helmetDef().id, LOOT_PROV), def = SCOPE_DEFS.get(common.item)!;
  for (const scope of [null, undefined, { provenance: ['arena-award'] }, { items: [] }, {}] as unknown as (TradeCooldownScope | null)[]) {
    assert.equal(inCooldownScope(common, scope), true, JSON.stringify(scope));
    assert.deepEqual(tradeCooldown(common, def, fresh, scope), { tradeable: false, until: T0 + 72 * H, hops: 0, reason: 'cooling' }, JSON.stringify(scope));
  }
  assert.equal(tradeCooldown(common, def, fresh).reason, 'cooling', 'the default is no scope');
  // An empty scope (both lists present, both empty) cools nothing, exactly as the DB.
  assert.equal(inCooldownScope(common, { items: [], provenance: [] }), false);
});

test('cooldown scope: never-tradeable pieces stay refused out of scope, and a bad clock still fails closed', () => {
  const iron = must(parseItemInstance({ ...F.ironInstance(), id: 'inst:iron' }));
  assert.equal(tradeCooldown(iron, SCOPE_DEFS.get(iron.item)!, fresh, SCOPE).reason, 'stackable');
  const cash = ware(crestDef.id, CASH_PROV);
  assert.equal(tradeCooldown(cash, SCOPE_DEFS.get(cash.item)!, fresh, SCOPE).reason, 'cash-shop');
  const bound = { ...piece(F.helmetDef().id, LOOT_PROV), boundTo: PC };
  assert.equal(tradeCooldown(bound, SCOPE_DEFS.get(bound.item)!, fresh, SCOPE).reason, 'bound');
  const common = piece(F.helmetDef().id, LOOT_PROV);
  assert.equal(tradeCooldown(common, SCOPE_DEFS.get(common.item)!, Number.NaN, SCOPE).reason, 'bad-clock');
});

test('cooldown scope: changeOffer and settleTrade honour it', () => {
  const scopeLookup = (id: ItemId): ItemDefinition | undefined => SCOPE_DEFS.get(id);
  const g = gift(['inst:c']), open: Trade = { ...g, sides: [{ ...g.sides[0], offered: [], accepted: false }, { ...g.sides[1], accepted: false }] };
  const common = piece(F.helmetDef().id, LOOT_PROV, 'inst:c'), rare = piece(rareDef.id, LOOT_PROV, 'inst:r'), pit = piece(fineDef.id, F.helmetInstance().provenance, 'inst:pit');
  const now = iso(fresh);
  // changeOffer: the fresh common piece is offered at once; the fresh rare and Pit pieces are cooling; with no scope the common one cools too.
  assert.deepEqual(must(changeOffer(open, PC, ids('inst:c'), 4, [common], scopeLookup, now, SCOPE)).sides[0].offered, ['inst:c']);
  refused(changeOffer(open, PC, ids('inst:c', 'inst:r'), 4, [common, rare], scopeLookup, now, SCOPE), 'rule-violation', 'offered[1].cooldown', `tradeable again at ${iso(T0 + 72 * H)}`);
  refused(changeOffer(open, PC, ids('inst:pit'), 4, [pit], scopeLookup, now, SCOPE), 'rule-violation', 'offered[0].cooldown');
  refused(changeOffer(open, PC, ids('inst:c'), 4, [common], scopeLookup, now), 'rule-violation', 'offered[0].cooldown');
  // settleTrade: the same answers at settle.
  const [out] = must(settleTrade(gift(['inst:c']), [escrowed(common)], scopeLookup, accountOf, now, packs, SCOPE));
  assert.equal(tradeHops(out!), 1);
  assert.equal(tradeCooldown(out!, SCOPE_DEFS.get(out!.item)!, fresh, SCOPE).tradeable, true, 'out of scope: the new owner may offer it at once');
  refused(settleTrade(gift(['inst:r']), [escrowed(rare)], scopeLookup, accountOf, now, packs, SCOPE), 'rule-violation', 'sides[0].offered[0].cooldown');
  refused(settleTrade(gift(['inst:pit']), [escrowed(pit)], scopeLookup, accountOf, now, packs, SCOPE), 'rule-violation', 'sides[0].offered[0].cooldown');
  refused(settleTrade(gift(['inst:c']), [escrowed(common)], scopeLookup, accountOf, now, packs), 'rule-violation', 'sides[0].offered[0].cooldown');
});
