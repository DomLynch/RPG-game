// CI entry for Origins Region 1 content (origins/region1/: data + a pure loader, no DOM, network or stateful src imports); the tests live beside it.
import './lib/era-off.ts';   // RV78: the legacy suite runs on trunk's rules; sandbox-era.ts is the one switch (tests/lib/era-off.ts)
import '../origins/region1/region1.test.ts';
import '../origins/region1/hazards.test.ts';   // the Bounty hazards as rows
