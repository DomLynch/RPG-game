# Brief: realistic blood in the Pit

**Owner:** World, Pit & Audio. **From:** Lead, on Dom's ask (2026-10-04 15:5x: "delegate to the world, pit and audio dev ... give them the proper brief").
**Branch to start from:** `lead/pit-look` @85e6ffb5. **Preview Dom uses:** https://frankendom.com/preview/pit-glow/?look=pit-glow (opens straight into the walkable room, no fight).
**Dom's words:** "take some time please". Quality over speed.

## 1. Why

The Pit was relit today to match Dom's painted reference (`03-reference-painted-cell.jpg`), and he has approved most of it. The last thing he flagged is the wall blood. Lead drew it procedurally, and Dom rejected it:

> "blood looks fake, uniform and like copy paste, sticker ... place them at different places location (not copy-paste sticker graffiti along the bottom like you did) ... design it like real blood, and make it realistic"

`01-dom-verdict-fake-blood.jpg` is his phone screenshot of the problem. Every splat has the same blobby shape, they all sit in one band at chest height along every wall, and they read as flat stickers.

## 2. The target

`02-reference-gpt-combat-blood.png` shows GPT's painted combat blood strips: `public/game/img/blood/{dragged-streak,soft-bleed,wet-smear}.webp` (192×1536 RGBA, used by `src/blood-edge.ts` on the screen edge when the player is hit). Dom: "remember what gpt did for our side combat blood? it looked real". That is the bar. The strips work because they have:

- **Irregular, directional shapes.** A spray has a direction, satellite droplets, thin tails and a thick heart.
- **Variation in density.** Opaque cores fade to translucent stains, with a darker rim where blood dried at the edge.
- **Drips that obey gravity.** Each drip has a varying length and a bead at the end.
- **No two marks alike.**

## 3. What to build

Replace the procedural blood in `addGrime()` in `src/pit/glow.ts` (the splats / smear / drips block inside `grimeTexture`) with **painted blood decals placed as events**:

1. **Source art.** Use GPT's strips as decals, cropped into separate marks. Also make a small set of new painted wall-blood decals in the same style: a spray arc, a hand or arm drag smear, a high splash with runs, a dried pool edge at the wall foot. Use the same FLUX/GPT workflow GPT used for the strips. Keep the RGBA webp small; check the texture budget.
2. **Placement: a few distinct events, not a band.** Suggested set (adjust to what reads in the stills):
   - **Left wall by the rack:** a spray arc where a blow landed, angled, at about 1.2–1.8 m.
   - **Right wall by the bed:** one hand-drag smear, low, about 0.4–0.9 m, running sideways.
   - **Far wall, one side of the gate only:** one high splash with drips running down 30–60 cm.
   - **One wall foot:** a dark dried pool edge where the wall meets the sand, which ties into the floor stains.
   - **Nothing on the back wall** (behind the camera most of the time), or one faint old stain at most.
   - **No decal repeated in view.** Vary scale and rotation per event.
3. **Look.** Old and dried: dark brown-red, never fresh bright red. Lit by the room, so use a `MeshStandardMaterial` with `transparent` and `roughness ~1`. It must not glow. A slightly darker, more saturated core with a lighter dried halo is fine.
4. **Keep the rest of the grime.** The damp at the foot, fbm dirt, water runs and torch soot stay. Dom liked the dirty direction, just not the blood.
5. **Floor.** The sand floor stains (`addBloodStains`, the arenas' blood patch, Blood Sand seed 43) are approved. Leave them alone unless your wall pool needs to meet one.

## 4. Approved, do not change

These are all behind the `pit-glow` flag, in `src/pit/glow.ts` and `room.ts`/`pit.ts` with `G`:

- **Warm relight:** stone `#d9a86e`, sand `#f2c58a`, warm hemisphere bounce, warm fog `#8a5a30` at 0.035, key ×2.2.
- **Gate:**
  - The arch is tinted to the wall tone (`GLOW.arch`); its brightness is now 1.1× the walls (Dom: "about 20% brighter than the walls").
  - The gate light sits back in the passage and the fill light is mid-room. Do NOT put a light near the gate wall: it gilds the stone and Dom calls it "heaven".
  - Daylight arena `#f0dab2` behind the bars; Dom wants daytime out there.
- **Room:**
  - No rug and no wall banner.
  - No hint box in open floor (quiet sheet); it shows at the rack, trophies and gate only.
  - 72° portrait lens (Dom: zoom out about 20%).

## 5. How to work (skill look-test)

1. Branch off `lead/pit-look` and stay flag-only. Never change the default Pit path.
2. Shoot phone stills at **390×694** (Dom's framing, not 375×812) with a walk around the room: the rack, the bed, the gate, both side walls. Read them at FULL resolution; a contact sheet hides detail.
3. Ask Deploy for `/preview/pit-glow/` from your sha (no release rows, no lock).
4. Open it on frankendom.com yourself before telling Dom; Deploy only curls.
5. Send Dom the same single link and a short clip or stills. Plain English, one line on what to look for.

**Gotchas:**
- A `//` comment pasted mid-line has swallowed code twice in this branch, including an array comma today. Put comments on their own line.
- When Dom gives a number ("20% brighter"), measure it from the screenshot, don't eyeball it.
- Dom judges on his phone, and his browser can show a cached older build. If he describes something already fixed, ask him to reopen the tab.

## 6. Done when

- Dom looks at the wall blood on the preview and says it reads real.
- tsc is clean and the targeted test gate passes (`node scripts/quality-stop-targeted.mjs`).
- Your head sha is sent to Lead. Lead folds the approved pit-glow look into one PR for the real Pit (normal gate, visual-pr-stills).

## Images

| File | What it is |
|---|---|
| `01-dom-verdict-fake-blood.jpg` | Dom's phone screenshot of the rejected blood (85e6ffb5) |
| `02-reference-gpt-combat-blood.png` | GPT's three combat blood strips on a sand background: the target quality |
| `03-reference-painted-cell.jpg` | Dom's chosen painted Pit reference (the whole look) |
| `04-current-walk-85e6ffb5.jpg` | Walk-around stills of the current preview |
