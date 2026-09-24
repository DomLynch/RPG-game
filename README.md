# Opponent reveal — MOCKUPS ONLY (A/B/C), 375x812. Nothing is built; Dom picks.

Brief: Lead, Block A 2026-09-24, from Dom's direction via Strategy after the #670 revert: any opponent reveal wears the loot pickup
panel's look (semi-transparent, the same gold skin), in-world, with no cage or board.
Background: a real frame of the fight opening (reverted build 5015ce25, 375x812, +700 ms after "Enter the arena"). The overlays are
HTML/CSS mockups in the loot panel's exact tokens from src/style.css: `#b7a2768c` sand at 55 %, `blur(6px)`, border `#f0e3c9a6`,
ink `#1b1916`, Georgia for the name, Instrument Sans caps for labels, pale-glass tiles `#fdf6e340`. The kit thumbs are the Centurion's
real loot thumbs (`public/game/img/loot/veteran.*.thumb.webp`).

| file | concept | where it sits | note |
|---|---|---|---|
| `reveal-A.png` | A: the loot panel's own card, in the loot panel's own place | top band under the rank row, ends above his head | Name + weapon + his kit row (the pieces you can win), so reveal and reward share one card. No pointer-taking elements, so the top-band rule holds. |
| `reveal-B.png` | B: nameplates standing over each fighter | a plate over his head with a tick down to him; a quieter plate over the player | The most in-world option, and the smallest: name and weapon only. Would track the fighters (a 3D anchor), not sit fixed on screen. |
| `reveal-C.png` | C: a banner laid on the sand between them | flat in the arena's perspective, between the two fighters | "WANDERER vs / The Centurion / TRIDENT". The biggest moment of the three, still in the gold glass, no board. |

`reveal-sheet.png` has all three with labels. Shared behaviour for any pick (to be confirmed after the pick): the reveal shows on
the opening, fades as the loot panel does (250 ms), and is gone by the first draw. Copy is illustrative.
