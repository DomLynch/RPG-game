// CI entry for the Origins mob styles (origins/mobs/: pure, no DOM, network, timers or randomness); the tests live beside it.
import './lib/era-off.ts';   // RV78: the legacy suite runs on trunk's rules; sandbox-era.ts is the one switch (tests/lib/era-off.ts)
import '../tests/world-styles.test.ts';
import './world-row.test.ts';
