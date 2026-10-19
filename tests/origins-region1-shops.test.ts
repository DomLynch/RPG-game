// CI entry for the Region 1 shop rows (origins/region1/shops.json); the tests live beside it.
import './lib/era-off.ts';   // RV78: the legacy suite runs on trunk's rules; sandbox-era.ts is the one switch (tests/lib/era-off.ts)
import '../origins/region1/shops.test.ts';
