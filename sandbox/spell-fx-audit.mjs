/* global console */
// Audit: which designed effect does each catalogue spell reach, by the game's own ladder rule?
//   the 100 ladder legends are 10 opponent families x 10 ranks (legend-families.json). A legend's rank r covers ladder levels 5r-4 .. 5r:
//   ranks 1-3 (levels 1-15) -> the family's class special A; ranks 4-7 (levels 16-35) -> class special B; ranks 8, 9, 10 -> the family's own boss special (bosses.json, rank 8/9/10).
// Prints the coverage and every gap; nothing is written.
import { SPELL_INFO } from '../src/fight/spell-catalogue.ts';
import { classSpecialFor } from '../src/fight/class-special-identity.ts';
import { bossSpecialFor } from '../src/fight/special-identity.ts';
import { SPECIAL_MODES } from '../src/fight/special-modes.ts';
import { SPECIAL_TESTS } from '../src/fight/special-look.ts';
import FAMILIES from '../src/fight/legend-families.json' with { type: 'json' };
import BOSSES from '../src/fight/bosses.json' with { type: 'json' };

const ladderLevel = (rank) => 5 * rank - 4;
const fxFor = (opponent, rank) => (rank >= 8 ? bossSpecialFor(opponent, ladderLevel(rank)) : classSpecialFor(opponent, ladderLevel(rank)));
console.log('designed effect modes', Object.keys(SPECIAL_MODES).length, '| look-test previews', Object.keys(SPECIAL_TESTS).length, '| boss rows', BOSSES.length ?? Object.keys(BOSSES).length);
const rankOf = new Map(); // legend id -> { opponent, rank }
for (const f of FAMILIES.families) for (const l of f.legends) rankOf.set(l.legendId, { opponent: f.opponent, rank: l.rank });
console.log('ladder legends', rankOf.size, '| families', FAMILIES.families.length);
console.log('\nPer family, the effect at each rank (what a rank-N ladder legend would show):');
for (const f of FAMILIES.families) console.log(f.opponent.padEnd(13), Array.from({ length: 10 }, (_, i) => `${i + 1}:${fxFor(f.opponent, i + 1) ?? '-'}`).join(' '));
const spells = Object.entries(SPELL_INFO);
const ladder = spells.filter(([id]) => rankOf.has(id)), other = spells.filter(([id]) => !rankOf.has(id));
console.log('\nspells', spells.length, '| of ladder legends', ladder.length, '| of other legends', other.length);
const reach = new Map(); for (const [id] of ladder) { const { opponent, rank } = rankOf.get(id); const fx = fxFor(opponent, rank); reach.set(id, fx); }
console.log('ladder spells with an effect:', [...reach.values()].filter(Boolean).length, 'without:', [...reach.values()].filter((v) => !v).length);
console.log('ladder spells without an effect:', [...reach].filter(([, v]) => !v).map(([id]) => `${id}(${rankOf.get(id).opponent} r${rankOf.get(id).rank})`).join(' ') || 'none');
const used = new Set([...reach.values()].filter(Boolean)); console.log('distinct effects reached by ladder spells:', used.size);
const all = new Set(); for (const f of FAMILIES.families) for (let r = 1; r <= 10; r++) { const v = fxFor(f.opponent, r); if (v) all.add(v); }
console.log('distinct designed effects the ladder rule can reach (10 families x 10 ranks):', all.size, '| with no mode:', [...all].filter((k) => !SPECIAL_MODES[k]).join(',') || 'none');
const bossIds = new Set(BOSSES.map((b) => b.id)); console.log('boss special ids in bosses.json:', bossIds.size, '| per family:', FAMILIES.families.map((f) => `${f.opponent}=${BOSSES.filter((b) => b.opponent === f.opponent).length}`).join(' '));
