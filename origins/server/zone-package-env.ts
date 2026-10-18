// Import this FIRST in a test that must see unlisted zone packages: Region 1 is loaded once per process and reads the unlisted-zone opt-in when it first loads, so a landing in an unlisted package
// resolves only if the flag is set before anything loads it. Test processes only: nothing that builds what the public gets imports this (tests/unlisted-zones-guard.test.ts guards the scripts and env files).
process.env.VITE_UNLISTED_ZONES = '1';
