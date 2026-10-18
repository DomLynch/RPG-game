// A digest of the melee strategy battery on the SHIPPED rows (no sandbox rows loaded): the same number at two shas proves a change touched no trunk fight.
//   node scripts/melee-digest.mjs [--seeds 8]   (needs node >= 22.6 with type stripping; run on the HF CPU box or the VPS)
/* global process, console */
import { createHash } from 'node:crypto';
import { battery } from '../tests/strategies.ts';
import { OPPONENTS } from '../src/fight/moves.ts';
import { setStab } from '../src/fight/stab-rule.ts';
setStab(true);
const i = process.argv.indexOf('--seeds'), seeds = i > 0 ? Number(process.argv[i + 1]) : 8;
const out = {};
for (const [id, opponent] of Object.entries({ veteran: OPPONENTS.veteran, goblin: OPPONENTS.goblin })) for (const level of ['normal', 'hard']) out[`${id}/${level}`] = battery(level, seeds, 7200, opponent);
const text = JSON.stringify(out);
console.log(`melee digest ${createHash('sha256').update(text).digest('hex').slice(0, 16)} (${seeds} seeds, ${text.length} bytes)`);
