// Record-era fixtures (external audit 2026-10-18 F5; Strategy P2): one STORED kill-link record per era stamp the live recorder writes (plain, patron, gambit,
// stances, pose, sheet, spell, SPECIAL 2, and every REACH bump that stamps a fight, e.g. the v76 cave troll), each pinned to the result it replays to.
// Unlike tests/fixtures/fight-records.json, which every rules change re-records (scripts/record-replay-check.mjs --write), this file is APPEND-ONLY: an
// entry is never rewritten, so it proves that a link shared in that era still replays to the same fight on every later build.
//   - an entry either replays (src/fight/replay.ts verifyRecord, the verifier's own replay) to its pinned ticks and outcome, or its version is refused
//     by a later bump that REACHED its fight (record.ts REACH): that is a deliberate retirement, and the refusal must name that bump;
//   - every recipe's CURRENT stamp has an entry: a bump or a new era that changes what a fight is stamped fails CI until `--append` adds it.
// Usage: node scripts/record-era-fixtures.mjs           check (exit 1 on a failure; the test runs the same checks)
//        node scripts/record-era-fixtures.mjs --append  add an entry for every recipe whose current stamp has none; never touches an existing entry
import { readFileSync, writeFileSync } from 'node:fs';
import { createRecorder, decodeRecord, encodeRecord, REACH } from '../src/fight/record.ts';
import { verifyRecord } from '../src/fight/replay.ts';
import { RECORD_VERSION } from '../src/fight/record.ts';
import { spellRefusal } from '../origins/server/spell-gate.ts';
import { playScaleFor, setLateNotice, setPlayScale } from '../src/fight/play-radius.ts';
import { setStab } from '../src/fight/stab-rule.ts';
import { forceSandbox, ROWS79_ON, ROWS80_ON, sandboxFor, SANDBOX_ON, setRows79, setRows80, setSandbox } from '../src/fight/sandbox-era.ts';

export const FIXTURE = new URL('../tests/fixtures/era-records.json', import.meta.url);
const BASE = { build: 'era', opponent: 'veteran', weapon: 'longsword', level: 6, seed: 731 };
// The replay checks a record exactly as the paying sweeps do (scripts/verify-loot.mjs): its sheet against the SERVER's view (the stored build's sheet, never the record's
// own: tests/sheet-trust-guard.test.ts) and its spell through the one spell gate (origins/server/spell-gate.ts: tests/spell-gate.test.ts). Each entry stores that server
// view with it (`server`), fixed forever like the record; the gate's verdict is pinned too, so a spell record with no stored build is pinned as REFUSED (never paid).
const SERVER = { sheet: { sheet: { health: 70, armour: 30 } } };   // the stored views a recipe's record is checked against; absent = the server holds no build and no grimoire
const ACCOUNT = 'era-fixtures';
const loaderOf = (server) => ({ held: async () => server?.held ?? { grimoire: {}, xp: {} }, build: async () => server?.build ?? null });
// A STORED record replays under the era its own version names (v31..v77 old rules, v78 the sandbox, v79 the RV79 rows), exactly as the paying sweeps do. The unit suite forces the era OFF for everything it
// FIGHTS (tests/lib/era-off.ts), which would replay a v78/v79 record under the wrong rules, so the force is lifted for the replay and put back after (RV79; a script run has no force and nothing to restore).
const replayByVersion = (run) => {
  const forced = !sandboxFor(RECORD_VERSION), sandbox = SANDBOX_ON, rows79 = ROWS79_ON, rows80 = ROWS80_ON;
  if (forced) { forceSandbox(undefined); setSandbox(true); setRows79(true); setRows80(true); }
  try { return run(); } finally { if (forced) { forceSandbox(false); setSandbox(sandbox); setRows79(rows79); setRows80(rows80); } }
};
export const ERA_ONLY = new Set(['meleeSpecial']);   // recipes whose fight differs from the plain one only in the live era: with the era forced off they stamp what plain stamps, so they are not part of the distinct-stamps check
const replayChecked = async (record, server) => {   // what a sweep would conclude: the sheet against the stored one, the spell through the gate, then the replay with its landed hits
  const gate = await spellRefusal(record, ACCOUNT, loaderOf(server));
  const hits = [0, 0], v = replayByVersion(() => verifyRecord(record, (p) => { for (const e of p.events) if (e.type === 'Hit') hits[e.actor]++; }, { sheet: server?.sheet }));
  return { v, hits, gate };
};
// Each recipe is one live-era feature on the base fight; the record's stamp comes from createRecorder, never from here.
export const RECIPES = {
  plain: {},
  patron: { patron: 3 },
  gambit: { gambit: true },
  stances: { stances: 'aggressive' },
  pose: { pose: { hero: { x: 0, z: -2 }, foe: { x: 0, z: 2 }, heroFacing: 0 } },
  sheet: { sheet: { health: 70, armour: 30 } },
  spell: { specials: true, spell: { id: 'alvis', skill: 5 } },
  skill2: { skill2: 'stomp' },
  meleeSpecial: { specials: true, skill: 'lunge' },   // RV79 (Auditor, BULK-CS note 1): a fight that PRESSES a melee special, so the era fixture fires the sandbox's windup / reach / react rows (the plain recipe never does)
  'cave-troll': { opponent: 'cave-troll', level: 3 },
};
const MAX_TICKS = 6000;
const script = (t, name) => ({ move: { x: 0, z: t < 90 ? 0.8 : 0, yaw: 0, run: false }, action: name === 'meleeSpecial' && t % 90 === 45 ? 'skill' : t % 30 === 15 ? 'light' : t % 240 === 100 ? 'skill2' : null, guard: t % 120 > 100, lock: true });   // the melee-special recipe presses its pick (slot a) every 90 ticks; every other recipe is the script it always was

