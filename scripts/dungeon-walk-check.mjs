// Headless walk of every dungeon row (origins/zones/dungeon-rows.json): in through the entrance room, room to room to the boss's room, and out the same way. Prints each route; exits 1 on a break.
// A row that fails to load (a broken graph, a missing loot or theme ref) throws at import, so a bad row also fails here. Run: node scripts/dungeon-walk-check.mjs
import { DUNGEONS, walkRoute } from '../origins/zones/dungeon.ts';

let bad = 0;
for (const d of DUNGEONS) {
  try {
    const w = walkRoute(d), boss = d.encounters.find((e) => e.id === d.boss.encounter);
    const stands = w.in.map((r) => `${r}${d.encounters.filter((e) => e.room === r).map((e) => ` [${e.creature.replace('character:', '')}]`).join('')}`);
    console.log(`${d.id} (L${d.level.join('-')}): in  ${stands.join(' > ')}\n${' '.repeat(d.id.length + 9)}boss ${boss.creature} in ${boss.room}; out ${w.out.join(' > ')}`);
  } catch (e) { bad++; console.error(`${d.id}: ${e.message}`); }
}
process.exit(bad ? 1 : 0);
