// Preloaded for every test file (`node --test --import ./tests/lib/era-off.ts`, package.json and unit-ci.yml): the sandbox era (src/fight/sandbox-era.ts) is OFF, so a
// test that checks trunk's fight numbers, a stored v31..v77 record or a fixture sees exactly the rules it was written against. A test about the sandbox rules
// themselves imports ./era-on.ts as its FIRST import. Live play and records at v78 or later are not touched by this file (it runs in tests only).
import { setSandbox } from '../../src/fight/sandbox-era.ts';

setSandbox(false);
