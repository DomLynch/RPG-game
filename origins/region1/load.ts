// Origins Region 1: the pure loader. It loads the world data through origins/world (loadWorld, resolveRegion), the bundle through the
// contracts' registry (loadContent), reads the kinds the contracts do not have yet (towns, Bounties, twist flags, rifts, boss loot
// rules), and checks every cross-reference between the three. No clock, no randomness, no DOM; every failure is a Result issue with a
// path, never a throw. Nothing in src/ imports this module.
import { Issues, LOCAL_KEY, checkString, isPlainObject, join, readArray, readBoolean, readEnum, readInt, readObject, readString, readText, type Obj, type Result } from '../contracts/core.ts';
import { parseId, type CharacterId, type EncounterId, type ItemId, type LootTableId, type RegionId } from '../contracts/ids.ts';
import { loadContent, type Registry } from '../contracts/registry.ts';
import { parseBossDefinition } from '../boss/boss.ts';
import { TYPE_WEIGHTS } from '../progression/model.ts';
import { toMetres } from '../world/derive.ts';
import { loadWorld, resolveRegion } from '../world/resolve.ts';
import type { Params } from '../world/schema.ts';
import { WEAPON_SLOTS } from '../../src/loot.ts';
import { BUNDLE, LOCAL, PROPOSED_ROWS } from './content.ts';
import { EXCHANGE_REGION, FRONTIER_REGION, REGION1_WORLD } from './world.ts';

export const REGION1 = [EXCHANGE_REGION, FRONTIER_REGION] as const;

// Spec numbers the data must sit inside (region1 §3 Bounties table; living-world §3.3, §12; feuds §3.1).
export const BOUNTY_METAL = { min: 30, max: 50 } as const; // bronze per paid win
export const BOUNTY_DAILY_CAP = { min: 1, max: 3 } as const; // paid wins per character per UTC day
export const MIN_TOWNS_FOR_WAR = 3; // living-world §4.3 / §12
export const TOWN_SAFE_CLEARANCE_M = 30; // living-world §12: a quarter's ring centre sits ≥ 30 m from the square's gate
// living-world §3.3 tiers: prosperity floor, services open, ruler title (§4.1).
export const TIERS = [
  { tier: 'ruin', from: 0, services: 0, title: null },
  { tier: 'hamlet', from: 50, services: 1, title: 'reeve' },
  { tier: 'village', from: 200, services: 2, title: 'reeve' },
  { tier: 'town', from: 450, services: 3, title: 'mayor' },
  { tier: 'city', from: 750, services: 4, title: 'lord' },
] as const;
export const tierOf = (prosperity: number) => [...TIERS].reverse().find((t) => prosperity >= t.from)!;
export const TEMPERAMENTS = ['ambitious', 'vengeful', 'mercantile', 'cautious'] as const;
export const TRADES = ['smith', 'healer', 'fence'] as const;

// The twist flags (region1 §4 and §7 ruling 10), each with exactly its fields. Origins encounter flags only: they are read by the Origins
// fight, never by the ladder, its RNG or anything in src/.
export const TWISTS = {
  'no-block': [],
  'one-health-bar': [],
  'flee-at': ['percent', 'catchSeconds'],
  'damage-only-on-parry': [],
  'heal-on-hit': [],
  hazard: ['hazard', 'stillSeconds'],
  candlelight: [],
} as const satisfies Record<string, readonly string[]>;
export type TwistKind = keyof typeof TWISTS;
export const HAZARDS = ['embers', 'breaking-planks'] as const;
export type Twist = { kind: TwistKind } & Record<string, unknown>;

