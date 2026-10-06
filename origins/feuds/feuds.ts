// Frankendom: Origins, FEUDS: systemic grudges, succession and notoriety. Reference engine, pure, integer-only, not under src/.
//
// Spec: docs/specs/origins/feuds.md (binding; every number below is that spec's PROVISIONAL data, named once and pinned in
// feuds.test.ts). Clean room (ruling 8): written from the spec only.
//
// Pure like the rest of origins/: no DOM, clock, Math.random or storage. The caller (the preview page, later the world writer) passes
// the server time `at` in whole seconds and the server seed in; the same inputs give the same output byte for byte, so a retried
// writer op can be checked against its first run. Its imports are the ladder (src/career.ts, read only) and the shared mulberry32
// (origins/world/generate.ts), so neither the cap nor the PRNG is declared twice.
//
// Deliberate scope (see the PR): §3 generator and grudge holding, §2 guardrails, §4 notoriety, §5 stand-in and successor, §5.1 trade
// shunning, §6 succession outcome, §7 guards / arrest / jail, §7.1 alert spread, rings and the escalation table. Deferred: retaliation
// grudges (§3 source 3, open question 3), patron-strike and bouncer fight details (§7.1.3–4), NPC hunters (§8), the PvP bounty (§9).

import { MAX_LEVEL, RANK_STEPS, TITLES } from '../../src/career.ts';
import { prng } from '../world/generate.ts';

// ---------------------------------------------------------------------------------------------------------------------------------
// Constants (feuds.md, PROVISIONAL until Dom rules; change them only with the doc).

export const DAY_S = 86_400;

// §3.1 grudges a player may hold, expiry, re-offer. Gate: Gladiator, the outer gate (contracts/world.ts: Gladiator I is level 11).
export const GRUDGE_HELD_MAX = 1;
export const GRUDGE_EXPIRY_S = 259_200;
export const GRUDGE_REOFFER_S = 86_400;
export const GRUDGE_MIN_LEVEL = TITLES.indexOf('Gladiator') * RANK_STEPS + 1;
export const GIVER_STANDING_DELTA = 50;
export const RIVAL_TOWN_STANDING_DELTA = -100;
export const NEUTRAL_ATTITUDE_FLOOR = -100; // attitudeFor must be > this

// §3.1 generator defaults (the `grudge-generator` row).
export const GENERATOR_DEFAULTS: GeneratorConfig = {
  rotationSeconds: 604_800, livePerTownMax: 2, livePerRegionMax: 6, varietyWindow: 4, rewardBronzePerLevel: 25, storyWeight: 5,
};

// §4 notoriety.
export const NOTORIETY_MAX = 1000;
export const NOTORIETY_RIVAL_KILL = 600;
export const NOTORIETY_GUARD_BEATEN = 50;
export const NOTORIETY_SETTLE_SIDE = 100;
export const NOTORIETY_BACK_SIDE = -100;
export const NOTORIETY_JAIL_SERVED = -200;
export const NOTORIETY_DECAY_PER_DAY = 100;
export const NOTORIETY_PAYOFF_BRONZE = 3;
export const SUSPECT = 100;
export const WANTED = 300;
export const HUNTED = 600;
export const SUSPECT_PRICE_PERMILLE = 1250;

// §5 stand-in and successor.
export const SUCCESSOR_MIN_S = 604_800;
export const SUCCESSOR_MAX_S = 1_209_600;
export const STANDIN_BUY_PERMILLE = 1500;
export const STANDIN_BACKED_BUY_PERMILLE = 1250;
export const STANDIN_SELL_PERMILLE = 667;
export const STANDIN_UPGRADE_COST_PERMILLE = 1500;
export const STANDIN_UPGRADE_TIER_CAP_OFFSET = 1;

// §6 succession event.
export const SUCCESSION_EVENT_S = 1800;
export const SUCCESSION_REWARD_BRONZE = 100;
export const GIVER_DISCOUNT_PERMILLE = 900;

