// The presence wire's shared constants: the two protocol names and the two frames (docs/specs/origins/frontier-presence.md §2). Pure data with no imports, so the page bundle and the node
// server read the same numbers (the client used to keep its own copy of the legacy centre). u16 centimetres: the v2 frame puts world (0,0) at CENTRE_CM, so x/z run -400..+255 m around the
// Pit centre and hold the town square AND every Zone 1 zone; the v1 frame (the old town-only client) is the 300 m square, centre 15000.
export const PROTOCOL = 'frankendom.presence.v1';   // the old town-only client (centre 15000, the 300 m square): served through the shim
export const PROTOCOL_V2 = 'frankendom.presence.v2';   // the whole-world frame (CENTRE_CM, FRAME_CM); the client offers one of them next to `token.<jwt>`, the server echoes it, never the token
export const CENTRE_CM = 40000;
export const FRAME_CM = 65535;
export const LEGACY_CENTRE_CM = 15000;
export const LEGACY_SPAN_CM = 30000;   // the v1 square's side: a v1 pose is clamped to 0..30000
