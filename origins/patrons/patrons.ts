// Frankendom: Origins — patrons and clans (allegiance at graduation). Pure, integer-only, no DOM, storage, network or clock: every time is
// a server-seconds integer the caller passes in. Not under src/: nothing here reaches the live arena game. The arena perks are the
// Combat lane's no-damage sidegrades (docs/specs/origins/patron-perks-sim.md: Vitality, Wind, Thrift, Guard, Poise, Stride, a
// RECORD_VERSION bump). The damage-based templates here are ORIGINS PvE ONLY (Strategy, 2026-10-07): resolvePerk returns zeros for
// any other venue, so a damage perk can never reach an arena fight, a Pit duel or a PvP fight.
//
// Specs: docs/specs/origins/living-world.md §10 (PR #1491: §10.2 templates, §10.6 leaving and switching, §10.7 data) and the patron list
// docs/specs/origins/legends-500.csv (PR #1498, rows with kind=patron and their perk_template column; read through csv.ts and generated
// into patrons.data.ts).
//
// Three things live here:
//   1. PERK TEMPLATES as data: a gain and a matching cost, parsed by a reader that refuses anything that is not equal power by
//      construction (complementary conditions of equal measure with the same stat and opposite sign, or `always` on both with equal and
//      opposite benefit on two different stats; |value| = the 30‰ budget on both sides).
//   2. ALLEGIANCE: the choice at graduation (Gladiator, the outer gate) of Independent, a player clan (a "company") or a patron's clan;
//      leaving is free with a 7-day wait before joining again; switching clan to clan costs 2,000 bronze and waits 28 days, and so does
//      joining any clan within 28 days of leaving one (going Independent does not reset that clock); every change is written to a log
//      that reads as the Exchange's book.
//   3. RESOLUTION: an allegiance plus a fight's context -> per-mille deltas tagged `scope: 'origins'`. Independent is all zeros.

import { fail, Issues, join, ok, readEnum, readInt, readObject, readString, type Issue, type Result } from '../contracts/core.ts';
import { gateAccess, type CareerStanding } from '../contracts/world.ts';
import type { PatronRow } from './csv.ts';
import { PATRON_ROWS } from './patrons.data.ts';

// ---------------------------------------------------------------------------------------------------------------------------------
// 1. Perk templates.

export const PERK_BUDGET_PERMILLE = 30;   // ±3% (Dom's override 1, living-world §10)
export const STATS = ['damageDealtPermille', 'damageTakenPermille', 'staminaCostPermille'] as const;
export type Stat = (typeof STATS)[number];
// Which way is good for the holder: more damage dealt, less damage taken, cheaper stamina.
const BENEFIT: Readonly<Record<Stat, 1 | -1>> = { damageDealtPermille: 1, damageTakenPermille: -1, staminaCostPermille: -1 };

// Conditions (§10.7). Each has exactly one complement of equal measure that exists in every fight, Pit included; `always` pairs only with
// itself. Equal level and exactly-half health are in neither half of their pair, so a template there is 0 on both sides.
export const WHENS = [
  'clock-half:day', 'clock-half:night', 'moon:waxing', 'moon:waning', 'fight-time:before-20s', 'fight-time:after-20s',
  'foe-level:higher', 'foe-level:lower', 'foe-health:below-half', 'foe-health:above-half', 'self-health:below-half', 'self-health:above-half', 'always',
] as const;
export type When = (typeof WHENS)[number];
export const COMPLEMENT: Readonly<Record<When, When>> = {
  'clock-half:day': 'clock-half:night', 'clock-half:night': 'clock-half:day', 'moon:waxing': 'moon:waning', 'moon:waning': 'moon:waxing',
  'fight-time:before-20s': 'fight-time:after-20s', 'fight-time:after-20s': 'fight-time:before-20s',
  'foe-level:higher': 'foe-level:lower', 'foe-level:lower': 'foe-level:higher',
  'foe-health:below-half': 'foe-health:above-half', 'foe-health:above-half': 'foe-health:below-half',
  'self-health:below-half': 'self-health:above-half', 'self-health:above-half': 'self-health:below-half', always: 'always',
};

