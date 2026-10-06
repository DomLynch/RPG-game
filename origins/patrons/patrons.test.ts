// Patrons and clans (patrons.ts): templates equal by construction, the patron list, the graduation choice, leave/switch pricing, the book,
// and resolution to Origins-only modifiers.
import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { parseCsv, patronsFromCsv, renderData } from './csv.ts';
import { PATRON_ROWS } from './patrons.data.ts';
import {
  applyPermille, bookLine, changeAllegiance, chooseAtGraduation, FIGHT_HALF_TICKS, holds, loadPatrons, NEW_ALLEGIANCE, NO_MODIFIERS, parseAllegianceState,
  parsePerkTemplate, PATRONS, PERK_BUDGET_PERMILLE, PERK_TEMPLATE_DATA, PERK_TEMPLATES, resolvePerk, RULES, STATS, templateText, VENUES, WHENS, COMPLEMENT,
  type Allegiance, type AllegianceState, type FightContext, type PatronId, type When,
} from './patrons.ts';

const server = (careerLevel: number) => ({ source: 'server' as const, careerLevel });
const GLADIATOR = server(11), T0 = 1_790_000_000;
const zeus: Allegiance = { kind: 'patron-clan', patron: 'patron:zeus' as PatronId };
const hel: Allegiance = { kind: 'patron-clan', patron: 'patron:hel' as PatronId };
const ind: Allegiance = { kind: 'independent' };
const value = <V>(r: { ok: true; value: V } | { ok: false; issues: unknown[] }): V => { if (!r.ok) assert.fail(JSON.stringify(r.issues)); return r.value; };
const chosen = (a: Allegiance): AllegianceState => value(chooseAtGraduation(NEW_ALLEGIANCE, a, { standing: GLADIATOR, at: T0 })).state;

// ---------------------------------------------------------------------------------------------------------------------------------
// Templates.

test('the eleven §10.2 templates load, each a +3% gain and a matching −3% cost', () => {
  assert.deepEqual([...PERK_TEMPLATES.keys()].sort(), ['closer', 'day-half', 'finisher', 'glass', 'iron-hide', 'last-stand', 'night-half', 'opener', 'tireless', 'underdog', 'waxing']);
  assert.equal(PERK_BUDGET_PERMILLE, 30);
  assert.equal(templateText(PERK_TEMPLATES.get('night-half')!), '+3% damage in the night half · −3% damage in the day half');
  assert.equal(templateText(PERK_TEMPLATES.get('iron-hide')!), '−3% damage taken · −3% damage');
});

// Equal power by construction: over every fight context, the gain and the cost of a conditional template hold on complementary halves
// (exactly one, or neither at the boundary), and an always-on template's net benefit is zero.
const contexts = function* (): Generator<FightContext> {
  for (const clockHalf of ['day', 'night'] as const) for (const moon of [0, 3, 4, 7]) for (const fightTicks of [0, FIGHT_HALF_TICKS - 1, FIGHT_HALF_TICKS, 9999])
    for (const [selfLevel, foeLevel] of [[12, 11], [12, 12], [12, 13]]) for (const h of [0, 499, 500, 501, 1000]) yield { venue: 'origins-pve', clockHalf, moon, fightTicks, selfLevel: selfLevel!, foeLevel: foeLevel!, selfHealthPermille: h, foeHealthPermille: 1000 - h };
};
test('every template is equal power: never both sides at once (conditional), always both (always-on), net benefit 0', () => {
  const sign = { damageDealtPermille: 1, damageTakenPermille: -1, staminaCostPermille: -1 } as const;
  for (const t of PERK_TEMPLATES.values()) {
    assert.equal(sign[t.gain.stat] * t.gain.value + sign[t.cost.stat] * t.cost.value, 0, t.id);
    for (const f of contexts()) {
      const g = holds(t.gain.when, f), c = holds(t.cost.when, f);
      if (t.gain.when === 'always') assert.ok(g && c, t.id); else assert.ok(!(g && c), `${t.id} both halves at once`);
    }
  }
  for (const w of WHENS) assert.equal(COMPLEMENT[COMPLEMENT[w]], w, `${w} complement is an involution`);
});
test('each conditional pair splits a fight into halves of equal measure (the clock and moon by construction, the rest symmetric)', () => {
  const fullCycle = (w: When) => [...contexts()].filter((f) => holds(w, f)).length;
  for (const t of PERK_TEMPLATES.values()) if (t.gain.when !== 'always') assert.equal(fullCycle(t.gain.when), fullCycle(t.cost.when), t.id);
});

