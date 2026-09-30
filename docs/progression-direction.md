# Skill first, builds at Origin

Owner decision, 2026-09-19: **Season 1 is Recruit → Origin. Build the core game first; defer the RPG endgame.** GAME_SPEC.md records this scope. The future mechanics below are design proposals, not shipped systems or settled balance. Preserve the current enhanced combat. No combat constants, inventory, purchases or progression awards change in this documentation/material cleanup.

## Product direction

Recruit → Origin teaches spacing, attack selection, guard/parry, dodge, stamina and posture without rank-based stat bonuses. The existing ten-title career ladder remains, with I–V on the first nine titles and a singular Origin. Saved identity and visible achievements carry attachment during the climb. Origin is the Season 1 endpoint; a later release may introduce full build allocation there. Career rank remains separate from competitive rating.

At Origin, five readable stats use 100 as a normalized baseline: STR, DEX, VIG, END and POISE. The proposed extra allocation is 50 points, concentrated or spread. Weapons supply recognizable fighting styles; armour exchanges protection for mobility/stamina costs. Grounded fighters face fantasy opponents whose size, reach and behaviour create readable tactical problems. Keep today's combat depth and restrained effects.

## Decisions before implementation

| Topic | Owner's proposal | Lead recommendation / unresolved trade-off |
| --- | --- | --- |
| Point acquisition | Eventually earn 50 additional points after Origin | Grant the full allocation at unlock or normalize competitive matches to an equal budget. Earned points otherwise create grind-based power. Separate early and Origin rule sets explicitly. |
| DEX | Faster attack recovery and stamina regeneration | Keep weapon recovery fixed so learned punish windows survive. Use stamina efficiency for DEX and keep regeneration with END unless the owner explicitly changes the existing stat contract. |
| Health scale | VIG 130 = 130 HP | Current player health is 150. Treat 100 as a normalized baseline: VIG 130 would mean 195 HP at the current base. Do not silently rebalance health to 100. |
| Speed and reach | Determined by physical weapon animations | Author a matched weapon/clip/contact package offline. Simulation data remains authoritative; animation never decides live timing or damage. |
| Armour | Light +10 RES; medium +25 RES / −5 DEX / −5 END; heavy +50 RES / −15 DEX / −15 END | Provisional numbers, not balance commitments. If RES 150 means 1.5× effective durability, use damage divided by 1.5; 50% damage reduction instead doubles durability. Validate STR/VIG/RES stacking and explain rounding. Armour does not add POISE under this proposal. |
| Rarity | Small damage differences among variants | Conflicts with current sidegrade/no-rarity-multiplier defaults. Start with cosmetic rarity or budgeted trade-offs; never silently make rare gear strictly better. |
| RPG unlock | Full builds only at Origin | The current ladder takes about 205 wins. Test whether appearance collection and weapon choices provide enough identity before this late unlock. |

## Inventory and monetization — later design only

The proposal is equipped weapon/armour plus one free locker slot, capped near five; discarded items are lost. It suggests permanent slots around $5, bundles around $10, respecs around $3–5 and an Arena Pass around $5/month, alongside cosmetic identities and executions. These are recorded ideas, not approved prices or implementation scope.

Define whether a slot stores an item or a complete loadout before designing persistence. Irreversible discard needs an explicit recovery/confirmation policy. Paid storage and respecs buy tactical flexibility, so do not describe them as advantage-free. Keep a viable free way to experiment and adapt; combat power and competitive eligibility must not depend on purchases. Monetization stays deferred until combat and retention are validated.

## Season 1 integration outline — design contracts, not new runtime modules

| Boundary | Existing foundation | Next implementation contract |
| --- | --- | --- |
| Fighter identity | `src/profile.ts`: device-local ID/name | Persistent guest credential and optional recovery. Explicit import of local saves; do not treat a browser ID as proof of ownership. |
| Career | Optional `profile.career.victoryMarks` | Server-owned marks, with rank derived by a pure ladder function. Do not save an independently mutable rank that can disagree with marks. |
| Encounters | `profile.encounter`, `src/roster.ts`, `src/ladder.ts` | Opponent selection stays separate from career rank. Existing recipes identify approved body/archetype/weapon packages. |
| Fight result | Pure duel events and finish state | Versioned result record: unique fight ID, fighter ID, season ID, rules/content version, encounter recipe, seed, outcome and verification source. Enforce one accepted result per fight; mark award and record insertion are atomic. |
| Presentation | Current HUD/journal | Show rank, next milestone and save status from career data. Replay/rematch cannot award twice. No fictitious career numbers while persistence is absent. |
| Future builds | No runtime implementation | Later add a versioned loadout referencing stable item IDs and an approved stat allocation. Resolve it once into validated fight configuration; never read inventory or persistence inside simulation ticks. |

Use a stable `season-1` identifier on new result records. Keep lifetime identity/history separate from season attribution;
do not infer a future wipe or reset policy. Unknown future loadout fields must not erase existing identity or career during
migration. A rules/content version preserves what a past result meant after balance updates.

Season 1 release checks: rank boundaries (3 marks per sub-rank in the first two tiers, then 5, Origin at 205 total wins),
no loss demotion, terminal Origin handling, duplicate/retried submissions, offline failure, reload/recovery, legacy save
migration and authorization isolation. Practice results must be labelled by their trust source; client-reported wins cannot
populate a verified competitive record merely because the server stored them. Decide the award policy before building it.

The API/schema and migration tests come with the actual persistence implementation. No unused interfaces, empty folders,
feature flags or placeholder services are needed now. This outline makes the integration points clear; it does not promise
the later game systems will be zero-effort plug-ins.

## Integration sequence and owners

1. Lead completes Season 1 quality and persistence work. Revisit the future-build decisions above after real playtests; do not settle monetization or stat balance now.
2. Lead owns recoverable guest identity, versioned fight records, idempotent result storage and career marks. Client-reported practice wins remain distinguishable from server-verified competitive results. Do not build speculative inventory/payment tables now.
3. Combat developer owns stat formulas, baseline/replay invariants and build-balance tests after approval. Equipment cannot bypass the shared combat rules.
4. Weapons developer owns approved reach, timings, stamina costs, clips and baked contact paths. Character developer owns appearance/armour assets; armour gameplay modifiers belong to shared data, not mesh names.
5. Validate one complete progression loop before adding inventory or monetization. Physical phone and external uncoached-player gates remain required.

No separate RPG engine, per-opponent combat forks, runtime asset assembly or new framework is required.
