// Release check: kill links stay true. A shared fight record (src/record.ts) replays the exact fight on the build under test,
// so the rules must reproduce the reference fights in tests/fixtures/fight-records.json: same final tick, same outcome, same
// Killed tick. Pure simulation, no browser, well under a second.
//
// Passes when every reference replays to the recorded tick/outcome/Killed tick, OR when decodeRecord refuses the record's version
// cleanly (the format moved on: regenerate). Fails loudly on a silent mismatch — a rules change that alters a recorded fight breaks
// every shared link, so it must be a conscious decision: `node scripts/record-replay-check.mjs --write` regenerates the references
// and the PR that carries the new fixture is the receipt.
//
// The fighters' final state is also digested and REPORTED (digestMatch) but does not gate by default: the digest of the busy
// scripted fight differs between the Mac (arm64) and the Linux runner (x64) while tick, outcome and Killed tick agree — float
// drift in the sim's trig/vector maths, first seen on quality run 35625150589. That drift is the Lead's finding to chase (a link
// recorded on a phone replayed on a desktop could in principle diverge); the gate's promise is the recorded outcome. --strict
// makes the digest gate too (same platform as the fixture: the mutation audit, a rules-change PR on the Mac). So --strict is
// MAC-ONLY in practice: on the x64 runner it FAILS veteran-scripted as a digest mismatch (quality run 36215939518, via the stale-fixture
// test); deploy.sh runs it on the Mac, CI runs the soft gate, and the release is unaffected.
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { initialPractice, stepPractice } from '../src/combat.ts';
import { OPPONENTS } from '../src/moves.ts';
import { idleIntent, legal } from '../src/duel.ts';
import { createRecorder, decodeRecord, encodeRecord } from '../src/record.ts';

// RECORD_REPLAY_FIXTURE points the check at another fixture file (the check's own tests use it); --write always writes the real one.
const FIXTURE = process.env.RECORD_REPLAY_FIXTURE && !process.argv.includes('--write') ? process.env.RECORD_REPLAY_FIXTURE : new URL('../tests/fixtures/fight-records.json', import.meta.url);
const write = process.argv.includes('--write');
const strict = process.argv.includes('--strict');

// The reference fights. All against the Veteran (normal), seed 731: one is movement + AI only, one is the busy intent stream from
// tests/record.test.ts (attacks, guards, kicks, held charges) — the rules surface a shared link exercises — and one fights with the
// Witch-fire skill equipped (record v12), casting whenever SKILL is lit, and one with the day-one Pommel Strike (record v13), striking
// whenever SKILL is lit and cutting into the stagger. A script may read the pre-tick practice (the third argument).
const REFERENCES = {
  'veteran-walk-in': t => ({ ...idleIntent(), move: { x: 0, z: 0.8, yaw: 0, run: false } }),
  'veteran-scripted': t => {
    const phase = t % 240;
    return {
      move: { x: phase < 90 ? Math.sin(t / 25) : 0, z: phase < 90 ? 0.8 : phase < 120 ? -0.6 : 0, yaw: 0.6 + 0.004 * Math.sin(t / 37) * t, run: phase > 200 },
      action: phase === 95 ? 'light' : phase === 110 ? 'light' : phase === 130 ? 'heavy' : phase === 170 ? 'thrust' : phase === 190 ? 'kick' : null,
      guard: phase >= 140 && phase < 165, guardDirection: phase >= 140 && phase < 165 ? 'overhead' : undefined, held: phase > 125 && phase < 135, lock: true,
    };
  },
  'veteran-witchfire': (t, practice) => {
    const p = practice.duel.fighters[0];
    return { ...idleIntent(), move: { x: 0, z: 0.8, yaw: 0, run: false }, action: p.phase === 'sheathed' ? 'light' : legal(p, 'skill') ? 'skill' : t % 60 === 30 ? 'light' : null };
  },
  'veteran-pommel': (t, practice) => {
    const p = practice.duel.fighters[0], foe = practice.duel.fighters[1];
    return { ...idleIntent(), move: { x: 0, z: 0.8, yaw: 0, run: false }, action: p.phase === 'sheathed' ? 'light' : legal(p, 'skill') ? 'skill' : foe.phase === 'hurt' || t % 60 === 30 ? 'light' : null };
  },
  // SCOPE 8 (bump 14): the last skill code (11), so a reference fight decodes the widest equipped-skill byte the header can hold today.
  'veteran-hewer': (t, practice) => {
    const p = practice.duel.fighters[0];
    return { ...idleIntent(), move: { x: 0, z: 0.8, yaw: 0, run: false }, action: p.phase === 'sheathed' ? 'light' : legal(p, 'skill') ? 'skill' : t % 60 === 30 ? 'light' : null };
  },
};
const SKILLS = { 'veteran-witchfire': 'witchfire', 'veteran-pommel': 'pommel', 'veteran-hewer': 'hewer' };   // the player's equipped skill per reference; absent = none
const META = { build: 'reference', opponent: 'veteran', weapon: 'longsword', profile: 'normal', seed: 731 };   // record v2 (#324) names the player's weapon
const MAX_TICKS = 6000;

