// The sandbox era ON for one test file (tests/lib/era-off.ts turns it off for the whole run): import this FIRST, before anything that reads the sandbox rules.
// It also lifts era-off.ts's force, so a record replays under the era its own version names (v31..v77 old rules, v78 the sandbox's, v79 and later the RV79 rows too).
import { forceSandbox, setRows79, setRows80, setSandbox } from '../../src/fight/sandbox-era.ts';

forceSandbox(undefined);
setSandbox(true);
setRows79(true);
setRows80(true);
