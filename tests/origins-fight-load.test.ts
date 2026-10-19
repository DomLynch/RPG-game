// CI entry for the Origins greybox's failed duel-chunk load (origins/preview/fight-load.ts: which fight a failure un-counts, who sees the hint).
import './lib/era-off.ts';   // RV78: the legacy suite runs on trunk's rules; sandbox-era.ts is the one switch (tests/lib/era-off.ts)
import '../origins/preview/fight-load.test.ts';
