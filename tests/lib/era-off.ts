// Imported FIRST by each legacy test file (tests/*.test.ts, one line; the sandbox-* files that test the ON rules import ./era-on.ts instead): the sandbox era (src/fight/sandbox-era.ts)
// and the RV79 rows (stances 2x, the wider Arena 1 circle, the plate shape) are OFF, so a test that checks trunk's fight numbers, a stored v31..v77 record or a fixture sees exactly the rules it was
// written against. Live play and records at v78 or later are not touched by this file (it runs in tests only).
// The era is FORCED off, not just set off: a fight the legacy suite records now is stamped with the current RECORD_VERSION, and its replay must run under the same rules
// it was fought with, not flip the era on because its version says so.
import { forceSandbox, setRows79, setRows80, setRows83, setRows84, setRows85, setSandbox } from '../../src/fight/sandbox-era.ts';

forceSandbox(false);
setSandbox(false);
setRows79(false);
setRows80(false);   // RV80 (leathers' shape, the special timers) too
setRows83(false);   // RV83 (the open world's bow hero carries the special share) too
setRows84(false);   // RV84 (the open world's picked specials, the added band rows) too
setRows85(false);   // RV85 (the open world's held STRIKE: the charged heavy) too