test('the reader refuses every template that is not a sidegrade', () => {
  const base = PERK_TEMPLATE_DATA[0] as { gain: object; cost: object };
  const bad: [string, unknown][] = [
    ['over budget', { ...base, gain: { when: 'clock-half:day', stat: 'damageDealtPermille', value: 31 } }],
    ['under budget', { ...base, gain: { when: 'clock-half:day', stat: 'damageDealtPermille', value: 20 } }],
    ['not complementary', { ...base, cost: { when: 'moon:waning', stat: 'damageDealtPermille', value: -30 } }],
    ['cost not a cost', { ...base, cost: { when: 'clock-half:night', stat: 'damageDealtPermille', value: 30 } }],
    ['gain not a gain', { ...base, gain: { when: 'clock-half:day', stat: 'damageDealtPermille', value: -30 }, cost: { when: 'clock-half:night', stat: 'damageDealtPermille', value: 30 } }],
    ['always, same stat', { ...base, gain: { when: 'always', stat: 'damageDealtPermille', value: 30 }, cost: { when: 'always', stat: 'damageDealtPermille', value: -30 } }],
    ['always, two gains', { ...base, gain: { when: 'always', stat: 'damageDealtPermille', value: 30 }, cost: { when: 'always', stat: 'damageTakenPermille', value: -30 } }],
    ['conditional across stats', { ...base, cost: { when: 'clock-half:night', stat: 'staminaCostPermille', value: 30 } }],
    ['always with a condition', { ...base, gain: { when: 'always', stat: 'damageDealtPermille', value: 30 } }],
    ['raw stat', { ...base, gain: { when: 'clock-half:day', stat: 'reach', value: 30 } }],
    ['float', { ...base, gain: { when: 'clock-half:day', stat: 'damageDealtPermille', value: 29.5 } }],
    ['extra field', { ...base, tick: 1 }],
    ['wrong kind', { ...base, kind: 'clan' }],
    ['wrong version', { ...base, schemaVersion: 2 }],
    ['bad id', { ...base, id: 'Day Half' }],
  ];
  for (const [why, raw] of bad) assert.equal(parsePerkTemplate(raw).ok, false, why);
  for (const raw of PERK_TEMPLATE_DATA) assert.ok(parsePerkTemplate(raw).ok);
});

test('stats are only damage dealt, damage taken and stamina cost: no tick, reach or timing ever', () => {
  assert.deepEqual([...STATS], ['damageDealtPermille', 'damageTakenPermille', 'staminaCostPermille']);
});

// ---------------------------------------------------------------------------------------------------------------------------------
// The patron list.

test('the patron list: 124 patrons from legends-500.csv, every one on a known template, ids unique', () => {
  assert.equal(PATRON_ROWS.length, 124);
  assert.equal(PATRONS.size, 124);
  for (const p of PATRONS.values()) assert.ok(PERK_TEMPLATES.has(p.template) && p.perk.id === p.template && p.clan === `clan:${p.id}`, p.id);
  assert.equal(PATRONS.get('patron:zeus' as PatronId)?.template, 'opener', 'living-world §10.2 sample: Sworn of Zeus, opener');
  assert.equal(PATRONS.get('patron:hades' as PatronId)?.template, 'iron-hide');
});
test('a bad list is refused whole: unknown template, duplicate, bad id', () => {
  const zeusRow = PATRON_ROWS[0]!;
  assert.equal(loadPatrons([{ ...zeusRow, template: 'edge' }]).ok, false);
  assert.equal(loadPatrons([zeusRow, zeusRow]).ok, false);
  assert.equal(loadPatrons([{ ...zeusRow, id: 'Zeus!' }]).ok, false);
});
test('the CSV reader: quotes, escaped quotes, quoted commas and newlines, CRLF', () => {
  assert.deepEqual(parseCsv('a,"b,c","d ""e""",\r\n"x\ny",z\n'), [['a', 'b,c', 'd "e"', ''], ['x\ny', 'z']]);
  assert.throws(() => parseCsv('a,"b'));
});
// One source of truth: when the list is in the tree (after PR #1498 merges), the generated data must be exactly what it gives today.
const CSV = fileURLToPath(new URL('../../docs/specs/origins/legends-500.csv', import.meta.url));
test('patrons.data.ts is the CSV, regenerated (drift check)', { skip: !existsSync(CSV) && 'legends-500.csv is not in this tree yet (PR #1498)' }, () => {
  const rows = patronsFromCsv(readFileSync(CSV, 'utf8'));
  assert.deepEqual(rows, PATRON_ROWS);
  assert.equal(renderData(rows), readFileSync(new URL('./patrons.data.ts', import.meta.url), 'utf8'), 'run node origins/patrons/generate.ts');
});

