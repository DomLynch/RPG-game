// Origins Zone 1 (the Ash Frontier) encounter logic: fight setup, fight outcome, seeded loot, loot into the backpack, world-mob damage
// rolls. Pure: no DOM, no clock, no storage, no Math.random. Every failure is a contracts Result issue, never a throw. Nothing in src/
// imports this folder; it reads src/ only for the roster bodies' health (src/moves.ts) and the rank titles, as origins/region1 does.
//
// Spec: docs/specs/origins/region1-ash-frontier.md §3 (Bounties), §4 (bosses, creatures, boss rules), §5 (loot), §7 (rulings 3, 4, 6,
// 9, 10). Data: origins/region1 (content.ts + the loader). Loot roll semantics: docs/specs/origins/eqemu-loot.md §5 (clean-room
// behaviour spec; no donor code was read). The twist outcome mirrors Combat's src/twist.ts (PR #1626, branch combat/twist-flags),
// which is not on trunk yet and is therefore not imported.
import { Issues, fail, ok, type Issue, type Result } from '../contracts/core.ts';
import type { CharacterId, CharacterInstanceId, EncounterId, ItemId, ItemInstanceId, LootTableId } from '../contracts/ids.ts';
import { parseItemInstance, type LootTable } from '../contracts/items.ts';
import { sha256, shortHash } from '../boss/hash.ts';
import { receive, type Inventory, type Lookup } from '../inventory/inventory.ts';
import { hitDamage, seededSource, type DamageRoll, type FightKind, type LuckFlags } from '../luck/luck.ts';
import { HAZARDS, TWISTS, loadRegion1, type Local, type Region1, type Twist, type TwistKind } from '../region1/load.ts';
import { DUMMY_STAGE, LOCAL } from '../region1/content.ts';
import { OPPONENTS, opponentAt } from '../../src/moves.ts';
import { TIERS, type Tier } from '../../src/grades.ts';
import type { OpponentId } from '../../src/roster.ts';

// ---- the twist flags Combat reads (mirror of src/twist.ts, PR #1626) ----------------------------------------------------------------
// MIRROR of src/twist.ts `TwistFlag` / `TwistOutcome` (combat/twist-flags, 067bfa32). Replace with an import once #1626 is on trunk.
export type TwistFlag = { kind: 'flee-at'; percent: number; catchSeconds?: number } | { kind: 'one-health-bar' };
export type TwistOutcome = 'fled' | 'caught' | 'escaped';   // src/twist.ts `twist.outcome`, null when no twist ended the fight
// MIRROR of src/twist.ts `oneBarHealth`: with the flag, the foes' healths summed into one bar; without it, the first foe's own bar.
export const oneBarHealth = (flags: readonly TwistFlag[], healths: readonly number[]): number =>
  flags.some(f => f.kind === 'one-health-bar') ? healths.reduce((a, b) => a + b, 0) : healths[0];
// The flags Combat's v1 sim reads. The other Origins flags (hazard, no-block, ...) travel in `flags` for the view and later sims.
const COMBAT_KINDS: readonly TwistKind[] = ['flee-at', 'one-health-bar'];

// ---- content --------------------------------------------------------------------------------------------------------------------

// The loaded Region 1 data plus the local rule tables the loader checked (kill rows, boss loot rules, creature tables).
export type EncounterContent = { region: Region1; local: Local };
export function loadEncounterContent(): Result<EncounterContent> {
  const r = loadRegion1();
  return r.ok ? ok({ region: r.value, local: LOCAL }) : r;
}
export const lookupOf = (content: EncounterContent): Lookup => (id: ItemId) => content.region.registry.items.get(id);

// Gear won in Region 1 records this tier. PROPOSED (region1 §5 "Tier", open question 5): the zone's difficulty.lootTier 3 read as
// the third rank title, Gladiator. The test pins it to the Frontier zones' lootTier.
export const REGION1_LOOT_TIER: Tier = 'Gladiator';
export const tierOfLootTier = (lootTier: number): Tier | undefined => TIERS[lootTier - 1];

// ---- 1. fight setup -------------------------------------------------------------------------------------------------------------

