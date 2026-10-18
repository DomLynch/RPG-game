// Import this FIRST in a test that must see unlisted packages: Region 1 is loaded once per process and reads the opt-in when it first loads, so a landing in an unlisted package
// resolves only if the flag is set before anything loads it. Test processes only: nothing that builds what the public gets imports this (tests/unlisted-zones-guard.test.ts guards the scripts and env files).
const OPT_IN = '1';
process.env.VITE_UNLISTED_ZONES = OPT_IN;