const live = (opponent) => { setPlayScale(playScaleFor(opponent, RECORD_VERSION)); setLateNotice(true); setStab(true); };   // the recorder stamps the LIVE era (as record-replay-check --write does)
const metaOf = (name) => ({ ...BASE, ...RECIPES[name] });
const outcomeOf = (finish) => (!finish ? 'abandoned' : finish.draw ? 'draw' : finish.victim === 1 ? 'killed' : 'died');
// The pin includes the blows each side landed over the whole replay: whole numbers, so (unlike a state digest, which drifts between arm64 and x64, record-replay-check.mjs) a pin that
// holds on every runner, and one that tells apart fights that end on the same tick (a feature that changes the exchange but not the finish).

/** The version the live recorder stamps on this recipe's fight today. */
export function currentStamp(name) { live(metaOf(name).opponent); const rec = createRecorder(metaOf(name)); rec.push(script(0, name)); return rec.finish('abandoned').v; }

/** Fight the recipe headless and return the finished record (cut at its finish) with what it replays to. */
export async function fightRecipe(name) {
  const meta = metaOf(name), server = SERVER[name];
  live(meta.opponent);
  const rec = createRecorder(meta);
  for (let t = 0; t < MAX_TICKS; t++) rec.push(script(t, name));
  const full = rec.finish('abandoned');
  let end = null;
  const probe = verifyRecord(full, (p) => { if (p.finish && end === null) end = { tick: p.duel.tick, outcome: outcomeOf(p.finish) }; }, { sheet: server?.sheet });
  if (!probe.practice && !probe.ok) throw new Error(`${name}: the live build cannot replay its own recipe: ${probe.reason}`);
  const record = end ? { ...full, intents: full.intents.slice(0, end.tick), ticks: end.tick, outcome: end.outcome } : full;
  const { v: check, hits, gate } = await replayChecked(record, server);
  if (!check.ok) throw new Error(`${name}: the cut record does not replay: ${check.reason}`);
  return { record, server: server ?? null, expect: { v: record.v, ticks: record.ticks, outcome: record.outcome, hits, gate } };
}

const load = () => JSON.parse(readFileSync(FIXTURE, 'utf8'));

