# Body quality sheet: the 15 bodies on trunk (Characters & Art, 2026-10-07)

Lead's ask (via Strategy, before any older body is reused for the 600+ legend roster): one contact sheet at the 375 fight camera, idle and mid-swing, same lighting, with tris, texture size, rig, a KEEP / REWORK / REBUILD verdict and the fix and size for every body. Stills: branch `stills/char-body-quality` (`<body>-ready.png`, `<body>-attack.png`, `contact-sheet-ready.png`, `contact-sheet-attack.png`).

## How this was made (and what it is not)
- Stills: `scripts/character-preview.mjs --enemy /src/assets/<body>.glb` gameplay-portrait ready and attack (390x844 lock camera, the game's lighting), warrior as the player, trunk `88264c17`, one capture job on the VPS. **It is the bare body**: the game's gear and kit (shields, weapons by rank, rank looks) are not applied, so a body that looks plain here may be dressed in play.
- Numbers: `scripts/world-body-check.mjs` read on the VPS from the shipped GLB: triangles over every mesh, file size, image count, **decoded texture MB** (w x h x 4, no mips; the figure that matters on a phone) and joints. All 15 are on the same 65-joint hero-family rig.
- Verdicts are my reading of the stills at 375, not Dom's eye. Say which you want moved.

## Table
| body | tris | file MB | textures | decoded MB | rig | look | verdict | fix and size |
|---|---|---|---|---|---|---|---|---|
| warrior (hero) | 63,572 | 6.44 | 34 | 93.3 | hero 65 | reads as a bare-chested fighter | KEEP look; REWORK cost | texture atlas pass for the phone tier (small) |
| veteran | 58,220 | 8.44 | 17 | 68.0 | hero 65 | gold helm, but sits low and is half hidden behind the player at the lock | KEEP | none for the look; atlas pass (small) |
| knight | 45,913 | 6.64 | 8 | 45.5 | hero 65 | strongest read: full plate, tall, clear silhouette | KEEP | none |
| goblin | 62,361 | 6.15 | 34 | 93.3 | hero 65 | small, reads; tiny at 375 | KEEP | atlas pass (small): done as the world body in #1716 for the world view only |
| nightborn | 60,785 | 7.25 | 34 | 93.3 | hero 65 | pale face, dark coat, red crown; reads | KEEP | atlas pass (small) |
| witch | 48,168 | 7.03 | 2 | 32.0 | hero 65 | hood and cloak mass hide the legs and face; reads as a robed figure | KEEP | none |
| dwarf | 45,787 | 7.80 | 9 | 45.8 | hero 65 | short, helm and beard, half hidden behind the player at the lock | KEEP | none |
| pitborn | 57,082 | 5.77 | 34 | 66.3 | hero 65 | green brute, reads as an orc | KEEP | atlas pass (small) |
| executioner | 45,471 | 6.69 | 6 | 39.0 | hero 65 | large, dark, hooded, long blade; strong | KEEP | none |
| plaguedoctor | 50,970 | 5.67 | 5 | 35.0 | hero 65 | beak mask and long coat; clear | KEEP | none |
| shieldmaiden | 44,456 | 6.04 | 31 | 90.3 | hero 65 | plain dark clothes, no shield in the bare body; generic | KEEP, check in play | atlas pass (small); gear comes from the shield and loot PRs |
| minotaur | 45,396 | 8.12 | 2 | 32.0 | hero 65 | horned bull, big maul; strong | KEEP | none |
| wraith | 46,246 | 7.40 | 2 | 32.0 | hero 65 | tall grey strands and a scythe; **head and scythe tip are cut off at the top of the lock frame, ready and attack** | REWORK | framing: scale or lock-camera fit for the tall body (small) |
| skeleton | 45,619 | 7.77 | 9 | 54.0 | hero 65 | small and pale; reads but thin at 375 | KEEP | none |
| werewolf | 45,555 | 5.95 | 2 | 32.0 | hero 65 | strong silhouette | KEEP | none |

**Legionary (best variant) and Ranger from history: not rated.** The Legionary hero-look rig (`public/herolook/legionary.glb` at `36db0b063`, 6.0 MB) did not parse with the plain loader (it needs MeshoptDecoder), so I have no numbers or still for it, and the sand-legionary branch (`herolook/sand-legionary`) has only reference images and prompts. For Ranger I found only `src/assets/source/items/ranger.glb` (a loot item, 847 KB), no rigged body in history. Both need Dom or Lead to name the variant before I can measure them.

## What this says
1. **No REBUILD.** Every body reads at 375; none needs a full hero-set redo to be reused.
2. **One REWORK on the look:** the wraith's framing.
3. **A cost REWORK across six bodies:** warrior, goblin and nightborn decode to 93 MB of textures, shieldmaiden 90, veteran 68, pitborn 66. The world-body batch (#1716) shows the cure: one atlas takes it to 4 MB. For the duel the number to aim at is a call for Lead (phone-tier atlas at 2048 would be about 16 MB); I have not built or measured it.
4. Veteran and dwarf are partly hidden behind the player in the idle lock: that is the lock camera and the bodies' size, not a body defect.
