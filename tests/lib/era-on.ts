// The sandbox era ON for one test file (tests/lib/era-off.ts turns it off for the whole run): import this FIRST, before anything that reads the sandbox rules.
import { setSandbox } from '../../src/fight/sandbox-era.ts';

setSandbox(true);
