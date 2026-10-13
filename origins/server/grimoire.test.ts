import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { encounterOps } from './encounter.ts';
import { ACCOUNT, CHAR, fakeDb, deps, fight, RESOLVED } from './encounter-fixtures.ts';
import { legendOfFight, spellLines, takeSpell, type Grimoire } from './grimoire.ts';
import { SPELL_BRICKS } from '../../src/fight/boss-spells.ts';
import { BOSSES } from '../../src/fight/boss-rows.ts';
import { Conflict } from './errors.ts';

const ctx = (db: ReturnType<typeof fakeDb>['db']) => ({ db, account: ACCOUNT });

test('takeSpell: two different legends at the same rank of one family each grant their own spell; the same legend twice grants once', () => {
  let g: Grimoire = {};
  const x = { root: 'crack', modifiers: [], suffix: null }, y = { root: 'longShadow', modifiers: [], suffix: null };
  const a = takeSpell(g, 'alpha-8', x); g = a.grimoire;
  const b = takeSpell(g, 'beta-8', y); g = b.grimoire;   // same family, same rank, another legend
  assert.deepEqual([a.reason, b.reason], ['taken', 'taken']);
  assert.deepEqual(g, { 'alpha-8': x, 'beta-8': y });
  const again = takeSpell(g, 'alpha-8', x);
  assert.equal(again.reason, 'already-taken'); assert.equal(again.grimoire, g, 'nothing changed');
  assert.equal(takeSpell(g, 'gamma-8', undefined).reason, 'no-spell');
});

test('the spell catalogue is the one source: every spell row is a legend, and a boss with no spell row grants nothing', () => {
  assert.equal(Object.keys(SPELL_BRICKS).length, 700);
  assert.equal(legendOfFight('boss:eloko'), 'eloko'); assert.equal(legendOfFight('boss:no-such-legend'), null);
  assert.equal(legendOfFight('encounter:knight'), null); assert.equal(legendOfFight(null), null);
  assert.deepEqual(spellLines('boss:eloko'), [{ legend: 'eloko', bricks: { ...SPELL_BRICKS.eloko! }, key: 'spell:eloko' }]); assert.deepEqual(spellLines('encounter:knight'), []);
  for (const row of BOSSES) {   // the presentation rows carry no spell of their own; one with no catalogue row takes nothing, not a placeholder
    if (Object.hasOwn(SPELL_BRICKS, row.id)) continue;
    assert.equal(legendOfFight(`boss:${row.id}`), null, row.id); assert.deepEqual(spellLines(`boss:${row.id}`), [], row.id);
    assert.equal(Object.hasOwn(row, 'bricks'), false, `${row.id}: bricks live on the spell rows, not on the boss row`);
  }
});

const boss = (id: string) => deps({ resolve: (_w, e) => (e === `boss:${id}` ? RESOLVED : null), verify: () => ({ ok: true, result: 'won', twist: null, ticks: 300 }) });
const settle = async (h: ReturnType<typeof fakeDb>, legend: string, d = boss(legend)) => {
  const ops = encounterOps(d), start = await ops.encounter_start!(ctx(h.db), { character: CHAR, encounter: `boss:${legend}` }) as { token: string; seed: number };
  return { ops, start, record: fight(start.seed, 1) };
};

test('a verified win against a legend takes its spell; a second legend of the same family takes its own; a retried settle and a repeat win take nothing more', async () => {
  const h = fakeDb({ t: 1e6 });
  const one = await settle(h, 'eloko'); await one.ops.encounter_settle!(ctx(h.db), { token: one.start.token, record: one.record });
  assert.deepEqual([...h.grimoire.keys()], [`${ACCOUNT}:eloko`]);
  await assert.rejects(async () => one.ops.encounter_settle!(ctx(h.db), { token: one.start.token, record: one.record }), Conflict);
  const two = await settle(h, 'kehua'); await two.ops.encounter_settle!(ctx(h.db), { token: two.start.token, record: two.record });   
  const again = await settle(h, 'eloko'); await again.ops.encounter_settle!(ctx(h.db), { token: again.start.token, record: again.record });
  assert.deepEqual([...h.grimoire.keys()].sort(), [`${ACCOUNT}:eloko`, `${ACCOUNT}:kehua`]);
});

