// CI entry for the Origins world boss event (origins/boss/: pure, no DOM, network, timers or randomness); the tests live beside it.
import './lib/era-off.ts';   // RV78: the legacy suite runs on trunk's rules; sandbox-era.ts is the one switch (tests/lib/era-off.ts)
import '../origins/boss/boss.test.ts';
import '../origins/boss/legend-boss.test.ts';   // legend bosses: boss:<legend> resolves, settles and takes the spell; the legend spawn row kind
