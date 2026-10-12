// The contract vocabularies that are data (src/core/contracts/definitions.json): gates, relations, quest roles, attitudes and quest scopes are ROWS. A new value is one row and no code, an unknown id still
// rejects, and the lists whose values select their own code path (ENCOUNTER_SCOPES, STAGE_KINDS, CONDITION_KINDS, QUEST_STATUSES) stay code.
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { cpSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import test from 'node:test';
import { buildTables, checkTables } from '../src/core/server.ts';
import defs from '../src/core/contracts/definitions.json' with { type: 'json' };
import manifest from '../src/core/contracts/definitions.manifest.json' with { type: 'json' };
import { ATTITUDES, GATES, GATE_TIER, QUEST_ROLES, RELATIONS, attitudeFor, attitudeOf, membershipRequired } from '../src/core/contracts/world.ts';
import { QUEST_SCOPES, STAGE_KINDS, CONDITION_KINDS, QUEST_STATUSES } from '../src/core/contracts/story.ts';

const problems = (d: unknown) => checkTables(buildTables(manifest.tables.map((m) => ({ manifest: m as never, parsed: d, file: 'definitions.json' })))).problems.map((p) => `${p.id} ${p.rule}: ${p.message}`);

test('the lists the old code held as const arrays are the rows, in the same order', () => {
  assert.deepEqual(GATES, ['pit', 'outer', 'second-realm', 'endgame']);
  assert.deepEqual(RELATIONS, ['ally', 'rival', 'enemy', 'kin', 'patron', 'servant']);
  assert.deepEqual(QUEST_ROLES, ['giver', 'witness', 'target', 'ally', 'boss']);
  assert.deepEqual(ATTITUDES, ['hostile', 'angry', 'neutral', 'friendly']);
  assert.deepEqual(QUEST_SCOPES, ['personal', 'party', 'world']);
  assert.deepEqual(GATES.map((g) => GATE_TIER[g]), ['Recruit', 'Gladiator', 'Champion', 'Origin']);
  assert.deepEqual(GATES.map(membershipRequired), [false, false, true, true]);
});

test('the attitude walk gives the old function\'s answers at every band edge, for the whole standing range, expelled or not', () => {
  const old = (n: number) => (n <= -500 ? 'hostile' : n <= -100 ? 'angry' : n >= 250 ? 'friendly' : 'neutral');
  for (let n = -1000; n <= 1000; n++) assert.equal(attitudeFor(n), old(n), String(n));
  for (let n = -1000; n <= 1000; n += 7) { const a = old(n); assert.equal(attitudeOf({ expelled: true, standing: n } as never), a === 'neutral' || a === 'friendly' ? 'angry' : a); assert.equal(attitudeOf({ expelled: false, standing: n } as never), a); }
});

test('the registry manifest holds for the real rows, and the loader names a missing field and a wrong type', () => {
  assert.deepEqual(problems(defs), []);
  const bad = structuredClone(defs) as Record<string, Record<string, Record<string, unknown>>>;
  delete bad.gates!.outer!.tier; bad.attitudes!.angry!.order = 'second';
  const text = problems(bad).join('; ');
  assert.match(text, /outer missing-field: tier is required/); assert.match(text, /angry wrong-type: order must be integer/);
});

test('the lists whose values select their own code path stay code (the verb test)', () => {
  assert.deepEqual([...STAGE_KINDS], ['progress', 'finish', 'fail']); assert.deepEqual([...QUEST_STATUSES], ['active', 'finished', 'failed']); assert.equal(CONDITION_KINDS.length, 8);
});

test('a new relation, quest role, quest scope and gate is ONE ROW in a copy of the tree, no code; an unknown id still rejects', () => {
  const dir = mkdtempSync(join(tmpdir(), 'contract-defs-'));
  try {
    cpSync('origins', join(dir, 'origins'), { recursive: true }); cpSync('src', join(dir, 'src'), { recursive: true });
    for (const link of ['scripts', 'package.json', 'node_modules']) symlinkSync(resolve(link), join(dir, link));
    const file = join(dir, 'src/core/contracts/definitions.json'), rows = JSON.parse(readFileSync(file, 'utf8'));
    rows.relations.mentor = {}; rows.questRoles.herald = {}; rows.questScopes.guild = {}; rows.gates.deep = { order: 4, tier: 'Origin', membership: true };
    writeFileSync(file, JSON.stringify(rows));
    writeFileSync(join(dir, 'probe.ts'), `import { courier } from './src/core/contracts/fixtures.ts';
import { parseCharacterDefinition, GATES, RELATIONS, QUEST_ROLES, membershipRequired } from './src/core/contracts/world.ts';
import { QUEST_SCOPES } from './src/core/contracts/story.ts';
const mk = (relation: string, role: string) => { const c = courier(); c.relationships[0]!.relation = relation; c.questRoles[0]!.role = role; return parseCharacterDefinition(c).ok; };
console.log(JSON.stringify({ mentorHerald: mk('mentor', 'herald'), unknown: mk('stranger', 'witness'), unknownRole: mk('enemy', 'jester'), gates: GATES, deepMembership: membershipRequired('deep'), rel: RELATIONS.includes('mentor'), roles: QUEST_ROLES.includes('herald'), scope: QUEST_SCOPES.includes('guild') }));`);
    const out = spawnSync(process.execPath, ['probe.ts'], { cwd: dir, encoding: 'utf8' });
    assert.equal(out.status, 0, out.stderr);
    assert.deepEqual(JSON.parse(out.stdout.trim().split('\n').pop()!), { mentorHerald: true, unknown: false, unknownRole: false, gates: ['pit', 'outer', 'second-realm', 'endgame', 'deep'], deepMembership: true, rel: true, roles: true, scope: true });
  } finally { rmSync(dir, { recursive: true, force: true }); }
});
