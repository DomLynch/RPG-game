# Legends: body_family for the 182 `tbd` rows (Characters & Art, 2026-10-07)

Companion to `legends-600-ladder.csv` (the diff is exactly the 182 rows that said `tbd`; no other row moved). Lead's brief said 145; the trunk CSV at `codex/01a09a76/task-1` has 182 `tbd` rows (137 from the new-candidates list, 44 from the demons/orders/ghosts/witches/fae gap scan, 1 headless-queen note), so all 182 are set.

## Rules (inference, mine; each row is a hand-set call, then a one-shot script applied them)
1. **Use a body we have.** A human, armoured, robed or ghostly legend takes the existing family that matches its silhouette: Romans `legionary`; medieval and Near-East commanders `knight` or `veteran`; women and robed figures `witch` (`shieldmaiden` for a woman who fights, `ching-shih`); fae royals and primordials `nightborn`; ghosts `wraith`; revenants and mummies `skeleton`; small tricksters `goblin`; hulking brutes `pitborn`; pirates `veteran`.
2. **`body_fit`.** `exact` only where the existing body already is the persona (Commodus, William Marshal, the two witch covens); everything else on a human body is `reskin` (tint, scale, kit, dressing, per `docs/specs/origins/body-families.md`).
3. **`new` only for a shape no body has:** `flyer` (siren, harpy, phoenix, griffin, wyvern, the Roc), `giant` (Cyclopes, Titans, Jotnar), `quadruped` (unicorn, qilin, manticore), `serpent` (basilisk, Yamata no Orochi). **14 rows need a new body.** `flyer` and `giant` are families from `body-families.md`, not yet in this CSV's vocabulary; the notes say so.
4. **Non-fighters are flagged, not forced:** `body_family=none`, `body_fit=flag`, reason in `notes`: Moby Dick (a whale), Yggdrasil (a tree), Tartarus (a place), Erebus (primordial darkness), the Colossus of Rhodes (a monument; Talos covers the bronze giant), Winged Victory (a statue). Lead or Dom decide whether any becomes a boss prop instead.
5. **No franchise look.** Rows the risk audit keeps with a design note carry `risk-audit design note applies`; the three trademark or franchise ones say so explicitly: Henry Morgan (no Captain Morgan rum look), Long John Silver (no chain-restaurant branding), Oda Nobunaga (no game-IP look). Thor, Loki, Heracles, Hippolyta, Pazuzu, Imhotep, Paimon, Sun Wukong, Cthulhu, Ragnar and Lagertha were not `tbd`; their rows are untouched and the rule still binds any art for them.

## Counts
| family | rows |
|---|---|
| veteran | 61 |
| witch | 23 |
| knight | 21 |
| legionary | 12 |
| nightborn, wraith | 10 each |
| goblin | 9 |
| pitborn | 7 |
| flyer (new) | 6 |
| none (flagged) | 6 |
| ranger, giant (new), quadruped (new) | 3 each |
| werewolf, serpent (new), skeleton | 2 each |
| shieldmaiden, plaguedoctor | 1 each |
| **total** | **182** |

Veteran is heavy (61): most are historical commanders, where the existing body plus a tint and kit is the intended path (`body-families.md`). If Lead wants a more varied ladder, the cheap lever is more `variant` rows on `knight`/`veteran`, not new bodies.
