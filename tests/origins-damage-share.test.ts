// CI's test:all runs tests/*.test.ts only: this stub is how kill credit by damage (origins/server/damage-share.ts, the replay's damage ledger, the writer's share path) reaches the gate.
import './lib/era-off.ts';   // RV78: the legacy suite runs on trunk's rules; sandbox-era.ts is the one switch (tests/lib/era-off.ts)
import '../origins/server/damage-share.test.ts';
import '../origins/server/damage-ledger.test.ts';
import '../origins/server/world-share.test.ts';