// §7 guards, arrest, jail.
export const GUARD_LEVEL_FLOOR = 25;
export const GUARD_LEVEL_OVER = 5;
export const GUARD_RECHALLENGE_S = 120;
export const FINE_BRONZE_PER_POINT = 2;
export const FINE_MIN_BRONZE = 100;
export const JAIL_S = 600;
export const JAIL_MAX_S = 1800;
export const BAIL_BRONZE_PER_S = 1;

// §7.1 alert spread.
export const ALERT_SPREAD_PERMILLE = 500;
export const ALERT_SPREAD_CROSS_REGION_PERMILLE = 0;

const own = <T>(rec: Readonly<Record<string, T>>, key: string): T | undefined => (Object.hasOwn(rec, key) ? rec[key] : undefined);
const clamp = (x: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, x));

// ---------------------------------------------------------------------------------------------------------------------------------
// World inputs (the bundle's view the engine needs; ids are the contracts' ids).

export type Town = { id: string; region: string; tier: number; safe: boolean; patron: string | null };
// A service NPC. `rival`: carries `rival` data (§11) so it may be grudge-marked. `essential` and `ruler` figures are never marked.
export type Npc = { id: string; town: string; trade: string | null; level: number; rival: boolean; essential?: boolean; ruler?: boolean };
export type World = { towns: readonly Town[]; npcs: readonly Npc[] };

const townOf = (world: World, id: string) => world.towns.find((t) => t.id === id);
export const markable = (npc: Npc, world: World): boolean =>
  npc.rival && !npc.essential && !npc.ruler && npc.trade !== null && townOf(world, npc.town)?.safe === false;

// ---------------------------------------------------------------------------------------------------------------------------------
// §3.1 The grudge generator: rollGrudges(seed, rotation, tables, world, history) → grudge-roll. Run once at rotation start.

export type Motive = { id: string; trades: 'same' | 'any'; weight: number; rewardPermille: number };
// `patron`: the kit needs a patron town (ringed-patron); `rivalKillNotoriety` is the kill's cost in the rival's town.
export type DefenceKit = { id: string; weight: number; minTownTier: number; patron: boolean; rivalKillNotoriety: number };
export type Twist = { id: string; weight: number };
export type GeneratorConfig = {
  rotationSeconds: number; livePerTownMax: number; livePerRegionMax: number; varietyWindow: number; rewardBronzePerLevel: number; storyWeight: number;
};
// A hand-authored story entry (grudge-definition, story: true): fixed pair, motive and reward; kit and twist are still drawn.
export type StoryEntry = { id: string; giver: string; rival: string; motive: string; rewardBronze: number; weight?: number };
export type Tables = { region: string; motives: readonly Motive[]; kits: readonly DefenceKit[]; twists: readonly Twist[]; config: GeneratorConfig; stories: readonly StoryEntry[] };
// Live rival facts at roll time: dead rivals, and rivals still held from an earlier rotation (skipped while held, §3.1).
export type RollState = { dead: readonly string[]; held: readonly string[] };

export type Grudge = {
  id: string; giver: string; rival: string; motive: string; kit: string; twist: string; rewardBronze: number; rivalKillNotoriety: number; story: boolean;
};
export type GrudgeRoll = { kind: 'grudge-roll'; schemaVersion: 1; region: string; rotation: number; seed: number; grudges: Grudge[] };

export const rotationIndex = (serverTime: number, rotationSeconds = GENERATOR_DEFAULTS.rotationSeconds): number =>
  Math.floor(serverTime / rotationSeconds);

// hash32(serverSeed, region, rotation): FNV-1a over the three, then a murmur3 finaliser. Integers only.
export function rotationSeed(serverSeed: number, region: string, rotation: number): number {
  let h = 0x811c9dc5;
  for (const ch of `${serverSeed >>> 0}|${region}|${rotation}`) h = Math.imul(h ^ ch.charCodeAt(0), 0x01000193);
  h = Math.imul(h ^ (h >>> 16), 0x85ebca6b);
  h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35);
  return (h ^ (h >>> 16)) >>> 0;
}