export type Side = { when: When; stat: Stat; value: number };
export type PerkTemplate = { kind: 'perk-template'; schemaVersion: 1; id: string; gain: Side; cost: Side };
const TEMPLATE_ID = /^[a-z][a-z0-9-]{1,31}$/;

const benefit = (s: Side): number => s.value * BENEFIT[s.stat];

function readSide(issues: Issues, raw: unknown, path: string): Side | undefined {
  const obj = readObject(issues, raw, path, ['when', 'stat', 'value']);
  if (!obj) return undefined;
  const when = readEnum(issues, obj, 'when', path, WHENS), stat = readEnum(issues, obj, 'stat', path, STATS);
  const value = readInt(issues, obj, 'value', path, -PERK_BUDGET_PERMILLE, PERK_BUDGET_PERMILLE);
  return when && stat && value !== undefined ? { when, stat, value } : undefined;
}

// The one way a template comes into being. A clan can only name a template by id, so a clan can never carry raw modifiers (§10.7).
export function parsePerkTemplate(raw: unknown, path = ''): Result<PerkTemplate> {
  const issues = new Issues();
  const obj = readObject(issues, raw, path, ['kind', 'schemaVersion', 'id', 'gain', 'cost']);
  if (!obj) return issues.finish(undefined as never);
  if (obj.kind !== 'perk-template') issues.add('unknown-kind', join(path, 'kind'), 'a perk template has kind "perk-template"');
  if (obj.schemaVersion !== 1) issues.add('unsupported-version', join(path, 'schemaVersion'), 'perk templates are schemaVersion 1');
  const id = readString(issues, obj, 'id', path, { pattern: TEMPLATE_ID });
  const gain = readSide(issues, obj.gain, join(path, 'gain')), cost = readSide(issues, obj.cost, join(path, 'cost'));
  if (gain && cost) {
    if (gain.value === 0 || cost.value === 0) issues.add('rule-violation', path, 'both sides move a stat (a zero side is no sidegrade)');
    if (COMPLEMENT[gain.when] !== cost.when) issues.add('rule-violation', join(path, 'cost.when'), `the cost must hold on the complement of the gain (${COMPLEMENT[gain.when]})`);
    if (gain.when === 'always' ? gain.stat === cost.stat : gain.stat !== cost.stat) {
      issues.add('rule-violation', join(path, 'cost.stat'), gain.when === 'always' ? 'an always-on pair moves two different stats' : 'a conditional pair moves the same stat on both halves');
    }
    if (Math.abs(gain.value) !== PERK_BUDGET_PERMILLE || Math.abs(cost.value) !== PERK_BUDGET_PERMILLE) issues.add('rule-violation', path, `each side is exactly ±${PERK_BUDGET_PERMILLE}‰`);
    if (benefit(gain) <= 0) issues.add('rule-violation', join(path, 'gain'), 'the gain must help the holder');
    if (benefit(gain) + benefit(cost) !== 0) issues.add('rule-violation', join(path, 'cost'), 'the cost must take back exactly what the gain gives');
  }
  return issues.finish({ kind: 'perk-template', schemaVersion: 1, id: id!, gain: gain!, cost: cost! });
}

