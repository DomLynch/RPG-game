// Kill-link determinism gate (beta plan brief 3: a shared fight record must replay to the same fight anywhere).
// Pure simulation, no browser, no clock: fights are recorded the way main.ts records them (every player intent goes
// through createRecorder.push and the sim steps the quantized intent), encoded to the share string, decoded back and
// replayed with stepPractice from initialPractice(seed, opponent). The gate passes only when every replay reaches the
// SAME finish on the SAME tick with the SAME outcome and byte-identical final fighters, and when a record carrying a
// foreign version byte is refused with the version error rather than decoded best-effort, and when src/replay.ts verifyRecord
// (the replay page's own check) accepts every record this gate replays. Any other result, including
// a replay that quietly ends elsewhere, exits 1 with the seed, opponent and both sides of the mismatch printed.
// The player is driven by the same brain the AI uses (src/ai.ts decide for side 0) so the fights are real: both sides
// attack, guard, parry and kill. Usage: node scripts/kill-link-check.mjs [--seeds N] [--profile normal|hard|easy]
import { initialPractice, stepPractice } from '../src/combat.ts';
import { createRecorder, decodeRecord, encodeRecord, fromBase64Url, toBase64Url } from '../src/record.ts';
import { decide, initialAi } from '../src/ai.ts';
import { verifyRecord } from '../src/replay.ts';
import { OPPONENTS, PROFILES } from '../src/moves.ts';
import { ROSTER } from '../src/roster.ts';

const arg = (name, fallback) => { const i = process.argv.indexOf(name); return i > 0 ? process.argv[i + 1] : fallback; };
const SEEDS = Number(arg('--seeds', 6)), PROFILE = arg('--profile', 'normal'), MAX_TICKS = 60 * 120;   // two minutes of sim per fight
const opponents = Object.keys(ROSTER).filter((id) => !ROSTER[id].hold);   // the shipped roster; held bodies have no live fights to link
const fingerprint = (p) => JSON.stringify(p.duel.fighters);
const outcomeOf = (p) => (p.finish ? (p.finish.draw ? 'draw' : p.finish.victim === 1 ? 'killed' : 'died') : 'abandoned');
const failures = [];
const fail = (where, detail) => { failures.push(`${where}: ${detail}`); console.error(`FAIL ${where}: ${detail}`); };

// Record one fight exactly as the live loop does: push, step the quantized intent, finish on the first finish.
function record(opponent, seed) {
  const meta = { build: 'kill-link-check', opponent, weapon: 'longsword', profile: PROFILE, seed };   // the record carries the player's weapon since #323; the hero brain fights with the longsword
  const recorder = createRecorder(meta);
  let practice = initialPractice(seed, OPPONENTS[opponent], 'longsword'), hero = initialAi(seed ^ 0x5bd1e995);
  while (!practice.finish && practice.duel.tick < MAX_TICKS) {
    const w = decide(practice.duel, 0, hero, PROFILES[PROFILE]);
    hero = w.ai;
    // The player starts sheathed and the brain never draws on its own (the warden waits for a drawn sword): the first tick is the
    // attack tap a player makes, which turns 'sheathed' into 'draw'; from there the brain fights as it does in the ladder battery.
    const intent = practice.duel.tick === 0 ? { ...w.intent, action: 'light' } : w.intent;
    practice = stepPractice(practice, recorder.push(intent), OPPONENTS[opponent].profiles[PROFILE]);
  }
  return { record: recorder.finish(outcomeOf(practice)), tick: practice.duel.tick, outcome: outcomeOf(practice), print: fingerprint(practice) };
}

// Replay a decoded record with nothing but its own bytes: the finish must land on the last recorded intent, not before.
function replay(r) {
  let practice = initialPractice(r.seed, OPPONENTS[r.opponent]);
  for (let i = 0; i < r.intents.length; i++) {
    if (practice.finish) return { early: i, tick: practice.duel.tick, outcome: outcomeOf(practice), print: fingerprint(practice) };
    practice = stepPractice(practice, r.intents[i], OPPONENTS[r.opponent].profiles[r.profile]);
  }
  return { early: -1, tick: practice.duel.tick, outcome: outcomeOf(practice), print: fingerprint(practice) };
}

let fights = 0, finished = 0, bytes = 0, longest = 0;
for (const opponent of opponents) for (let s = 0; s < SEEDS; s++) {
  const seed = 731 + s * 97;
  const live = record(opponent, seed), where = `${opponent} seed ${seed} (${PROFILE})`;
  const link = await encodeRecord(live.record);
  bytes += link.length; longest = Math.max(longest, link.length);
  let decoded;
  try { decoded = await decodeRecord(link); } catch (error) { fail(where, `decode threw: ${error.message}`); continue; }
  if (decoded.ticks !== live.record.ticks || decoded.outcome !== live.outcome) { fail(where, `decode changed the header: ticks ${decoded.ticks}/${live.record.ticks} outcome ${decoded.outcome}/${live.outcome}`); continue; }
  const back = replay(decoded);
  fights++;
  // The game's own verifier (src/replay.ts, what the replay page runs) must agree with this gate's independent replay.
  const verdict = verifyRecord(decoded);
  if (!verdict.ok) { fail(where, `verifyRecord refused a live record: ${verdict.reason}`); continue; }
  if (live.outcome !== 'abandoned') finished++;
  if (back.early >= 0) { fail(where, `replay finished early at intent ${back.early} of ${decoded.ticks} (${back.outcome} on tick ${back.tick})`); continue; }
  if (back.tick !== live.tick || back.outcome !== live.outcome) { fail(where, `replay ended on tick ${back.tick} as ${back.outcome}; live fight ended on tick ${live.tick} as ${live.outcome}`); continue; }
  if (back.print !== live.print) fail(where, `same tick and outcome but the fighters differ:\n  live   ${live.print.slice(0, 300)}\n  replay ${back.print.slice(0, 300)}`);
}
if (finished === 0) fail('coverage', `no fight reached a finish within ${MAX_TICKS} ticks; the gate proved nothing about kills`);

// A record from a future (or corrupted) build must be refused by its version byte, never best-effort decoded into a wrong fight.
{
  const sample = (await (async () => { const r = record(opponents[0], 731).record; return r; })());
  const raw = await new Response(new Blob([fromBase64Url(await encodeRecord(sample))]).stream().pipeThrough(new DecompressionStream('gzip'))).arrayBuffer();
  const foreign = new Uint8Array(raw); foreign[2] = 200;   // header: 'F','K', version
  const link = toBase64Url(new Uint8Array(await new Response(new Blob([foreign]).stream().pipeThrough(new CompressionStream('gzip'))).arrayBuffer()));
  try { const r = await decodeRecord(link); fail('version refusal', `a version-200 record decoded silently as version ${r.v} with ${r.ticks} ticks`); }
  catch (error) { if (!/version 200 is not supported/.test(error.message)) fail('version refusal', `wrong error for a foreign version: ${error.message}`); }
}

const verdict = failures.length ? 'FAIL' : 'PASS';
console.log(`kill-link determinism: ${verdict} — ${fights} fights (${opponents.length} opponents × ${SEEDS} seeds, ${PROFILE}), ${finished} reached a kill/death/draw, links mean ${Math.round(bytes / Math.max(1, fights))} / longest ${longest} chars, version refusal ${failures.some((f) => f.startsWith('version')) ? 'BROKEN' : 'ok'}`);
process.exit(failures.length ? 1 : 0);
