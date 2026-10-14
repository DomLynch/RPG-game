# Ten wild cards — 2026-10-10 19:xx (Strategy)

Source: the donor library at Games-Analysis db99bc8 (38 candidates harvested from the feel topics, catalogue, brainstorms and the onboarding focus; the reading was done by an agent, the choice and wording are mine). Every card is a distinct original: the rule is kept, names, layout, palette and numbers are ours. Donors marked GPL, restricted or leaked gave the category only.

How the loop works (your rule: judge by feel on your phone). Each card is a style flag on the existing scene, published to the preview folder with no release rows, per the look-test skill. You play it for five minutes at 375 wide, say keep or kill, and the next three go up. Nothing ships to the release pipeline until you say keep.

Order I'd run them: 1, 2, 9 tonight (small, all on fights that already exist), then 3, 4, 6, then 5, 7, 8, 10.

---

## 1. One heavy hit
**What you see.** Three attackers landing on you in the same tick read as ONE heavy hit: one shake, one blood blob on the side it came from, one rim flash on the hero instead of a full white flash. Quick taps never stack into flicker.
**Look test.** Zone 1, the 4-wolf pack. Flag on: get hit by two wolves at once. Does it feel like a wall, or like a strobe? Compare flag off.
**Cost.** Small, presentation only, inside the engine's hit stack.
**IP risk.** None in practice: the idea is "merge beats, flash the rim". Donors Crawl, Quake, Doom 3, Mindustry (all GPL, category only); our numbers are set at the look test.

## 2. The telegraph
**What you see.** A tenth of a second before a strike lands, a small ground ring and a short sound; the attacker's head, body or legs lights for a beat so you can read where it is going. A creature calling for help draws a visible ring.
**Look test.** Pit, any opponent. Can you dodge on the ring alone with the sound off? Then with the sound on, eyes half-closed.
**Cost.** Small, one cue frame in the engine, data per move.
**IP risk.** None: windup cues are universal. Donors SCAR (MIT), Asheron's Call emulator (AGPL, category), DevilutionX (restricted licence, category).

## 3. The stagger ladder
**What you see.** Hits push an opponent up a ladder: interrupted, stunned, dazed, knocked down, each with its own pose and its own signature sound. Under an elite's bar, three pips show it hardening: full stun, half, quarter, then an immune flash. Stuns from any attacker count on the same ladder, so three wolves cannot chain-stun you either. This is the crowd-control rule I already sent Lead for Proof 3.
**Look test.** Pit, a heavy opponent. Can you tell the four states apart by sound alone? Do the pips make "this one is getting tougher" obvious?
**Cost.** Medium: engine state plus four sounds and a pip row.
**IP risk.** None: diminishing returns are a genre convention. Donors Veloren, TrinityCore, EQEmu (all GPL, category only).

## 4. The downed window
**What you see.** A fall has three stages: knocked down, downed, dead. The downed pose is unmistakable and is the finisher window. Heavy hits lock the target into its own hit-reaction clip for a beat, so weight reads without a number.
**Look test.** Zone 1, one goblin. Does "downed" read on the phone from the follow camera, and do you reach for the finisher without a prompt?
**Cost.** Medium: one new pose state keyed by creature row, finisher trigger already exists.
**IP risk.** Category only: the three-stage fall comes from the leaked SWG source, so shape only. Also DevilutionX, OpenGothic (category).

## 5. The boss with bands and a true form
**What you see.** A boss changes its move list at 70 and 30 percent health and the switch is visible at the edge: palette step, a name-card pulse, a war cry. At zero, once per boss, the bar refills larger with a "true form" caption and the fight goes on.
**Look test.** Zone 2, the pack leader given the band rows. Does the band switch read as "it changed", or as a stat you'd never notice? Does the refill feel like a cheat or a thrill?
**Cost.** Medium for bands, large for a true-form model; the true form can be a palette and size step first.
**IP risk.** Category only: donors AAEmu (treat as GPL), ModernUO (GPL), OpenDAoC (GPL).

## 6. Ambush and the call ring
**What you see.** Something in the grass is not drawn until you hit it. An ambusher appears beside you already swinging, with a half-second warning flash. A creature that calls for help draws a ring and the ring fills with what answers.
**Look test.** Zone 1 walk. Does the half-second flash give you exactly enough to react at 375 wide, or does it feel cheap?
**Cost.** Small: spawn flags and one flash.
**IP risk.** Category only: ModernUO, OpenDAoC, DevilutionX.

## 7. The hunter
**What you see.** After you upset a lair, a thin countdown ring in the corner. At the warning mark a one-in-five chance of a sting. When it runs out, a hunter is behind you. Loud fights pull every nearby group.
**Look test.** Zone 2 walk after a kill. Does the ring make you move, and is the arrival behind you a jolt or an annoyance?
**Cost.** Medium: timer, spawn-behind, one sting.
**IP risk.** Low: Barony is permissive (BSD); CDDA (CC BY-SA, category).

## 8. The nightly storm
**What you see.** One zone line at dusk, the sky eases over two seconds so sunset warns you. Clouds gather over a patch, lightning lands on whatever you are fighting. The storm refuses to end while a fight is on.
**Look test.** Zone 1 at dusk with the flag. Is the lightning on your target a "wow" at phone size, and does the sky warning read before you look up?
**Cost.** Medium: zone-row weather data on the existing light, one lightning effect.
**IP risk.** Category only: OpenDAoC (GPL), SWGEmu client (no licence, shape only).

## 9. The camera that fights with you (zones only)
**What you see.** On a kill, the camera eases into a short low orbit around the victim and returns; any tap skips it. In a fight the frame widens a little per engaged attacker, the shoulder loosens, the field of view opens at three, and the hit shake kicks toward the strongest hitter. The Pit camera stays frozen as ruled.
**Look test.** Zone 1, the 4-wolf pack, then one kill. Does the orbit make you want to kill again? Does the wider frame help you see the third wolf?
**Cost.** Small for the orbit, medium for the duel frame; both are data on the shared follow camera (World's presets A and B are the carrier).
**IP risk.** None: these came from our own camera brainstorm, not a donor.

## 10. The opening
**What you see.** The game opens with a four-second push-in to the ring, a music sting at one second, your first hit lands from a real server event at two and a half, any tap skips. No HUD until the first beat closes, then it fades in over two seconds. After the first kill: a "champion approaches" banner, a ten-second timer, the attack control flashing until your first tap, then two attackers at once. Win, and you walk into the town hall with the bank.
**Look test.** Fresh profile on the phone. Time from tap to first hit. Did you feel the game before you read anything?
**Cost.** Small: scripted sequence on the Pit start screen plus HUD gating.
**IP risk.** Category only for the walk-in (a RuneScape-derived client, restricted). The banner idea from KeeperFX (GPL), HUD gating from Shattered Pixel Dungeon (GPL). All recreated.

---

**Withdrawn:** the asset-audit idea that easy instance folders ship their own spawn files, per the catalogue reading.
**Not here on purpose:** the lair altar meter (needs many kills, not a five-minute test), damage-number colouring, gear glow ladder. In the library for later.
**Ruled for Lead today:** crowd-control ladder counts stuns from any source, one ladder per target, folds into Proof 3.
