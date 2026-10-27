// CI entry for the load cover (origins/preview/load-cover.ts): it lifts at the first styled frame, and a wall-clock max hold fades it even if no frame ever draws.
import './lib/era-off.ts';   // RV78: the legacy suite runs on trunk's rules; sandbox-era.ts is the one switch (tests/lib/era-off.ts)
import '../origins/preview/load-cover.test.ts';
