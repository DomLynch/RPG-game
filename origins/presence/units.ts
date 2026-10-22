// Units, formats and protocol numbers the presence service shares. None is a game rule: each is a named exempt entry in scripts/as-data/allow/origins-presence.json with its reason. The generic ones (HALF, PERCENT,
// MS_PER_SECOND) live in ../units.ts and are imported from there.
export const HTTP_OK = 200;   // HTTP status code (RFC 9110): the protocol's own number
export const CELL_STRIDE = 4096;   // a grid cell's key is column * CELL_STRIDE + row; a zone is at most 655 m, so a row never reaches the stride and two cells never share a key
export const ACCOUNT_TAG_CHARS = 8;   // the leading characters of an account id a log line shows as its short tag
export const UUID_TAIL_CHARS = 12;   // a UUID's last group is 12 hex digits (a test bot's account id is built from its name)
export const P50 = 50, P99 = 99;   // the two percentiles the health readout reports, named p50 and p99 in the readout
