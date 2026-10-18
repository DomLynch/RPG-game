// CI entry for the wear and repair rows (origins/gear/: pure, no DOM, network, timers or randomness); the tests live beside it.
import './lib/era-off.ts';   // RV78: the legacy suite runs on trunk's rules; sandbox-era.ts is the one switch (tests/lib/era-off.ts)
import '../origins/gear/wear-repair.test.ts';