// ---------------------------------------------------------------------------------------------------------------------------------
// The choice at graduation.

test('the choice opens at Gladiator (level 11) on a server-verified career, and not before', () => {
  assert.equal(chooseAtGraduation(NEW_ALLEGIANCE, zeus, { standing: server(10), at: T0 }).ok, false, 'Legionary V');
  assert.equal(chooseAtGraduation(NEW_ALLEGIANCE, zeus, { standing: { source: 'device', careerLevel: 30 }, at: T0 }).ok, false, 'a device figure opens nothing');
  for (const a of [zeus, ind, { kind: 'company', name: "Orla's Hammers", template: 'tireless' } as Allegiance]) {
    const r = value(chooseAtGraduation(NEW_ALLEGIANCE, a, { standing: GLADIATOR, at: T0 }));
    assert.equal(r.charged, 0, 'the first choice is free');
    assert.deepEqual(r.state.allegiance, a);
    assert.equal(r.state.version, 1);
    assert.equal(r.state.log.length, 1);
    assert.equal(r.entry.event, 'chose');
  }
});
test('the graduation choice is made once, and only of a real patron or a well-formed company', () => {
  assert.equal(chooseAtGraduation(chosen(zeus), hel, { standing: GLADIATOR, at: T0 }).ok, false);
  assert.equal(chooseAtGraduation(NEW_ALLEGIANCE, { kind: 'patron-clan', patron: 'patron:yahweh' as PatronId }, { standing: GLADIATOR, at: T0 }).ok, false);
  assert.equal(chooseAtGraduation(NEW_ALLEGIANCE, { kind: 'company', name: 'X', template: 'glass' }, { standing: GLADIATOR, at: T0 }).ok, false, 'name too short');
  assert.equal(chooseAtGraduation(NEW_ALLEGIANCE, { kind: 'company', name: 'The Raw Stats', template: 'edge' }, { standing: GLADIATOR, at: T0 }).ok, false, 'a company picks a fixed template');
  assert.equal(chooseAtGraduation(NEW_ALLEGIANCE, zeus, { standing: GLADIATOR, at: 1.5 }).ok, false);
});

// ---------------------------------------------------------------------------------------------------------------------------------
// Leaving and switching (§10.6).

