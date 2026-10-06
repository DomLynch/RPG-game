# Lead Dev (Expansion): starting brief (Strategy, 2026-10-06, on Dom's order)

**Role.** You own Frankendom: Origins, the world beyond the Pit: `origins-blueprint-2026-10-06.md` with Dom's rulings 1–7 at the top. The arena Lead owns the beta and every release. You prepare Origins so it can be built fast the day the beta passes.

**Before the beta (now):** blueprint packages O0–O2 only. That is paper and prototypes; nothing ships.
1. **O0 Baseline.**
   - Pin the current Frankendom commit and the donor repos: World of ClaudeCraft @f46f30f (MIT, ~1M LOC, the parts bin), ModernUO, EQEmu, OpenMW, OpenGothic/ZenKit, inkjs.
   - Write the donor manifest. For each candidate record: source, commit, files, behaviour, dependencies, licence, decision (reuse / adapt / reimplement / reference / reject), destination and tests.
   - Donor game data may be decoded offline for research (ruling 5). Shipped content is our own.
2. **O1 Shared contracts.** Versioned TypeScript schemas for Character, Faction, Quest, Region, Encounter, Item definition, Item instance and Loot table. Also the ONE progression (ruling 7):
   - Pit wins and world kills feed one career, one rank and one stat set.
   - A boss kill counts like an arena win. Mobs give much less, diminishing on repeats and when far below your level.
   - Everything is server-verified.
   - Borrow levelling ideas from EverQuest, Ultima Online, WoW, Morrowind and Gothic II. Write the formulas as a proposal for Strategy and Dom.
3. **O2 Extraction proofs.** Three small units, each compiling without its donor, with tests:
   - inventory transfer: ClaudeCraft extraction vs a native implementation, same contract;
   - quest journal: five stages with branches;
   - staged boss event.
4. **Shared-world server pick** (ruling 6): a lean Node server on ClaudeCraft's hardening patterns, or Colyseus. One page with your recommendation to Strategy.

**Fixed decisions (do not re-argue):**
- The gate opens at Gladiator (rank 3); Champion and Origin open deeper realms.
- The Exchange, region 1 and chapter 1 are free. Membership starts at region 2 ($9.99/mo starting price, adjustable).
- Content: anything except figures central to a major living religion.
- Enoch belongs to Armagedom.
- Add ghosts from real fight records and creator-minted cosmetics.

**Walls:**
- `expansion/*` branches only. No changes to shipping src/ until the arena Lead agrees.
- No release slots before beta.
- Heavy jobs go to the VPS.
- Use your own sub-agents, not arena lanes.
- Report weekly to Strategy, plus a one-line note to the arena Lead when you need shared code.

**Done for this phase:** O0 manifest, O1 schemas plus the progression proposal, three O2 proofs with tests, and the server pick, all on PRs, docs merged.