// A fight is an encounter (a Bounty, the public boss, the rift) or a plain open-world creature kill (a character with a creature table).
export type FightId = EncounterId | CharacterId;
export type Foe = { character: CharacterId; body: OpponentId; level: number; health: number };
export type FightSetup = {
  fight: FightId;
  kind: FightKind;                 // 'world-mob' for every Region 1 fight: there is no Pit in Region 1 (luck ruling, 2026-10-07)
  scope: 'solo' | 'party' | 'public' | 'open-world';
  foes: Foe[];                     // in fight order: each stage's foe once per kill it needs, then the boss
  opponent: Foe;                   // the boss; for one-health-bar its health is the summed bar (oneBarHealth over `foes`)
  bar: number;                     // the health bar Combat sets up
  flags: Twist[];                  // every Origins twist flag on this fight (ENCOUNTER_FLAGS, then any overlay)
  combatFlags: TwistFlag[];        // the subset src/twist.ts v1 reads
  seedKey: string;                 // the seed input: fightSeed(seedKey, character, attempt) is the fight's seed
};
// An overlay is a twist the content does not carry on the encounter itself: a grudge's rolled twist (feuds.md §3.1 `grudge-twist`,
// whose flee-at params are `{ percent }` only, so no catch window). It is checked like a content flag, catchSeconds optional.
export type SetupOptions = { overlay?: readonly unknown[] };

const bodyHealth = (body: OpponentId, level: number): number | undefined => {
  const o = OPPONENTS[body];
  return o ? opponentAt(o, level).health : undefined;
};

export function fightSetup(id: unknown, content: EncounterContent, opts: SetupOptions = {}): Result<FightSetup> {
  if (typeof id !== 'string') return fail('wrong-type', 'fight', 'a fight id is an encounter: or character: id');
  const { registry, flags: contentFlags } = content.region;
  const issues = new Issues();
  const foeOf = (character: CharacterId, encounter: EncounterId | null, path: string, level?: number, health?: number): Foe | undefined => {
    const c = registry.characters.get(character);
    if (!c) { issues.add('unknown-id', path, `${character} is not a character in Region 1`); return undefined; }
    const form = c.encounterForms.find((f) => f.encounter === encounter);
    const body = form?.opponent ?? null, lvl = level ?? form?.level ?? null;
    if (!form || body === null || lvl === null) { issues.add('missing-field', path, `${character} has no duel form for ${encounter ?? 'the open world'}`); return undefined; }
    const hp = health ?? bodyHealth(body, lvl);
    if (hp === undefined) { issues.add('unknown-id', path, `no roster body "${body}" for ${character}`); return undefined; }
    return { character, body, level: lvl, health: hp };
  };

  let foes: Foe[] = [], scope: FightSetup['scope'], base: Twist[] = [];
  const e = registry.encounters.get(id as EncounterId);
  if (e) {
    scope = e.scope;
    e.stages.forEach((s, i) => {
      if (s.id === DUMMY_STAGE) return;   // a single-foe Bounty's placeholder stage (region1 §7 open 1b): the boss himself, not a second foe
      const first = s.roster[0]?.character;   // a Region 1 stage has one roster entry; a weighted roster would need a seeded pick
      const f = first && foeOf(first, e.id, `${e.id}.stages[${i}]`);
      if (f) for (let k = 0; k < s.killsToAdvance; k++) foes.push(f);
    });
    const boss = foeOf(e.boss.character, e.id, `${e.id}.boss`, e.boss.level, e.boss.health);
    if (boss) foes.push(boss);
    base = [...(contentFlags.get(e.id) ?? [])];
  } else if (Object.hasOwn(content.local.creatureLoot, id)) {
    scope = 'open-world';
    const f = foeOf(id as CharacterId, openWorldForm(content, id as CharacterId), id);
    if (f) foes = [f];
  } else {
    return fail('unknown-id', 'fight', `${id} is no Region 1 encounter or open-world creature`);
  }
  const overlay = readOverlay(issues, opts.overlay ?? [], base);
  if (!issues.empty) return issues.finish(undefined as never);
  const flags = [...base, ...overlay];
  const combatFlags = flags.filter((f) => COMBAT_KINDS.includes(f.kind)).map(toCombatFlag);
  const boss = foes[foes.length - 1]!;
  const bar = combatFlags.some((f) => f.kind === 'one-health-bar') ? oneBarHealth(combatFlags, foes.map((f) => f.health)) : boss.health;
  return ok({ fight: id as FightId, kind: 'world-mob', scope, foes, opponent: { ...boss, health: bar }, bar, flags, combatFlags, seedKey: `origins:${id}` });
}
// The form an open-world kill fights on: the one with no encounter, else (the mere brood, whose only form is the matriarch's guard) the
// first form's body and level.
const openWorldForm = (content: EncounterContent, c: CharacterId): EncounterId | null => {
  const forms = content.region.registry.characters.get(c)?.encounterForms ?? [];
  return forms.some((f) => f.encounter === null) ? null : forms[0]?.encounter ?? null;
};

