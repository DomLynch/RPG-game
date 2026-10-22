// CI's test:all runs tests/*.test.ts only: this stub is how the world-marks settler (docs/specs/origins/pit-live-zone.md, migration 20261022100000: a ladder roster kill is a ladder mark, settled at the end of the join window) reaches the gate.
import './lib/era-off.ts';   // RV78: the legacy suite runs on trunk's rules; sandbox-era.ts is the one switch (tests/lib/era-off.ts)
import '../origins/server/world-marks.test.ts';
import '../origins/server/world-marks-dungeon.test.ts';
