// O1 world: access from the one career (ruling 2 gates, ruling 3 membership), CharacterInstance (no duplicate authority),
// CharacterDefinition (content rule, routines), factions and standing, regions and encounters.
import assert from 'node:assert/strict';
import test from 'node:test';
import { MAX_LEVEL, TITLES, levelOf, rankFor } from '../../src/career.ts';
import type { Result } from './core.ts';
import * as F from './fixtures.ts';
import {
  ATTITUDE_BANDS, GATE_TIER, STANDING_MAX, STANDING_MIN, adjustStanding, attitudeFor, attitudeOf, canPromote, checkStanding, gateAccess, membershipRequired,
  parseCharacterDefinition, parseCharacterInstance, parseEncounterDefinition, parseFactionDefinition, parseFactionStanding, parseRegionDefinition, rankOf,
  checkCareerStanding, titleForLevel,
  reactionOf, regionAccess, type CareerStanding, type FactionDefinition, type FactionStanding,
} from './world.ts';
import type { FactionId } from './ids.ts';

type Raw = Record<string, unknown>;
const refused = (r: Result<unknown>, code: string, path?: string): void => {
  assert.equal(r.ok, false, `expected ${code}${path ? ` at ${path}` : ''}`);
  if (r.ok) return;
  assert.ok(r.issues.some((i) => i.code === code && (path === undefined || i.path === path)), `want ${code}${path ? ` at ${path}` : ''}; got ${JSON.stringify(r.issues)}`);
};
const must = <T>(r: Result<T>): T => { assert.ok(r.ok, JSON.stringify(!r.ok && r.issues)); return r.value; };
// The gate input is the server's career level (computed by origins/progression from career credit). For a legacy account the level is
// today's levelOf(marks), so `marks(m)` is the standing an account with m victory marks has today.
const server = (careerLevel: number): CareerStanding => ({ source: 'server', careerLevel });
const marks = (m: number): CareerStanding => server(levelOf(m));

// ---- gates ----------------------------------------------------------------------------------------------------------------------------

test('gates: rank is the server career level, titled exactly as src/career.ts; legacy marks keep today\'s rank', () => {
  for (const m of [0, 9, 10, 14, 19, 20, 44, 45, 200]) {
    const today = rankFor(m);
    assert.deepEqual(rankOf(marks(m)), { level: today.level, title: today.title }, `${m} marks`);
  }
  assert.equal(TITLES.indexOf(GATE_TIER.outer) + 1, 3, 'ruling 2: Gladiator is rank 3');
});

test('gates: career level 11 opens the Gladiator gate; a level reached through world play alone opens it too', () => {
  assert.deepEqual(gateAccess('outer', server(10), false), { ok: false, reason: 'rank', needs: 'Gladiator' });
  assert.deepEqual(gateAccess('outer', server(11), false), { ok: true });
  // No Pit marks at all (today's rank would be Recruit I), but world play took the career to level 11: the gate opens.
  assert.equal(rankFor(0).title, 'Recruit');
  assert.deepEqual(gateAccess('outer', server(11), false), gateAccess('outer', marks(10), false));
  assert.deepEqual(gateAccess('second-realm', server(21), true), { ok: true });
});

test('gates: titles are cap-parametric — floor((level - 1) / 5), Origin at the top of any ladder', () => {
  assert.deepEqual([titleForLevel(1), titleForLevel(5), titleForLevel(6), titleForLevel(11), titleForLevel(45), titleForLevel(MAX_LEVEL)], ['Recruit', 'Recruit', 'Legionary', 'Gladiator', 'Invictus', 'Origin']);
  assert.deepEqual([titleForLevel(46, 50), titleForLevel(50, 50)], ['Origin', 'Origin']);
  assert.deepEqual(checkCareerStanding(server(50), 50), []);
  assert.equal(checkCareerStanding(server(51))[0]?.code, 'out-of-range', 'past the default cap of src/career.ts MAX_LEVEL');
});

