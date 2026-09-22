# Shield — asset spec (multi-chars lane)

Owner: multi-chars. Consumers: the **Veteran** archetype (7/7 from Legionary on), the **Shieldmaiden**, whose round shield is always-on,
and the **Centurion**, who takes a gladius and a scutum from the Legionary (Strategy with Dom's word, 00:15 — the trident stays a starter
weapon with no wielder, and opponent grips are 5/5). Combat owns the fight rules; the loader owns equip and stow. This file is the asset.

## Beta ships ONE shape: the small round (Dom, 2026-09-22, superseding the three below)
One mesh, materials doing all ten ranks. The reasons it is the right one of the three, rather than a compromise:
- It is the **gladiator-correct** shape — a small round shield is what this game's fighters would carry.
- It is the **Shieldmaiden's identity shape**, so one asset serves both named consumers instead of one serving each.
- It is the smallest on screen and the cheapest on a phone, and the off-hand is the slot a player sees least.

What is given up: at Origin a small round in gold reads *modest* rather than imposing — the material has to carry the whole rank. That is
acceptable, and it is reversible: **adding the kite and the tower later is additive, not a re-author**, because the tier→shape mapping is
data and the material ladder is unchanged. The three-shape plan below stays here as the agreed shape of the expansion, not as dead text.

## Three shapes, ten ranks — the expansion, not the beta
The shield gets fancier with rank. Shape does the coarse work, material does the per-rank work:

| shape | ranks | the look |
|---|---|---|
| **Small round** | Recruit → Gladiator | boards and hide, iron rim, plain boss |
| **Kite** | Veteran → Primus | the middle of the ladder, and the **base mesh** everything else is cut from |
| **Tower** | Invictus, Origin | full-height, gold or blackened |

**Why three and not ten.** Every other slot on the grade ladder is a *material* variant on one shared mesh — that is what keeps ten ranks
× ten archetypes affordable, and it is what makes a lighter tier physically unable to undress the wearer. A shape change is the one thing
the ladder was designed not to pay for, so it is spent deliberately and only three times. Ten ranks still read as ten shields, because the
material ladder runs inside each shape: a wooden round with an iron rim at Recruit, bronze boss at Champion, a blackened kite at Primus,
gold or black tower at Origin.

When the expansion lands, the base is authored as the **kite** — the middle case. **For beta the base is the small round**, and the kite and tower are cut from it later.

## The one thing that makes shields unlike every other slot — a decision for Combat, not for art
Everywhere else on the ladder a higher tier is pure vanity and the fight is unchanged. A shield's **shape is read as coverage**: a tower
that visibly covers more of the body will be expected to cover more in the fight. So either

- **(i) shape is cosmetic** and all three guard identically — consistent with the rest of the ladder, slightly odd at the extremes; or
- **(ii) shape carries a real `GuardProfile`** and the shield ladder becomes the one place where rank changes the fight.

**Recommendation: (i) for beta.** (ii) needs Combat's balance work, and the shield does not block at all yet — its rules are queued behind
the four wieldable weapons. Taking (i) now costs nothing later: moving from (i) to (ii) is a data change on three shapes, not a re-author.

**Deferred to Season 2 with damage, defence and stats (Dom, 2026-09-22)** — and that is the right place for it, because the shape question
*is* the stats question: extra shapes only earn their cost once defence is a number, and before that a tower that guards like a buckler is
a promise the fight does not keep.

**The one thing that is not free to defer, and is therefore settled now:** the tier→shape mapping stays **data**, not geometry baked per
rank. Adding the kite and the tower in Season 2 is then a table edit plus two meshes, never a re-author of what beta ships.

**And one trap to carry into that design rather than discover in it:** the moment defence becomes a stat, the grade ladder stops being
cosmetic *everywhere*, not only on shields — every tier becomes a power ladder unless "what it looks like" and "what it does" are
deliberately kept as separate fields. Note also that loot is documented today as **visual cosmetics only, no stats**; shields with defence
is the change that breaks that sentence, so Season 2 should expect to rewrite it on purpose rather than quietly.

## The Shieldmaiden
Lead's ruling, taken as given: **one asset — a material variant and a size, not a second mesh.** Her brief has no owner yet, so nobody can
contradict it tonight. If her round shape turns out to need a structurally different mesh rather than a scaled variant of the small round,
that gets raised **before** authoring as a scope item, not absorbed.

## Two transforms, and the back
The shield is worn in the paperdoll **off-hand** and **stowed flat on the back while a two-hander is held**, coming up the moment a
one-hand weapon is equipped. So it is authored with **two transforms** — in the off-hand, and flat on the back — plus a **back attachment
point on the player rig**.

**The equip/stow decision is the loader's, not the asset's**: it picks off-hand versus back by reading Weapons' `grip` field — **ONE-HAND
knife, cleaver, estoc; TWO-HAND trident, warhammer, scythe, hero sword.** The asset ships so either side can drive it.

**The trident is TWO-hand, and this list is a spec rather than prose.** An earlier wording of it ("trident-as-spear") put the trident in
the one-hand column, and `src/moves.ts` on trunk currently carries `TRIDENT ... grip: 'one-hand'` (verified at `becec83`; PR #472
corrects it). Because the loader reads `grip` to decide where the shield sits, a wrong entry here is a **wrong transform**, not a wrong
sentence — a one-hand trident would raise a shield straight through the haft.

Worth recording as the check that settles it independently of anyone's memory: the trident is `guard: 'shaft'` with a `guardProfile`,
exactly like the scythe, warhammer, maul and reaper — **and every other shaft-guard weapon in the file is `two-hand`.** The trident was
the lone exception, which is the shape of a typo rather than a design.

**Shipping shape:** loot-only, like the gloves — the stow transform travels as data on the piece rather than as a second draw, so nothing
renders twice before the loader's grip wiring lands, and no fight GLB is rebuilt.

## Rules it inherits
- A shared piece, so it is exported **once** under the shared-draw schema and every wearer resolves to it through the file's own map.
- `over` in the off-hand: it hides no draw of the player's, so the coverage rule is satisfied by construction.
- Tiers repaint metal, trim and leather; cloth is the house dye.
