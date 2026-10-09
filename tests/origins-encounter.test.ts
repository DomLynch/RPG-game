// CI's test:all runs tests/*.test.ts only: this stub is how the encounter verifier (origins/server/encounter-verify.ts) and the writer's encounter ops (origins/server/encounter.ts) reach the gate.
// The sim-equality pin, tests/world-fight-determinism.test.ts, is a tests/ file and runs on its own. The real-Postgres check is scripts/origins-encounter-check.mjs (the VPS).
import '../origins/server/encounter-verify.test.ts';
import '../origins/server/encounter.test.ts';
