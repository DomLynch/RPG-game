# Brief: beta retention hooks — the three that ship (Dom + Strategy, 2026-09-30)

From Dom (owner) via Strategy, after a GPT review of what keeps players for months (rank, mastery, social, collection, variable reward, drip, expression, shareable moments). **Beta scope.** Everything here is built on the Pit, the Duel and the fight record that already exist; nothing touches the fight simulation or the match record before Saturday's first live duel. Gear stats, PvP bands, tournaments and houses stay in `gear-levels-matchmaking.md` (post-beta).

## 1. Legend collection + gear worth chasing (Pit lane, Web for the wall)

- The Pit shows a **wall of the 100 legends**: beaten ones lit, the rest dark, ordered by rank. Tap a dark legend to see name, rank and the piece they drop ("Beat Athena for her shield"). The player can **pin one as the next target**; the pin shows on the Sparring/Fight screen.
- Every legend beaten **drops one named piece** (weapon or armour, from the existing rank looks). It goes on the **rack** in the Pit and the fighter **wears it** in the next fight.
- Beta rule: pieces are **named, visible and worn; no stat power yet.** When the stats brief lands, the same pieces get their numbers. Nothing to migrate.
- Owner: Pit for room + rack + drop, Web for the wall and the pin, Backend for the per-player collection row (which legends, which pieces). Reuse the fight record; no new tables beyond a collection row.

## 2. Friend challenge + personal rivals (Duel lane, after Saturday's duel)

- **Challenge link**: one tap makes a link; the friend opens it on their phone and the duel starts. No account for the friend beyond what Duel already needs.
- **Head-to-head record** between two players (wins, losses, last fight), shown before and after the fight. **Recent opponents** list with a Rematch button.
- Beta rule: gear is worn as looks in duels; power waits for stats. Houses come later, once people return.
- Owner: Duel for the link and the record, Web for the screen. Relay unchanged.

## 3. Useful defeat feedback + quick rematch (Combat for the numbers, Web for the screen)

- After every fight, **one line of honest feedback** from the fight record, chosen by the biggest miss: "Parried four times, never rolled", "Three heavies missed and left you open", "Guard broke twice". One line, not a scorecard.
- **Personal best** against that legend (fewest hits taken, or time), shown on the same card.
- **Fight Again** re-runs the same opponent without a reload. A **Change gear** shortcut opens the rack (looks only in beta).
- Owner: Combat defines the six or so feedback lines and the rule that picks one; Web builds the card; Backend stores the personal best next to the fight record.

## 4. Share the kill (Finishers + Web, small)

- A **Share** button on the finisher/kill camera that exports the last 6 s as a clip or still with the legend's name and rank. Cheapest acquisition hook in the list; the finisher is the moment people show each other.

## Measure (Backend, two counters)

- Did the player press **Fight Again** after a loss (rate per player)?
- Did the player **come back after 7 days** (and 30)?
- Both from the existing fight record; no new events beyond a `rematch` flag. Lead reports the two numbers weekly to Strategy.

## Order

1 and 3 first (they share the post-fight card and the rack), then 4, then 2 after Saturday's duel has run. Each lands as its own PR with fight-camera stills per the visual-PR rule.