test('switching clan costs 2,000 bronze, waits 28 days, and is logged', () => {
  const s = chosen(zeus), day = 86400;
  assert.equal(changeAllegiance(s, hel, { standing: GLADIATOR, at: T0 + 1, bronze: 1999 }).ok, false, 'cannot pay');
  const r = value(changeAllegiance(s, hel, { standing: GLADIATOR, at: T0 + 1, bronze: 5000 }));
  assert.equal(r.charged, RULES.switchBronze);
  assert.equal(r.charged, 2000);
  assert.deepEqual(r.entry, { at: T0 + 1, event: 'switched', from: 'clan:zeus', to: 'clan:hel', bronze: 2000 });
  assert.equal(r.state.nextSwitchAt, T0 + 1 + 28 * day);
  assert.equal(changeAllegiance(r.state, zeus, { standing: GLADIATOR, at: T0 + 28 * day, bronze: 5000 }).ok, false, 'inside the 28 days');
  assert.ok(changeAllegiance(r.state, zeus, { standing: GLADIATOR, at: T0 + 1 + 28 * day, bronze: 5000 }).ok, 'after the 28 days');
  assert.equal(changeAllegiance(r.state, hel, { standing: GLADIATOR, at: T0 + 99 * day, bronze: 5000 }).ok, false, 'already sworn there');
});
test('leaving is free; joining again waits 7 days, and is free once 28 days have passed since leaving', () => {
  const day = 86400, left = value(changeAllegiance(chosen(zeus), ind, { standing: GLADIATOR, at: T0 + 10, bronze: 0 }));
  assert.equal(left.charged, 0);
  assert.equal(left.state.nextJoinAt, T0 + 10 + 7 * day);
  assert.equal(changeAllegiance(left.state, hel, { standing: GLADIATOR, at: T0 + 7 * day, bronze: 5000 }).ok, false, 'inside the 7 days');
  const back = value(changeAllegiance(left.state, hel, { standing: GLADIATOR, at: T0 + 10 + 28 * day, bronze: 0 }));
  assert.equal(back.charged, 0);
  assert.deepEqual(back.state.log.map((e) => e.event), ['chose', 'left', 'joined']);
  assert.equal(changeAllegiance(NEW_ALLEGIANCE, ind, { standing: GLADIATOR, at: T0, bronze: 0 }).ok, false, 'choose at graduation first');
});
// Strategy, 2026-10-07: going Independent is free but does not reset the clock, so it is no way round the switch cost.
test('leave clan A, stand Independent, join clan B: on day 10 it costs 2,000 bronze and starts the 28-day wait; on day 29 it is free', () => {
  const day = 86400, left = value(changeAllegiance(chosen(zeus), ind, { standing: GLADIATOR, at: T0, bronze: 0 })).state;
  assert.equal(changeAllegiance(left, hel, { standing: GLADIATOR, at: T0 + 10 * day, bronze: 1999 }).ok, false, 'day 10, cannot pay');
  const paid = value(changeAllegiance(left, hel, { standing: GLADIATOR, at: T0 + 10 * day, bronze: 5000 }));
  assert.equal(paid.charged, RULES.switchBronze);
  assert.deepEqual(paid.entry, { at: T0 + 10 * day, event: 'joined', from: 'independent', to: 'clan:hel', bronze: 2000 });
  assert.equal(paid.state.nextSwitchAt, T0 + 38 * day, 'the 28-day switch wait starts on joining');
  assert.equal(changeAllegiance(paid.state, zeus, { standing: GLADIATOR, at: T0 + 37 * day, bronze: 5000 }).ok, false, 'under the switch wait');
  assert.equal(changeAllegiance(left, hel, { standing: GLADIATOR, at: T0 + 28 * day - 1, bronze: 0 }).ok, false, 'the last second of the window still costs');
  const free = value(changeAllegiance(left, hel, { standing: GLADIATOR, at: T0 + 29 * day, bronze: 0 }));
  assert.equal(free.charged, 0, 'day 29 is outside the window');
  assert.equal(free.state.nextSwitchAt, 0);
  // The wait from a paid switch holds through a spell as Independent too.
  const switched = value(changeAllegiance(chosen(zeus), hel, { standing: GLADIATOR, at: T0, bronze: 2000 })).state;
  const out = value(changeAllegiance(switched, ind, { standing: GLADIATOR, at: T0 + day, bronze: 0 })).state;
  assert.equal(changeAllegiance(out, zeus, { standing: GLADIATOR, at: T0 + 10 * day, bronze: 5000 }).ok, false, 'still inside the switch wait');
  assert.equal(value(changeAllegiance(out, zeus, { standing: GLADIATOR, at: T0 + 28 * day, bronze: 5000 })).charged, 2000, 'wait over, still inside 28 days of leaving');
  // Independent from graduation never left a clan: joining is free.
  assert.equal(value(changeAllegiance(chosen(ind), hel, { standing: GLADIATOR, at: T0 + 1, bronze: 0 })).charged, 0);
});
test('the book reads each change in the Exchange-book wording', () => {
  const s1 = chosen(zeus), s2 = value(changeAllegiance(s1, hel, { standing: GLADIATOR, at: T0 + 5, bronze: 2000 })).state;
  const s3 = value(changeAllegiance(s2, ind, { standing: GLADIATOR, at: T0 + 6, bronze: 0 })).state;
  assert.deepEqual(s3.log.map((e) => bookLine(e, 'Aldren')), [
    'Aldren swore to the clan of Zeus on 2026-09-21.', 'Aldren forsook the clan of Zeus for the clan of Hel on 2026-09-21.', 'Aldren left the clan of Hel on 2026-09-21.',
  ]);
  assert.equal(bookLine(chosen(ind).log[0]!, 'Aldren'), 'Aldren chose to stand Independent on 2026-09-21.');
});

test('a stored state round-trips through the reader; anything else is refused', () => {
  const s = value(changeAllegiance(chosen({ kind: 'company', name: 'Grey Company', template: 'opener' }), zeus, { standing: GLADIATOR, at: T0 + 1, bronze: 2000 })).state;
  assert.deepEqual(value(parseAllegianceState(JSON.parse(JSON.stringify(s)))), s);
  assert.deepEqual(value(parseAllegianceState(JSON.parse(JSON.stringify(NEW_ALLEGIANCE)))), NEW_ALLEGIANCE);
  for (const bad of [null, [], { ...s, kind: 'x' }, { ...s, version: -1 }, { ...s, allegiance: { kind: 'patron-clan', patron: 'patron:nobody' } },
    { ...s, allegiance: { kind: 'company', name: 'Ok Name', template: 'edge' } }, { ...s, log: [{ at: 1 }] }, { ...s, extra: 1 }, { ...s, nextJoinAt: 1.5 }]) {
    assert.equal(parseAllegianceState(bad).ok, false, JSON.stringify(bad));
  }
});

