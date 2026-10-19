// CI's test:all runs tests/*.test.ts only: this stub is how the page's spawn client (origins/preview/spawn-net.ts) reaches the gate.
import './lib/era-off.ts';   // RV78: the legacy suite runs on trunk's rules; sandbox-era.ts is the one switch (tests/lib/era-off.ts)
import '../origins/preview/spawn-net.test.ts';