function toCombatFlag(t: Twist): TwistFlag {
  if (t.kind === 'one-health-bar') return { kind: 'one-health-bar' };
  return { kind: 'flee-at', percent: t.percent as number, ...(typeof t.catchSeconds === 'number' ? { catchSeconds: t.catchSeconds } : {}) };
}

function readOverlay(issues: Issues, raw: readonly unknown[], base: readonly Twist[]): Twist[] {
  const out: Twist[] = [];
  raw.forEach((t, i) => {
    const p = `overlay[${i}]`;
    if (t === null || typeof t !== 'object' || Array.isArray(t)) { issues.add('not-object', p, 'a twist is an object'); return; }
    const o = t as Record<string, unknown>;
    if (typeof o.kind !== 'string' || !Object.hasOwn(TWISTS, o.kind)) { issues.add('content-rule', `${p}.kind`, `${JSON.stringify(o.kind)} is not an Origins encounter flag`); return; }
    const kind = o.kind as TwistKind, allowed: readonly string[] = ['kind', ...TWISTS[kind]];
    for (const k of Object.keys(o)) if (!allowed.includes(k)) issues.add('unknown-field', `${p}.${k}`, `a ${kind} twist has no "${k}"`);
    const int = (k: string, lo: number, hi: number, required: boolean) => {
      if (!Object.hasOwn(o, k)) { if (required) issues.add('missing-field', `${p}.${k}`, `${kind} needs ${k}`); return; }
      if (!Number.isInteger(o[k]) || (o[k] as number) < lo || (o[k] as number) > hi) issues.add('out-of-range', `${p}.${k}`, `${k} is a whole number in ${lo}..${hi}`);
    };
    if (kind === 'flee-at') { int('percent', 1, 99, true); int('catchSeconds', 1, 120, false); }
    if (kind === 'hazard') { if (!(HAZARDS as readonly unknown[]).includes(o.hazard)) issues.add('out-of-range', `${p}.hazard`, `a hazard is one of ${HAZARDS.join(', ')}`); int('stillSeconds', 1, 30, true); }
    if ([...base, ...out].some((b) => b.kind === kind)) issues.add('duplicate-id', p, `a ${kind} twist is set twice on one fight`);
    out.push(o as Twist);
  });
  return out;
}

// The fight's seed: a pure function of the seed key, the character and the attempt number, so a retried attempt rolls afresh and a
// replay of one attempt rolls the same. The first 32 bits of sha-256 (origins/boss/hash.ts), never Math.random.
export function fightSeed(seedKey: string, character: string, attempt: number): number {
  const d = sha256(`${seedKey}|${character}|${attempt}`);
  return ((d[0]! << 24) | (d[1]! << 16) | (d[2]! << 8) | d[3]!) >>> 0;
}

// ---- 4. world-mob damage rolls ----------------------------------------------------------------------------------------------------

