import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { encounterOps } from './encounter.ts';
import { ACCOUNT, CHAR, fakeDb, deps, fight } from './encounter-fixtures.ts';
import { practiceLines, PRACTICE_UNIT, XP_PER_POINT } from './practice.ts';
import { PLAYER_WEAPONS, WEAPONS, WEAPON_PRACTICE_SKILL } from '../../src/fight/server.ts';
import { SHEET_SKILLS } from '../../src/fight/sheet-rows.ts';
import { Conflict } from './errors.ts';

const ctx = (db: ReturnType<typeof fakeDb>['db']) => ({ db, account: ACCOUNT });
const f = (over: Partial<Parameters<typeof practiceLines>[0]> = {}) => practiceLines({ token: 'T', weapon: 'longsword', enemyLevel: 5, youLevel: 5, placed: { sword: 3 }, ...over });
const BUILD = (placed: Record<string, number>) => ({ level: 10, placed, respreadRank: 1, version: 1 });
const won = () => deps({ verify: () => ({ ok: true, result: 'won', twist: null, ticks: 300 }) });
const run = async (placed: Record<string, number> | null, verifyOk = true, focus = false) => {
  const h = fakeDb({ t: 1e6 }); h.world.build = placed === null ? null : BUILD(placed); if (focus) h.focus.add('sword');
  const ops = encounterOps(verifyOk ? won() : deps({ verify: () => ({ ok: true, result: 'lost', twist: null, ticks: 300 }) }));
  const start = await ops.encounter_start!(ctx(h.db), { character: CHAR, encounter: 'encounter:knight' }) as { token: string; seed: number };
  return { h, ops, start, record: fight(start.seed, 1) };
};

test('practiceLines: an even fight pays the unit, a hard one more, a grey one nothing; the ceiling is the placed points', () => {
  assert.deepEqual(f(), [{ skill: 'sword', amount: PRACTICE_UNIT, capXp: 3 * XP_PER_POINT, key: 'practice:enc:T:sword' }]);
  assert.equal((f({ enemyLevel: 9 })[0] as { amount: number }).amount, Math.floor(PRACTICE_UNIT * 1.25));
  assert.deepEqual(f({ enemyLevel: 1, youLevel: 60 }), [], 'grey pays 0');
  assert.deepEqual(f({ placed: {} }), [], 'no point placed, no ceiling, nothing to fill');
  assert.deepEqual(f({ weapon: 'no-such-weapon' }), []);
});

test('every player weapon practises a real sheet skill', () => {
  const skills = new Set(SHEET_SKILLS.map((s) => s.id));
  for (const id of PLAYER_WEAPONS) if (!(WEAPONS[id] as { placeholder?: true }).placeholder) assert.ok(skills.has(WEAPON_PRACTICE_SKILL[id] ?? ''), `weapon ${id} has no practice skill row`);
  for (const skill of Object.values(WEAPON_PRACTICE_SKILL)) assert.ok(skills.has(skill), skill);
});

test('a verified win fills the weapon skill; a retried settle pays once (guard 3)', async () => {
  const { h, ops, start, record } = await run({ sword: 2 });
  await ops.encounter_settle!(ctx(h.db), { token: start.token, record });
  assert.equal(h.xp.get('sword'), Math.floor(PRACTICE_UNIT * 1.25), 'level-6 knight vs a level-0 career');
  await assert.rejects(async () => ops.encounter_settle!(ctx(h.db), { token: start.token, record }), Conflict);
  assert.equal(h.xp.get('sword'), Math.floor(PRACTICE_UNIT * 1.25), 'the replay paid nothing');
});

