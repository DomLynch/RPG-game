# Rank tint: handoff from Character Main to Armour (2026-09-26)

Scope change (Dom via Strategy, relayed by Lead 2026-09-26): the new Armour lane owns wearable-piece fit, materials and rank grading.
This branch (`char/rank-tint`) and its retune pass to Armour. **No PR until Dom rules on the sheet.**

## What the branch does (e6a23dd4, WIP)
The grades.ts rank finishes shown as a tint that keeps the texture maps: metal, trim and leather only, never cloth. A worn piece shows
the rung it was taken at (`Provenance.tier`; absent = Recruit), an opponent's kit the rung he is met at. No sim, record or RV changes.
- `src/rank-tint.ts`: `tinted(material, tier)`, a cached clone per (material, tier) that shares textures. After `color_fragment` the
  albedo keeps its luminance and takes the grade's hue: rgb = mix(rgb, chroma(grade)·L·gain, TINT.strength), gain clamped [.35, 2.5].
  One program for every rung (`customProgramCacheKey` 'rank-tint'). Tunables in `TINT`.
- `src/characters.ts` wear(pieces, failed, tierOf?), `src/scene.ts` (opponent `() => tier`, player `wornTier[id] ?? 'Recruit'`),
  `src/main.ts` wornTiers() and `?perf=1` prints `programs N`, `src/camera.ts` stills-only `?look=foe` (4.4 m in front of the opponent).
- `tests/rank-tint.test.ts` 3/3 (on e6a23dd4).
- Base: World's #705 head f85246b6. Rebase when #705 moves or merges.

## Evidence
- Sheet v1 (e6a23dd4, local preview, 375 at 2x): `~/Developer/rank-tint-frames/sheet/rank-tint-sheet.jpg`; raw stills and receipts
  beside it, no page errors. Hero wearing the Veteran set at tier 1 / tier 10: `sheet/hero-t1`, `sheet/hero-t10`.
- Perf (check 1): Master = Origin = 101 draws / 55 programs; Recruit 99 / 54 (no crest at Recruit). Measured on e6a23dd4.
- Check 3: only the kit tints; body, face and tunic identical on all ten rungs.
- Shoot command (from a frankendom checkout, preview `npx vite build && npx vite preview --port 4707`; it binds IPv6 localhost, so use
  `localhost`, not 127.0.0.1): `QA_URL=http://localhost:4707 AUDIT_REVISION=tint AUDIT_MODE=stills AUDIT_ONLY=veteran
  AUDIT_QUERY="&tier=<Rank>&look=foe" AUDIT_DIR=<dir> node <opponent audit script>`. Ask Deploy for FREE first.

## Flags from sheet v1 (for Dom's ruling)
1. The helmet carries almost the whole ladder. `veteran.Greaves.Bronze` is the SAME mapped Bronze as the helmet and covers both shins,
   so it already tints like the helmet; it reads weakly because it is small, low and shaded at 375 (the gold shin at Origin is it).
   Boots are dark Leather (0.07) and GRADES' leather ladder is ten near-identical dark browns, so they barely move.
2. `grades.ts` maps `Wrap` to leather, so the Veteran's pale linen wrist and ankle wraps tint (mint at Invictus).

## Prepared retune: patches a + b (Lead GO, NOT committed; files beside this note)
- `rank-tint-handoff/a-leather-as-trim.patch` (rank-tint.ts): leather pieces take the rung's TRIM finish instead of the flat leather
  ladder, behind `TINT.leatherAsTrim`, so boots, straps and belt carry the rung.
- `rank-tint-handoff/b-wrap-cloth.patch` (grades.ts + grades.test.ts): `Wrap` becomes 'cloth', so wraps stay as authored.
- They pull against each other on the Veteran's arms: his only Arms item is a Wrap, so with b his arms stop tinting. Lead's call: a + b
  together. Apply with `git apply docs/proposals/rank-tint-handoff/*.patch`.
- Status: see "Sheet v2" below.

## Crest (agreed with the Veteran lane)
The crest is Heraldry, i.e. cloth, and never tints; the rung signal is its presence (none at Recruit, `src/loot.ts:87`). Veteran's new
crest material is named `HorsehairCloth`, which classOf's `<Word>Cloth` regex makes 'cloth' with no CLASS_OF edit. A plume that tints
per rung would be a CLASS_OF 'trim' entry, and that is Dom's call. The hero-crest follow-up is Armour's.

## Sheet v2
Pending: the a + b re-shoot waits for Deploy's FREE after 9b07457d.