const side = (when: When, stat: Stat, value: number): Side => ({ when, stat, value });
const D = 'damageDealtPermille', T = 'damageTakenPermille', S = 'staminaCostPermille', B = PERK_BUDGET_PERMILLE;
// living-world §10.2, as §10.7 content. Every row goes through parsePerkTemplate at load (below): a bad row is a load-time throw.
export const PERK_TEMPLATE_DATA: readonly unknown[] = [
  { id: 'day-half', gain: side('clock-half:day', D, B), cost: side('clock-half:night', D, -B) },
  { id: 'night-half', gain: side('clock-half:night', D, B), cost: side('clock-half:day', D, -B) },
  { id: 'waxing', gain: side('moon:waxing', D, B), cost: side('moon:waning', D, -B) },
  { id: 'opener', gain: side('fight-time:before-20s', D, B), cost: side('fight-time:after-20s', D, -B) },
  { id: 'closer', gain: side('fight-time:after-20s', D, B), cost: side('fight-time:before-20s', D, -B) },
  { id: 'underdog', gain: side('foe-level:higher', D, B), cost: side('foe-level:lower', D, -B) },
  { id: 'finisher', gain: side('foe-health:below-half', D, B), cost: side('foe-health:above-half', D, -B) },
  { id: 'last-stand', gain: side('self-health:below-half', D, B), cost: side('self-health:above-half', D, -B) },
  { id: 'iron-hide', gain: side('always', T, -B), cost: side('always', D, -B) },
  { id: 'glass', gain: side('always', D, B), cost: side('always', T, B) },
  { id: 'tireless', gain: side('always', S, -B), cost: side('always', D, -B) },
].map((t) => ({ kind: 'perk-template', schemaVersion: 1, ...t }));

const must = <V>(r: Result<V>, what: string): V => { if (!r.ok) throw new Error(`${what}: ${JSON.stringify(r.issues)}`); return r.value; };
export const PERK_TEMPLATES: ReadonlyMap<string, PerkTemplate> = new Map(PERK_TEMPLATE_DATA.map((raw, i) => {
  const t = must(parsePerkTemplate(raw, `templates[${i}]`), 'perk template');
  return [t.id, t] as const;
}));

// The picker's plain-English line for a template, e.g. "+3% damage in the night half · −3% damage in the day half".
const WHEN_TEXT: Readonly<Record<When, string>> = {
  'clock-half:day': 'in the day half', 'clock-half:night': 'in the night half', 'moon:waxing': 'while the moon waxes', 'moon:waning': 'while the moon wanes',
  'fight-time:before-20s': "in a fight's first 20 s", 'fight-time:after-20s': 'after 20 s', 'foe-level:higher': 'against a higher-level foe',
  'foe-level:lower': 'against a lower-level foe', 'foe-health:below-half': 'against a foe under half health', 'foe-health:above-half': 'against a foe above half health',
  'self-health:below-half': 'while you are under half health', 'self-health:above-half': 'while you are above half health', always: '',
};
const STAT_TEXT: Readonly<Record<Stat, string>> = { damageDealtPermille: 'damage', damageTakenPermille: 'damage taken', staminaCostPermille: 'stamina cost' };
const sideText = (s: Side): string => `${s.value > 0 ? '+' : '−'}${Math.abs(s.value) / 10}% ${STAT_TEXT[s.stat]}${WHEN_TEXT[s.when] ? ` ${WHEN_TEXT[s.when]}` : ''}`;
export const templateText = (t: PerkTemplate): string => `${sideText(t.gain)} · ${sideText(t.cost)}`;

// ---------------------------------------------------------------------------------------------------------------------------------
// 2. Patrons and clans.

export type PatronId = `patron:${string}`;
export type ClanId = `clan:${string}`;
export type Patron = PatronRow & { patron: PatronId; clan: ClanId; perk: PerkTemplate };

