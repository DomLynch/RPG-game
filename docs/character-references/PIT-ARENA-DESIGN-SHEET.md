# Pit arena and leaderboard stone: design sheet (Characters, 2026-10-08)

For Dom. Source of the requirement: `docs/TOP10.md` "Remove the Pit holding cell" (Dom APPROVED 2026-10-08): the Pit becomes a **physical arena building in the town**, entered through its door or gate, with a **leaderboard stone next to it**. The models are done and READY in the town building kit (#1825, `public/world/town/buildings.glb` + `buildings.json`); this sheet shows them and says what each part is for. World places them, Web hangs the rankings on the stone, Backend supplies the data.

## The three pieces (Blender renders, flat light, not game-camera stills)

| Piece | Node | Size (m, w x d x h) | Tris | What it is |
|---|---|---|---|---|
| Pit arena | `pit_arena_a` | 12.1 x 12.5 x 5.4 | 528 | A twelve-sided stone drum open to the sky: low wall ring, three window bays, sand floor stepped down inside. Reads as a small colosseum from the road. |
| Pit gate | `pit_gate_a` | 3.3 x 1.0 x 4.5 | 156 | Stone arch with a barred gate and a brass plaque. The walk-up entrance: the gate flourish (the one-second sound) belongs here. Two red banner poles flank it. |
| Leaderboard stone | `leaderboard_stone_a` | 1.9 x 3.1 x 1.4 base | 174 | A tall stone on a stepped plinth with a brass title plate and **ten dark rows**: `anchor_row_01..10` are empty children, one per row, for Web's ranking text (kills, PvP, ladder). |

Total 858 tris for all three (the whole kit is 28 pieces / 2,907 tris / 31,681 B gzip).

## Stills

- Aerial: https://github.com/DomLynch/RPG-game/blob/21dd340a42eb272abed7190403ef5c2dca475ba8/pit-arena-v1-aerial-blender.png?raw=true
- Front: https://github.com/DomLynch/RPG-game/blob/21dd340a42eb272abed7190403ef5c2dca475ba8/pit-arena-v1-front-blender.png?raw=true
- Stone, close: https://github.com/DomLynch/RPG-game/blob/21dd340a42eb272abed7190403ef5c2dca475ba8/leaderboard-stone-v1-blender.png?raw=true

## How it answers the four points

1. **Physical building you walk up to:** the drum is walk-around scale (a hero is 1.84 m, the wall ring about 3 m, open top 5.4 m); the gate arch is the door. No interior room: the old holding cell is deleted, fights happen as they do now.
2. **Menu entry as well:** nothing in the model; Web's.
3. **Stone next to it:** placed beside the gate at the road side (the render shows it 3 m off the right pillar); ten rows, one title plate.
4. **Rules (no entry in combat, no trade or logout in a duel):** Backend / World logic, not geometry.

## What is not done (honest list)

- **No game-camera still yet:** the Blender renders use flat grey-brown light. A still at the fight camera at 375 wide needs World to place the building in the live Zone 1 path (Dom's ruling: not behind a flag).
- **Flat colour:** like the rest of the kit it is faceted flat colour (stone, brass, red cloth); texture and wear are a follow-up PR, not a gate.
- **One variant:** no second arena shape, no banner variants, no night lamps. The gate has no door leaf animation.
- **Anchors are placeholders until Web draws on them:** the dark rows are geometry only.
