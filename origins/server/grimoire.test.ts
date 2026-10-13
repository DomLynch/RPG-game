import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { encounterOps } from './encounter.ts';
import { ACCOUNT, CHAR, fakeDb, deps, fight, RESOLVED } from './encounter-fixtures.ts';
import { legendOfFight, spellLines, takeSpell, type Grimoire } from './grimoire.ts';
import { BOSS_BRICKS } from '../../src/fight/server.ts';
import { Conflict } from './errors.ts';

const ctx = (db: ReturnType<typeof fakeDb>['db']) => ({ db, account: ACCOUNT });

test('takeSpell: two different legends at the same rank of one family each grant their own spell; the same legend twice grants once', () => {
  let g: Grimoire = {};
  const a = takeSpell(g, 'alpha-8', ['skill_reaping']); g = a.grimoire;
  const b = takeSpell(g, 'beta-8', ['skill_cleave', 'skill_jab']); g = b.grimoire;   // same family, same rank, another legend
  assert.deepEqual([a.reason, b.reason], ['spell-taken', 'spell-taken']);
  assert.deepEqual(g, { 'alpha-8': ['skill_reaping'], 'beta-8': ['skill_cleave', 'skill_jab'] });
  const again = takeSpell(g, 'alpha-8', ['skill_reaping']);
  assert.equal(again.reason, 'already-taken'); assert.equal(again.grimoire, g, 'nothing changed');
  assert.equal(takeSpell(g, 'gamma-8', undefined).reason, 'no-spell'); assert.equal(takeSpell(g, 'gamma-8', []).reason, 'no-spell');
});

test('every boss legend carries a brick list on its row, and the fight id boss:<legend> names it', () => {
  assert.ok(Object.keys(BOSS_BRICKS).length >= 27);
  assert.equal(legendOfFight('boss:arawn'), 'arawn'); assert.equal(legendOfFight('boss:no-such-legend'), null);
  assert.equal(legendOfFight('encounter:knight'), null); assert.equal(legendOfFight(null), null);
  assert.deepEqual(spellLines('boss:arawn'), [{ legend: 'arawn', bricks: [...BOSS_BRICKS.arawn!], key: 'spell:arawn' }]); assert.deepEqual(spellLines('encounter:knight'), []);
});

const boss = (id: string) => deps({ resolve: (_w, e) => (e === `boss:${id}` ? RESOLVED : null), verify: () => ({ ok: true, result: 'won', twist: null, ticks: 300 }) });
const settle = async (h: ReturnType<typeof fakeDb>, legend: string, d = boss(legend)) => {
  const ops = encounterOps(d), start = await ops.encounter_start!(ctx(h.db), { character: CHAR, encounter: `boss:${legend}` }) as { token: string; seed: number };
  return { ops, start, record: fight(start.seed, 1) };
};

test('a verified win against a legend takes its spell; a second legend of the same family takes its own; a retried settle and a repeat win take nothing more', async () => {
  const h = fakeDb({ t: 1e6 });
  const one = await settle(h, 'arawn'); await one.ops.encounter_settle!(ctx(h.db), { token: one.start.token, record: one.record });
  assert.deepEqual([...h.grimoire.keys()], [`${ACCOUNT}:arawn`]);
  await assert.rejects(async () => one.ops.encounter_settle!(ctx(h.db), { token: one.start.token, record: one.record }), Conflict);
  const two = await settle(h, 'thanatos'); await two.ops.encounter_settle!(ctx(h.db), { token: two.start.token, record: two.record });   // executioner rank 9, same family
  const again = await settle(h, 'arawn'); await again.ops.encounter_settle!(ctx(h.db), { token: again.start.token, record: again.record });
  assert.deepEqual([...h.grimoire.keys()].sort(), [`${ACCOUNT}:arawn`, `${ACCOUNT}:thanatos`]);
});

