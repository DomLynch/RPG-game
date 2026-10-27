// Release check: the many-on-one cut (Dom via Strategy, 2026-10-13). One engine (src/fight/roll.ts crowdPercent, swarm-defs.json slots) applied in the duel step:
// three identical creatures on one hero land 1.0 / 0.5 / 0.3 of the solo blow, by join order (primary, then the joiners in order). Pure simulation, no browser.
// Run: node scripts/many-on-one-check.mjs  - exits 1 and prints the table on any miss.
import { creature, newWorld, player, stepCombat } from '../src/fight/world.ts';
import { SLOT_ROWS, crowdPercent } from '../src/fight/roll.ts';

const STILL = { x: 0, z: 0 }, boost = (f) => { f.health = f.maxHealth = 1e6; return f; };
const run = (ids) => {   // landed blows as [creature, slot at that tick, move, damage]; the slot is read from the hero's stream after the step: primary foe 1st, joiners in order
  let w = newWorld([boost(player('hero', 0, 0, 0, undefined, 10)), ...ids.map((id, i) => creature(id, 'boar', [0, 1.4, -1.4][i], [1.6, 1.8, 1.8][i]))]);
  const hits = [];
  for (let k = 0; k < 60 * 40; k++) {
    const r = stepCombat(w, { hero: STILL }, 1 / 60); w = r.world;
    const st = w.streams.hero, order = [st?.foe, ...(st?.joined ?? []).map((j) => j.foe)];
    for (const e of r.events) if (e.type === 'Hit' && e.victim === 'hero') hits.push([e.attacker, order.indexOf(e.attacker) + 1, e.move, e.damage]);
  }
  return hits;
};
const solo = {};
for (const [, , move, dmg] of run(['b1'])) solo[move] ??= dmg;
const trio = run(['b1', 'b2', 'b3']), rows = [], seen = new Set(), landed = new Set();
let bad = 0;
for (const [id, slot, move, dmg] of trio) {
  landed.add(id); seen.add(slot);
  const want = Math.max(1, Math.round(solo[move] * crowdPercent(slot) / 100)), ok = slot >= 1 && solo[move] !== undefined && dmg === want;
  if (!ok) bad++;
  if (!ok || rows.length < 12) rows.push(`${id} slot ${slot} ${move}: solo ${solo[move]} -> ${dmg} (want ${want}, ${Math.round(100 * dmg / solo[move])}%) ${ok ? 'ok' : 'MISS'}`);
}
console.log(`slots ${SLOT_ROWS.filter((r) => r.kind === 'mob').map((r) => r.percent).join('/')}%\n${rows.join('\n')}`);
if (landed.size < 3 || !seen.has(1) || !seen.has(2) || !seen.has(3) || bad) { console.error(`many-on-one: ${bad} miss(es), ${landed.size}/3 creatures landed, slots seen ${[...seen].sort()}`); process.exit(1); }
console.log('many-on-one: ok');
