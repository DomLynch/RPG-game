// CI entry for Zone 1's own combat loop: Combat's pure step (src/fight/world.ts) and World's mount (origins/preview/world-combat.ts).
import '../origins/combat/zone1.test.ts';
import '../origins/preview/world-combat.test.ts';
import '../origins/preview/speeds.test.ts';   // #1871's test: imported here until its own stub lands
import '../origins/preview/warm-plan.test.ts';   // the player's actor is on every zone's warm-up list
