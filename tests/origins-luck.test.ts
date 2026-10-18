// CI entry for the Origins combat-luck contract (src/core/luck.ts: pure, no DOM, network, timers or randomness); the tests live beside it.
import './lib/era-off.ts';   // RV78: the legacy suite runs on trunk's rules; sandbox-era.ts is the one switch (tests/lib/era-off.ts)
import './luck.test.ts';