// Namespaces the contracts do not list yet (region1 §7 open 1g; feuds §13 open 4; living-world §14). Same local-part rule as ids.ts.
const LOCAL_ID = /^[a-z0-9][a-z0-9._-]{0,95}$/;
export const LOCAL_NAMESPACES = ['town', 'bounty', 'rift', 'riftboss', 'riftsched', 'patron'] as const;
function localId(issues: Issues, value: unknown, path: string, ns: (typeof LOCAL_NAMESPACES)[number]): string | undefined {
  const s = checkString(issues, value, path);
  if (s === undefined) return undefined;
  if (!s.startsWith(`${ns}:`) || !LOCAL_ID.test(s.slice(ns.length + 1))) {
    issues.add('bad-id', path, `"${s}" is not a ${ns}: id`);
    return undefined;
  }
  return s;
}
const ref = <N extends 'character' | 'encounter' | 'region' | 'loottable'>(issues: Issues, value: unknown, path: string, ns: N) => issues.absorb(parseId(value, ns, path));
const kindOf = (issues: Issues, obj: Obj, path: string, kind: string): void => {
  if (obj.kind !== kind) issues.add('unknown-kind', join(path, 'kind'), `expected kind "${kind}"`);
  if (obj.schemaVersion !== 1) issues.add('unsupported-version', join(path, 'schemaVersion'), 'schemaVersion 1 is the only one');
};

export type Town = {
  id: string; name: string; region: RegionId; zone: string; startProsperity: number; patron: string;
  ruler: { title: string; character: CharacterId; temperament: string; standIn: CharacterId; successors: CharacterId[] };
  centre: string; jail: string; services: { trade: string; npc: CharacterId; at: string }[]; resources: string[]; riverside: boolean;
};
export type Bounty = { id: string; name: string; region: RegionId; encounter: EncounterId; twist: Twist; metal: number; dailyCap: number };
export type RiftSite = { id: string; region: RegionId; zone: string; at: string; weight: number };
export type Region1 = {
  zones: ReadonlyMap<RegionId, ReadonlyMap<string, Params>>;
  registry: Registry;
  towns: Town[];
  bounties: Bounty[];
  flags: ReadonlyMap<EncounterId, Twist[]>;
  rifts: { sites: RiftSite[]; boss: Obj; scheduler: Obj };
};
export type Local = typeof LOCAL;