test('gates: an out-of-range or non-integer career level is rejected and opens nothing', () => {
  for (const level of [0, -1, MAX_LEVEL + 1, 10.5, Number.NaN, Number.POSITIVE_INFINITY]) {
    assert.ok(checkCareerStanding(server(level)).length > 0, `level ${level} is refused`);
    const access = gateAccess('outer', server(level), true);
    assert.equal(access.ok, false, `level ${level} opens nothing`);
    assert.equal(!access.ok && access.reason, 'invalid');
  }
  assert.equal(checkCareerStanding({ source: 'server', careerLevel: '11' as unknown as number })[0]?.code, 'wrong-type');
  assert.equal(checkCareerStanding({ source: 'browser' as 'server', careerLevel: 11 })[0]?.code, 'wrong-type');
});

test('gates: Gladiator opens the outer gate, Champion the next realm, Origin the endgame; the Pit is always open', () => {
  assert.deepEqual(gateAccess('pit', { source: 'device', careerLevel: 1 }, false), { ok: true });
  assert.deepEqual(gateAccess('outer', marks(9), false), { ok: false, reason: 'rank', needs: 'Gladiator' }); // Legionary V
  assert.deepEqual(gateAccess('outer', marks(10), false), { ok: true }); // Gladiator I, no membership needed
  assert.deepEqual(gateAccess('second-realm', marks(19), true), { ok: false, reason: 'rank', needs: 'Champion' });
  assert.deepEqual(gateAccess('second-realm', marks(20), false), { ok: false, reason: 'membership', needs: 'membership' });
  assert.deepEqual(gateAccess('second-realm', marks(20), true), { ok: true });
  assert.deepEqual(gateAccess('endgame', marks(44), true), { ok: false, reason: 'rank', needs: 'Origin' });
  assert.deepEqual(gateAccess('endgame', marks(45), true), { ok: true });
});

test('gates: device marks never open a world gate, whatever they say', () => {
  assert.deepEqual(gateAccess('outer', { source: 'device', careerLevel: MAX_LEVEL }, true), { ok: false, reason: 'unverified', needs: 'a server-verified career level' });
});

test('gates: membership is derived from the gate (ruling 3), never authored', () => {
  assert.deepEqual([membershipRequired('pit'), membershipRequired('outer'), membershipRequired('second-realm'), membershipRequired('endgame')], [false, false, true, true]);
  const region = must(parseRegionDefinition(F.frontier()));
  assert.deepEqual(regionAccess(region, marks(10), false), { ok: true });
  refused(parseRegionDefinition({ ...F.frontier(), membership: 'free' }), 'unknown-field', 'membership');
});

// ---- characters -----------------------------------------------------------------------------------------------------------------------

const pcRaw = (patch: Raw = {}): Raw => ({ kind: 'character-instance', schemaVersion: 1, id: F.PC, account: F.ACCOUNT, name: 'Dom', createdAt: F.AT, ...patch });

test('character instance: parses; holds no second copy of marks, rank, stats or items', () => {
  must(parseCharacterInstance(pcRaw()));
  for (const field of ['victoryMarks', 'rank', 'level', 'stats', 'inventory', 'equipped', 'bank']) refused(parseCharacterInstance(pcRaw({ [field]: 1 })), 'unknown-field', field);
  refused(parseCharacterInstance(pcRaw({ schemaVersion: 2 })), 'unsupported-version');
  refused(parseCharacterInstance(pcRaw({ account: 'account:dom' })), 'bad-id', 'account');
  refused(parseCharacterInstance(pcRaw({ name: 'x'.repeat(33) })), 'out-of-range', 'name');
  refused(parseCharacterInstance(pcRaw({ createdAt: 'yesterday' })), 'wrong-type', 'createdAt');
  refused(parseCharacterInstance(pcRaw({ kind: 'character-definition' })), 'unknown-kind', 'kind');
});

