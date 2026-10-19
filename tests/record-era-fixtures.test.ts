// Record-era fixtures (external audit 2026-10-18 F5): one stored kill-link record per era stamp, append-only, each replaying to its pinned ticks, outcome and
// landed hits forever or retired by a REACH bump that names its fight (scripts/record-era-fixtures.mjs). The negative controls are the audit's acceptance:
// dropping an era's entry, mutating a pin, or a record that replays to a different fight must fail.
import './lib/era-off.ts';   // RV78: the legacy suite runs on trunk's rules; sandbox-era.ts is the one switch (tests/lib/era-off.ts)
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { checkEraFixtures, currentStamp, FIXTURE, RECIPES } from '../scripts/record-era-fixtures.mjs';
import { decodeRecord, encodeRecord, REACH, RECORD_VERSION } from '../src/fight/record.ts';

type Entry = { name: string; encoded: string; expect: { v: number; ticks: number; outcome: string; hits: number[] } };
const fixture = JSON.parse(readFileSync(FIXTURE, 'utf8')) as { records: Entry[] };
const clone = (): { records: Entry[] } => JSON.parse(JSON.stringify(fixture));

test('every stored era record replays to its pin (or is retired by a REACH bump naming its fight), and every recipe\'s current stamp has an entry', async () => {
  const { problems, results } = await checkEraFixtures(fixture);
  assert.deepEqual(problems, []);
  assert.ok(results.length >= Object.keys(RECIPES).length);
  // A digest-only bump (rows shipped off, no fight stamped at it, REACH[RECORD_VERSION] empty: RV77) has no record of its own: the newest stamp any recipe writes must have one, and a bump that DOES stamp a recipe needs its entry.
  const stampedAtCeiling = Object.keys(RECIPES).some((n) => currentStamp(n) === RECORD_VERSION);
  assert.ok(!stampedAtCeiling || fixture.records.some((e) => e.expect.v === RECORD_VERSION), 'the newest era (RECORD_VERSION) has a stored record');
  assert.ok(stampedAtCeiling || (REACH[RECORD_VERSION] ?? []).length === 0, 'a bump that reaches a fight stamps it, and its recipe has a record');
});

test('the eras are distinct stamps of the live recorder: plain, patron, gambit, stances, pose, sheet, spell, SPECIAL 2 and the v76 cave troll', () => {
  const stamps = Object.keys(RECIPES).map((n) => [n, currentStamp(n)] as const);
  assert.ok(new Set(stamps.map(([, v]) => v)).size === stamps.length, JSON.stringify(stamps));
});

test('negative control: an era with no stored record fails, naming the --append fix', async () => {
  const f = clone(); f.records = f.records.filter((e) => e.name !== 'spell');
  const { problems } = await checkEraFixtures(f);
  assert.ok(problems.some((p) => /^spell: the live recorder stamps v\d+ and no stored record has it; run .*--append/.test(p)), problems.join(' | '));
});

test('negative control: a mutated pin fails (ticks, outcome, or the landed hits of the same finish)', async () => {
  for (const mutate of [(e: Entry) => { e.expect.ticks += 1; }, (e: Entry) => { e.expect.outcome = 'killed'; }, (e: Entry) => { e.expect.hits = [e.expect.hits[0]! + 1, e.expect.hits[1]!]; }]) {
    const f = clone(); mutate(f.records.find((e) => e.name === 'sheet')!);
    assert.ok((await checkEraFixtures(f)).problems.some((p) => p.startsWith('sheet ')), 'the mutation is caught');
  }
});

test('negative control: a stored record that now replays to a different fight fails (its intents changed under the same version)', async () => {
  const f = clone(), e = f.records.find((x) => x.name === 'plain')!, rec = await decodeRecord(e.encoded);
  rec.intents = rec.intents.map((i) => (i.action === 'light' ? { ...i, action: null } : i));   // the same header and version, but the hero never swings: a different fight under the same stamp
  e.encoded = await encodeRecord(rec);
  const { problems } = await checkEraFixtures(f);
  assert.ok(problems.some((p) => p.startsWith('plain ')), problems.join(' | '));
});

test('the replay checks a record the way the paying sweeps do: its sheet against the entry\'s STORED server view, its spell through the one spell gate', async () => {
  const f = clone(), sheet = f.records.find((e) => e.name === 'sheet')! as Entry & { server: { sheet: Record<string, number> } };
  sheet.server.sheet = { ...sheet.server.sheet, health: 71 };   // the stored build no longer gives the record's sheet
  assert.ok((await checkEraFixtures(f)).problems.some((p) => /^sheet v\d+: no longer replays: .*stored build/.test(p)), 'the record\'s own sheet is never trusted');
  const spell = fixture.records.find((e) => e.name === 'spell')! as Entry & { expect: { gate: string | null } };
  assert.match(String(spell.expect.gate), /names no stored build/, 'a spell record with no stored build is pinned as refused by the gate (never paid)');
});

test('a refusal not backed by a REACH bump fails; a record reached by a later bump counts as retired, not as a pass or a failure', async () => {
  const junk = clone(); junk.records.push({ ...junk.records[0]!, encoded: 'not-a-record' });
  assert.ok((await checkEraFixtures(junk)).problems.some((p) => /refused without a REACH bump/.test(p)));
  const v22 = (JSON.parse(readFileSync(new URL('./fixtures/v22-records.json', import.meta.url), 'utf8')) as { records: { opponent: string; encoded: string }[] }).records.find((r) => r.opponent === 'veteran')!;
  const reached = clone(); reached.records.push({ name: 'plain', encoded: v22.encoded, expect: { v: 22, ticks: 0, outcome: 'killed', hits: [0, 0] } });   // a v22 veteran link: reached by bump 29
  const { problems, results } = await checkEraFixtures(reached);
  assert.deepEqual(problems, []);
  assert.ok(results.some((r: { retired?: number }) => r.retired === 29), JSON.stringify(results));
});
