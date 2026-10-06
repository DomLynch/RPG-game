# Patron perks in the duel sim (Combat lane): PROVISIONAL, costed 2026-10-06

Approved as a design by Lead and Strategy (Dom via Strategy). **No `src/` work starts until fatigue (#1483) and the 50 levels (#1470/#1475) are live.** Expansion owns the patron data and the choice UI; Combat owns the hook below. The patron choice ships at graduation (the first Origins step).

## Rules
1. A patron perk is a small sidegrade: **≤ 30‰ (3%) on each side of the trade, and every perk pairs a gain with a matching loss**, so net power is about zero. Perks are built from the vetted templates below, shown to both fighters, with a **no-patron baseline** (patron 0 = today's fight).
2. **Perks never touch tick counts, reach, move timing or any AI input.** Hard rule. Foes carry no patron: the ladder and its AI never see one. Duels and PvP are symmetric by patron id.
3. No-patron fights stay **byte-identical** (proofs below). The record version is the **lowest that can express the fight**: 27 with no patron, 28 only with one.

## Hook
`Fighter.perk`: an immutable record of per-mille integers, set once at duel start from the patron id (the same pattern as the per-fighter knobs `guardProfile`, `regen`, `speed` that `createFighter` already takes). Absent = today's code path, taken with `perk ? scaled : plain` (never `x * 1`, so no float drift). Fixed-point arithmetic, so a replay on any engine agrees.

| # | Template | Where it bites | ±3% fit |
|---|---|---|---|
| 1 | Vitality | max health | 100 → 103 / 97 (integer) |
| 2 | Wind | stamina regen (existing per-fighter multiplier) | yes |
| 3 | Thrift | attack stamina cost (one `spend` site) | yes |
| 4 | Guard | block / guard-break stamina cost (`guardProfile.costScale`) | yes |
| 5 | Poise | posture damage taken | yes |
| 6 | Edge | damage dealt | **OUT** until damage rounding is measured; if it needs a float, Edge stays out |
| 7 | Stride | walk / sprint pace (`speed`), moves no timing | yes |

**Do not fit** (and so are not templates): reach (AI spacing reads the move tables; 3% of 1.4 m is also under his hysteresis), parry / perfect-block windows (10 and 3 ticks: 3% is a third of a tick), any move timing, stun / stagger lengths, chain and buffer windows.

A patron is up to two templates with signed weights in per-mille, e.g. Wind +20‰ / Thrift −10‰ is not allowed to exceed 30‰ in either direction; Expansion's data names each patron as such a pair.

## Record, verifier, PvP
- **Header:** one byte after the arena byte (RV26 added the arena byte and RV21 the specials flag the same way). `decodeRecord` yields `meta.patron` (0 for every v ≤ 27 record, so all readable versions keep replaying exactly). `READABLE_VERSIONS` gains 28 and keeps 27; `REACH[28] = []`.
- **Writer:** `RECORD_VERSION = 28` is the writer ceiling, but `packRecord` writes 27 when `patron = 0` and 28 only with a patron. Today's links stay byte-identical and old clients keep working; only a patron fight is a v28 link that an old build refuses.
- **Verifier:** `scripts/verify-daily.mjs` imports `decodeRecord` and `deploy.sh` rsyncs `src/**/*.ts` to the verifier host, so it gets `meta.patron` for free and builds the Fighter perk from the id.
- **Table version:** the patron table is versioned with the record (the id alone is not enough if the table changes); a record names the table version it was minted under.
- **PvP / rollback:** perks live as scalars on `Fighter`, so `net/rollback hashDuel` covers them; both clients load the same table by id from the handshake or the match is refused.

## Release order (part of the spec)
1. The verifier host carries the v28 decoder in a release **before** any client can write v28.
2. Then the build that can mint a patron link. Never the other way round.

## Proof that no-patron fights are unchanged
1. The #1402 fingerprint fixture: **0 changed cells** with patron 0; a second NEW fixture pins patron cells.
2. `packRecord` with no patron equals the v27 golden bytes (`tests/record.test.ts` corpus + a stored golden set).
3. Differential: `stepDuel` with `perk = undefined` against the pre-change build, `hashDuel` equal over the whole replay corpus and the ladder battery (10 strategies × 10 rungs × 24 seeds).
4. `SIM_DIGEST` re-pinned **with** the version bump, deliberately; `tests/ladder-tail` digest (L1–46 bodies and profiles) untouched. Any cell that moves is a finding, not a re-pin.
5. **Guard behaviour for a v27 writer under ceiling 28 (new pattern).** `tests/record-version-guard.test.ts` reads only the ceiling `RECORD_VERSION`, never the byte `packRecord` emits. With `RECORD_VERSION = 28` it asserts: ceiling >= `PINNED_FOR_VERSION`; the sim digest equals `SIM_DIGEST` when the ceiling equals the pin (otherwise the ceiling must be higher); every bump in `READABLE_VERSIONS[0]+1 .. 28` declares a `REACH` entry (`REACH[28] = []`); and 28 is in `READABLE_VERSIONS`, with 27 kept. It does not assert that a no-patron record is v27. That is pinned by proof 2 (the stored v27 golden bytes in `tests/record.test.ts`) and by the fingerprint fixture's 0 changed cells, so the guard and those two together describe the pattern.

## Balance gate
Every template is measured on the battery before it ships; the ladder anchors (Goblin median, `KNOWN_FLAT` bands) must stay inside their bands with the **worst-case** template. A perk applies to a player's fight against a foe, never to the foe.

## Size and risk
~250–350 LOC in the sim (`Fighter.perk`, 5–6 scaled sites in `duel.ts`, header byte + decode in `record.ts`, the table type) and ~150 LOC of tests; about 2 days with the VPS full run, plus Expansion's data/UI and Web's "shown to both fighters" text. Risk **medium**: `duel.ts` hot paths (one conditional each, covered by the differential), balance on the anchors, verifier-before-client ordering, PvP table agreement.
