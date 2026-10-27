// CI entry for Zone 1's own combat loop: Combat's pure step (src/fight/world.ts) and World's mount (origins/preview/world-combat.ts).
import './lib/era-off.ts';   // RV78: the legacy suite runs on trunk's rules; sandbox-era.ts is the one switch (tests/lib/era-off.ts)
import '../origins/combat/zone1.test.ts';
import '../origins/preview/world-combat.test.ts';
import '../origins/preview/world-heavy-hold.test.ts';   // a world press of kind heavy starts the heavy swing (hold-for-heavy, the world sim half)
import '../origins/preview/loadout-gate.test.ts';   // the sheet-in-world loadout gate (#2900)
import '../origins/preview/speeds.test.ts';   // #1871's test: imported here until its own stub lands
import '../origins/preview/warm-plan.test.ts';   // the player's actor is on every zone's warm-up list
import '../origins/preview/zone-look.test.ts';   // zone schema look/time fields (A2a)
import '../origins/preview/zone-sound.test.ts';   // K8: Zone 1 combat sound
