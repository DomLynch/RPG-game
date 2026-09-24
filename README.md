# Defence reads — block, parry, dodge at impact (LIVE a5590911, 375x812)

Captured 2026-09-24 ~18:28–18:39 +04 from https://frankendom.com (release.json `a5590911f8abe1ca6ea7c4a3bc9435172d2c4d3f`),
`?opponent=veteran&debug=1` (debug readout hidden), headless Chromium, mobile 375x812 @2x. Each still is the frame on which the
sim emitted the target event for the player (actor 0). Cues were read LIVE by hooking `AudioBufferSourceNode.start` and mapping
the sprite offset to `src/audio/manifest.ts` (identical on a5590911); no `OscillatorNode` fallback fired in any run.

| defence | still | cue(s) that fired | what the player can read |
|---|---|---|---|
| Block | `defence-block.png` (vs heavy overhead) | `block` (not `block_perfect`) + the attacker's `whoosh_heavy` | Guard up, swords crossed overhead, a white trail on the blade. Line: "Blocked · −35 stamina · −10 chip". |
| Parry | `defence-parry.png` (vs heavy overhead) | `parry` + the attacker's `whoosh_heavy` | **Same body picture as the block at this frame**: guard up, blades crossed overhead. Line: "Parried!". The Centurion's `Staggered` fires on this same tick but has not shown yet. |
| Dodge | `defence-dodge.png` (vs thrust) | NO impact cue — only `roll` (at the roll's start) + the attacker's `whoosh_light` | Unmistakable: the player is mid-roll, low and off the line, the thrust passing over. Line: "Evaded!". |

`defence-sheet.png` = the three side by side.

**Verdict.** Dodge reads as its own event from the body alone. Block and parry do NOT read apart from the bodies at impact —
on the phone they are told apart by the sound (`block` vs `parry`, different samples) and the one-line text only. If they
should read apart visually, the difference has to come after impact (the attacker's stagger) or from a hit effect; that
is a finding for Lead/Strategy, not a change made here.

Notes: the dodge had to be a sideways roll — a straight-back roll from the default spacing takes the player out of reach and the
sim reports `AttackMissed`, not `Dodged` (no "Evaded!"). A kick dodge (captured first) also reads, with the same `roll`-only audio.
The player stood passive between attempts, so the lorarii whipped him (`whip` cue) — unrelated to the defences.