// Load and cross-check Region 1. Defaults are the shipped data; tests pass broken copies.
export function loadRegion1(world: unknown = REGION1_WORLD, bundle: unknown = BUNDLE, local: Local = LOCAL): Result<Region1> {
  const issues = new Issues();
  // 1. World data: every zone of both regions resolves, every connection is answered.
  const zones = new Map<RegionId, ReadonlyMap<string, Params>>();
  const data = issues.absorb(loadWorld(world));
  if (data) for (const id of REGION1) {
    const r = issues.absorb(resolveRegion(data, id));
    if (r) zones.set(id as RegionId, r);
  }
  // 2. The contracts bundle: every record parses, every reference inside it resolves, no id twice.
  const registry = issues.absorb(loadContent(bundle));
  if (!data || !registry || !issues.empty) return issues.finish(undefined as never);

  // 3. Every id, contracts and local, is unique across the whole of Region 1.
  const seen = new Set<string>();
  const unique = (id: unknown, path: string) => {
    if (typeof id !== 'string') return;
    if (seen.has(id)) issues.add('duplicate-id', path, `${id} is defined twice in Region 1`);
    seen.add(id);
  };
  (bundle as Obj[]).forEach((r, i) => unique(r.id, `bundle[${i}].id`));
  for (const [key, list] of [['towns', local.towns], ['bounties', local.bounties], ['rifts', local.rifts]] as const) {
    (list as readonly Obj[]).forEach((r, i) => unique(r.id, `${key}[${i}].id`));
  }

  // 4. World ↔ contracts: a contracts region's waypoints are exactly its world landmarks, each name used in one zone only.
  const zoneOfLandmark = new Map<RegionId, Map<string, string>>();
  for (const id of REGION1) {
    const rid = id as RegionId, owner = new Map<string, string>();
    for (const [zone, p] of zones.get(rid)!) for (const name of Object.keys(p.layout)) {
      if (owner.has(name)) issues.add('duplicate-id', `${rid}.${zone}.layout.${name}`, `landmark "${name}" is also in zone ${owner.get(name)}`);
      owner.set(name, zone);
    }
    zoneOfLandmark.set(rid, owner);
    const def = registry.regions.get(rid);
    if (!def) { issues.add('unknown-id', rid, `no region-definition for ${rid}`); continue; }
    for (const w of def.waypoints) if (!owner.has(w)) issues.add('unknown-id', `${rid}.waypoints`, `waypoint "${w}" is no world landmark`);
    for (const name of owner.keys()) if (!def.waypoints.includes(name)) issues.add('missing-field', `${rid}.waypoints`, `world landmark "${name}" is not a waypoint`);
  }
  for (const e of registry.encounters.values()) if (!zones.has(e.region)) issues.add('unknown-id', `${e.id}.region`, `${e.region} is not a Region 1 region`);
  // A region-definition spawn may stand only in a zone where creatures may fight: never a town's foe inside a town.
  const townZones = new Set(local.towns.map((t) => `${t.region}/${t.zone}`));

  // 5. No weapon drops in Region 1 (ruled): no item a table can award, and no item defined here, is a weapon.
  const weapon = (item: ItemId) => (WEAPON_SLOTS as readonly string[]).includes(registry.items.get(item)?.slot ?? '');
  for (const def of registry.items.values()) if (weapon(def.id)) issues.add('content-rule', `${def.id}.slot`, `${def.slot} is a weapon: no weapon drops in Region 1`);
  for (const t of registry.lootTables.values()) t.rolls.forEach((roll, i) => roll.entries.forEach((e, j) => {
    if (weapon(e.item)) issues.add('content-rule', `${t.id}.rolls[${i}].entries[${j}].item`, `${e.item} is a weapon: no weapon drops in Region 1`);
  }));
  for (const t of registry.lootTables.values()) if (t.fallback !== null) issues.add('content-rule', `${t.id}.fallback`, 'crafting is out: fallback is null');

  // 6. Twist flags: Origins encounter flags on encounters this content defines, each a known kind with exactly its fields.
  const flags = new Map<EncounterId, Twist[]>();
  for (const [key, list] of Object.entries(local.flags)) {
    const p = `flags.${key}`, id = ref(issues, key, p, 'encounter');
    if (!id) continue;
    if (!registry.encounters.has(id)) { issues.add('unknown-id', p, `${id} is not an encounter in Region 1`); continue; }
    const twists = list.map((t, i) => readTwist(issues, t, `${p}[${i}]`)).filter((t): t is Twist => t !== undefined);
    if (twists.length !== list.length) continue;
    if (new Set(twists.map((t) => t.kind)).size !== twists.length) issues.add('duplicate-id', p, 'a twist kind is set twice on one encounter');
    flags.set(id, twists);
  }

  // 7. Towns.
  const towns = local.towns.map((raw, i) => readTown(issues, raw, `towns[${i}]`)).filter((t): t is Town => t !== undefined);
  for (const t of towns) {
    const p = t.id, rz = zones.get(t.region), zp = rz?.get(t.zone);
    if (!rz) { issues.add('unknown-id', join(p, 'region'), `${t.region} is not a Region 1 region`); continue; }
    if (!zp) { issues.add('unknown-id', join(p, 'zone'), `no zone "${t.zone}" in ${t.region}`); continue; }
    if (zp.rules.safe) issues.add('rule-violation', join(p, 'zone'), `${t.zone} is safe: a town can be fought in, the square cannot`);
    if (zp.density.creatures !== 0) issues.add('rule-violation', join(p, 'zone'), 'a town zone spawns no creatures');
    for (const [key, at] of [['centre', t.centre], ['jail', t.jail], ...t.services.map((s, j) => [`services[${j}].at`, s.at] as const)] as const) {
      if (!Object.hasOwn(zp.layout, at)) issues.add('unknown-id', join(p, key), `no landmark "${at}" in zone ${t.zone}`);
    }
    const tier = tierOf(t.startProsperity);
    if (tier.title !== t.ruler.title) issues.add('rule-violation', join(p, 'ruler.title'), `a ${tier.tier} is ruled by a ${tier.title ?? 'nobody'}, not a ${t.ruler.title}`);
    if (t.services.length > tier.services) issues.add('rule-violation', join(p, 'services'), `a ${tier.tier} opens ${tier.services} services, not ${t.services.length}`);
    const people = [t.ruler.character, t.ruler.standIn, ...t.ruler.successors, ...t.services.map((s) => s.npc)];
    people.forEach((c) => { if (!registry.characters.has(c)) issues.add('unknown-id', p, `${c} is not a character in Region 1`); });
    if (new Set(people).size !== people.length) issues.add('duplicate-id', p, 'one figure holds two town roles');
    // Rulers are never grudge rivals (living-world ruling 7): no duel form. A service NPC can be one, so it has a duel form.
    for (const c of [t.ruler.character, t.ruler.standIn]) if (registry.characters.get(c)?.encounterForms.length) issues.add('rule-violation', p, `${c} rules or stands in, so it has no duel form`);
    for (const s of t.services) {
      const c = registry.characters.get(s.npc);
      if (c && !c.encounterForms.some((f) => f.opponent !== null && f.level !== null)) issues.add('rule-violation', p, `${s.npc} (a ${s.trade}) needs a duel form`);
      if (c?.essential) issues.add('rule-violation', p, `${s.npc} is essential, so it cannot be a town's rival`);
    }
    const def = registry.regions.get(t.region);
    for (const c of people) if (def && !def.spawns.some((s) => s.characters.includes(c) && zoneOfLandmark.get(t.region)!.get(s.at) === t.zone)) {
      issues.add('missing-field', p, `${c} has no spawn in ${t.zone}`);
    }
    // A safe zone reached through a gate keeps its distance from the town's centre (no guard ring overlaps the square).
    const m = toMetres(zp);
    for (const c of Object.values(zp.connections)) if (c.kind === 'gate' && rz.get(c.to)?.rules.safe) {
      const a = m.landmarks[c.here], b = m.landmarks[t.centre];
      if (a && b && Math.hypot(a.x - b.x, a.d - b.d) < TOWN_SAFE_CLEARANCE_M) issues.add('rule-violation', join(p, 'centre'), `the centre is within ${TOWN_SAFE_CLEARANCE_M} m of the safe gate ${c.here}`);
    }
  }
  if (towns.length < MIN_TOWNS_FOR_WAR) issues.add('rule-violation', 'towns', `Region 1 needs ${MIN_TOWNS_FOR_WAR} war-capable towns, not ${towns.length}`);

  // 8. Bounties.
  const bounties = local.bounties.map((raw, i) => readBounty(issues, raw, `bounties[${i}]`)).filter((b): b is Bounty => b !== undefined);
  for (const b of bounties) {
    const e = registry.encounters.get(b.encounter);
    if (!e) { issues.add('unknown-id', join(b.id, 'encounter'), `${b.encounter} is not an encounter in Region 1`); continue; }
    if (e.region !== b.region) issues.add('rule-violation', join(b.id, 'region'), `${b.encounter} is in ${e.region}`);
    if (e.scope !== 'solo') issues.add('rule-violation', join(b.id, 'encounter'), 'a Bounty is a solo fight');
    const own = flags.get(b.encounter);
    if (!own || own.length !== 1 || !sameTwist(own[0]!, b.twist)) issues.add('rule-violation', join(b.id, 'twist'), "the Bounty's twist must match its encounter's one flag (the fight reads the flag)");
    const def = registry.regions.get(b.region);
    if (def && !def.spawns.some((s) => s.encounter === b.encounter)) issues.add('missing-field', b.id, `${b.encounter} has no spawn in ${b.region}`);
  }
  for (const [id] of flags) if (!bounties.some((b) => b.encounter === id)) issues.add('rule-violation', `flags.${id}`, 'a flag sits on an encounter no Bounty fights');

  // 9. Kill rows and boss loot (region1 §4–§5: boss loot on the first win only).
  for (const [c, row] of Object.entries(local.killRows)) {
    const id = ref(issues, c, `killRows.${c}`, 'character');
    if (id && !registry.characters.has(id)) issues.add('unknown-id', `killRows.${c}`, `${c} is not a character in Region 1`);
    if (!Object.hasOwn(TYPE_WEIGHTS, row) && !(PROPOSED_ROWS as readonly string[]).includes(row)) issues.add('unknown-id', `killRows.${c}`, `no progression row "${row}"`);
  }
  const rule = new Map<string, Local['bossLoot'][number]>();
  local.bossLoot.forEach((r, i) => {
    if (rule.has(r.encounter)) issues.add('duplicate-id', `bossLoot[${i}]`, `${r.encounter} has two loot rules`);
    rule.set(r.encounter, r);
    if (!registry.encounters.has(r.encounter as EncounterId)) issues.add('unknown-id', `bossLoot[${i}].encounter`, `${r.encounter} is not an encounter in Region 1`);
    if ((r.rule === 'weekly-cap') !== (r.perWeek !== undefined)) issues.add('rule-violation', `bossLoot[${i}].perWeek`, 'perWeek is set exactly on a weekly-cap rule');
  });
  const rawById = new Map((bundle as Obj[]).map((r) => [r.id, r]));
  for (const e of registry.encounters.values()) {
    const p = e.id, r = rule.get(e.id), row = local.killRows[e.boss.character];
    if (!r) { issues.add('missing-field', p, 'every encounter names how its boss table is rolled'); continue; }
    if (!row) issues.add('missing-field', p, `${e.boss.character} has no kill row`);
    if (row === 'world-boss') {
      if (r.rule !== 'first-win') issues.add('rule-violation', p, 'a world boss table rolls on the first win only');
    }
    if (row && Object.hasOwn(TYPE_WEIGHTS, row) && TYPE_WEIGHTS[row]!.once !== (r.rule === 'first-win')) issues.add('rule-violation', p, `the ${row} row and the ${r.rule} rule disagree on once-only`);
    const isBounty = bounties.some((b) => b.encounter === e.id);
    if (isBounty !== (r.rule === 'never')) issues.add('rule-violation', p, 'a Bounty pays metal only (rule never), and only a Bounty does');
    // A public boss runs on origins/boss: level and health present, the progression model's contribution threshold, a short id.
    if (e.scope === 'public') issues.absorb(parseBossDefinition(rawById.get(e.id), p));   // the raw bundle record, not the parsed one
  }
  const neverTables = new Set<LootTableId>(), rolledTables = new Set<LootTableId>();
  for (const e of registry.encounters.values()) (rule.get(e.id)?.rule === 'never' ? neverTables : rolledTables).add(e.boss.loot);
  for (const t of neverTables) if (rolledTables.has(t)) issues.add('rule-violation', t, 'a never-rolled table is also a rolled boss table');
  for (const [c, t] of Object.entries(local.creatureLoot)) {
    if (!registry.characters.has(c as CharacterId)) issues.add('unknown-id', `creatureLoot.${c}`, `${c} is not a character in Region 1`);
    if (!registry.lootTables.has(t as LootTableId)) issues.add('unknown-id', `creatureLoot.${c}`, `${t} is not a loot table in Region 1`);
    if (neverTables.has(t as LootTableId)) issues.add('rule-violation', `creatureLoot.${c}`, `${t} is never rolled`);
  }
  // Every table is used by something: a boss, a creature, or nothing (refused, so dead tables do not pile up).
  const used = new Set<string>([...neverTables, ...rolledTables, ...Object.values(local.creatureLoot)]);
  for (const t of registry.lootTables.keys()) if (!used.has(t)) issues.add('rule-violation', t, 'no boss or creature rolls this table');
  // Every spawn of a creature stands outside the towns.
  for (const id of REGION1) for (const s of registry.regions.get(id as RegionId)?.spawns ?? []) {
    const zone = zoneOfLandmark.get(id as RegionId)!.get(s.at);
    if (zone && townZones.has(`${id}/${zone}`) && (s.encounter || s.characters.some((c) => local.killRows[c]))) issues.add('rule-violation', `${id}.spawns.${s.id}`, 'no foe spawns inside a town');
  }

  // 10. Rifts.
  const rifts = readRifts(issues, local.rifts, registry, zones, townZones);
  return issues.finish({ zones, registry, towns, bounties, flags, rifts: rifts ?? { sites: [], boss: {}, scheduler: {} } });
}