// A weighted integer draw: r = floor(u · total) is exact (u is a u32 / 2^32 and total < 2^21), so every engine draws the same index.
function draw<T>(rand: () => number, items: readonly T[], weight: (t: T) => number): T | undefined {
  const total = items.reduce((s, t) => s + Math.max(0, weight(t)), 0);
  if (total <= 0) return undefined;
  let r = Math.floor(rand() * total);
  for (const t of items) if ((r -= Math.max(0, weight(t))) < 0) return t;
  return undefined;
}

type Candidate = { giver: Npc; rival: Npc; motive: Motive; story: StoryEntry | null };
const tripleKey = (giver: string, rival: string, motive: string) => `${giver}>${rival}>${motive}`;

export function rollGrudges(seed: number, rotation: number, tables: Tables, world: World, state: RollState, history: readonly GrudgeRoll[]): GrudgeRoll {
  const { config } = tables, rand = prng(seed);
  const recent = new Set(history.filter((h) => h.region === tables.region && h.rotation < rotation && h.rotation >= rotation - config.varietyWindow)
    .flatMap((h) => h.grudges.map((g) => tripleKey(g.giver, g.rival, g.motive))));
  const inRegion = (n: Npc) => townOf(world, n.town)?.region === tables.region;
  const rivalOk = (n: Npc) => inRegion(n) && markable(n, world) && !state.dead.includes(n.id) && !state.held.includes(n.id);
  const pairOk = (g: Npc, r: Npc, m: Motive) => g.trade !== null && g.town !== r.town && (m.trades === 'any' || g.trade === r.trade)
    && !recent.has(tripleKey(g.id, r.id, m.id));
  const givers = world.npcs.filter((n) => n.trade !== null && inRegion(n)), rivals = world.npcs.filter(rivalOk);
  let pool: Candidate[] = [];
  for (const rival of rivals) for (const giver of givers) for (const motive of tables.motives)
    if (pairOk(giver, rival, motive)) pool.push({ giver, rival, motive, story: null });
  for (const story of tables.stories) {
    const giver = world.npcs.find((n) => n.id === story.giver), rival = rivals.find((n) => n.id === story.rival);
    const motive = tables.motives.find((m) => m.id === story.motive);
    if (giver && rival && motive && pairOk(giver, rival, motive)) pool.push({ giver, rival, motive, story });
  }
  const perTown = new Map<string, number>(), grudges: Grudge[] = [];
  while (grudges.length < config.livePerRegionMax) {
    const pick = draw(rand, pool, (c) => (c.story ? c.story.weight ?? config.storyWeight : c.motive.weight));
    if (!pick) break;
    const town = townOf(world, pick.rival.town)!, n = (perTown.get(town.id) ?? 0) + 1;
    perTown.set(town.id, n);
    pool = pool.filter((c) => c.rival.id !== pick.rival.id && (n < config.livePerTownMax || c.rival.town !== town.id));
    const kit = draw(rand, tables.kits.filter((k) => k.minTownTier <= town.tier && (!k.patron || town.patron !== null)), (k) => k.weight);
    const twist = draw(rand, tables.twists, (t) => t.weight);
    if (!kit || !twist) break; // no kit fits this town / no twists: an empty table stops the roll rather than inventing a default
    grudges.push({
      id: pick.story ? pick.story.id : `grudge:${tables.region.replace(/^region:/, '')}-r${rotation}-${grudges.length + 1}`,
      giver: pick.giver.id, rival: pick.rival.id, motive: pick.motive.id, kit: kit.id, twist: twist.id,
      rewardBronze: pick.story ? pick.story.rewardBronze : Math.floor((config.rewardBronzePerLevel * pick.rival.level * pick.motive.rewardPermille) / 1000),
      rivalKillNotoriety: kit.rivalKillNotoriety, story: pick.story !== null,
    });
  }
  return { kind: 'grudge-roll', schemaVersion: 1, region: tables.region, rotation, seed, grudges };
}