test('character definition: fixtures parse, including a legend reused by its persisted key', () => {
  for (const build of [F.courier, F.varney, F.ghoul, F.smith]) must(parseCharacterDefinition(build()));
  refused(parseCharacterDefinition({ ...F.varney(), id: 'character:legend.nightborn-11' }), 'legacy-unknown', 'id');
});

test('character definition: the content rule tripwire (ruling 4) — whole names only', () => {
  for (const name of ['Lucifer', 'satan', 'Jesus', 'The Buddha', 'Vishnu', '  Allah ']) refused(parseCharacterDefinition({ ...F.courier(), name }), 'content-rule', 'name');
  for (const name of ['Hades', 'Ereshkigal', 'Mary Read', 'Anubis', 'Arawn']) must(parseCharacterDefinition({ ...F.courier(), name }));
});

test('character definition: every rejection path', () => {
  const c = F.courier();
  refused(parseCharacterDefinition({ ...c, relationships: [{ character: c.id, relation: 'ally' }] }), 'rule-violation', 'relationships[0]');
  refused(parseCharacterDefinition({ ...c, relationships: [{ character: 'character:x', relation: 'lover' }] }), 'wrong-type', 'relationships[0].relation');
  refused(parseCharacterDefinition({ ...c, questRoles: [{ quest: 'quest:x', role: 'king' }] }), 'wrong-type', 'questRoles[0].role');
  refused(parseCharacterDefinition({ ...c, presentations: [] }), 'out-of-range', 'presentations');
  refused(parseCharacterDefinition({ ...c, presentations: [c.presentations[0], c.presentations[0]] }), 'duplicate-id', 'presentations[1].id');
  refused(parseCharacterDefinition({ ...c, encounterForms: [{ id: 'x', opponent: null, level: null, encounter: null }] }), 'rule-violation', 'encounterForms[0]');
  refused(parseCharacterDefinition({ ...c, encounterForms: [{ id: 'x', opponent: 'veteran', level: null, encounter: null }] }), 'rule-violation', 'encounterForms[0].level');
  refused(parseCharacterDefinition({ ...c, encounterForms: [{ id: 'x', opponent: 'dragon', level: 5, encounter: null }] }), 'legacy-unknown', 'encounterForms[0].opponent');
  refused(parseCharacterDefinition({ ...c, encounterForms: [{ id: 'x', opponent: 'veteran', level: 51, encounter: null }] }), 'out-of-range', 'encounterForms[0].level');
  refused(parseCharacterDefinition({ ...c, lore: { source: 'original' } }), 'missing-field', 'lore.summary');
  const { faction: _f, ...noFaction } = c;
  void _f;
  refused(parseCharacterDefinition(noFaction), 'missing-field', 'faction');
});

test('character definition: a routine covers the whole day exactly once', () => {
  const entry = (start: string, end: string, waypoint = 'dock') => ({ start, end, activity: 'carry', region: 'region:ash-frontier', waypoint });
  must(parseCharacterDefinition({ ...F.courier(), routine: [entry('00:00', '00:01'), entry('00:01', '00:00')] }));
  refused(parseCharacterDefinition({ ...F.courier(), routine: [entry('06:00', '20:00'), entry('19:00', '06:00')] }), 'rule-violation', 'routine[1]'); // overlap
  refused(parseCharacterDefinition({ ...F.courier(), routine: [entry('06:00', '20:00'), entry('21:00', '06:00')] }), 'rule-violation', 'routine'); // gap 20:00
  refused(parseCharacterDefinition({ ...F.courier(), routine: [entry('06:00', '06:00')] }), 'rule-violation', 'routine[0]');
  refused(parseCharacterDefinition({ ...F.courier(), routine: [entry('6:00', '20:00')] }), 'wrong-type', 'routine[0].start');
  refused(parseCharacterDefinition({ ...F.courier(), routine: [entry('24:00', '20:00')] }), 'wrong-type', 'routine[0].start');
});

// ---- factions -------------------------------------------------------------------------------------------------------------------------

