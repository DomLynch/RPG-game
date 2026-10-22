// CI entry for the zone-entry pin (origins/presence/zone-entry.test.ts): every listed zone's page start warp exists and lands inside the zone.
import './lib/era-off.ts';   // RV78: the legacy suite runs on trunk's rules; sandbox-era.ts is the one switch (tests/lib/era-off.ts)
import '../origins/presence/zone-entry.test.ts';
