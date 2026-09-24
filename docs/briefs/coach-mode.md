# Coach mode — brief (Strategy, 2026-09-24 15:53 +04)

**Status:** POST-BETA. Owner ruling 2026-09-24 08:5x (docs/SCOPE.md, this branch): a coached fight is a full fight, rank and loot progress exactly as a played one, one ladder, no exhibition variant, "keep the game simple". Lead allocates the build when beta closes and Combat has a live session. Nothing in beta waits on this.

## What it is (from SCOPE)

Pick a playstyle before the fight (aggressive / defensive / agile / trickster) plus at most one extra instruction, then watch. The fighter is driven through the same input path as a human; tactics change preferences only, no perfect reactions.

## Requirements added 2026-09-24 (from the player-bot's 27/27 Easy report)

1. **The first coached exchange teaches defend-then-punish.** The coach holds guard, parries, and strikes the opening. The game's depth already wins fights (the bot won 27/27 on quick attacks, blocks and parries, no heavy spam); players are not shown it. No new buttons, no new mechanic.
2. **The Journal explains what the defence earned**, in plain words after the exchange: damage avoided, the opening it made, distance kept or lost. The player should be able to repeat the reason, not just the result.
3. **The charged heavy is answered on screen.** When the opponent charges, the coach rolls or parries the release, and the Journal names it ("held guard would have broken"). This is the same readability requirement as the HUD guard-broken line, shown from the other side.
4. **One ruleset.** Never a reduced reward, a separate ladder, or a coach-only difficulty.

## Receipts before merge

- A 3-frame strip at 375x812 of the first coached exchange (hold, parry, punish) with the Journal line visible, plus the perf line.
- One strip of the coach answering a charged heavy, with the Journal line.

## Not in this brief

Director's-cut clip export, challenge links, rematch-from-the-bad-moment (skipped in SCOPE). Roll vs short-step distances and thrust vs slash balance are parked (sim, freeze).