test('a loss, an unverified record and a fight that is no legend\'s take no spell', async () => {
  const lost = fakeDb({ t: 1e6 }), l = await settle(lost, 'arawn', deps({ resolve: (_w, e) => (e === 'boss:arawn' ? RESOLVED : null), verify: () => ({ ok: true, result: 'lost', twist: null, ticks: 300 }) }));
  await l.ops.encounter_settle!(ctx(lost.db), { token: l.start.token, record: l.record }); assert.equal(lost.grimoire.size, 0);
  const bad = fakeDb({ t: 1e6 }), b = await settle(bad, 'arawn', deps({ resolve: (_w, e) => (e === 'boss:arawn' ? RESOLVED : null) }));
  await b.ops.encounter_settle!(ctx(bad.db), { token: b.start.token, record: 'not-a-record-at-all' }); assert.equal(bad.grimoire.size, 0, 'unreadable = a loss');
  const plain = fakeDb({ t: 1e6 }), ops = encounterOps(deps({ verify: () => ({ ok: true, result: 'won', twist: null, ticks: 300 }) }));
  const s = await ops.encounter_start!(ctx(plain.db), { character: CHAR, encounter: 'encounter:knight' }) as { token: string; seed: number };
  await ops.encounter_settle!(ctx(plain.db), { token: s.token, record: fight(s.seed, 1) }); assert.equal(plain.grimoire.size, 0);
});

// Guard: no spell without a verified record. Only encounter.ts reaches the grimoire writer, and only under `verdict.ok && result === 'won'`; kill_report and the sweeps never name it.
const ROOT = new URL('../../', import.meta.url).pathname;
const walk = (d: string): string[] => readdirSync(d).flatMap((n) => { const p = join(d, n); return n === 'node_modules' || n === '.git' || n === '.claude' ? [] : statSync(p).isDirectory() ? walk(p) : [p]; });
const files = [...walk(join(ROOT, 'origins')), ...walk(join(ROOT, 'scripts')), ...walk(join(ROOT, 'supabase')), ...walk(join(ROOT, 'src'))].filter((p) => /\.(ts|mjs|sql)$/.test(p)).map((p) => relative(ROOT, p));
const ALLOWED = new Set(['origins/server/grimoire.ts', 'origins/server/grimoire.test.ts', 'origins/server/encounter.ts', 'origins/server/encounter-fixtures.ts', 'origins/server/store.ts', 'supabase/migrations/202610130027_grimoire_core.sql', 'supabase/down/202610130027_grimoire_core_down.sql', 'scripts/origins-encounter-check.mjs', 'src/fight/boss-spells.ts', 'src/fight/server.ts']);
test('guard: nothing writes the grimoire but the verified encounter settle (spellLines runs only on a verified win)', () => {
  const touching = files.filter((p) => /(origins_grimoire|spellLines|takeSpell|BOSS_BRICKS)/.test(readFileSync(join(ROOT, p), 'utf8')));
  assert.deepEqual(touching.filter((p) => !ALLOWED.has(p)), [], 'a new file touches the grimoire: a spell comes only through origins_encounter_settle');
  for (const p of ['origins/server/world-spawns.ts', 'origins/server/mob-rewards.ts', 'scripts/verify-loot.mjs', 'scripts/verify-daily.mjs']) assert.ok(!touching.includes(p), `${p} must not touch the grimoire`);
  const enc = readFileSync(join(ROOT, 'origins/server/encounter.ts'), 'utf8');
  assert.match(enc, /verdict\.ok && result === 'won' \? spellLines\(fight\) : \[\]/, 'spell lines are built only from a verified win');
  assert.equal((enc.match(/spellLines\(/g) ?? []).length, 1);
  const sql = readFileSync(join(ROOT, 'supabase/migrations/202610130027_grimoire_core.sql'), 'utf8');
  assert.match(sql, /p_result <> 'won' then raise exception 'a spell is taken only on a win'/);
});