test('a loss, an unverified record or a character with nothing placed pays no practice; focus doubles; the ceiling clamps', async () => {
  const lost = await run({ sword: 2 }, false); await lost.ops.encounter_settle!(ctx(lost.h.db), { token: lost.start.token, record: lost.record }); assert.equal(lost.h.xp.size, 0);
  const none = await run(null); await none.ops.encounter_settle!(ctx(none.h.db), { token: none.start.token, record: none.record }); assert.equal(none.h.xp.size, 0);
  const real = await run({ sword: 2 }); await real.ops.encounter_settle!(ctx(real.h.db), { token: real.start.token, record: 'AAAAAAAAAAAA' }); assert.equal(real.h.xp.size, 0, 'unreadable record = a loss');
  const focused = await run({ sword: 2 }, true, true); await focused.ops.encounter_settle!(ctx(focused.h.db), { token: focused.start.token, record: focused.record });
  assert.equal(focused.h.xp.get('sword'), 2 * Math.floor(PRACTICE_UNIT * 1.25));
  const capped = await run({ sword: 1 }, true, true); capped.h.xp.set('sword', XP_PER_POINT - 5); await capped.ops.encounter_settle!(ctx(capped.h.db), { token: capped.start.token, record: capped.record });
  assert.equal(capped.h.xp.get('sword'), XP_PER_POINT, 'placed points are the ceiling');
});

// Guards 1 and 2: the pool is written ONLY by the verified encounter settle. Scan the tree: no other server code, script or migration touches it.
const ROOT = new URL('../../', import.meta.url).pathname;
const walk = (d: string): string[] => readdirSync(d).flatMap((n) => { const p = join(d, n); return n === 'node_modules' || n === '.git' || n === '.claude' ? [] : statSync(p).isDirectory() ? walk(p) : [p]; });
const files = [...walk(join(ROOT, 'origins')), ...walk(join(ROOT, 'scripts')), ...walk(join(ROOT, 'supabase')), ...walk(join(ROOT, 'src'))].filter((p) => /\.(ts|mjs|sql)$/.test(p)).map((p) => relative(ROOT, p));
const WRITES = /(origins_skill_xp|origins_skill_practice|practiceLines)/;
const ALLOWED = new Set(['origins/server/practice.ts', 'origins/server/spell-check.ts', 'origins/server/spell-check.test.ts', 'origins/server/practice.test.ts', 'origins/server/encounter.ts', 'origins/server/encounter-fixtures.ts', 'supabase/migrations/202610130026_skill_practice.sql', 'supabase/down/202610130026_skill_practice_down.sql', 'scripts/awards-database-check.mjs', 'scripts/origins-encounter-check.mjs']);

test('guard: nothing but the verified encounter settle writes the practice pool (kill_report and every sweep stay out)', () => {
  const touching = files.filter((p) => WRITES.test(readFileSync(join(ROOT, p), 'utf8')));
  assert.deepEqual(touching.filter((p) => !ALLOWED.has(p)), [], 'a new file touches the practice pool: it must come through origins_encounter_settle');
  assert.ok(touching.includes('origins/server/encounter.ts'));
  for (const p of ['origins/server/world-spawns.ts', 'origins/server/mob-rewards.ts', 'scripts/verify-loot.mjs', 'scripts/verify-daily.mjs']) assert.ok(!touching.includes(p), `${p} must not touch the pool`);
});

test('guard: kill_report cannot reach the pool, the level or a spell (origins_spawn_kill allows event/mint/metal/career_set only)', () => {
  const sql = readFileSync(join(ROOT, 'supabase/migrations/202610080014_origins_world_spawns.sql'), 'utf8');
  assert.ok(sql.includes("l ->> 'op' not in ('event', 'mint', 'metal', 'career_set')"), 'the kill batch allow-list is exactly event, mint, metal, career_set');
  const spawns = readFileSync(join(ROOT, 'origins/server/world-spawns.ts'), 'utf8');
  assert.ok(!/practice|skill_xp|grimoire|spell/i.test(spawns), 'world-spawns.ts never names the pool, a spell or the grimoire');
  assert.ok(!/set_level|origins_set_level|level_set/.test(spawns), 'and never writes the level');
});