// ---------------------------------------------------------------------------------------------------------------------------------
// Resolution to Origins-only modifiers.

const fight = (over: Partial<FightContext> = {}): FightContext => ({ venue: 'origins-pve', clockHalf: 'day', moon: 0, fightTicks: 0, selfLevel: 12, foeLevel: 12, selfHealthPermille: 1000, foeHealthPermille: 1000, ...over });
test('Independent, no choice, or a missing template: all zeros, tagged origins', () => {
  assert.deepEqual(resolvePerk(null, fight()), NO_MODIFIERS);
  assert.deepEqual(resolvePerk(ind, fight()), NO_MODIFIERS);
  assert.equal(NO_MODIFIERS.scope, 'origins');
});
test('a patron clan resolves its template against the fight', () => {
  // Zeus: opener. +30 dealt in the first 20 s, −30 after.
  assert.equal(resolvePerk(zeus, fight({ fightTicks: 0 })).damageDealtPermille, 30);
  assert.equal(resolvePerk(zeus, fight({ fightTicks: FIGHT_HALF_TICKS })).damageDealtPermille, -30);
  // Hades: iron-hide, always on both.
  const hades = resolvePerk({ kind: 'patron-clan', patron: 'patron:hades' as PatronId }, fight());
  assert.deepEqual(hades, { scope: 'origins', template: 'iron-hide', damageDealtPermille: -30, damageTakenPermille: -30, staminaCostPermille: 0 });
  // A company with underdog: neither half at equal level.
  const co: Allegiance = { kind: 'company', name: 'Grey Company', template: 'underdog' };
  assert.equal(resolvePerk(co, fight()).damageDealtPermille, 0);
  assert.equal(resolvePerk(co, fight({ foeLevel: 13 })).damageDealtPermille, 30);
  assert.equal(resolvePerk(co, fight({ foeLevel: 11 })).damageDealtPermille, -30);
});
// Strategy, 2026-10-07: every template moves damage, so the templates are Origins PvE only. The arena gets only Combat's no-damage
// sidegrades (patron-perks-sim.md), never these; PvP gets none of them either.
test('damage templates never resolve outside Origins PvE: the arena and PvP get all zeros for every patron, company and context', () => {
  assert.deepEqual([...VENUES], ['origins-pve', 'arena', 'pvp']);
  const allegiances: Allegiance[] = [...[...PATRONS.values()].map((p): Allegiance => ({ kind: 'patron-clan', patron: p.patron })),
    ...[...PERK_TEMPLATES.keys()].map((template): Allegiance => ({ kind: 'company', name: 'Grey Company', template }))];
  for (const venue of ['arena', 'pvp'] as const) for (const a of allegiances) for (const f of contexts()) {
    assert.deepEqual(resolvePerk(a, { ...f, venue }), NO_MODIFIERS, `${venue} ${JSON.stringify(a)}`);
  }
  assert.equal(resolvePerk(zeus, fight({ venue: 'arena', fightTicks: 0 })).damageDealtPermille, 0);
  assert.equal(resolvePerk(zeus, fight({ fightTicks: 0 })).damageDealtPermille, 30, 'the same fight in Origins PvE');
});
test('applyPermille: integer in, integer out; a zero delta is the identity', () => {
  assert.equal(applyPermille(100, 30), 103);
  assert.equal(applyPermille(100, -30), 97);
  assert.equal(applyPermille(77, 0), 77);
  for (let v = 0; v < 500; v++) assert.ok(Number.isInteger(applyPermille(v, 30)) && Number.isInteger(applyPermille(v, -30)));
});
test('every patron resolves inside the ±3% budget on every stat, in every context', () => {
  for (const p of PATRONS.values()) for (const f of contexts()) {
    const m = resolvePerk({ kind: 'patron-clan', patron: p.patron }, f);
    for (const s of STATS) assert.ok(Math.abs(m[s]) <= PERK_BUDGET_PERMILLE, `${p.id} ${s}`);
  }
});
