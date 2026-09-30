# Roster integration contract

Owner-approved 2026-09-19. Start with the five shipped fighters; preserve combat while separating content from rules.

## Ownership

- Lead: `src/roster.ts`, encounter selection, guest migration, shared browser gate, spec, integration/release.
- Combat: `moves.ts` archetype profiles and weapon-independent AI; submit balance/replay evidence for changes.
- Weapons: approved weapon/rig/clip/contact packages; shelved packages stay explicitly marked until their validation passes.
- Characters: named appearances and reusable offline presets; body/equipment fitting and phone readability.
- World and finishers: existing ownership; no additional work required for this foundation.

## Add an individual

1. Agree a stable ID, name, existing archetype and approved body/weapon pairing with lead.
2. Character lane supplies its approved GLB/preset. `body` names that shipped asset/preset; appearance variants get their own asset name.
   Existing offline material palettes live in `scripts/warrior-appearance.mjs`; extend that data instead of adding fighter-name material branches. Geometry and authored texture work remain in the character pipeline.
3. Add one catalogue recipe. Do not add an opponent-name branch to `duel.ts` or `ai.ts`.
4. Validate grips, gait, attack silhouettes and visible-versus-simulated blade contact. Sharing bone names alone is insufficient.
5. Run the unchanged combat battery, rig/contact tests, per-fight budget and both browser gates. Only hero + selected opponent may be fetched.
6. Lead integrates the reviewed PR from current trunk and verifies the public affected route before release close-out.

`archetype` currently groups compatible body scale, health, guard and fighting profiles. It is deliberately constrained; do not freely mix a Goblin body with a giant's scale. Split further only when the first approved reuse requires it. The builder's default comes from the recipe's weapon; a `placeholder` weapon deliberately builds the shipped longsword until the weapons lane activates its real package.

## Sequence

First ship these foundations. Then approve two contrasting named fighters using existing combat archetypes, review them on phones, and expand to six. Fifty is a content goal, not permission for fifty combat engines. Introductory encounter order stays unchanged in this release; a seeded no-repeat selector belongs with the expanded catalogue.

## Career and persistence

`profile.encounter` selects the next opponent. Legacy `profile.ladder` migrates into it without changing guest ID/name or inventing wins. Saves also write the legacy alias so rolling back a release preserves encounter selection. Optional `career.victoryMarks` is independent and is only a schema boundary here: this release does not award marks, display a career rank, create Supabase resources or claim recoverable identity.

Backend design must handle guest recovery, explicit local-save import, versioned fight IDs/recipes/seeds, idempotent result submission and authorization. Client-reported practice results cannot become server-verified competitive results merely by storing them. Never derive career rank from the encounter array.

The owner's skill-first / Origin-build proposal and its unresolved balance decisions are recorded in `docs/progression-direction.md`. It does not override current combat or authorize paid storage.

## Known gates

The physical iPhone/Pixel five-minute test and external uncoached-player gate remain open. Existing finisher/contact defects are owned by their lanes and cannot be closed by this catalogue refactor. Unit/CI success is not hardware or player acceptance.

Production builds emit identical retained textures once under content-hashed `assets/textures/` paths. GLBs reference these relative URLs; deploy the complete `dist` directory. Source GLBs remain self-contained. The independent compression gate reads shared image bytes and verifies the same pixels and metadata. JPEG entropy packing requires `jpegtran` (macOS: `brew install jpeg-turbo`; Linux: `apt install libjpeg-turbo-progs`).
