// How big the Ash Wolf is DRAWN, as a multiple of its rig (src/assets/wolf.glb is 0.644 m at native scale; Dom 2026-10-07: "very small", then "same size walking and fighting").
// ONE number for both paths: the world's mob look (origins/preview/mob-looks.ts) and the duel's opponent rig (src/characters.ts), so a wolf met walking is the wolf fought (tests/beast-scale.test.ts).
// Render only, deliberately outside SIM_FILES: the sim's capsule (OPPONENTS.wolf.scale .8, ~1.4 m of hit body), the bite reach and the baked jaw path are unchanged, no record or fingerprint moves.
// The rig at x2 stands ~1.29 m, which is what that capsule was sized for; at native size the bites reached over a 0.64 m body.
export const WOLF_RENDER_SCALE = 2;
