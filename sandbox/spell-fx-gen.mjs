/* global URL, console */
// Authors sandbox/spell-fx.json: one `spellEffect` row per catalogue spell { id, fx }, the designed special effect that spell plays when cast (special-presentation.ts spellFxId).
// The game's ladder rule (10 opponent families x 10 ranks): a spell's level is its rank; rank r = ladder levels 5r-4..5r.
//   ranks 1-3 -> the family's class special A, ranks 4-7 -> class special B, ranks 8, 9, 10 -> the family's own boss special.
//   a spell of a LADDER legend (legend-families.json) plays exactly its family's effect at its rank.
//   any other spell (a legend outside the ladder) plays an effect of its own level band, taken from the family pool by the spell's school when an effect of that school exists
//   (special-schools.json), else from the whole band; the pick inside the pool is a hash of the spell id, so it is stable.
// Re-run to re-author: node sandbox/spell-fx-gen.mjs
import { writeFileSync } from 'node:fs';
import { SPELL_INFO } from '../src/fight/spell-catalogue.ts';
import { classSpecialFor } from '../src/fight/class-special-identity.ts';
import { bossSpecialFor } from '../src/fight/special-identity.ts';
import { SPECIAL_MODES } from '../src/fight/special-modes.ts';
import FAMILIES from '../src/fight/legend-families.json' with { type: 'json' };
import SCHOOL_ROWS from '../src/fight/special-schools.json' with { type: 'json' };
const SCHOOL_OF = Object.fromEntries(SCHOOL_ROWS.rows.map((r) => [r.id, r.school]));   // the effects that carry a school (18 of the 50); the rest have none

const hash = (s) => { let h = 2166136261; for (const c of s) { h ^= c.charCodeAt(0); h = Math.imul(h, 16777619) >>> 0; } return h; };
const ladderLevel = (rank) => 5 * rank - 4;
const fxFor = (opponent, rank) => (rank >= 8 ? bossSpecialFor(opponent, ladderLevel(rank)) : classSpecialFor(opponent, ladderLevel(rank)));
const band = (rank) => (rank <= 3 ? 'A' : rank <= 7 ? 'B' : String(rank));
const opponents = FAMILIES.families.map((f) => f.opponent);
const pools = new Map();   // band -> effect ids, one per family
for (const rank of [1, 4, 8, 9, 10]) pools.set(band(rank), opponents.map((o) => fxFor(o, rank)).filter(Boolean));
const rankOf = new Map(); for (const f of FAMILIES.families) for (const l of f.legends) rankOf.set(l.legendId, { opponent: f.opponent, rank: l.rank });

let exact = 0, bySchool = 0, byBand = 0;
const rows = Object.entries(SPELL_INFO).sort(([a], [b]) => a.localeCompare(b)).map(([id, i]) => {
  const ladder = rankOf.get(id);
  if (ladder) { exact++; return { id, fx: fxFor(ladder.opponent, i.level) }; }
  const pool = pools.get(band(i.level)), same = pool.filter((fx) => SCHOOL_OF[fx] === i.school), pick = same.length ? same : pool;
  if (same.length) bySchool++; else byBand++;
  return { id, fx: pick[hash(id) % pick.length] };
});
for (const r of rows) if (!r.fx || !SPECIAL_MODES[r.fx]) throw Error(`${r.id}: no effect mode for "${r.fx}"`);
writeFileSync(new URL('./spell-fx.json', import.meta.url), '{"spellEffect":[\n' + rows.map((r) => JSON.stringify(r)).join(',\n') + '\n]}\n');
console.log(rows.length, 'rows | ladder legends (exact)', exact, '| by school + band', bySchool, '| by band only', byBand, '| distinct effects', new Set(rows.map((r) => r.fx)).size);