function readTwist(issues: Issues, raw: unknown, path: string): Twist | undefined {
  if (!isPlainObject(raw)) { issues.add('not-object', path, 'a twist is an object'); return undefined; }
  if (typeof raw.kind !== 'string' || !Object.hasOwn(TWISTS, raw.kind)) {
    issues.add('content-rule', join(path, 'kind'), `${JSON.stringify(raw.kind)} is not an Origins encounter flag (${Object.keys(TWISTS).join(', ')})`);
    return undefined;
  }
  const kind = raw.kind as TwistKind, fields: readonly string[] = TWISTS[kind];
  const obj = readObject(issues, raw, path, ['kind', ...fields]);
  if (!obj) return undefined;
  const before = issues.list.length;
  if (kind === 'flee-at') { readInt(issues, obj, 'percent', path, 1, 99); readInt(issues, obj, 'catchSeconds', path, 1, 120); }
  if (kind === 'hazard') { readEnum(issues, obj, 'hazard', path, HAZARDS); readInt(issues, obj, 'stillSeconds', path, 1, 30); }
  return issues.list.length === before ? (obj as Twist) : undefined;
}
const sameTwist = (a: Twist, b: Twist): boolean => JSON.stringify(Object.entries(a).sort()) === JSON.stringify(Object.entries(b).sort());

