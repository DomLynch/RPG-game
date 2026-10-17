// Units and storage widths the writer shares. None is a game rule: each is a named exempt entry in scripts/as-data/allow/origins-server.json with its reason.
export const MS_PER_SECOND = 1000;
export const TICKS_PER_SECOND = 60;   // the sim's fixed step rate (src/fight/sim.ts STEP = 1 / 60); tests/units.test.ts pins the two together
export const CM_PER_M = 100;
export const LOG_TAG_CHARS = 6;   // the last characters of an id, as a log line's short tag
export const SEED_LIMIT = 0x80000000;   // a fight seed is a positive 31-bit integer (randomInt(1, SEED_LIMIT)), the record format's seed width
export const UINT32_BYTES = 4;   // the width of a readUInt32BE (the second roll of a hash starts one word in)
export const UINT32_RANGE = 0x100000000;   // 2^32, to turn four bytes of a hash into a fraction in [0, 1)
export const KILL_ID_HEX = 32;   // hex characters of the sha256 kept in a kill's storage id (enc.<hex>): the id's width in origins_events / ledgers
