// CI's test:all runs tests/*.test.ts only: this stub is how the creature loadouts (rows, the shared pickLoadout, creatureHash and the page/server parity) reach the gate.
import './lib/era-off.ts';   // RV78: the legacy suite runs on trunk's rules; sandbox-era.ts is the one switch (tests/lib/era-off.ts)
import '../origins/world/loadouts-rules.test.ts';
