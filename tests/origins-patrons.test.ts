// CI entry for Origins patrons and clans (origins/patrons/: pure, no DOM, network or stateful src imports); the tests live beside it.
import './lib/era-off.ts';   // RV78: the legacy suite runs on trunk's rules; sandbox-era.ts is the one switch (tests/lib/era-off.ts)
import '../origins/patrons/patrons.test.ts';
