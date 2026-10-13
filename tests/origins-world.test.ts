// CI entry for the Origins world parameters (origins/world/: pure, no DOM, network or stateful src imports); the tests live beside it.
import '../origins/world/concord.test.ts';
import '../origins/world/generate.test.ts';
import '../origins/world/town.test.ts';
import '../origins/world/town-kit.test.ts';
import '../origins/world/resolve.test.ts';
import '../origins/world/zone-rules.test.ts';
import '../origins/world/relief.test.ts';   // Zone 1 quality step 1: the ground's relief (pure, seeded)
import '../origins/world/variants.test.ts';   // creature variants as rows: tier weights and multipliers, tint, glyph, drop prefix, seeded roll
import '../origins/world/instances.test.ts';   // private instances as a slot pool: 24 slots, owner key, 300/900 s timers, headcount spawn
import '../origins/world/town-defs.test.ts';   // the town lot-kind and trade rows (the stub rule: every origins test has a CI entry)