const TOWN_KEYS = ['kind', 'schemaVersion', 'id', 'name', 'region', 'zone', 'safe', 'startProsperity', 'patron', 'ruler', 'centre', 'jail', 'services', 'resources', 'riverside'];
function readTown(issues: Issues, raw: unknown, path: string): Town | undefined {
  const before = issues.list.length, obj = readObject(issues, raw, path, TOWN_KEYS);
  if (!obj) return undefined;
  kindOf(issues, obj, path, 'town-definition');
  const id = localId(issues, obj.id, join(path, 'id'), 'town'), name = readText(issues, obj, 'name', path, { max: 60 });
  const region = ref(issues, obj.region, join(path, 'region'), 'region'), zone = readString(issues, obj, 'zone', path, { pattern: LOCAL_KEY });
  if (readBoolean(issues, obj, 'safe', path) !== false) issues.add('rule-violation', join(path, 'safe'), 'a town is never safe: the Exchange square is not a town');
  const startProsperity = readInt(issues, obj, 'startProsperity', path, 50, 1000), patron = localId(issues, obj.patron, join(path, 'patron'), 'patron');
  const r = readObject(issues, obj.ruler, join(path, 'ruler'), ['title', 'character', 'temperament', 'standIn', 'successors']);
  const rp = join(path, 'ruler');
  const ruler = r && {
    title: readEnum(issues, r, 'title', rp, ['reeve', 'mayor', 'lord'] as const)!,
    character: ref(issues, r.character, join(rp, 'character'), 'character')!,
    temperament: readEnum(issues, r, 'temperament', rp, TEMPERAMENTS)!,
    standIn: ref(issues, r.standIn, join(rp, 'standIn'), 'character')!,
    successors: readArray(issues, r, 'successors', rp, (v, p) => ref(issues, v, p, 'character'), { max: 8 })!,
  };
  const centre = readString(issues, obj, 'centre', path, { pattern: LOCAL_KEY }), jail = readString(issues, obj, 'jail', path, { pattern: LOCAL_KEY });
  const services = readArray(issues, obj, 'services', path, (v, p) => {
    const s = readObject(issues, v, p, ['trade', 'npc', 'at']);
    const trade = s && readEnum(issues, s, 'trade', p, TRADES), npc = s && ref(issues, s.npc, join(p, 'npc'), 'character'), at = s && readString(issues, s, 'at', p, { pattern: LOCAL_KEY });
    return trade && npc && at ? { trade, npc, at } : undefined;
  }, { max: 4 });
  if (services && new Set(services.map((s) => s.trade)).size !== services.length) issues.add('duplicate-id', join(path, 'services'), 'one trade twice in a town');
  const resources = readArray(issues, obj, 'resources', path, (v, p) => checkString(issues, v, p, { pattern: LOCAL_KEY }), { max: 8 });
  const riverside = readBoolean(issues, obj, 'riverside', path);
  if (issues.list.length !== before) return undefined;
  return { id: id!, name: name!, region: region!, zone: zone!, startProsperity: startProsperity!, patron: patron!, ruler: ruler!, centre: centre!, jail: jail!, services: services!, resources: resources!, riverside: riverside! };
}

