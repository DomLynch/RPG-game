// CI entry for the Origins preview hint card and header (origins/preview/hint.test.ts). The origins/ tests only run when a tests/ file imports them.
import './lib/era-off.ts';   // RV78: the legacy suite runs on trunk's rules; sandbox-era.ts is the one switch (tests/lib/era-off.ts)
import '../origins/preview/hint.test.ts';
