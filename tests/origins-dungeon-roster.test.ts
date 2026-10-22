// CI entry for Dungeon 1's ring roster (origins/dungeon/: pure data + a loader, no DOM, network or randomness); the tests live beside it.
import './lib/era-off.ts';   // RV78: the legacy suite runs on trunk's rules; sandbox-era.ts is the one switch (tests/lib/era-off.ts)
import '../origins/dungeon/bowl-roster.test.ts';
