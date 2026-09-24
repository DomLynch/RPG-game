# Defence reads v2 — PR #686 (world/parry-tell) @ b1fe8d66, 375x812

Captured 2026-09-24 +04 from a local `vite build` of b1fe8d66 served by `vite preview` (not live), `?opponent=veteran&debug=1`
(debug readout hidden), headless Chromium, mobile 375x812 @2x, with no deploy lock held. Same method as v1 (`evidence/defence-reads`
@ 6ff9f47d, live a5590911): each still is the frame on which the sim emitted the player's event; cues are read live from
`AudioBufferSourceNode.start` mapped to `src/audio/manifest.ts`. The parry +6 still is 6 ticks (100 ms page time) after impact.
The text-covered copies put an opaque bar over the event line (`#combat-status`) only.

| defence | still | cue(s) that fired | what the player can read |
|---|---|---|---|
| Block | `defence-block.png` / `defence-block-textcovered.png` (vs heavy overhead) | `block` + the attacker's `whoosh_heavy` | The Centurion is hunched INTO the strike, trident low at his side; the player's blade is crossed over his. Line: "Blocked · −35 stamina · −10 chip". |
| Parry | `defence-parry.png` / `defence-parry-textcovered.png` (vs heavy overhead) | `parry` + `whoosh_heavy` | **New with #686:** at the impact tick the Centurion's trident is thrown OUT, horizontal and high off his line, arm flung wide, torso pulled upright, so he no longer leans in. Line: "Parried!". |
| Parry +6 | `defence-parry-plus6.png` / `-textcovered.png` | (same exchange) | The trident is further off line, and a few white sparks show at the contact. The pose holds; it is not a one-frame flicker. |
| Dodge | `defence-dodge.png` (vs thrust) | NO impact cue, only `roll` + the attacker's `whoosh_light` | Unchanged from v1: mid-roll, low and off the line. Line: "Evaded!". |

Sheets: `defence-sheet.png` (block, parry, parry +6, dodge) and `defence-sheet-textcovered.png` (block, parry, parry +6, text covered).
`contact-crop.png` is the blade contact enlarged for block | parry | parry +6.

**Compared with v1** (same move, same camera, same cue set): in v1 block and parry showed the same attacker pose at impact. On
#686 the attacker's weapon and body separate them from the impact tick with the text covered. Whether that reads at phone size
with the sound off is Strategy's call. The cues and event text are unchanged from live.