test('faction definition: fixtures parse; every rejection path', () => {
  must(parseFactionDefinition(F.ferryCourt()));
  must(parseFactionDefinition(F.bloodCourt()));
  const ranks = F.ferryCourt().ranks;
  refused(parseFactionDefinition({ ...F.ferryCourt(), ranks: [ranks[1], ranks[0]] }), 'rule-violation', 'ranks[1]');
  refused(parseFactionDefinition({ ...F.ferryCourt(), ranks: [] }), 'rule-violation', 'ranks');
  refused(parseFactionDefinition({ ...F.bloodCourt(), ranks }), 'rule-violation', 'ranks');
  refused(parseFactionDefinition({ ...F.ferryCourt(), ranks: Array.from({ length: 11 }, (_, i) => ({ id: `r${i}`, title: 'R', minStanding: i })) }), 'out-of-range', 'ranks');
  refused(parseFactionDefinition({ ...F.ferryCourt(), ranks: [ranks[0], { ...ranks[1], id: 'oarhand' }] }), 'duplicate-id', 'ranks[1].id');
  refused(parseFactionDefinition({ ...F.ferryCourt(), reactions: [F.ferryCourt().reactions[0], F.ferryCourt().reactions[0]] }), 'duplicate-id', 'reactions[1]');
  refused(parseFactionDefinition({ ...F.ferryCourt(), reactions: [{ faction: 'faction:blood-court', attitude: 3 }] }), 'wrong-type', 'reactions[0].attitude');
});

test('faction standing: a bounded number, membership and expulsion', () => {
  const def: FactionDefinition = must(parseFactionDefinition(F.ferryCourt()));
  const s: FactionStanding = must(parseFactionStanding(F.standing()));
  assert.deepEqual(checkStanding(s, def), []);
  refused(parseFactionStanding({ ...F.standing(), standing: STANDING_MAX + 1 }), 'out-of-range', 'standing');
  refused(parseFactionStanding({ ...F.standing(), rank: null, expelled: true }), 'rule-violation', 'expelled');
  refused(parseFactionStanding({ ...F.standing(), rank: 10 }), 'out-of-range', 'rank');
  assert.equal(checkStanding({ ...s, rank: 2 }, def)[0]!.code, 'out-of-range');
  assert.equal(checkStanding(s, must(parseFactionDefinition(F.bloodCourt())))[0]!.code, 'rule-violation');
  // Clamped: repeated favours cannot buy unlimited standing.
  assert.equal(adjustStanding(s, 5000).standing, STANDING_MAX);
  assert.equal(adjustStanding(s, -5000).standing, STANDING_MIN);
});

test('faction standing: four attitudes, expulsion caps at angry, promotion is offered not automatic', () => {
  assert.deepEqual([ATTITUDE_BANDS.hostileAtOrBelow, -499, ATTITUDE_BANDS.angryAtOrBelow, -99, 0, 249, ATTITUDE_BANDS.friendlyAtOrAbove].map(attitudeFor),
    ['hostile', 'angry', 'angry', 'neutral', 'neutral', 'neutral', 'friendly']);
  const def = must(parseFactionDefinition(F.ferryCourt()));
  const s = must(parseFactionStanding({ ...F.standing(), standing: 400 }));
  assert.equal(attitudeOf(s), 'friendly');
  assert.equal(attitudeOf({ ...s, expelled: true }), 'angry');
  assert.equal(canPromote(s, def), true); // 400 ≥ Pilot's 300
  assert.equal(canPromote({ ...s, standing: 299 }, def), false);
  assert.equal(canPromote({ ...s, expelled: true }, def), false);
  assert.equal(canPromote({ ...s, rank: 1 }, def), false); // no rank above Pilot
  assert.equal(canPromote({ ...s, rank: null }, def), true); // joining is rank 0
  assert.equal(reactionOf(def, 'faction:blood-court' as FactionId), 'hostile');
  assert.equal(reactionOf(must(parseFactionDefinition(F.bloodCourt())), 'faction:ferry-court' as FactionId), 'angry', 'directional');
  assert.equal(reactionOf(def, 'faction:nobody' as FactionId), 'neutral');
});

