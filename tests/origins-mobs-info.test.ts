// CI entry for the creature info card (src/core/world/info.ts, origins/preview/creature-card.ts). The origins/ tests only run when a tests/ file imports them.
import './lib/era-off.ts';   // RV78: the legacy suite runs on trunk's rules; sandbox-era.ts is the one switch (tests/lib/era-off.ts)
import './world-info.test.ts';
