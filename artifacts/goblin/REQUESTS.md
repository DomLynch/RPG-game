# Goblin lane → other lanes (2026-09-16)

The brief: "Do not touch camera, combat rules, weapons code or audio. Requests here." Everything below was found while building and proving
the asset (`artifacts/character/BRIEF-goblin.md`); line numbers are trunk `89c91fe` + this branch.

## Combat lane — the goblin's fight identity needs knobs `ai.ts` does not have
Provisional `OPPONENTS.goblin.profiles` use only what exists (reaction, parry 0, dodge, aggression, discipline). What the brief asks for and
where today's code decides otherwise:
1. **Feint rate** — feints happen only against a read parrier (`ai.ts:148`, `READ.feint` 1/6 gated on `reads.parryHappy`). Proposed
   `AiProfile.feint` (base rate per swing; the goblin high, the Veteran 0 = today).
2. **Guard share zero** — the goblin guards today: mode `'guard'` at `ai.ts:95` (`r < .33` inside 1–1.4 m), the bait guard at `:143`
   (`(1 − aggression) × .6`), the `'block'` plan at `:69` (`affordable ? 'block'`), the pressured guard-walk at `:155`, and the parry fallback
   for unblockables when out of roll stamina at `:69`. Receipt: the real-app probe read "Warden guarding · heavy or close-range kick" within
   6 s of the draw (`artifacts/goblin/live-goblin.mjs`). Proposed `AiProfile.guard` share (0 → those branches evade/back-step instead).
3. **Back-step after landing** — only the HURT side retreats (`ai.ts:48`). Proposed: on a `Hit` with `actor === me`, plan `'evade'`
   (backstep) with a `disengage` share.
4. **Circle / back-step preference** — mode selection at `ai.ts:95` (`gap > 1.4 ? 'approach' : gap < 1 ? 'retreat' : r < .33 ? 'guard' : 'circle'`).
   Proposed `AiProfile.circle` share so he rarely stands still.
5. **Fast stamina regen, low poise** — regen is `RULES` (40/s, global); poise 0 already = "anything staggers him". Proposed `Opponent.regen`.
6. **Fairness battery for him** (`tests/opponents.test.ts`) once 1–5 land: the brief's "a player who swings at every feint gets punished; a
   patient player lands counter-hits; the goblin never enters guard; AI-vs-AI 25–45 s". Today's AI-vs-AI at normal: median 18.2 s
   (12.5–23.0) with the sword's data and 100 health — the number to beat, not a target.
7. **Knife timings** — proposed table in BRIEF-goblin.md; every timing is its own baked table (`PathSpec` carries the timing), so the knife
   needs its own `PATHS` + a bake entry, not just faster `MOVES`.

## Camera lane (do not touch — request)
8. Lock camera vs a 1.36 m opponent: at close range on 393×852 he is mostly behind the hero's back — head and ears peek over the shoulder
   (`artifacts/goblin/live-393x852-6s.png`; harness `gameplay-portrait-ready.png` at 390×844 frames him well at 1.2 m). Suggest the lock
   look-at height (and/or pitch) follow the opponent's `scale`, or a small lateral offset when the opponent is shorter than the player.
   The Pitborn (taller) had no such request; the Veteran is hidden less because his head clears the hero's.

## Weapons lane (after trident → cleaver)
9. The short hooked knife: `WeaponId 'knife'` exists as a longsword placeholder. Contract as the cleaver's: `WeaponDrawn` under `hand_r`
   with `extras.contact {from, to}` on the hook, one-handed reversed grip (the sword's transform turned 180° about the hand's axis keeps the
   sword clip family), `material` — `'iron'` is the longsword's already; give the knife its own value if audio must cue it thinner — ≤ 3k
   tris, one 1K set. Build hook: `WARRIOR_FIGHTER=goblin WARRIOR_WEAPON=knife node scripts/build-warrior.mjs`. NOTE the goblin's root scale
   (.835) scales whatever hangs under `hand_r`: author the knife at 1/.835 if it must measure its metres in the world; reach is measured
   from the bake anyway. Bake: `{ weapon: 'knife', glb: 'src/assets/goblin.glb', node: 'WeaponDrawn' }`.

## Audio lane
10. Voice: chittering breath, yelp on hit, cackle after a landed dart, shriek death; light quick footsteps (`Step` events are audio's #1
    request already); thin whoosh for the knife. `Hit/Blocked/Parried` carry `weapon: 'knife'` now (placeholder data) — a hook to cue on.

## Lead
11. Budget: dist 14.63 / 16 MB gzip with four fighters; a fifth will not fit without per-opponent 1K tiles (≈ −1.5 MB each) or a cap decision.
12. The Pitborn's KeenTools scan (`01a0ab5b…`) is git-ignored (only in `~/Developer/frankendom-pitborn`); the hero's, Veteran's and now the
    goblin's are force-added. A fresh clone cannot rebuild `pitborn.glb`'s head — force-add it.
13. `character-preview.mjs` `clips.png` is the player's sheet; the opponent's own is `artifacts/goblin/clip-sheet.mjs` (worth folding into
    the harness as `--enemy-clips`).
