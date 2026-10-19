// CI's test:all runs tests/*.test.ts only: this stub is how per-layer spawn clocks (docs/specs/origins/per-layer-spawns.md, migration 20261019170000: the writer's layer path and the spawn janitor) reach the gate.
import './lib/era-off.ts';   // RV78: the legacy suite runs on trunk's rules; sandbox-era.ts is the one switch (tests/lib/era-off.ts)
import '../origins/server/world-layers.test.ts';
import '../origins/server/spawn-janitor.test.ts';
import '../origins/server/dynamic-respawn.test.ts';
