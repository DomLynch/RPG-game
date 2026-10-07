// The RNG draw fingerprint (Lead brief 2026-10-06, Dom's 10-05 plan: "before 50 levels"). When a level is added or a table retuned, every existing
// fight and replay (record-replay, the duel verifier) must stay bit-identical unless the change means to alter it. For every opponent x level
// {1, 6, 11, 12, 18, 30, 46} x three fixed seeds x two scripted players (idle; walk in and swing every 45 ticks), the sim runs a fixed number of
// ticks and records (a) how many draws the warden's seeded stream made and a hash of their values in order, and (b) the end state's hash
// (net/rollback.ts hashDuel: tick, both fighters, the finish). The warden has ONE stream: ai.ts `lcg`, advanced only by roll(), so its draws are
// the lcg orbit of the start seed and the count is the steps from the start seed to the end seed. No sim file is touched.
//   node scripts/rng-fingerprint.mjs            prints the fingerprints as JSON
//   node scripts/rng-fingerprint.mjs --update   rewrites tests/fixtures/rng-fingerprint.json at the current RECORD_VERSION (npm run fingerprint:update)
import { createHash } from 'node:crypto';
import { writeFileSync } from 'node:fs';
import { initialPractice, stepPractice } from '../src/combat.ts';
import { idleIntent } from '../src/duel.ts';
import { LEVELS, OPPONENTS, opponentAt, profileAt } from '../src/moves.ts';
import { hashDuel } from '../src/net/rollback.ts';
import { NO_PATRON_VERSION } from '../src/record.ts';

export const FIXTURE = new URL('../tests/fixtures/rng-fingerprint.json', import.meta.url);
export const LEVEL_SET = [1, 6, 11, 12, 18, 30, 46];
export const SEEDS = [731, 20260922, 4242424242];
export const TICKS = 600;
const lcg = (seed) => (Math.imul(seed, 1664525) + 1013904223) >>> 0;   // ai.ts, same arithmetic
const ACTS = ['light', 'heavy', 'thrust'];
const PLAYERS = {
  idle: () => idleIntent(),
  walkin: (t) => ({ ...idleIntent(), move: { x: 0, z: t % 120 < 60 ? 0.8 : 0, yaw: 0, run: false }, action: t % 45 === 0 ? ACTS[(t / 45) % 3] : null, lock: true }),
};
const sha = (text) => createHash('sha256').update(text).digest('hex').slice(0, 16);

/** Both numbers for one stream: draws (steps from the start seed to the end seed, searched up to `cap`) and a hash of the drawn values in order. */
export function stream(startSeed, endSeed, cap = 2_000_000) {
  const hash = createHash('sha256');
  let seed = startSeed, n = 0;
  while (seed !== endSeed) {
    if (n >= cap) throw Error('rng-fingerprint: the end seed is not on the start seed\'s orbit: another writer touches the warden\'s seed');
    seed = lcg(seed); n++;
    hash.update(String(seed)).update(',');
  }
  return { draws: n, values: hash.digest('hex').slice(0, 16) };
}

export function fingerprints() {
  const cells = {};
  for (const id of Object.keys(OPPONENTS)) for (const level of LEVEL_SET) for (const seed of SEEDS) for (const [name, player] of Object.entries(PLAYERS)) {
    const opponent = OPPONENTS[id];
    let practice = initialPractice(seed, opponentAt(opponent, level));
    let ticks = 0;
    for (; ticks < TICKS && !practice.finish; ticks++) practice = stepPractice(practice, player(ticks), profileAt(opponent, level));
    const { draws, values } = stream(seed, practice.ai.seed);
    cells[`${id}:${level}:${seed}:${name}`] = { ticks, draws, rng: values, state: hashDuel(practice.duel) };
  }
  return { version: NO_PATRON_VERSION, ticks: TICKS, levels: LEVEL_SET, seeds: SEEDS, levelCount: LEVELS, cells };
}

if (process.argv[1] && new URL(`file://${process.argv[1]}`).pathname === new URL(import.meta.url).pathname) {
  const result = fingerprints();
  if (process.argv.includes('--update')) { writeFileSync(FIXTURE, `${JSON.stringify(result, null, 1)}\n`); console.log(`rng-fingerprint: ${Object.keys(result.cells).length} cells at RECORD_VERSION ${result.version} -> tests/fixtures/rng-fingerprint.json`); }
  else console.log(JSON.stringify(result));
}