const outcomeOf = practice => (practice.finish ? (practice.finish.victim === 1 ? 'killed' : 'died') : 'abandoned');
const digestOf = practice => createHash('sha256').update(JSON.stringify({ tick: practice.duel.tick, fighters: practice.duel.fighters, finish: practice.finish })).digest('hex').slice(0, 16);
const killedTickOf = events => events.find(e => e.type === 'Killed')?.tick ?? null;

// Step a fight from its intents (recorded or freshly scripted); returns the practice and the Killed tick seen along the way.
function play(intents, onIntent, skill = null) {
  let practice = initialPractice(META.seed, OPPONENTS[META.opponent], META.weapon, skill), killed = null;
  for (let t = 0; t < intents.length && !practice.finish; t++) {
    practice = stepPractice(practice, onIntent ? onIntent(intents[t], practice) : intents[t], OPPONENTS[META.opponent].profiles[META.profile]);
    killed ??= killedTickOf(practice.events) === null ? null : practice.duel.tick;
  }
  return { practice, killed };
}

if (write) {
  const records = [];
  for (const [name, script] of Object.entries(REFERENCES)) {
    const skill = SKILLS[name] ?? null, rec = createRecorder({ ...META, ...(skill ? { skill } : {}) });
    const { practice, killed } = play(Array.from({ length: MAX_TICKS }, (_, t) => t), (t, before) => rec.push(script(t, before)), skill);
    const record = rec.finish(outcomeOf(practice));
    if (record.outcome === 'abandoned') throw new Error(`${name}: the reference fight must end in a kill, ran ${record.ticks} ticks without one`);
    records.push({ name, encoded: await encodeRecord(record), expect: { ticks: record.ticks, outcome: record.outcome, killedTick: killed, digest: digestOf(practice) } });
  }
  writeFileSync(FIXTURE, JSON.stringify({ note: 'Reference fights for scripts/record-replay-check.mjs. Regenerate ONLY for an intentional rules change: node scripts/record-replay-check.mjs --write', records }, null, 2) + '\n');
  console.log(JSON.stringify({ wrote: records.map(r => ({ name: r.name, ...r.expect, chars: r.encoded.length })) }));
  process.exit(0);
}

const { records } = JSON.parse(readFileSync(FIXTURE, 'utf8'));
const results = [];
let failed = 0;
for (const { name, encoded, expect } of records) {
  let record;
  try {
    record = await decodeRecord(encoded);
  } catch (error) {
    const message = String(error?.message ?? error);
    if (/version/i.test(message)) {   // format moved on. Soft: a clean refusal. Strict (the release gate): a stale fixture gates nothing, so it fails until re-recorded.
      if (strict) { failed++; results.push({ name, error: `STALE FIXTURE: ${message}; the bump must re-record the references (node scripts/record-replay-check.mjs --write)` }); }
      else results.push({ name, refused: message });
      continue;
    }
    failed++; results.push({ name, error: `fixture does not decode: ${message}` }); continue;
  }
  if (record.opponent !== META.opponent || record.profile !== META.profile || record.seed !== META.seed) { failed++; results.push({ name, error: 'fixture metadata is not the reference fight' }); continue; }
  const { practice, killed } = play(record.intents, undefined, record.skill ?? null);
  const got = { ticks: practice.duel.tick, outcome: outcomeOf(practice), killedTick: killed, digest: digestOf(practice) };
  const gated = strict ? ['ticks', 'outcome', 'killedTick', 'digest'] : ['ticks', 'outcome', 'killedTick'];
  const drift = gated.filter(k => got[k] !== expect[k]);
  if (drift.length || record.ticks !== expect.ticks || record.outcome !== expect.outcome) {
    failed++;
    results.push({ name, error: `SILENT MISMATCH: the replay no longer reproduces the recorded fight (${drift.map(k => `${k}: expected ${expect[k]}, got ${got[k]}`).join('; ') || 'record header disagrees with expectations'})` });
  } else results.push({ name, ...got, digestMatch: got.digest === expect.digest });
}
// Strict: every reference the script names must have a fixture, and at least one must have been gated. A bump that forgets --write
// (2026-09-26, RV14: four v13 fixtures refused, the new reference absent) otherwise passes an empty gate.
if (strict) {
  for (const name of Object.keys(REFERENCES)) if (!records.some(r => r.name === name)) { failed++; results.push({ name, error: 'NO FIXTURE: the reference is not in tests/fixtures/fight-records.json; run --write' }); }
  if (!results.some(r => !r.error && !r.refused)) { failed++; results.push({ name: '*', error: 'NO REFERENCE GATED: nothing replayed, so determinism is unverified' }); }
}
console.log(JSON.stringify({ check: 'record-replay', passed: failed === 0, results }));
if (failed) {
  console.error(`record-replay-check: ${failed} reference fight(s) no longer replay identically. Shared kill links would replay a different fight on this build. If the rules change is intentional, regenerate the references (node scripts/record-replay-check.mjs --write) in the same PR and bump RECORD_VERSION if old links must be refused.`);
  process.exit(1);
}