// ---------------------------------------------------------------------------------------------------------------------------------
// §4 Notoriety: per killer, per town, 0..NOTORIETY_MAX, decayed lazily from `at` (the rested-credit refill pattern, no clock job).

export type Notoriety = { points: number; at: number };
export type Band = 'clean' | 'suspect' | 'wanted' | 'hunted';
export const CLEAN: Notoriety = { points: 0, at: 0 };

// −100 a day, continuous, rounded down when read: floor(points − 100·dt/day) = points − ceil(100·dt/day) for integer points.
export const notorietyAt = (n: Notoriety, at: number): number =>
  Math.max(0, n.points - Math.ceil((NOTORIETY_DECAY_PER_DAY * Math.max(0, at - n.at)) / DAY_S));
export const addNotoriety = (n: Notoriety, delta: number, at: number): Notoriety =>
  ({ points: clamp(notorietyAt(n, at) + delta, 0, NOTORIETY_MAX), at });
export const bandOf = (points: number): Band => (points >= HUNTED ? 'hunted' : points >= WANTED ? 'wanted' : points >= SUSPECT ? 'suspect' : 'clean');
const BAND_RANK: Record<Band, number> = { clean: 0, suspect: 1, wanted: 2, hunted: 3 };
export const atLeast = (band: Band, floor: Band): boolean => BAND_RANK[band] >= BAND_RANK[floor];

// Pay-off at the Exchange magistrate: any amount, 3 bronze a point, never more points than are owed.
export function payOff(n: Notoriety, bronze: number, at: number): { notoriety: Notoriety; points: number; costBronze: number } {
  const now = notorietyAt(n, at), points = Math.min(now, Math.floor(Math.max(0, bronze) / NOTORIETY_PAYOFF_BRONZE));
  return { notoriety: { points: now - points, at }, points, costBronze: points * NOTORIETY_PAYOFF_BRONZE };
}
// "Pay all": the sum across towns at 3 bronze a point.
export const payAllCost = (byTown: Readonly<Record<string, Notoriety>>, at: number): number =>
  Object.values(byTown).reduce((s, n) => s + notorietyAt(n, at) * NOTORIETY_PAYOFF_BRONZE, 0);

// §7.1.1 The alert: a grudge kill adds the kit's cost in the rival's town, and ALERT_SPREAD_PERMILLE of it in every other town of the
// same region that has an NPC of the dead rival's trade (the trade's network). Other trades' towns and other regions get nothing.
export function alertSpread(world: World, rivalTown: string, trade: string, killNotoriety = NOTORIETY_RIVAL_KILL): { town: string; delta: number }[] {
  const home = townOf(world, rivalTown);
  if (!home) return [];
  const out = [{ town: home.id, delta: killNotoriety }];
  for (const t of world.towns) {
    if (t.id === home.id || !world.npcs.some((n) => n.town === t.id && n.trade === trade)) continue;
    const permille = t.region === home.region ? ALERT_SPREAD_PERMILLE : ALERT_SPREAD_CROSS_REGION_PERMILLE;
    const delta = Math.floor((killNotoriety * permille) / 1000);
    if (delta > 0) out.push({ town: t.id, delta });
  }
  return out;
}

// The escalation table (§7.1): what town T does to the killer at a given band.
export type TownResponse = {
  band: Band; shopPricePermille: number | null; shuns: boolean; rings: RingId[]; patronStrikes: boolean; bouncer: boolean; hunters: boolean;
};
export function townResponse(points: number): TownResponse {
  const band = bandOf(points), wanted = atLeast(band, 'wanted'), hunted = band === 'hunted';
  return {
    band,
    shopPricePermille: wanted ? null : band === 'suspect' ? SUSPECT_PRICE_PERMILLE : 1000, // null = shops refuse
    shuns: band === 'suspect',
    rings: hunted ? ['outer', 'middle', 'inner'] : wanted ? ['outer', 'middle'] : [],
    patronStrikes: wanted, bouncer: hunted, hunters: hunted,
  };
}

