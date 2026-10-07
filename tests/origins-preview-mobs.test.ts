// CI entry for the Region 1 mobs. origins/preview/mobs.ts: the Frontier's creatures, placed from the Region 1 data, wandering, noticing the hero (pure, no DOM).
// origins/preview/mob-looks.ts, mob-dress.ts: the look table and the dressing of a roster body. The origins/ tests only run when a tests/ file imports them.
import '../origins/preview/mobs.test.ts';
import '../origins/preview/hunt.test.ts';   // bite 2: the hunt (a tapped creature's fight, its loot, the Bounty), pure
import '../origins/preview/mob-looks.test.ts';
import '../origins/preview/mob-dress.test.ts';