// Every row must name a known template and a unique id; a bad list is a load-time throw (patrons.test.ts pins it), never a silent drop.
export function loadPatrons(rows: readonly PatronRow[]): Result<ReadonlyMap<PatronId, Patron>> {
  const issues = new Issues(), out = new Map<PatronId, Patron>();
  rows.forEach((r, i) => {
    const path = `patrons[${i}]`, patron = `patron:${r.id}` as PatronId, perk = PERK_TEMPLATES.get(r.template);
    if (!/^[a-z][a-z0-9-]{0,47}$/.test(r.id)) issues.add('bad-id', join(path, 'id'), `"${r.id}" is not a patron id`);
    else if (out.has(patron)) issues.add('duplicate-id', join(path, 'id'), `${patron} is listed twice`);
    if (!r.name.trim()) issues.add('missing-field', join(path, 'name'), 'a patron has a name');
    if (!perk) issues.add('unknown-id', join(path, 'template'), `"${r.template}" is not a perk template`);
    else if (!out.has(patron)) out.set(patron, { ...r, patron, clan: `clan:${r.id}`, perk });
  });
  return issues.finish(out as ReadonlyMap<PatronId, Patron>);
}
export const PATRONS: ReadonlyMap<PatronId, Patron> = must(loadPatrons(PATRON_ROWS), 'patron list');
export const patronOf = (id: string): Patron | undefined => PATRONS.get(id as PatronId);

// ---------------------------------------------------------------------------------------------------------------------------------
// 3. Allegiance: Independent, a player clan (a "company", living-world §10: player-made groups) or a patron's clan.

export type Allegiance =
  | { kind: 'independent' }
  | { kind: 'patron-clan'; patron: PatronId }
  | { kind: 'company'; name: string; template: string };   // a player clan picks one of the same fixed templates: equal by construction