// One hit of a fight of this kind, either direction (player -> foe and foe -> player share the fight's seed and its hit numbering).
// Rolled ±10% only for 'world-mob' with the flag on (luck.rollsApply); the Pit, PvP and the ladder pass the base damage through.
export const fightHit = (kind: FightKind, flags: LuckFlags, base: number, seed: number, hit: number): DamageRoll => hitDamage(kind, flags, base, seed, hit, seededSource);
// Every Region 1 fight is a world-mob fight.
export const worldMobHit = (flags: LuckFlags, base: number, seed: number, hit: number): DamageRoll => fightHit('world-mob', flags, base, seed, hit);

// ---- 2. fight outcome -----------------------------------------------------------------------------------------------------------

export type FightReport = {
  fight: string;                          // an encounter or open-world creature id, checked by fightSetup
  result: 'won' | 'lost';                 // 'lost' = the player died; every twist outcome ends the fight with the player standing
  twistOutcome: TwistOutcome | null;      // src/twist.ts `twist.outcome`
  firstWin?: boolean;                     // required for a world boss: the server's `beaten` set has no world-boss:<character> yet
  bountyWinsToday?: number;               // required for a Bounty: paid wins this character already has this UTC day
  bossRollsThisWeek?: number;             // required for a weekly-cap boss (the rift): table rolls this account already had this week
  overlay?: readonly unknown[];           // the same overlay the fight was set up with
};
export type Payout = {
  metal: number;                          // bound metal to the one balance (a Bounty win under its cap)
  killRow: string | null;                 // the progression row the Kill event names; null = no kill, 0 CP
  lootTable: LootTableId | null;          // the table to roll (rollLoot); null = nothing drops
  bossLoot: boolean;                      // the boss's own table rolls (first win, or under the weekly cap)
};
export type FightResolution = { cleared: boolean; forfeit: boolean; kill: boolean; retry: boolean; payout: Payout };
const NOTHING: Payout = { metal: 0, killRow: null, lootTable: null, bossLoot: false };

export function resolveFight(report: FightReport, content: EncounterContent): Result<FightResolution> {
  const setup = fightSetup(report.fight, content, { overlay: report.overlay ?? [] });
  if (!setup.ok) return setup;
  const { result, twistOutcome } = report;
  if (result !== 'won' && result !== 'lost') return fail('out-of-range', 'result', "result is 'won' or 'lost'");
  if (twistOutcome !== null && twistOutcome !== 'fled' && twistOutcome !== 'caught' && twistOutcome !== 'escaped') return fail('out-of-range', 'twistOutcome', "twistOutcome is 'fled', 'caught', 'escaped' or null");
  const flee = setup.value.combatFlags.find((f): f is Extract<TwistFlag, { kind: 'flee-at' }> => f.kind === 'flee-at');
  if (twistOutcome !== null) {
    if (!flee) return fail('rule-violation', 'twistOutcome', `${report.fight} has no flee-at twist, so no twist outcome`);
    if (twistOutcome === 'fled' && flee.catchSeconds !== undefined) return fail('rule-violation', 'twistOutcome', 'a flee with a catch window ends caught or escaped, never fled');
    if (twistOutcome !== 'fled' && flee.catchSeconds === undefined) return fail('rule-violation', 'twistOutcome', `${twistOutcome} needs a catch window (catchSeconds)`);
    if (result === 'lost') return fail('rule-violation', 'result', `${twistOutcome} ends the fight with the player standing, so it is not a loss`);
  }
  if (result === 'lost') return ok({ cleared: false, forfeit: false, kill: false, retry: true, payout: NOTHING });   // pays and costs nothing
  if (twistOutcome === 'escaped') return ok({ cleared: false, forfeit: true, kill: false, retry: true, payout: NOTHING });   // retry at once
  if (twistOutcome === 'fled') return ok({ cleared: true, forfeit: false, kill: false, retry: false, payout: NOTHING });   // not a kill: 0 CP, no boss award
  // A kill: won outright, or caught inside the window (the normal defeat).
  const payout = killPayout(report, setup.value, content);
  return payout.ok ? ok({ cleared: true, forfeit: false, kill: true, retry: false, payout: payout.value }) : payout;
}

