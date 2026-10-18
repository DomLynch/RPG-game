// CI stub (tests/origins-test-stubs.test.ts): test:all runs tests/*.test.ts only, so the speed table's tests reach the gate through this import.
import './lib/era-off.ts';   // RV78: the legacy suite runs on trunk's rules; sandbox-era.ts is the one switch (tests/lib/era-off.ts)
import '../origins/preview/speeds.test.ts';