// ---------------------------------------------------------------------------------------------------------------------------------
// §5.1 Trade shunning: the mild early stage. Per killer, per trade, one expiry; the commissioning giver is exempt.

export type TradeShun = { trade: string; fromTown: string; until: number; exempt: string[] };
// until = at + ceil((points − (SUSPECT − 1)) / decay) days; 0 points or below SUSPECT → `at` (no shun).
export const shunUntil = (points: number, at: number): number =>
  at + Math.max(0, Math.ceil((points - (SUSPECT - 1)) / NOTORIETY_DECAY_PER_DAY)) * DAY_S;
// Write or rewrite the shun for a trade: a second kill keeps the later `until` and adds its giver to the exemptions.
export function shun(prev: TradeShun | undefined, trade: string, fromTown: string, giver: string, points: number, at: number): TradeShun {
  const until = shunUntil(points, at);
  if (!prev) return { trade, fromTown, until, exempt: [giver] };
  return { trade, fromTown: until >= prev.until ? fromTown : prev.fromTown, until: Math.max(until, prev.until), exempt: [...new Set([...prev.exempt, giver])] };
}
// Any notoriety change in the shun's town rewrites `until` from the new points (pay-off, release, guard win, event).
export const reshun = (s: TradeShun, points: number, at: number): TradeShun => ({ ...s, until: shunUntil(points, at) });

// What a service NPC does for this viewer. Only the killer is affected; the stall itself never changes per viewer.
export type Access =
  | { kind: 'open'; pricePermille: number }
  | { kind: 'refused'; reason: 'wanted' | 'shunned'; stance: 'turned-away' | null; prompt: string };
export function serviceAccess(npc: Npc, pointsInTown: number, shuns: readonly TradeShun[], at: number): Access {
  const r = townResponse(pointsInTown);
  if (r.shopPricePermille === null) return { kind: 'refused', reason: 'wanted', stance: null, prompt: 'Closed to you' };
  const s = npc.trade !== null && shuns.find((x) => x.trade === npc.trade && x.until > at && !x.exempt.includes(npc.id));
  if (s) return { kind: 'refused', reason: 'shunned', stance: 'turned-away', prompt: 'Closed to you' };
  return { kind: 'open', pricePermille: r.shopPricePermille };
}

// ---------------------------------------------------------------------------------------------------------------------------------
// §3 Holding a grudge, and §2 the guardrails on the kill.

export type GrudgeStatus = 'held' | 'settled' | 'lapsed' | 'expired';
export type GrudgeState = { character: string; grudge: string; rival: string; cycle: number; status: GrudgeStatus; takenAt: number; expiresAt: number; settledAt: number | null };
export type RivalState = {
  rival: string; town: string; cycle: number; status: 'alive' | 'dead'; diedAt: number | null; killedBy: string | null; successorAt: number | null;
  outcome: SuccessionOutcome | null;
};
export const newRival = (rival: string, town: string, cycle = 1): RivalState =>
  ({ rival, town, cycle, status: 'alive', diedAt: null, killedBy: null, successorAt: null, outcome: null });

// A held grudge lapses into `expired` once its time is up (read lazily).
export const grudgeAt = (g: GrudgeState, at: number): GrudgeState => (g.status === 'held' && at >= g.expiresAt ? { ...g, status: 'expired' } : g);

