# Test Zone sandbox pictures and checks

Headless-browser scripts used to prove the Test Zone's visuals and rules, so a porter can reproduce them without asking. Every script takes the page URL; use the live preview
`https://frankendom.com/preview/zone-look/?zone=90&region=1` or a local dev server (`.claude/launch.json` "test-zone-hot", port 5190, build flag `VITE_UNLISTED_ZONES=1`).

- Run from the repo root, with playwright resolvable (`PW_ROOT=/path/with/node_modules/playwright` if it is not in this checkout). They launch chromium with `--use-angle=metal` (Mac GPU); change the flag elsewhere.
- They read the page's browser-check hooks: `originsPreview.fell(id)`, `.hurt(n)`, `.regenQuiet()`, `.heroFist()`, `.mobScreen(id)`, `.tapMob(id)`, `.combat()`, `.mobs()` (with `grips`, `handMesh`, `meshesOf`, `fit`). These exist only on the sandbox branch.
- URL flags used: `&fit=0` (the engine's retarget only, for a before/after), `&regen=45|60|90`, `&fight=goblin` (isolate one goblin), `&view=first`.
- Heavy runs go to the Mac GPU (browser/WebGL rows), tests go to the VPS: see docs/sandbox/porting-notes.md.

| Script | What it proves |
|---|---|
| `gear-shots.mjs` | walks the hero up to each creature with a loadout and makes a contact sheet |
| `crop-shots.mjs` | a 3x crop around each creature of that body, from <distanceM> away |
| `troll-before-after.mjs` | ready crop + mid-fight screen for one troll; run with &fit=0 for the "before" |
| `before-after-sheet.mjs` | builds fit-sheet.png from fit-before-*.png / fit-after-*.png |
| `kit-check.mjs` | every creature with a loadout: built or CAPSULE, plus the warnings |
| `loot-check.mjs` | fell three ranks via originsPreview.fell, walk onto the drops, print the outfit, reload, count console errors |
| `regen-check.mjs` | hurt 80, stand still, health every 5 s |
| `regen-hunted-check.mjs` | control (quiet heals) then a goblin hunting him (quiet timer stays 0, health never rises) |
| `drop-look.mjs` | fell one creature, list which drop models are drawn, still of the drops |
| `claw-check.mjs` | per-bone skin counts and claw/hand-bone distances for a goblin and a troll (reads mobs().handMesh) |
| `grip-check.mjs` | where each creature's weapon sits against its hand bone (reads mobs().grips) |
| `meshes-check.mjs` | every mesh drawn under a goblin and a troll (reads mobs().meshesOf) |

Usage lines are at the top of each file.