function killPayout(report: FightReport, setup: FightSetup, content: EncounterContent): Result<Payout> {
  const boss = setup.opponent.character, killRow = content.local.killRows[boss] ?? null;
  if (killRow === null) return fail('missing-field', 'fight', `${boss} has no kill row`);
  if (setup.scope === 'open-world') return ok({ metal: 0, killRow, lootTable: content.local.creatureLoot[boss] as LootTableId, bossLoot: false });
  const e = content.region.registry.encounters.get(setup.fight as EncounterId)!;
  const rule = content.local.bossLoot.find((r) => r.encounter === e.id);
  if (!rule) return fail('missing-field', 'fight', `${e.id} names no boss loot rule`);
  const count = (key: 'bountyWinsToday' | 'bossRollsThisWeek'): Result<number> => {
    const v = report[key];
    return Number.isSafeInteger(v) && (v as number) >= 0 ? ok(v as number) : fail('missing-field', key, `${key} is a whole number ≥ 0 for ${e.id}`);
  };
  if (rule.rule === 'never') {   // a Bounty: metal only, up to the daily cap; the kill still pays its own row
    const b = content.region.bounties.find((x) => x.encounter === e.id);
    if (!b) return fail('missing-field', 'fight', `${e.id} pays metal only but no Bounty fights it`);
    const wins = count('bountyWinsToday');
    if (!wins.ok) return wins;
    return ok({ metal: wins.value < b.dailyCap ? b.metal : 0, killRow, lootTable: null, bossLoot: false });
  }
  if (rule.rule === 'first-win') {   // ruling 9: the boss table rolls only on the kill that pays the once-row; a repeat rolls nothing
    if (typeof report.firstWin !== 'boolean') return fail('missing-field', 'firstWin', `firstWin is required for ${e.id}`);
    return ok({ metal: 0, killRow, lootTable: report.firstWin ? e.boss.loot : null, bossLoot: report.firstWin });
  }
  const rolls = count('bossRollsThisWeek');   // weekly-cap (the rift boss, PROPOSED living-world §8.4)
  if (!rolls.ok) return rolls;
  const under = rolls.value < (rule.perWeek ?? 0);
  return ok({ metal: 0, killRow, lootTable: under ? e.boss.loot : null, bossLoot: under });
}

// ---- 3. seeded loot -------------------------------------------------------------------------------------------------------------

export type Drop = { item: ItemId; quantity: number };
export type RolledLoot = { table: LootTableId; items: Drop[]; metal: number };
export type LootOptions = { foeLevel?: number };   // the killed foe's level for the entries' level gate; absent = no gate applied