export type OfferInput = {
  careerLevel: number; pointsInGiverTown: number; giverAttitude: number; held: readonly GrudgeState[]; rival: RivalState;
  lastClosedAt: number | null; // the last expiry or decline of this grudge by this player
};
export type OfferRefusal = 'gate' | 'suspect-in-giver-town' | 'giver-hostile' | 'holds-another' | 'rival-dead' | 'reoffer-wait';
// `grudge-open`: every eligibility rule at the offer. Returns the reasons it is closed (empty = open).
export function grudgeOpen(o: OfferInput, at: number): OfferRefusal[] {
  const out: OfferRefusal[] = [];
  if (o.careerLevel < GRUDGE_MIN_LEVEL) out.push('gate');
  if (o.pointsInGiverTown >= SUSPECT) out.push('suspect-in-giver-town');
  if (!(o.giverAttitude > NEUTRAL_ATTITUDE_FLOOR)) out.push('giver-hostile');
  if (o.held.filter((g) => grudgeAt(g, at).status === 'held').length >= GRUDGE_HELD_MAX) out.push('holds-another');
  if (rivalAt(o.rival, at).status !== 'alive') out.push('rival-dead');
  if (o.lastClosedAt !== null && at < o.lastClosedAt + GRUDGE_REOFFER_S) out.push('reoffer-wait');
  return out;
}
export const takeGrudge = (character: string, grudge: Grudge, rival: RivalState, at: number): GrudgeState =>
  ({ character, grudge: grudge.id, rival: grudge.rival, cycle: rival.cycle, status: 'held', takenAt: at, expiresAt: at + GRUDGE_EXPIRY_S, settledAt: null });

// The engage check: only a live, holding attacker on the rival's current cycle. Everyone else sees a normal NPC.
export function mayAttack(attacker: string, rival: RivalState, grudges: readonly GrudgeState[], at: number): boolean {
  const live = rivalAt(rival, at);
  return live.status === 'alive'
    && grudges.some((g) => g.character === attacker && g.rival === live.rival && g.cycle === live.cycle && grudgeAt(g, at).status === 'held');
}

export type KillResult =
  | { ok: true; rival: RivalState; grudges: GrudgeState[] }
  | { ok: false; reason: 'not-holder' | 'rival-dead' };
// rival_kill: verifies holder and cycle, sets `dead`, settles the killer's grudge and lapses every other holder's on this cycle. The
// successor date is provisional (died + max) until the succession event closes (§6). Payouts are the caller's, from the roll's row.
export function rivalKill(rival: RivalState, grudges: readonly GrudgeState[], killer: string, at: number): KillResult {
  const live = rivalAt(rival, at);
  if (live.status !== 'alive') return { ok: false, reason: 'rival-dead' };
  if (!mayAttack(killer, live, grudges, at)) return { ok: false, reason: 'not-holder' };
  const next = grudges.map((g) => {
    if (g.rival !== live.rival || g.cycle !== live.cycle || grudgeAt(g, at).status !== 'held') return g;
    return g.character === killer ? { ...g, status: 'settled' as const, settledAt: at } : { ...g, status: 'lapsed' as const };
  });
  return { ok: true, rival: { ...live, status: 'dead', diedAt: at, killedBy: killer, successorAt: at + SUCCESSOR_MAX_S, outcome: null }, grudges: next };
}

// ---------------------------------------------------------------------------------------------------------------------------------
// §6 The succession event, and §5 the successor and the stand-in.

export type Side = 'back' | 'settle';
export type SuccessionOutcome = 'backed' | 'settled' | 'unresolved';
export type Contribution = { character: string; side: Side; permille: number };

export const canJoin = (rival: RivalState, character: string, side: Side): boolean => !(side === 'back' && character === rival.killedBy);
export const sideNotoriety = (side: Side): number => (side === 'settle' ? NOTORIETY_SETTLE_SIDE : NOTORIETY_BACK_SIDE);
export function successionOutcome(contributions: readonly Contribution[]): SuccessionOutcome {
  const sum = (s: Side) => contributions.filter((c) => c.side === s).reduce((a, c) => a + Math.max(0, c.permille), 0);
  const back = sum('back'), settle = sum('settle');
  return back > settle ? 'backed' : settle > back ? 'settled' : 'unresolved';
}
// The day from died + 7 to died + 14 for an unresolved event, seeded from (rival, cycle).
export const unresolvedDay = (rival: string, cycle: number): number =>
  Math.floor(prng(rotationSeed(cycle, rival, 0))() * (SUCCESSOR_MAX_S / DAY_S - SUCCESSOR_MIN_S / DAY_S + 1)) + SUCCESSOR_MIN_S / DAY_S;