export const COMPANY_NAME = /^[A-Za-z][A-Za-z' -]{1,30}[A-Za-z]$/;
export const RULES = { switchBronze: 2000, switchCooldownSeconds: 28 * 86400, leaveCooldownSeconds: 7 * 86400 } as const;   // §10.6 / §10.7 allegiance-rules

export type LogEntry = { at: number; event: 'chose' | 'left' | 'switched' | 'joined'; from: string | null; to: string; bronze: number };
export type AllegianceState = {
  kind: 'allegiance'; version: number;
  allegiance: Allegiance | null;   // null = not chosen yet (before graduation, or a Gladiator who has not chosen)
  since: number | null; nextJoinAt: number; nextSwitchAt: number;
  log: readonly LogEntry[];
};
export const NEW_ALLEGIANCE: AllegianceState = { kind: 'allegiance', version: 0, allegiance: null, since: null, nextJoinAt: 0, nextSwitchAt: 0, log: [] };

export const isClan = (a: Allegiance | null): boolean => !!a && a.kind !== 'independent';
export const allegianceKey = (a: Allegiance): string => (a.kind === 'independent' ? 'independent' : a.kind === 'patron-clan' ? `clan:${a.patron.slice('patron:'.length)}` : `company:${a.name}`);
export function allegianceName(a: Allegiance): string {
  if (a.kind === 'independent') return 'Independent';
  if (a.kind === 'company') return a.name;
  return `the clan of ${patronOf(a.patron)?.name ?? a.patron}`;
}
export function templateOf(a: Allegiance | null): PerkTemplate | null {
  if (!a || a.kind === 'independent') return null;
  return a.kind === 'company' ? PERK_TEMPLATES.get(a.template) ?? null : patronOf(a.patron)?.perk ?? null;
}

function checkAllegiance(a: Allegiance, path: string): Issue[] {
  const issues = new Issues();
  if (a.kind === 'patron-clan' && !patronOf(a.patron)) issues.add('unknown-id', join(path, 'patron'), `${a.patron} is not a patron`);
  if (a.kind === 'company') {
    if (!COMPANY_NAME.test(a.name)) issues.add('wrong-type', join(path, 'name'), 'a company name is 3..32 letters, spaces, hyphens or apostrophes');
    if (!PERK_TEMPLATES.has(a.template)) issues.add('unknown-id', join(path, 'template'), `"${a.template}" is not a perk template`);
  }
  if (!['independent', 'patron-clan', 'company'].includes(a.kind)) issues.add('unknown-kind', join(path, 'kind'), 'independent, patron-clan or company');
  return issues.list;
}

export type Change = { state: AllegianceState; charged: number; entry: LogEntry };
type Ctx = { standing: CareerStanding; at: number };
const whole = (n: unknown): n is number => typeof n === 'number' && Number.isSafeInteger(n) && n >= 0;

function guard(state: AllegianceState, to: Allegiance, ctx: Ctx): Issue[] {
  const issues = new Issues();
  const access = gateAccess('outer', ctx.standing, false);
  if (!access.ok) issues.add('rule-violation', 'standing', `the allegiance choice opens at the outer gate (needs ${access.needs})`);
  if (!whole(ctx.at)) issues.add('wrong-type', 'at', 'server seconds, a whole number');
  issues.list.push(...checkAllegiance(to, 'to'));
  if (state.allegiance && allegianceKey(state.allegiance) === allegianceKey(to)) issues.add('rule-violation', 'to', 'that is already your allegiance');
  return issues.list;
}
function commit(state: AllegianceState, to: Allegiance, entry: LogEntry, patch: Partial<AllegianceState>): Change {
  return { state: { ...state, ...patch, allegiance: to, since: entry.at, version: state.version + 1, log: [...state.log, entry] }, charged: entry.bronze, entry };
}

// The choice at graduation: the first time a Gladiator stands in the Exchange. Free, any of the three (§10.6 "First choice: free").
export function chooseAtGraduation(state: AllegianceState, to: Allegiance, ctx: Ctx): Result<Change> {
  if (state.allegiance) return fail('rule-violation', 'state', 'the graduation choice is made once; later changes are leave or switch');
  const issues = guard(state, to, ctx);
  if (issues.length) return { ok: false, issues };
  return ok(commit(state, to, { at: ctx.at, event: 'chose', from: null, to: allegianceKey(to), bronze: 0 }, {}));
}

// Every later change, priced by §10.6:
//   clan -> Independent: free; you may not join another clan for 7 days.
//   Independent -> clan: free once that wait is over, unless you left a clan less than 28 days ago: then it is priced as a switch
//     (Strategy, 2026-10-07: going Independent is free but does not reset the clock, so it is no way round the switch cost).
//   clan -> another clan: 2,000 bronze (a sink, debited by the caller from `bronze`) and a 28-day wait before the next switch.
// The 28-day wait from a paid switch also holds through a spell as Independent.
export function changeAllegiance(state: AllegianceState, to: Allegiance, ctx: Ctx & { bronze: number }): Result<Change> {
  const from = state.allegiance;
  if (!from) return fail('rule-violation', 'state', 'choose at graduation first');
  const issues = guard(state, to, ctx);
  if (!whole(ctx.bronze)) issues.push({ code: 'wrong-type', path: 'bronze', message: 'a bronze balance is a whole number' });
  if (issues.length) return { ok: false, issues };
  const at = ctx.at, fromKey = allegianceKey(from), toKey = allegianceKey(to);
  if (to.kind === 'independent') return ok(commit(state, to, { at, event: 'left', from: fromKey, to: toKey, bronze: 0 }, { nextJoinAt: at + RULES.leaveCooldownSeconds }));
  if (from.kind === 'independent') {
    if (at < state.nextJoinAt) return fail('rule-violation', 'at', `you may join a clan again in ${state.nextJoinAt - at} s`);
    // An Independent's last log entry is the graduation choice or the 'left' that made them Independent: that is when the clock started.
    const last = state.log[state.log.length - 1], leftAt = last?.event === 'left' ? last.at : null;
    if (leftAt === null || at >= leftAt + RULES.switchCooldownSeconds) return ok(commit(state, to, { at, event: 'joined', from: fromKey, to: toKey, bronze: 0 }, {}));
  }
  if (at < state.nextSwitchAt) return fail('rule-violation', 'at', `you may switch clan again in ${state.nextSwitchAt - at} s`);
  if (ctx.bronze < RULES.switchBronze) return fail('rule-violation', 'bronze', `switching clan costs ${RULES.switchBronze} bronze; you have ${ctx.bronze}`);
  const event = from.kind === 'independent' ? 'joined' : 'switched';
  return ok(commit(state, to, { at, event, from: fromKey, to: toKey, bronze: RULES.switchBronze }, { nextSwitchAt: at + RULES.switchCooldownSeconds }));
}

// The Exchange's book line for a log entry (living-world §6.1 / §10.6 wording; the trial is not modelled yet, so "chose" not "passed the trial").
const keyName = (key: string | null): string => {
  if (!key || key === 'independent') return 'Independent';
  if (key.startsWith('company:')) return key.slice('company:'.length);
  const p = patronOf(`patron:${key.slice('clan:'.length)}`);
  return p ? `the clan of ${p.name}` : key;
};
export function bookLine(entry: LogEntry, player: string): string {
  const date = new Date(entry.at * 1000).toISOString().slice(0, 10);
  switch (entry.event) {
    case 'chose': return entry.to === 'independent' ? `${player} chose to stand Independent on ${date}.` : `${player} swore to ${keyName(entry.to)} on ${date}.`;
    case 'joined': return `${player} swore to ${keyName(entry.to)} on ${date}.`;
    case 'left': return `${player} left ${keyName(entry.from)} on ${date}.`;
    case 'switched': return `${player} forsook ${keyName(entry.from)} for ${keyName(entry.to)} on ${date}.`;
  }
}

// A stored state (the preview's save, later the server's row) read back from `unknown`: anything that is not exactly this shape is refused.
export function parseAllegianceState(raw: unknown): Result<AllegianceState> {
  const issues = new Issues();
  const obj = readObject(issues, raw, '', ['kind', 'version', 'allegiance', 'since', 'nextJoinAt', 'nextSwitchAt', 'log']);
  if (!obj) return issues.finish(undefined as never);
  if (obj.kind !== 'allegiance') issues.add('unknown-kind', 'kind', 'an allegiance state has kind "allegiance"');
  const version = readInt(issues, obj, 'version', '', 0, Number.MAX_SAFE_INTEGER);
  const nextJoinAt = readInt(issues, obj, 'nextJoinAt', '', 0, Number.MAX_SAFE_INTEGER), nextSwitchAt = readInt(issues, obj, 'nextSwitchAt', '', 0, Number.MAX_SAFE_INTEGER);
  const since = obj.since === null ? null : readInt(issues, obj, 'since', '', 0, Number.MAX_SAFE_INTEGER);
  let allegiance: Allegiance | null = null;
  if (obj.allegiance !== null) {
    const a = readObject(issues, obj.allegiance, 'allegiance', ['kind', 'patron', 'name', 'template']);
    const kind = a && readEnum(issues, a, 'kind', 'allegiance', ['independent', 'patron-clan', 'company'] as const);
    if (a && kind === 'independent') allegiance = { kind };
    else if (a && kind === 'patron-clan') allegiance = { kind, patron: String(a.patron) as PatronId };
    else if (a && kind === 'company') allegiance = { kind, name: String(a.name), template: String(a.template) };
    if (allegiance) issues.list.push(...checkAllegiance(allegiance, 'allegiance'));
  }
  const log: LogEntry[] = [];
  if (!Array.isArray(obj.log)) issues.add('wrong-type', 'log', 'a list');
  else obj.log.forEach((e: unknown, i) => {
    const p = `log[${i}]`, o = readObject(issues, e, p, ['at', 'event', 'from', 'to', 'bronze']);
    if (!o) return;
    const at = readInt(issues, o, 'at', p, 0, Number.MAX_SAFE_INTEGER), bronze = readInt(issues, o, 'bronze', p, 0, Number.MAX_SAFE_INTEGER);
    const event = readEnum(issues, o, 'event', p, ['chose', 'left', 'switched', 'joined'] as const), to = readString(issues, o, 'to', p, { max: 64 });
    const from = o.from === null ? null : readString(issues, o, 'from', p, { max: 64 });
    if (at !== undefined && bronze !== undefined && event && to !== undefined && from !== undefined) log.push({ at, event, from, to, bronze });
  });
  return issues.finish({ kind: 'allegiance', version: version!, allegiance, since: since ?? null, nextJoinAt: nextJoinAt!, nextSwitchAt: nextSwitchAt!, log });
}

// ---------------------------------------------------------------------------------------------------------------------------------
// 4. Resolution: what the template does in one Origins fight. Read at engage for the world clock (it holds for the whole fight, §10.3) and
// at each hit for the fight's own state. Output is per-mille DELTAS (0 = unchanged), tagged for Origins: the live arena never reads them.
// Every template moves damage, so it resolves only in an Origins PvE fight (Strategy, 2026-10-07). The caller must name the venue: 'arena'
// (the live game: the Pit, arena duels) and 'pvp' (any player against player, Origins included) always resolve to zeros.

export const VENUES = ['origins-pve', 'arena', 'pvp'] as const;
export type Venue = (typeof VENUES)[number];
export type FightContext = {
  venue: Venue;
  clockHalf: 'day' | 'night';   // §10.3 worldTimeAt at engage: night is the last third of the day, the rest is day
  moon: number;                 // 0..7 at engage; 0–3 waxing, 4–7 waning
  fightTicks: number;           // ticks since the fight began, 60 Hz
  selfLevel: number; foeLevel: number;
  selfHealthPermille: number; foeHealthPermille: number;   // 0..1000 of max health
};
export type OriginsModifiers = { scope: 'origins'; template: string | null } & Record<Stat, number>;
export const NO_MODIFIERS: OriginsModifiers = { scope: 'origins', template: null, damageDealtPermille: 0, damageTakenPermille: 0, staminaCostPermille: 0 };
export const FIGHT_HALF_TICKS = 20 * 60;   // "a fight's first 20 s"

export function holds(when: When, f: FightContext): boolean {
  switch (when) {
    case 'always': return true;
    case 'clock-half:day': return f.clockHalf === 'day';
    case 'clock-half:night': return f.clockHalf === 'night';
    case 'moon:waxing': return f.moon >= 0 && f.moon <= 3;
    case 'moon:waning': return f.moon >= 4 && f.moon <= 7;
    case 'fight-time:before-20s': return f.fightTicks < FIGHT_HALF_TICKS;
    case 'fight-time:after-20s': return f.fightTicks >= FIGHT_HALF_TICKS;
    case 'foe-level:higher': return f.foeLevel > f.selfLevel;
    case 'foe-level:lower': return f.foeLevel < f.selfLevel;
    case 'foe-health:below-half': return f.foeHealthPermille < 500;
    case 'foe-health:above-half': return f.foeHealthPermille > 500;
    case 'self-health:below-half': return f.selfHealthPermille < 500;
    case 'self-health:above-half': return f.selfHealthPermille > 500;
  }
}

export function resolvePerk(allegiance: Allegiance | null, f: FightContext): OriginsModifiers {
  const t = f.venue === 'origins-pve' ? templateOf(allegiance) : null;
  if (!t) return NO_MODIFIERS;
  const out: OriginsModifiers = { ...NO_MODIFIERS, template: t.id };
  for (const s of [t.gain, t.cost]) if (holds(s.when, f)) out[s.stat] += s.value;
  return out;
}

// Applying a delta to an integer quantity (damage, stamina): floor((v × (1000 + d)) / 1000). Integer in, integer out; d = 0 returns v.
export const applyPermille = (value: number, delta: number): number => (delta === 0 ? value : Math.floor((value * (1000 + delta)) / 1000));
