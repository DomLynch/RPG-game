// CI's test:all runs tests/*.test.ts only: this stub is how the world-record verifier (origins/server/world-verify.ts) and the kill_report record path reach the gate.
import './lib/era-off.ts';   // RV78: the legacy suite runs on trunk's rules; sandbox-era.ts is the one switch (tests/lib/era-off.ts)
import '../origins/server/world-verify.test.ts';
