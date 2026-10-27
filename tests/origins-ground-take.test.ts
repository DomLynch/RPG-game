// CI entry for ground loot (#2775): the pure take, the handlers and the loader's rows. The real-Postgres check is scripts/origins-ground-check.mjs (the VPS).
import './lib/era-off.ts';   // RV78: the legacy suite runs on trunk's rules; sandbox-era.ts is the one switch (tests/lib/era-off.ts)
import '../origins/server/ground-take.test.ts';
