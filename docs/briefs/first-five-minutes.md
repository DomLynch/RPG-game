# Brief: the first five minutes (intro → first fight → the hook)

Owner: Strategy, 2026-10-14 23:1x Dubai, on Dom's order ("get this briefed and we get it done"). Lead runs it; Web builds the overlay, World the camera path, Dom approves the copy. Receipt before READY: one 375-wide clip of the whole sequence from cold load to the share row, plus Dom's phone run.

## Why
Nobody but Dom has played the game. The first 30 minutes decide whether a mobile player stays, and today a fresh guest lands in the arena with a "Tap Fight" cue and no idea where they are or why. The fight hooks; the first 60 seconds don't.

## What ships (one PR per line, in this order)

1. **Intro, in-engine, no video file.** A 45–60 s camera tour of the Pit (the existing TOUR path in `src/fight/camera.ts`) with the hero standing in it, four caption cards fading in and out. Runs on top of the live arena, so the game is already loaded when it ends. Tap anywhere = skip to the fight; FIGHT itself works from second 0. Shown once per device (a storage flag), never on a return visit, never on a kill-link visit. This keeps Dom's 2026-09-30 ruling (no first-visit card, a guest loads straight into the arena): the intro is a layer, not a gate.
2. **Captions and timings as rows** (`src/intro-defs.json` + manifest, four cards: text, start tick, hold ticks, fade ticks), zero literals; the as-data checker stays at 0 debt.
3. **Fight 1 unchanged**: the Centurion at level 1, a first-timer tapping attack wins (SCOPE.md rule). The brief adds nothing to the fight.
4. **The hook, verified in sequence, not rebuilt**: kill screen → the legend line (already read from the catalogue rows) → the take (loot v2, tap is the take, Undo) → the share row ("1v1 me in Frankendom ⚔️", DUEL / LINK / CLIP). Web walks this on a phone and fixes only what breaks in the flow.

## Copy (draft, in the arena's voice of src/legends.ts; Dom approves or rewrites before build)
1. "You wake on the sand. Iron on your wrists. A crowd above you that has already bet on your death."
2. "This is Frankendom. The dead fight here, and the living pay to watch."
3. "Win, and you take what the fallen carried. Win enough, and the gate opens to the world beyond the Pit."
4. "The Centurion is first. He always is. Tap to strike."

## Rules
- No pale or glowing text over a fighter (the specials look bar); captions sit in the lower third, dark ink on a dark strip.
- Nothing in the intro changes fight numbers, timings or the record; no RV bump.
- Phone first: 375×812 is the build target; desktop gets the same overlay.
- Reuse first: the camera TOUR path, the coach message channel for captions, the existing capture scripts for the receipt clip.

## Receipts for READY
- Before/after stills at 375 (visual-pr-stills rule) and the full-sequence clip (cold load → intro → fight 1 → kill → take → share), filmed on the VPS.
- Time from cold load to first tap on FIGHT, with and without skip, in the PR body.
- Dom's phone run, then the five-friend playtest measures time-to-second-fight.

## Not in this brief
A pre-rendered cinematic (Blender) comes later if Dom wants one; voice-over; any Origins content; a tutorial beyond the four cards.