// A deterministic roll of one table (eqemu-loot.md §5, on the contracts' LootTable): the same table, seed and level give the same drops.
// Draw n is luck.seededSource(seed, n), in a fixed order: currency, then each roll's gate, then its entries.
//   currency:     a uniform whole number in [min, max] (metal, the one bound balance; ruling 4).
//   roll gate:    each of `repeat` times, probability 100 passes without a draw, else a draw u passes when u·100 < probability.
//   independent:  each eligible entry, a draw u drops it when u·100 < chance.
//   weighted:     up to max(dropLimit, minDrop) picks: a pick is made while drops < minDrop, or when any entry has chance ≥ 100, or when
//                 a draw u ≥ Π(1 − cᵢ/100); the pick walks the entries by weight `chance`. Picks are with replacement.
export function rollLoot(tableId: unknown, seed: number, content: EncounterContent, opts: LootOptions = {}): Result<RolledLoot> {
  const table = content.region.registry.lootTables.get(tableId as LootTableId);
  if (!table) return fail('unknown-id', 'lootTable', `${String(tableId)} is not a Region 1 loot table`);
  const never = content.local.bossLoot.some((r) => r.rule === 'never' && content.region.registry.encounters.get(r.encounter as EncounterId)?.boss.loot === table.id);
  if (never) return fail('rule-violation', 'lootTable', `${table.id} is never rolled: a Bounty pays metal only`);
  if (!Number.isSafeInteger(seed)) return fail('wrong-type', 'seed', 'a seed is a whole number');
  const lvl = opts.foeLevel;
  if (lvl !== undefined && !Number.isInteger(lvl)) return fail('wrong-type', 'foeLevel', 'a level is a whole number');
  let n = 0;
  const draw = () => seededSource(seed, n++);
  return ok(rollTable(table, draw, lvl));
}
function rollTable(table: LootTable, draw: () => number, level: number | undefined): RolledLoot {
  const items: Drop[] = [];
  const metal = table.currency ? table.currency.min + Math.floor(draw() * (table.currency.max - table.currency.min + 1)) : 0;
  const eligible = (e: LootTable['rolls'][number]['entries'][number]) => level === undefined || ((e.levelMin === null || level >= e.levelMin) && (e.levelMax === null || level <= e.levelMax));
  for (const roll of table.rolls) for (let k = 0; k < roll.repeat; k++) {
    if (roll.probability < 100 && draw() * 100 >= roll.probability) continue;
    const entries = roll.entries.filter(eligible);
    if (roll.mode === 'independent') {
      for (const e of entries) if (draw() * 100 < e.chance) items.push({ item: e.item, quantity: e.quantity });
      continue;
    }
    if (entries.length === 0) continue;
    const total = entries.reduce((a, e) => a + e.chance, 0), bypass = entries.some((e) => e.chance >= 100);
    const none = entries.reduce((a, e) => (e.chance < 100 ? a * (100 - e.chance) / 100 : a), 1);
    let drops = 0;
    for (let i = 0; i < Math.max(roll.dropLimit, roll.minDrop); i++) {
      if (!(drops < roll.minDrop || bypass || draw() >= none)) continue;
      let w = draw() * total;
      const pick = entries.find((e) => (w < e.chance ? true : ((w -= e.chance), false)));
      if (pick) { items.push({ item: pick.item, quantity: pick.quantity }); drops++; }
    }
  }
  return { table: table.id, items, metal };
}

// ---- 3b. loot into the backpack -------------------------------------------------------------------------------------------------

// Who won the drops and for which kill. `killId` is the kill's own unique key (the boss module's LootRequest.mintKey, or the server's
// kill id), so each drop's mint key `loot:<killId>:<n>` is unique and a retried settlement cannot mint twice. `at` is the server time.
export type LootMint = { wonBy: CharacterInstanceId; killId: string; encounter: EncounterId | null; at: string };
export type Delivered = { inventory: Inventory; metal: number; received: ItemInstanceId[] };

// Mint each drop as a `loot` item instance (contracts' shape, parsed) and hand it to the inventory's own `receive`, which owns capacity,
// stacking and one-of-each. All or nothing: any refusal returns that refusal and the inventory unchanged. Metal is a balance, not an item.
export function intoBackpack(inventory: Inventory, drops: RolledLoot, mint: LootMint, content: EncounterContent): Result<Delivered> {
  const lookup = lookupOf(content);
  let inv = inventory;
  const received: ItemInstanceId[] = [], hash = shortHash(`${mint.killId}|${drops.table}`);
  for (const [n, d] of drops.items.entries()) {
    const def = lookup(d.item);
    if (!def) return fail('unknown-id', `drops.items[${n}].item`, `${d.item} is not a Region 1 item`);
    const parsed = parseItemInstance({
      kind: 'item-instance', schemaVersion: 1, id: `inst:loot-${hash}-${n}`, item: d.item, version: 0, quantity: d.quantity,
      tier: def.power === 'slot-weight' ? REGION1_LOOT_TIER : null,
      location: { kind: 'trade-escrow', container: 'container:loot-mint', from: mint.wonBy },   // where a fresh drop sits until `receive` places it
      boundTo: null,
      provenance: { kind: 'loot', mintKey: `loot:${mint.killId}:${n}`, at: mint.at, wonBy: mint.wonBy, table: drops.table, encounter: mint.encounter },
      history: [],
    }, `drops.items[${n}]`);
    if (!parsed.ok) return parsed;
    const next = receive(inv, parsed.value, lookup);
    if (!next.ok) return { ok: false, issues: next.issues.map((i: Issue) => ({ ...i, path: `drops.items[${n}].${i.path}` })) };
    inv = next.value;
    received.push(parsed.value.id);
  }
  return ok({ inventory: inv, metal: drops.metal, received });
}