const BOUNTY_KEYS = ['kind', 'schemaVersion', 'id', 'name', 'region', 'gate', 'encounter', 'twist', 'metal', 'dailyCap'];
function readBounty(issues: Issues, raw: unknown, path: string): Bounty | undefined {
  const before = issues.list.length, obj = readObject(issues, raw, path, BOUNTY_KEYS);
  if (!obj) return undefined;
  kindOf(issues, obj, path, 'bounty-definition');
  const id = localId(issues, obj.id, join(path, 'id'), 'bounty'), name = readText(issues, obj, 'name', path, { max: 60 });
  const region = ref(issues, obj.region, join(path, 'region'), 'region'), encounter = ref(issues, obj.encounter, join(path, 'encounter'), 'encounter');
  if (obj.gate !== 'outer') issues.add('rule-violation', join(path, 'gate'), 'Region 1 is behind the outer gate');
  const twist = readTwist(issues, obj.twist, join(path, 'twist'));
  const metal = readInt(issues, obj, 'metal', path, BOUNTY_METAL.min, BOUNTY_METAL.max);
  const dailyCap = readInt(issues, obj, 'dailyCap', path, BOUNTY_DAILY_CAP.min, BOUNTY_DAILY_CAP.max);
  if (issues.list.length !== before) return undefined;
  return { id: id!, name: name!, region: region!, encounter: encounter!, twist: twist!, metal: metal!, dailyCap: dailyCap! };
}

