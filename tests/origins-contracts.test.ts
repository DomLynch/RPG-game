// Origins O1 contracts (src/core/contracts/, docs only until the beta): pure, no DOM or network; Lead's option A CI entry.
import './lib/era-off.ts';   // RV78: the legacy suite runs on trunk's rules; sandbox-era.ts is the one switch (tests/lib/era-off.ts)
import './contracts-economy.test.ts';
import './contracts-ids.test.ts';
import './contracts-items.test.ts';
import './contracts-registry.test.ts';
import './contracts-story.test.ts';
import './contracts-trade-cooldown.test.ts';
import './contracts-world.test.ts';
