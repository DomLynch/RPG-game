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
// makes the digest gate too (same platform as the fixture: the mutation audit, a rules-change PR on the Mac).
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { initialPractice, stepPractice } from '../src/combat.ts';
import { OPPONENTS } from '../src/moves.ts';
import { idleIntent } from '../src/duel.ts';
import { createRecorder, decodeRecord, encodeRecord } from '../src/record.ts';

// RECORD_REPLAY_FIXTURE points the check at another fixture file (the check's own tests use it); --write always writes the real one.
const FIXTURE = process.env.RECORD_REPLAY_FIXTURE && !process.argv.includes('--write') ? process.env.RECORD_REPLAY_FIXTURE : new URL('../tests/fixtures/fight-records.json', import.meta.url);
const write = process.argv.includes('--write');
const strict = process.argv.includes('--strict');

// The reference fights. Both against the Veteran (normal), seed 731: one is movement + AI only, the other is the busy
// intent stream from tests/record.test.ts (attacks, guards, kicks, held charges) — the rules surface a shared link exercises.
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
};
const META = { build: 'reference', opponent: 'veteran', profile: 'normal', seed: 731 };
const MAX_TICKS = 6000;

const outcomeOf = practice => (practice.finish ? (practice.finish.victim === 1 ? 'killed' : 'died') : 'abandoned');
const digestOf = practice => createHash('sha256').update(JSON.stringify({ tick: practice.duel.tick, fighters: practice.duel.fighters, finish: practice.finish })).digest('hex').slice(0, 16);
const killedTickOf = events => events.find(e => e.type === 'Killed')?.tick ?? null;

// Step a fight from its intents (recorded or freshly scripted); returns the practice and the Killed tick seen along the way.
function play(intents, onIntent) {
  let practice = initialPractice(META.seed, OPPONENTS[META.opponent]), killed = null;
  for (let t = 0; t < intents.length && !practice.finish; t++) {
    practice = stepPractice(practice, onIntent ? onIntent(intents[t]) : intents[t], OPPONENTS[META.opponent].profiles[META.profile]);
    killed ??= killedTickOf(practice.events) === null ? null : practice.duel.tick;
  }
  return { practice, killed };
}

if (write) {
  const records = [];
  for (const [name, script] of Object.entries(REFERENCES)) {
    const rec = createRecorder({ ...META });
    const { practice, killed } = play(Array.from({ length: MAX_TICKS }, (_, t) => script(t)), raw => rec.push(raw));
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
    if (/version/i.test(message)) { results.push({ name, refused: message }); continue; }   // format moved on: a clean refusal, not a rules drift
    failed++; results.push({ name, error: `fixture does not decode: ${message}` }); continue;
  }
  if (record.opponent !== META.opponent || record.profile !== META.profile || record.seed !== META.seed) { failed++; results.push({ name, error: 'fixture metadata is not the reference fight' }); continue; }
  const { practice, killed } = play(record.intents);
  const got = { ticks: practice.duel.tick, outcome: outcomeOf(practice), killedTick: killed, digest: digestOf(practice) };
  const gated = strict ? ['ticks', 'outcome', 'killedTick', 'digest'] : ['ticks', 'outcome', 'killedTick'];
  const drift = gated.filter(k => got[k] !== expect[k]);
  if (drift.length || record.ticks !== expect.ticks || record.outcome !== expect.outcome) {
    failed++;
    results.push({ name, error: `SILENT MISMATCH: the replay no longer reproduces the recorded fight (${drift.map(k => `${k}: expected ${expect[k]}, got ${got[k]}`).join('; ') || 'record header disagrees with expectations'})` });
  } else results.push({ name, ...got, digestMatch: got.digest === expect.digest });
}
console.log(JSON.stringify({ check: 'record-replay', passed: failed === 0, results }));
if (failed) {
  console.error(`record-replay-check: ${failed} reference fight(s) no longer replay identically. Shared kill links would replay a different fight on this build. If the rules change is intentional, regenerate the references (node scripts/record-replay-check.mjs --write) in the same PR and bump RECORD_VERSION if old links must be refused.`);
  process.exit(1);
}