function readRifts(issues: Issues, records: readonly Obj[], registry: Registry, zones: ReadonlyMap<RegionId, ReadonlyMap<string, Params>>, townZones: ReadonlySet<string>): Region1['rifts'] | undefined {
  const before = issues.list.length, sites: RiftSite[] = [];
  let boss: Obj | undefined, scheduler: Obj | undefined;
  records.forEach((raw, i) => {
    const p = `rifts[${i}]`;
    if (raw.kind === 'rift-site') {
      const obj = readObject(issues, raw, p, ['kind', 'schemaVersion', 'id', 'region', 'zone', 'at', 'weight']);
      if (!obj) return;
      kindOf(issues, obj, p, 'rift-site');
      const id = localId(issues, obj.id, join(p, 'id'), 'rift'), region = ref(issues, obj.region, join(p, 'region'), 'region');
      const zone = readString(issues, obj, 'zone', p, { pattern: LOCAL_KEY }), at = readString(issues, obj, 'at', p, { pattern: LOCAL_KEY });
      const weight = readInt(issues, obj, 'weight', p, 1, 100), zp = region && zone ? zones.get(region)?.get(zone) : undefined;
      if (region && zone && !zp) issues.add('unknown-id', join(p, 'zone'), `no zone "${zone}" in ${region}`);
      if (zp && at && !Object.hasOwn(zp.layout, at)) issues.add('unknown-id', join(p, 'at'), `no landmark "${at}" in ${zone}`);
      if (zp?.rules.safe || townZones.has(`${region}/${zone}`)) issues.add('rule-violation', join(p, 'zone'), 'a rift opens only in a non-safe, non-town zone');
      if (id && region && zone && at && weight !== undefined) sites.push({ id, region, zone, at, weight });
    } else if (raw.kind === 'rift-boss') {
      const obj = readObject(issues, raw, p, ['kind', 'schemaVersion', 'id', 'character', 'levelOver', 'guardian', 'lootTable', 'weight', 'encounter']);
      if (!obj) return;
      kindOf(issues, obj, p, 'rift-boss');
      localId(issues, obj.id, join(p, 'id'), 'riftboss');
      const character = ref(issues, obj.character, join(p, 'character'), 'character'), guardian = ref(issues, obj.guardian, join(p, 'guardian'), 'character');
      const loot = ref(issues, obj.lootTable, join(p, 'lootTable'), 'loottable'), encounter = ref(issues, obj.encounter, join(p, 'encounter'), 'encounter');
      const levelOver = readInt(issues, obj, 'levelOver', p, 0, 10);
      readInt(issues, obj, 'weight', p, 1, 100);
      const e = encounter ? registry.encounters.get(encounter) : undefined;
      if (!e) { issues.add('unknown-id', join(p, 'encounter'), `${String(obj.encounter)} is not an encounter in Region 1`); return; }
      if (e.boss.character !== character) issues.add('rule-violation', join(p, 'character'), `${e.id}'s boss is ${e.boss.character}`);
      if (e.boss.loot !== loot) issues.add('rule-violation', join(p, 'lootTable'), `${e.id} rolls ${e.boss.loot}`);
      if (!e.stages.every((s) => s.roster.every((r) => r.character === guardian))) issues.add('rule-violation', join(p, 'guardian'), `${e.id}'s gathering is not ${guardian}`);
      const band = Math.max(...[...(zones.get(e.region)?.values() ?? [])].map((z) => z.difficulty.levelMax));
      if (levelOver !== undefined && e.boss.level !== band + levelOver) issues.add('rule-violation', join(p, 'levelOver'), `the rift boss fights at the band top ${band} + ${levelOver}, not ${e.boss.level}`);
      if (e.scope !== 'public') issues.add('rule-violation', join(p, 'encounter'), 'a rift is a public fight');
      if (boss) issues.add('duplicate-id', p, 'Region 1 has one rift boss');
      boss = obj;
    } else if (raw.kind === 'rift-scheduler') {
      const obj = readObject(issues, raw, p, ['kind', 'schemaVersion', 'id', 'region', 'perDayMin', 'perDayMax', 'minGapSeconds', 'warnSeconds', 'openSeconds', 'siteCooldownSeconds', 'townClearanceMetres', 'lootRollsPerWeek']);
      if (!obj) return;
      kindOf(issues, obj, p, 'rift-scheduler');
      localId(issues, obj.id, join(p, 'id'), 'riftsched');
      const region = ref(issues, obj.region, join(p, 'region'), 'region');
      if (region && !zones.has(region)) issues.add('unknown-id', join(p, 'region'), `${region} is not a Region 1 region`);
      const lo = readInt(issues, obj, 'perDayMin', p, 0, 24), hi = readInt(issues, obj, 'perDayMax', p, 1, 24), gap = readInt(issues, obj, 'minGapSeconds', p, 0, 86_400);
      if (lo !== undefined && hi !== undefined && lo > hi) issues.add('rule-violation', join(p, 'perDayMin'), 'perDayMin is above perDayMax');
      if (hi !== undefined && gap !== undefined && hi * gap > 86_400) issues.add('rule-violation', join(p, 'minGapSeconds'), `${hi} rifts a day cannot sit ${gap} s apart`);
      for (const k of ['warnSeconds', 'openSeconds', 'siteCooldownSeconds']) readInt(issues, obj, k, p, 60, 604_800);
      readInt(issues, obj, 'townClearanceMetres', p, 0, 1000);
      readInt(issues, obj, 'lootRollsPerWeek', p, 1, 50);
      if (scheduler) issues.add('duplicate-id', p, 'Region 1 has one rift scheduler');
      scheduler = obj;
    } else issues.add('unknown-kind', join(p, 'kind'), `unknown rift kind ${JSON.stringify(raw.kind)}`);
  });
  if (!boss) issues.add('missing-field', 'rifts', 'Region 1 has a rift boss');
  if (!scheduler) issues.add('missing-field', 'rifts', 'Region 1 has a rift scheduler');
  if (sites.length === 0) issues.add('missing-field', 'rifts', 'Region 1 has rift sites');
  return issues.list.length === before ? { sites, boss: boss!, scheduler: scheduler! } : undefined;
}
