# Activity transitions: who owns entering, leaving and cancelling (design note)

Code Quality, 2026-09-29, for Lead (ruling: not before beta; decide after Thursday's Duel run). Docs only. Source: trunk 5f2f622a, Pit draft #1122 @ e755257a, Duel #1116 @ e20a9f6a. Prompted by GPT's recheck at 5f2f622 ("the main risk is ownership of transitions").

## What exists today

The page has one fight at a time (`Match`, src/match.ts). Everything else layered on the arena is a separate *activity*, started from `main.ts` and cancelled in its own way:

| Activity | Starts | Async part | How a late result is stopped | Ends / cancelled by |
|---|---|---|---|---|
| Fight (career, practice, sparring) | `match.begin*` → `began()` | none | — | the next start |
| Replay of a kill link | `?replay=` → `startReplay` | fetch + decode | `match.epoch` checked before `match.startReplay` (main.ts ~913–921) | any start (epoch) |
| Claim wait before Share | the kill (`claim` promise) | post, `CLAIM_WAIT_MS` | `fightToken` (main.ts 712–735) | `began()` bumps it |
| Clip export | CLIP tap | recorder `stop()` | `clipEpoch` (main.ts 532, 802, 826, 838) | `dropClip()` in `began()`; a new recording |
| Pit (draft #1122) | Enter the Pit / Recover | chunk import | **none** (GPT P1) | `closePit()`; the gate's `go()` |
| Duel (#1116) | `?duel=` | lobby import + handshake | none needed today (page-level, before any fight) | page leave |
| Next rung / weapon or loadout change | Next | `settled` claim | none: `location.reload()` | the reload |
| Journal / welcome / versus card | buttons | none | — | `paused()` reads their flags |

So three different "is this result still mine?" tokens already exist: `match.epoch`, `fightToken` and `clipEpoch`. Each one is correct on its own. A fourth one (the Pit) is about to be added by hand, and two cancellation bugs have come from that gap: C at 48788d3 and F at 303af39 (both clip), and P1 in the Pit draft.

**`.click()` used as a command:**
- main.ts 692: `mobile-name` → `element('name-button').click()`. This one is harmless: it is a UI alias for a UI action.
- Pit draft `gate().go`: `closePit(); resetButton.click()`. This is the fragile one. The Pit's exit runs the kill screen's Next/Rematch handler through the DOM, so it depends on that button's `hidden` or disabled state and on whatever guards the handler adds later.
- main.ts 860: `link.click()` to download a clip. That is the browser API itself, not a game command.

## Smallest seam (no framework, no enum of flags)

1. **One op token**, reusing what is there. `match.epoch` already counts every start. Add a two-line helper next to `began()`:
   `const own = () => { const e = match.epoch; return () => e === match.epoch; };`
   The Pit's open, the clip's finish and the claim wait each take `own()` when they start and check it before they touch the scene or UI. `fightToken` and the fight-start half of `clipEpoch` then become `own()`. The clip keeps its own bump for "a new recording of the same fight", which is F's case and is not a fight start. Net code change: three counters become one, plus one helper.
2. **One command per button.** Move the body of `resetButton`'s click handler into `function nextFight()`. The handler calls `nextFight()`, and the Pit gate calls `closePit(); nextFight()`. Nothing else changes.
3. **Leaving the arena is transactional (the Pit and anything after it).** An activity that hides the arena must restore it on failure. That is GPT P2, owned by the Pit lane in #1122. Keep the rule in `src/pit/stage.ts`'s contract comment rather than in a shared base.

**Not proposed:** an activity manager class; a state enum; moving `Match` (it owns combat and stays as it is); touching the duel before its transport lands (Duel's four acceptance gates cover its transitions).

## Cost and when

- Seam 1: about 20 lines in main.ts, and the existing C/F/claim tests keep passing unchanged. That is the proof.
- Seam 2: about 5 lines. Its test is in the Pit's graphics harness: the gate leaves the Pit and starts the next fight with the button hidden.
- Order: Seam 2 lands with or right after #1122. Seam 1 comes after beta, before a third area or an online mode that shows the kill screen.
- Owner: Code Quality for Seam 1, the Pit lane for Seam 2, both on Lead's word.