/** Every stored entry replays to its pin, or is refused by a named REACH bump; every recipe's current stamp has an entry. Returns the problems (empty = pass). */
export async function checkEraFixtures(fixture = load()) {
  const problems = [], results = [];
  for (const e of fixture.records) {
    let rec;
    try { rec = await decodeRecord(e.encoded); } catch (error) {
      const msg = String(error?.message ?? error), bump = Number(/bump (\d+)/.exec(msg)?.[1]);
      if (/version \d+ is not supported/.test(msg) && REACH[bump]?.some((r) => (typeof r === 'string' ? r : r.opponent) === metaOf(e.name).opponent)) { results.push({ name: e.name, v: e.expect.v, retired: bump }); continue; }
      problems.push(`${e.name} v${e.expect.v}: refused without a REACH bump naming its fight: ${msg}`); continue;
    }
    if (rec.v !== e.expect.v) { problems.push(`${e.name}: decodes as v${rec.v}, pinned v${e.expect.v}`); continue; }
    const { v: got, hits, gate } = await replayChecked(rec, e.server ?? undefined);   // against the entry's OWN stored server view, never the record's word
    if (gate !== e.expect.gate) { problems.push(`${e.name} v${e.expect.v}: the spell gate now says ${JSON.stringify(gate)}, pinned ${JSON.stringify(e.expect.gate)}`); continue; }
    if (!got.ok) { problems.push(`${e.name} v${e.expect.v}: no longer replays: ${got.reason}`); continue; }
    if (rec.ticks !== e.expect.ticks || rec.outcome !== e.expect.outcome) { problems.push(`${e.name} v${e.expect.v}: header ${rec.ticks}/${rec.outcome}, pinned ${e.expect.ticks}/${e.expect.outcome}`); continue; }
    if (hits[0] !== e.expect.hits[0] || hits[1] !== e.expect.hits[1]) { problems.push(`${e.name} v${e.expect.v}: SILENT DRIFT: the replay lands ${hits.join('/')} hits, pinned ${e.expect.hits.join('/')} (same finish, a different fight)`); continue; }
    results.push({ name: e.name, v: e.expect.v, ticks: e.expect.ticks, outcome: e.expect.outcome, hits });
  }
  for (const name of Object.keys(RECIPES)) {
    if (ERA_ONLY.has(name) && !sandboxFor(RECORD_VERSION)) continue;   // forced off (the unit suite): this recipe stamps what plain stamps; a live-era run (the script, the release row) checks it
    const v = currentStamp(name);
    if (!fixture.records.some((e) => e.name === name && e.expect.v === v)) problems.push(`${name}: the live recorder stamps v${v} and no stored record has it; run node scripts/record-era-fixtures.mjs --append and commit the entry`);
  }
  return { problems, results };
}

if (process.argv[1] && import.meta.url === new URL(`file://${process.argv[1]}`).href) {
  if (process.argv.includes('--append')) {
    const fixture = (() => { try { return load(); } catch { return { note: 'APPEND-ONLY. Never edit or regenerate an entry; add new eras with: node scripts/record-era-fixtures.mjs --append (scripts/record-era-fixtures.mjs)', records: [] }; } })();
    const added = [];
    for (const name of Object.keys(RECIPES)) {
      const v = currentStamp(name);
      if (fixture.records.some((e) => e.name === name && e.expect.v === v)) continue;
      const { record, server, expect } = await fightRecipe(name);
      fixture.records.push({ name, added: new Date().toISOString().slice(0, 10), encoded: await encodeRecord(record), server, expect });
      added.push({ name, ...expect });
    }
    writeFileSync(FIXTURE, JSON.stringify(fixture, null, 2) + '\n');
    console.log(JSON.stringify({ appended: added }));
  } else {
    const { problems, results } = await checkEraFixtures();
    console.log(JSON.stringify({ check: 'record-era', passed: problems.length === 0, results, problems }));
    if (problems.length) process.exit(1);
  }
}
