// The mob kit's version, as a tag a world-fight record carries and the server checks (Auditor MEDIUM on #1701). A world-fight record is verified by the server replaying it with ITS build's mob layer
// (origins/server/encounter-verify.ts), but RECORD_VERSION versions the sim, not the kit: a page built from another commit than the writer's would play a fight the verifier cannot reproduce and an
// honest win would be refused as a loss. So the page writes this tag into the record's `build` string (origins/preview/world-record.ts, packed ASCII already: no record-format change) and the
// verifier refuses a different one as "kit mismatch", which is not a loss (settle answers 422 'kit-mismatch', the token is left to the sweep, nothing is paid).
// The tag is a hash of the kit DATA (the tables below) plus KIT_LOGIC_VERSION: a hash of data cannot see a code change, so a change in behaviour with the tables untouched must bump
// KIT_LOGIC_VERSION. tests/kit-version.test.ts pins the TEXT of the two files that code lives in, so a change there fails until someone decides and re-pins.
import { AFTER_HIT_TICKS, EXHAUSTED_BELOW } from '../../src/mobkit.ts';
import { KITS, MODE } from './kits.ts';

// Bump when the kit CODE changes behaviour: src/mobkit.ts (kitIntent, holds, validateChains) or origins/mobs/kits.ts (mobLayer, mobProfile). (Combat owns those; the pin test below calls them out.)
export const KIT_LOGIC_VERSION = 1;

// cyrb53: a small synchronous 53-bit string hash (no crypto: it runs in the page). Not a secret, only a version tag.
export function cyrb53(text: string, seed = 0): number {
  let h1 = 0xdeadbeef ^ seed, h2 = 0x41c6ce57 ^ seed;
  for (let i = 0; i < text.length; i++) { const c = text.charCodeAt(i); h1 = Math.imul(h1 ^ c, 2654435761); h2 = Math.imul(h2 ^ c, 1597334677); }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return 4294967296 * (2097151 & h2) + (h1 >>> 0);
}

// Object keys sorted, so the same tables always give the same text.
const canonical = (value: unknown): string => JSON.stringify(value, (_key, v: unknown) => (v && typeof v === 'object' && !Array.isArray(v) ? Object.fromEntries(Object.entries(v).sort(([a], [b]) => (a < b ? -1 : 1))) : v));
export const kitTagOf = (tables: unknown): string => cyrb53(canonical(tables)).toString(36);

// What this build's mob layer is made of. (#1701's CHAINS table joins this list when it is on trunk.)
export const kitTables = () => ({ logic: KIT_LOGIC_VERSION, KITS, MODE, AFTER_HIT_TICKS, EXHAUSTED_BELOW });
export const kitTag = (): string => kitTagOf(kitTables());

// The record's `build` string: the page's own label, then the tag. kitOfBuild reads it back (null: none).
export const kitBuild = (label: string): string => `${label} kit:${kitTag()}`;
export const kitOfBuild = (build: string): string | null => /(?:^| )kit:([0-9a-z]+)$/.exec(build)?.[1] ?? null;