// succession_close: fixes the successor's day from the outcome.
export function closeSuccession(rival: RivalState, outcome: SuccessionOutcome): RivalState {
  if (rival.status !== 'dead' || rival.diedAt === null) return rival;
  const days = outcome === 'backed' ? SUCCESSOR_MIN_S / DAY_S : outcome === 'settled' ? SUCCESSOR_MAX_S / DAY_S : unresolvedDay(rival.rival, rival.cycle);
  return { ...rival, outcome, successorAt: rival.diedAt + days * DAY_S };
}
// successor_arrive, lazy: the first read after successorAt brings the next cycle (the same legend returning, or a named heir chosen by
// the caller from `successors`), and the grudge reopens.
export const rivalAt = (rival: RivalState, at: number): RivalState =>
  rival.status === 'dead' && rival.successorAt !== null && at >= rival.successorAt ? newRival(rival.rival, rival.town, rival.cycle + 1) : rival;

// Contributors at or over `thresholdPermille` earn the event reward (the spec names a threshold but not its value).
export const successionRewards = (contributions: readonly Contribution[], thresholdPermille: number): { character: string; bronze: number }[] =>
  [...new Set(contributions.filter((c) => c.permille >= thresholdPermille).map((c) => c.character))].map((character) => ({ character, bronze: SUCCESSION_REWARD_BRONZE }));

// The service terms while the rival is dead. The stand-in runs it worse; the giver's own service is 10% off after a `settled` event.
export type StandInTerms = { buyPermille: number; sellPermille: number; upgradeCostPermille: number; upgradeTierCap: number; vendorTier: number };
export function standInTerms(rival: RivalState, at: number, maxEffectiveTier: number, vendorTier: number): StandInTerms | null {
  const live = rivalAt(rival, at);
  if (live.status === 'alive') return null;
  return {
    buyPermille: live.outcome === 'backed' ? STANDIN_BACKED_BUY_PERMILLE : STANDIN_BUY_PERMILLE,
    sellPermille: STANDIN_SELL_PERMILLE, upgradeCostPermille: STANDIN_UPGRADE_COST_PERMILLE,
    upgradeTierCap: Math.max(1, maxEffectiveTier - STANDIN_UPGRADE_TIER_CAP_OFFSET), vendorTier: Math.max(1, vendorTier - 1),
  };
}
export const giverPricePermille = (rival: RivalState, at: number): number => {
  const live = rivalAt(rival, at);
  return live.status === 'dead' && live.outcome === 'settled' ? GIVER_DISCOUNT_PERMILLE : 1000;
};

// ---------------------------------------------------------------------------------------------------------------------------------
// §7 / §7.1 Guards: rings stronger near the target, a challenge is an NPC duel, a loss is an arrest (metal and jail, never gear).

export type RingId = 'outer' | 'middle' | 'inner';
export type Ring = { id: RingId; fromMetres: number; band: 'wanted' | 'hunted'; guardLevelFloor: number; guardLevelOver: number; damagePermille: number };
export const DEFAULT_RINGS: readonly Ring[] = [
  { id: 'outer', fromMetres: 30, band: 'wanted', guardLevelFloor: GUARD_LEVEL_FLOOR, guardLevelOver: GUARD_LEVEL_OVER, damagePermille: 1000 },
  { id: 'middle', fromMetres: 15, band: 'wanted', guardLevelFloor: 30, guardLevelOver: 10, damagePermille: 1500 },
  { id: 'inner', fromMetres: 0, band: 'hunted', guardLevelFloor: 40, guardLevelOver: 20, damagePermille: 4000 },
];
export const guardLevel = (ring: Pick<Ring, 'guardLevelFloor' | 'guardLevelOver'>, yourLevel: number): number =>
  Math.min(MAX_LEVEL, Math.max(ring.guardLevelFloor, yourLevel + ring.guardLevelOver));

