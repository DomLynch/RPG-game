// CI stub (tests/origins-test-stubs.test.ts): Zone 1's combat loop tests reach test:all through this import.
import './lib/era-off.ts';   // RV78: the legacy suite runs on trunk's rules; sandbox-era.ts is the one switch (tests/lib/era-off.ts)
import '../origins/combat/zone1.test.ts';
import '../origins/combat/open-world.test.ts';
