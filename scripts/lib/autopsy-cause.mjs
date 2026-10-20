// The first autopsy line must name the cause (scripts/autopsy-browser-check.mjs). Since RV80 (K5f) level-1 foes fire specials, so a special's
// name is a correct cause line too: "The Scutum Shove landed on your torso." (K5j deploy stop, 2026-10-19: the row failed on the old plain-move list.)
// A special's name is capitalised; the plain moves stay lower-case, so "The Foo landed" without a body part still fails.
export const AUTOPSY_CAUSE = /^(Your posture broke|Your guard broke|You were out of stamina|The ((cut|heavy|thrust|kick|riposte|counter|critical)|[A-Z][A-Za-z' -]*[A-Za-z]) landed on your (head|torso|legs)\.)/;
