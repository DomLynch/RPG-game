// CI's test:all runs tests/*.test.ts only: this stub is how the Zone 1 world spawn ops (origins/server/world-spawns.ts, migration 202610080014) reach the gate.
// The real-Postgres check is scripts/origins-spawns-check.mjs (the VPS).
import '../origins/server/world-spawns.test.ts';
