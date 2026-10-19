// CI entry for NPC rows (origins/npcs/row.ts) and Region 1's townspeople (origins/region1/npcs.ts).
import './lib/era-off.ts';   // RV78: the legacy suite runs on trunk's rules; sandbox-era.ts is the one switch (tests/lib/era-off.ts)
import '../origins/npcs/row.test.ts';
import '../origins/npcs/cloth.test.ts';   // the cloth pieces as rows
