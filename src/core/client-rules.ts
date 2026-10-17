// The core's client-side waits as a row (Web, Dom's data-layer rule, from the 2026-10-17 hard-coding audit): how long a gear / skills read waits on the writer, and when a returning player's account mounts on an
// idle page. Every value is the literal it replaced (tests/core-rows-5.test.ts pins them and loads the table through the registry). None is read by the sim. Pure.
import RULES from './client-rules.json' with { type: 'json' };

export const CLIENT = RULES.clientRule[0]!;   // the clientRule row (src/core/client-rules.json)