// ---- regions and encounters -------------------------------------------------------------------------------------------------------------

test('region definition: fixtures parse; every rejection path', () => {
  must(parseRegionDefinition(F.exchange()));
  must(parseRegionDefinition(F.frontier()));
  const r = F.frontier();
  refused(parseRegionDefinition({ ...r, gate: 'realm-2' }), 'wrong-type', 'gate');
  refused(parseRegionDefinition({ ...r, waypoints: [] }), 'out-of-range', 'waypoints');
  refused(parseRegionDefinition({ ...r, waypoints: ['dock', 'dock'] }), 'duplicate-id', 'waypoints');
  refused(parseRegionDefinition({ ...r, landmarks: [{ id: 'x', name: 'X', at: 'nowhere' }] }), 'unknown-id', 'landmarks[0].at');
  refused(parseRegionDefinition({ ...r, portals: [{ id: 'loop', at: 'dock', to: r.id, toPortal: 'loop' }] }), 'rule-violation', 'portals[0].to');
  refused(parseRegionDefinition({ ...r, spawns: [{ id: 'empty', at: 'dock', encounter: null, characters: [] }] }), 'rule-violation', 'spawns[0]');
  refused(parseRegionDefinition({ ...r, triggers: [r.triggers[0], r.triggers[0]] }), 'duplicate-id', 'triggers[1].id');
  refused(parseRegionDefinition({ ...r, assetManifest: '' }), 'out-of-range', 'assetManifest');
});

test('encounter definition: fixture parses; every rejection path', () => {
  must(parseEncounterDefinition(F.vigil()));
  const e = F.vigil();
  refused(parseEncounterDefinition({ ...e, scope: 'public' }), 'rule-violation', 'decay'); // a public event must decay
  must(parseEncounterDefinition({ ...e, scope: 'public', decay: { windowSeconds: 1800, keepProgressPercent: 20 } }));
  refused(parseEncounterDefinition({ ...e, stages: [] }), 'out-of-range', 'stages');
  refused(parseEncounterDefinition({ ...e, stages: [e.stages[0], e.stages[0]] }), 'duplicate-id', 'stages[1].id');
  refused(parseEncounterDefinition({ ...e, stages: [{ ...e.stages[0], killsToAdvance: 0 }] }), 'out-of-range', 'stages[0].killsToAdvance');
  refused(parseEncounterDefinition({ ...e, stages: [{ ...e.stages[0], roster: [] }] }), 'out-of-range', 'stages[0].roster');
  refused(parseEncounterDefinition({ ...e, stages: [{ ...e.stages[0], roster: [{ character: 'character:ruin-ghoul', weight: 0 }] }] }), 'out-of-range', 'stages[0].roster[0].weight');
  refused(parseEncounterDefinition({ ...e, decay: { windowSeconds: 10, keepProgressPercent: 20 } }), 'out-of-range', 'decay.windowSeconds');
  refused(parseEncounterDefinition({ ...e, rewards: { minContributionPercent: 101 } }), 'out-of-range', 'rewards.minContributionPercent');
  refused(parseEncounterDefinition({ ...e, boss: { character: 'character:legend.nightborn-3' } }), 'missing-field', 'boss.loot');
  assert.deepEqual(must(parseEncounterDefinition({ ...e, boss: { ...e.boss, level: 12, health: 9000 } })).boss, { ...e.boss, level: 12, health: 9000 });
  refused(parseEncounterDefinition({ ...e, boss: { ...e.boss, level: MAX_LEVEL + 1 } }), 'out-of-range', 'boss.level');
  refused(parseEncounterDefinition({ ...e, boss: { ...e.boss, health: 0 } }), 'out-of-range', 'boss.health');
});