test('a loss, an unverified record and a fight that is no legend\'s take no spell', async () => {
  const lost = fakeDb({ t: 1e6 }), l = await settle(lost, 'eloko', deps({ resolve: (_w, e) => (e === 'boss:eloko' ? RESOLVED : null), verify: () => ({ ok: true, result: 'lost', twist: null, ticks: 300 }) }));
  await l.ops.encounter_settle!(ctx(lost.db), { token: l.start.token, record: l.record }); assert.equal(lost.grimoire.size, 0);
  const bad = fakeDb({ t: 1e6 }), b = await settle(bad, 'eloko', deps({ resolve: (_w, e) => (e === 'boss:eloko' ? RESOLVED : null) }));
  await b.ops.encounter_settle!(ctx(bad.db), { token: b.start.token, record: 'not-a-record-at-all' }); assert.equal(bad.grimoire.size, 0, 'unreadable = a loss');
  const plain = fakeDb({ t: 1e6 }), ops = encounterOps(deps({ verify: () => ({ ok: true, result: 'won', twist: null, ticks: 300 }) }));
  const s = await ops.encounter_start!(ctx(plain.db), { character: CHAR, encounter: 'encounter:knight' }) as { token: string; seed: number };
  await ops.encounter_settle!(ctx(plain.db), { token: s.token, record: fight(s.seed, 1) }); assert.equal(plain.grimoire.size, 0);
});

// Guard: no spell without a verified record. Only encounter.ts reaches the grimoire writer, and only under `verdict.ok && result === 'won'`; kill_report and the sweeps never name it.
const ROOT = new URL('../../', import.meta.url).pathname;
const walk = (d: string): string[] => readdirSync(d).flatMap((n) => { const p = join(d, n); return n === 'node_modules' || n === '.git' || n === '.claude' ? [] : statSync(p).isDirectory() ? walk(p) : [p]; });
const files = [...walk(join(ROOT, 'origins')), ...walk(join(ROOT, 'scripts')), ...walk(join(ROOT, 'supabase')), ...walk(join(ROOT, 'src'))].filter((p) => /\.(ts|mjs|sql)$/.test(p)).map((p) => relative(ROOT, p));
const ALLOWED = new Set(['origins/server/spell-check.ts', 'supabase/migrations/202610130029_skill_pool_access.sql', 'origins/server/spell-gate.ts', 'origins/server/spell-check.test.ts', 'origins/server/grimoire.ts', 'origins/server/grimoire.test.ts', 'origins/server/grimoire-get.test.ts', 'origins/server/encounter.ts', 'origins/server/encounter-fixtures.ts', 'origins/server/store.ts', 'supabase/migrations/202610130027_grimoire_core.sql', 'supabase/down/202610130027_grimoire_core_down.sql', 'scripts/origins-encounter-check.mjs', 'src/fight/boss-spells.ts', 'src/fight/server.ts', 'origins/server/world-spawns.test.ts']);
test('guard: nothing writes the grimoire but the verified encounter settle (spellLines runs only on a verified win)', () => {
  const touching = files.filter((p) => /(origins_grimoire|spellLines|takeSpell|SPELL_BRICKS)/.test(readFileSync(join(ROOT, p), 'utf8')));
  assert.deepEqual(touching.filter((p) => !ALLOWED.has(p)), [], 'a new file touches the grimoire: a spell comes only through origins_encounter_settle');
  for (const p of ['origins/server/world-spawns.ts', 'origins/server/mob-rewards.ts', 'scripts/verify-loot.mjs', 'scripts/verify-daily.mjs']) assert.ok(!touching.includes(p), `${p} must not touch the grimoire`);
  const enc = readFileSync(join(ROOT, 'origins/server/encounter.ts'), 'utf8');
  assert.match(enc, /verdict\.ok && result === 'won' \? spellLines\(fight\) : \[\]/, 'spell lines are built only from a verified win');
  assert.equal((enc.match(/spellLines\(/g) ?? []).length, 1);
  const sql = readFileSync(join(ROOT, 'supabase/migrations/202610130027_grimoire_core.sql'), 'utf8');
  assert.match(sql, /p_result <> 'won' then raise exception 'a spell is taken only on a win'/);
});
