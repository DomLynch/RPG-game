// CI entry for the zone loader (origins/zones/loader.ts): Zone 1's package validates and the validator names each fault. The import ban and the data-only lint are in tests/zone-packages.test.ts.
import '../origins/zones/loader.test.ts';
import '../origins/zones/presence.test.ts';   // the optional per-world-zone presence block on the zone row (speed, quiet, caps), checked at load
import '../origins/zones/camera-default.test.ts';   // camera B is the schema default: a row with no preset resolves to b
