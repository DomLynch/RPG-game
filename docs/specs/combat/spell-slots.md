# The spell list and the two universal special slots (spec, data layer first)

Status: **spec, Combat, 2026-10-15. No code or rows yet.** Lead's order (Dom's priority): spells in the open world end to end, all on the data layer. This note fixes the shape before any sim code, because two slots change the input, the fighter, the record and the HUD, so it is an RV/WSV change and not a rows-only PR. "Two universal special slots" is **Lead's reading of Dom**: any spell can go in either slot, the slots are not tied to a class or school. Strategy to correct if wrong.

## What exists today (read on trunk, 2026-10-15)
- **One cast slot.** A spell is cast through the SKILL slot's special: the press is `Action 'skill'`, legal when `skillCooldown === 0` and stamina >= `spell.cost` (`duel.ts:241`), with the special's own windup 120, recovery 45, cooldown 1200, reach 3 (`RULES.special`, shared, timing sacred). The fighter carries one `spell` (`Fighter.spell`), the record carries one `spell: { id, skill }` (RV53), the open-world input carries `special: true` only when the step carries `cast` (#2778).
- **One equipped spell.** `src/core/spell-equip.ts` keeps the account's owned ids and ONE equipped id (localStorage key `frankendom.spell.equipped.v1`); `pickSpell` (`src/fight/spell-pick.ts`) resolves it with the school skill; the server re-checks the grimoire and the skill ceiling (`origins/server/spell-check.ts`).
- **Spells are catalogue rows.** `spell-index.json`: 700 ids, each `[root, level 1-10]`; nine roots in `brick-defs.json`; cost = root cost + costPerLevel x level, capped at the stamina bar from record v64 (#2785); landing share, outcome bands and the fizzle rules are rows (`cast-rules.json`). A spell is bound to the boss whose kill takes it (programme 2b).
- **The list.** `docs/briefs/spell-list.md` (#2781, accepted as a brief) picks 15 starter spells over levels 1-10 from the existing roots, all reusing the witchfire / miasma / charge fx, no new fx.

## The design

### 1. The spell list as rows
A `spell-list-defs.json` (+ manifest) with one row per starter spell: `{ id, name, level }` where `id` is an existing spell-index id at the brief's (root, level), `name` the display name, nothing else (cost, school and share come from the index + brick rows, never copied). The loader refuses an id that is not in `spell-index.json`, a level that does not match the index, a cost above the stamina bar, and fewer or more than one entry per brief level slot. The picking of the 15 ids (one existing legend id per (root, level)) is Characters' legend call (the legends rule); Combat proposes, Characters confirms.

### 2. The slots as rows
`spell-slot-defs.json` (+ manifest), two tables:
- `slots`: one row per slot `{ id, action }` where `action` is the input verb that casts it (`skill` for slot `a`, a new `skill2` for slot `b`) and `order` is the HUD order. Adding a third slot later is a row plus the HUD, not new code paths.
- `slotRules`: one row each, all numbers: `sharedCooldown` (1 = a cast from either slot starts the same cooldown, 0 = each slot has its own), `firstCast` (the first-cast delay today in `RULES.special.first`), `interruptCooldown`. **Cooldowns and windups stay the special's own rows (`RULES.special`)**: timing is sacred, no per-spell or per-slot timing in v1.
- **Costs** are the spell's (brick cost + costPerLevel x level, capped at the bar): no slot cost row, no second number.

### 3. The sim (the RV/WSV part)
- `Fighter.spell` becomes `Fighter.spells: readonly [Spell | undefined, Spell | undefined]` (slot order from the rows); `legal(skill2)` mirrors `legal(skill)` per slot with the shared or separate cooldown per `slotRules`. The cast path (`castOutcome`, `outcomeMult`, the seeded draw) is unchanged and keyed by slot, so every existing seeded stream is the same stream (the draw index is the cast count, not the slot).
- **Record:** `spell` becomes `spells: [{id, skill}?, {id, skill}?]`; a record below the bump keeps the one-spell field and replays through slot `a` exactly as today (era-gated like `cast-penalty-era.ts` / `costCapFrom`). RV bump, REACH empty for old opponents (no profile moves), the one-spell fixtures must replay identically (the A/B hash proof, as in sim batch C).
- **Open world:** the world step carries `cast: 'a' | 'b'` instead of `cast: true` (WSV bump); `stepHero` feeds `special: true` / `skill2` by slot.
- **Server:** the verifier re-checks BOTH slots against the grimoire and the stored skill ceiling; two slots may hold the same spell (rule row `allowDuplicate`, default 0: a spell can be in only one slot).

### 4. The equip and the HUD read the rows
- `spell-equip.ts` stores `{ a, b }` (a new storage key; the old key reads into slot `a`); `pickSpell` runs per slot; both come from the owned grimoire.
- The HUD builds its buttons from `spell-slot-defs.json` (how many, which action, which order) and shows each slot's spell name, cost (from the spell row) and cooldown (from the special rows), so changing a slot rule needs no HUD code. Web owns the screen; Combat provides the rows and a read function (`slotsOf(fighter)`).

## Build order (PRs, each data-layer clean: `check:as-data --gate` new = 0, touched files' baselined sites cleared, counts in the body)
1. **Rows PR (no behaviour):** `spell-list-defs.json`, `spell-slot-defs.json` + loaders + tests; nothing reads them yet.
2. **Sim PR (RV + WSV):** `Fighter.spells`, `skill2`, the record's `spells` with the era gate, the world `cast` slot, server verifier. Seeded A/B proof that a one-spell fight hashes identically before and after.
3. **Core + Web PR:** `spell-equip.ts` two slots, `pickSpell` per slot, the HUD from the slot rows (Web).
Each lands behind the existing flags until Strategy picks the day.

## Open questions (defaults in brackets)
1. **Shared or separate cooldown?** [shared: one big special cooldown, two choices, the least new balance; separate doubles the spell output and needs the AI-vs-AI gate again]
2. **Second input on touch/keyboard:** a second button next to the skill button, or a swipe/hold on the first? [a second button, Web decides the layout]
3. **Duplicates** in both slots? [no: `allowDuplicate` 0]
4. **Does an empty slot fall back** to the class special / skill, or does the press do nothing? [nothing: an empty slot is inert, the class special keeps its own button]
5. **Who owns the 15 ids**: Characters (legend call) with Combat's loader checks. [yes]
6. **PvP/duels:** do both slots work in a duel, or only the open world first? [both the open world and sparring first, the ladder later (Strategy)]

Donor: EverQuest / EQEmu (hotbar slots and a global spell recovery), AzerothCore (the global cooldown as a rule, `spell_dbc` cost and cast rows), World of Claudecraft's spell bar where the repo has it; shape only, not read this turn (to be read before the sim PR per `reuse-first`).