// The ring whose guard meets a player `distance` metres from the centre: the ring containing that point if the band arms it, else the
// nearest armed ring outside it (a Wanted player who reaches the inner yard still meets the middle ring's guard, never nobody).
export function ringAt(distance: number, points: number, rings: readonly Ring[] = DEFAULT_RINGS): Ring | null {
  const band = bandOf(points), outward = [...rings].sort((a, b) => a.fromMetres - b.fromMetres);
  const start = outward.reduce((idx, r, i) => (r.fromMetres <= distance ? i : idx), -1);
  for (let i = Math.max(0, start); i < outward.length; i++) if (atLeast(band, outward[i]!.band)) return outward[i]!;
  return null;
}

export type GuardChallenge = { ring: RingId; level: number; damagePermille: number };
// A guard challenges a Wanted or Hunted player in the zone on sight, unless one did in the last GUARD_RECHALLENGE_S (or a release
// granted the same grace). Guards are a weight-0 row: no XP, CP or loot, so this carries none.
export function guardChallenge(distance: number, points: number, yourLevel: number, graceUntil: number, at: number, rings?: readonly Ring[]): GuardChallenge | null {
  if (at < graceUntil) return null;
  const ring = ringAt(distance, points, rings);
  return ring ? { ring: ring.id, level: guardLevel(ring, yourLevel), damagePermille: ring.damagePermille } : null;
}

export type Jail = { town: string; until: number; fineBronze: number };
export type Arrest = { finePaidBronze: number; unpaidBronze: number; balanceBronze: number; jail: Jail };
// arrest: fine 2 bronze a point (minimum 100) from the metal balance down to 0; the unpaid rest is extra jail at 1 s a bronze; jail
// 600 s plus that, capped at 1800 s. The signature has no inventory, equipment or bank: an arrest cannot touch gear.
export function arrest(town: string, points: number, balanceBronze: number, at: number): Arrest {
  const fine = Math.max(FINE_MIN_BRONZE, points * FINE_BRONZE_PER_POINT), paid = Math.min(Math.max(0, balanceBronze), fine), unpaid = fine - paid;
  return { finePaidBronze: paid, unpaidBronze: unpaid, balanceBronze: balanceBronze - paid, jail: { town, until: at + Math.min(JAIL_MAX_S, JAIL_S + unpaid), fineBronze: fine } };
}

export type GuardDuelResult =
  | { outcome: 'win'; notoriety: Notoriety; graceUntil: number }
  | { outcome: 'loss'; notoriety: Notoriety; arrest: Arrest };
export function guardDuel(outcome: 'win' | 'loss', town: string, n: Notoriety, balanceBronze: number, at: number): GuardDuelResult {
  if (outcome === 'win') return { outcome, notoriety: addNotoriety(n, NOTORIETY_GUARD_BEATEN, at), graceUntil: at + GUARD_RECHALLENGE_S };
  return { outcome, notoriety: { points: notorietyAt(n, at), at }, arrest: arrest(town, notorietyAt(n, at), balanceBronze, at) };
}

export const bailBronze = (jail: Jail, at: number): number => Math.max(0, jail.until - at) * BAIL_BRONZE_PER_S;
export const jailed = (jail: Jail | null, at: number): boolean => jail !== null && at < jail.until;
// release (time served or bail): notoriety −200 in that town and a re-challenge grace; the caller moves the walker to the town gate.
export const release = (n: Notoriety, at: number): { notoriety: Notoriety; graceUntil: number } =>
  ({ notoriety: addNotoriety(n, NOTORIETY_JAIL_SERVED, at), graceUntil: at + GUARD_RECHALLENGE_S });

// Read-only lookup kept for callers that key notoriety by town.
export const pointsIn = (byTown: Readonly<Record<string, Notoriety>>, town: string, at: number): number => {
  const n = own(byTown, town);
  return n ? notorietyAt(n, at) : 0;
};
