# The Pit: design note v1

Pit lane to Lead, 2026-09-29. The brief is `docs/state/pit.md`. This note covers design only: nothing here is built, and every number labelled measured was read from live revision 303af39e today. All other numbers are budgets for the first PR to meet, not results.

## 1. Room layout (phone first, one room)

```
                 arena sand (sim circle r 8.55, wall r 11.7)
                              |
                  ═══════ ARENA GATE (existing, angle π) ═══════
                              |  ramp down, 4 m, torches both sides
        ┌─────────────────────┴─────────────────────┐
        │ TROPHY WALL (3 plinths)       [recovery    │   room 10 × 7.5 m, ceiling 3.4 m
        │   "Taken from Leonidas, rank 7"  door] ◄───┤   (the defeat entrance, side wall)
        │                                            │
        │            fighter walks here              │
        │                                            │
        │ GEAR RACK (wall, one row per slot)         │
        │   tap = wear, fighter changes on the spot  │
        └──────────── NEXT-FIGHT GATE ───────────────┘   back up to the arena, next opponent
```

- **Placement.** The room sits outside the arena's parapet, below the gate at angle π (the side the hero walks in from), so the arena never has to move. While the Pit is shown the arena group is hidden, not disposed: on the same page the fight comes back to it.
- **Walk-in.** After a WIN the kill screen gets a third button, *Enter the Pit*, beside Rematch and Next, so fast players keep their loop. The player walks to the gate inside the sim circle as they do today. Past r 8.55 a short presentation walk (about 1.5 s, not sim) carries them through the gate and down the ramp, and the camera follows. The fight camera stays locked during combat exactly as now.
- **Defeat.** No Pit button on the loss screen. *Recover* enters through the side door with no gate animation and lands the player at the rack (the next decision after a loss is gear).
- **Pit camera.** A fixed three-quarter pose per zone (rack, trophies, gate), eased between zones as the fighter crosses them. It never orbits freely, so no wall clipping on a 375 px screen.
- **Movement.** The same input intents (`input.ts`) drive a small kinematic mover inside `src/pit/`: x, z and heading, a clamp to the room rectangle, walk and idle clips on the hero rig. The mover never touches `sim.ts` and nothing in the Pit ticks the duel.

## 2. The three interactions (v1, no more)

| Interaction | Reads | Writes | Notes |
|---|---|---|---|
| Gear rack | `profile.loot.owned`, `equipped`, `taken[id].tier` (`loot.ts`) | through a coordinator callback into main.ts's existing wear path (the journal rack's Wear/Worn: persist, then cloud on the profile beat) | Armour changes on the rig at once through `view.wear(ids, tiers)`, which already exists. A **weapon** pick is saved and labelled *carried next fight*, because the rig holds one weapon per page (`main.ts:1011`). No new storage. |
| Trophy display | `loot.taken` provenance: opponent, tier, day | nothing | v1 picks 3 automatically: highest tier first, then most recent. The trophies are clones of pieces already in `loot.glb`, so there is no new GLB. The line reads "Taken from <legend>, rank N" via `ownedName` and legends. A player-chosen set needs a `loot.trophies` field, and `cleanLoot` strips unknown fields today, so that is v1.1 and stays with the loot owner. |
| Next-fight gate | `match.nextRung()` via the coordinator | same as the Next button today | Next already runs `location.reload()` on a new rung (`main.ts:742-748`). Rematch stays on the page. |

## 3. Code shape: sealed module + one coordinator

```
src/pit-coordinator.ts   (in the entry chunk, ≤ 150 lines)
   ├─ owns: the Enter/Recover buttons, the prefetch, loading state, arena↔pit switch
   ├─ the ONLY file with  import('./pit/index.ts')  (dynamic; `import type` allowed)
   └─ hands the Pit a Stage object (below); main.ts calls coordinator.frame(dt) when active
src/pit/                 (its own lazy chunk)
   index.ts   enter(stage, how: 'win'|'defeat') → Pit { frame(dt), leave(), dispose() }
   room.ts    procedural room: geometry, textures (generated like arena/textures.ts), torches
   mover.ts   kinematic walk + zone camera
   rack.ts    DOM rack rows (Web's patterns), trophy plinths
```

**The Stage object** is the whole shared surface, passed in and never imported:

```ts
type Stage = {
  scene: THREE.Scene; camera: THREE.PerspectiveCamera; renderer: THREE.WebGLRenderer;   // borrowed, never disposed by the Pit
  setArenaVisible(on: boolean): void;                  // scene.ts: arena.group + opponent rig + fight effects
  hero: { place(x: number, z: number, heading: number, speed: number, dt: number): void };   // scene.ts drives the player rig's walk/idle
  readMove(): { x: number; z: number };                 // input.ts move intents (the coordinator maps them to Pit-camera space)
  loot(): Loot; wear(id: LootId): void; legendName(opponent: OpponentId, tier?: number): string;
  nextFight(): void; rematch(): void;                   // main.ts's existing handlers
};
```

The **import-boundary test** is `tests/pit-boundary.test.ts`, the same regex approach as `tests/sim-boundary.test.ts`, extended to dynamic imports:
1. Only `src/pit-coordinator.ts` refers to `./pit/`, only via `import()` or `import type`. Every other `src/**` file fails on it.
2. `src/pit/*` imports only `three`, its own siblings, and **type-only** imports from `../loot.ts`, `../roster.ts`, `../grades.ts`. Any value import from outside fails. Everything live comes through `Stage`.
3. The SIM list never imports `pit-coordinator.ts` (the existing sim-boundary test already enforces this, and the new test asserts it again).
4. A self-test that the regex sees `import()`, `import type`, `export … from` and a bare `import`.

The coordinator's two hooks into main.ts (the kill screen buttons and `frame` delegation) and the Stage methods in scene.ts (`setArenaVisible`, `hero.place`) are the only edits outside `src/pit/`. Both files belong to Lead/presentation, so those lines go in their own small PR for Lead's review before any room code lands.

## 4. Lazy load + honest fallback

- **Prefetch:** on the kill (a WIN finish event), the coordinator calls `requestIdleCallback(() => import('./pit/index.ts'))`, with `setTimeout` 1 s where the idle callback is missing (Safari). It only fetches: nothing is built until the player taps.
- **Tap before it is ready:** the button turns into *Opening the gate…* with a spinner, and the player stays on the kill screen where Rematch and Next still work. Building the room is spread over frames (one sub-build per frame, the pattern `arena.ts ready` uses), so no frame ever freezes.
- **Failure** (offline, 404, a chunk from a stale release after a deploy): *The Pit could not open, fight on.* The button retries on the next tap and Sentry gets it tagged `pit`. Nothing is lost, because nothing was written.
- The UI never promises "no loading".

## 5. Handoff and memory (Lead's question: who owns what, what gets disposed)

- **One renderer, one THREE.Scene, one rAF loop.** All three belong to scene.ts/main.ts. The Pit borrows them through Stage and never creates a renderer, a second canvas or a second loop. While the Pit is active, main.ts's `frame` skips the duel step and calls `coordinator.frame(dt)`. The sim is paused, not torn down, so Rematch works from inside the Pit.
- **The Pit owns only what it built**: the `room` group (geometries, materials, generated textures, at most 1 point light plus emissive torches), the trophy clones (which share geometry with `loot.glb` and own only their material clones), and its DOM rows.
- **Build once per page, hide between visits.** `enter()` builds on the first visit only. `leave()` hides the room group, shows the arena and gives the camera back. Nothing is allocated per visit, so repeated Rematch → Pit → Rematch cycles cannot grow memory. A new opponent (Next) reloads the page, which frees everything as today.
- **`dispose()`** frees every geometry, material and texture the Pit made (never the borrowed ones or the shared `loot.glb` geometry) and removes its DOM. It runs on `pagehide`, and when a context loss is followed by a failed restore.
- **Context loss:** room textures are generated `DataTexture`s that keep their pixels, so Three.js re-uploads them on restore. There are no `CanvasTexture`s built from a dropped canvas.
- **Proof:** a browser row (it needs the Mac slot, so it waits) runs Pit enter/leave × 10 on one page and asserts that `renderer.info.memory.geometries`/`textures` and `programs.length` after cycle 10 equal cycle 1, plus a heap delta inside a noise band.

## 6. Budget (stated now, measured in the first code PR)

Measured on live 303af39e: the entry `index-*.js` is 1,457,374 B raw, 440,779 B gzip. The existing lazy chunk `souls-look` (209 source lines) is 23,253 B raw, 6,597 B gzip. `account` is 56,299 B gzip.

| Item | Budget (gzip) | Basis |
|---|---|---|
| Entry-chunk growth (coordinator) | ≤ 2 KB | ~150 lines, no three imports of its own |
| `pit-*.js` chunk | ≤ 40 KB | ~1,000 lines of TS; souls-look density (~32 B gz/line) gives ~32 KB |
| New binary assets (GLB/textures) | 0 B in v1, cap 300 KB if World asks for a prop | room is procedural; trophies reuse `loot.glb` |
| Per-fight download (`check-budget.mjs` PER_FIGHT 12 MB) | unchanged | the Pit loads after the kill, never in the fight's download |
| Draw calls in the Pit | ≤ 60 (arena hidden, so the fight's arena draws drop out) | merged room geometry by material, as `arena.ts` does |
| Lights | +1 point light max, no extra shadow map | torches are emissive + flicker in the shader |
| Phone frame | Pit p95 ≤ the fight's p95 on the same phone | the perf overlay already prints draws/p95 |

`scripts/check-budget.mjs` gets a `PIT` line on the pit chunk, so the gate fails the PR that breaks it.

## 7. What the look test shows (needs Lead's slot + Deploy's /preview/)

- **Flag:** `?look=pit` on the live scene (the look-test skill; `look-flag.ts` gets a `pit` token). It skips the fight: the room is built at page load, the hero stands at the rack wearing his real equipped set, 3 trophy plinths show his real taken pieces, the gate is visible behind him, and the camera is at the rack pose. It has no interaction, no walk and no coordinator; it is a still scene.
- **Dom judges** light and mood (torch-lit stone, not a dungeon crawler's black box), scale (does the fighter read at 375 wide in a room), and whether the rack/trophy/gate triangle reads at a glance.
- **Two stills at 375 wide**: rack pose and gate pose. Then the link, with one line for Dom.
- **The world has to match:** the Pit is lit by the same grade as the arena (`colour-grade.ts`), so it does not look like a different game. World lane advises on this before the test.
- The default path is untouched and no release rows are involved. The flag becomes the real room only through the normal gate.

## 8. Order of PRs after the note

1. The seam: the `pit-coordinator.ts` stub, Stage methods in scene.ts, the boundary test, the budget line. It has no room and does nothing visible without the flag.
2. The look test (`?look=pit`), on Lead's slot.
3. Room + mover + rack + trophies, with stills (visual-PR-stills) and the memory row.
4. Defeat entrance + slow-network run (throttled 3G, the loading indicator is seen, no freeze, no lost take).

Open for Lead: (a) are you OK with Stage methods on scene.ts, or should they live in a presentation file you name; (b) do you agree Recover lands at the rack after a defeat.

## 9. D2: the gate is the way in (spec, 2026-09-30; Dom's live test via Lead; Pit + Combat)

**What Dom saw.** After the finisher and the loot pick the player is parked on a kill screen with buttons. The Pit is a room he walks into, so the way in should be the arena gate, on foot; the button stays as the shortcut. Nothing here is built; numbers marked *measured* come from the code named beside them.

**Default flow after a WIN (career fight only, as the door rule today: `main.ts` updateHud, no replay, spar, stalled or look test).**

1. **The loot pick ends the kill screen's pinned part.** Take / Leave it / Wear as today. The E2 card and the autopsy are untouched.
2. **The camera settles on the gate.** From wherever the arena cam stands (the tour, `camera.ts` TOUR, or the stopped tour), one slow move, never a cut (TOUR's own rule): to a pose behind the player's fighter looking at the arena gate (`arena.ts` LAYOUT.gate = π, gateWidth 3.2 m, wall inner r 11.7 m; *measured*). Blend TOUR.blendIn = 3 s. The tour does not resume after it.
3. **The stick comes back.** The joystick shows and the fighter walks under it with the pre-Fight walk (sheathed gait, the stick turned by the camera's yaw as `sim.ts advance` does: the same formula the Pit's mover copied, `src/pit/mover.ts`). Attack, guard, roll and skill stay hidden: this is not a fight. The fallen opponent, the blood and the drop stay where they are; the fighter walks round them (no collision today; none added).
4. **The way in.** The gate opens the Pit in two ways, both the same `openPit(stage, 'win')` call the button makes:
   - **Walk:** the fighter crosses the gate line: `inGate(angle, r, 0)` (`arena.ts:34`) at r ≥ wall inner − 1.5 m. He keeps walking through a 1 s fade to black and arrives in the Pit at the ramp mouth walking (today's ARRIVE.win, `src/pit/pit.ts`), heading π, at the speed he had.
   - **Tap:** a tap on the gate on screen (a raycast against the gate's bars and arch, the same hit path the E2 tour's stop-on-touch uses: `document`-level pointerdown, then a pick) opens it the same way, with the fighter auto-walking the last metres during the fade so he still arrives walking.
   - **Shortcut:** *Enter the Pit* stays on the kill screen, same slot (Web's cluster −155/98, 134×44). It is the same call with an auto-walk.
5. **Rematch / Next** keep working throughout (they are live during the walk, as they are during the tour). Next's `location.reload()` on a new rung is unchanged (`main.ts:770-774`).
6. **Loading.** The chunk is prefetched at the kill (§4). A walk that reaches the gate before it lands holds at the gate: the fighter stops at the line, the button reads *Opening the gate…*, and the fade starts when the chunk is in. A failed load: *The Pit could not open, fight on.*, the fighter can keep walking, the next crossing tries again (§4's rule, no change).

**DEFEAT.** Unchanged: *Recover* on the loss screen enters by the side door and lands at the rack (Lead's ruling). No walk: the fighter is dead on the sand.

**Draw / stalled.** No gate, no walk; the kill screen as today.

**Who builds what.**

| Piece | Owner | Where |
|---|---|---|
| Post-kill free walk: stick shown, sheathed gait, no fight inputs, bounds = sand circle, the fallen stays | Combat | `main.ts` (input gating after the finish), `sim.ts`/`characters.ts` (the walk on a finished match) |
| Camera settle to the gate pose, tour hand-off, no cut | Combat (camera.ts is theirs) with the Pit's pose numbers | `camera.ts` |
| Gate trigger (line crossing + tap pick), the fade, the arrival-walking hand-off, the hold-at-gate loading state | Pit | `pit-coordinator.ts`, `main.ts` door wiring, `src/pit/pit.ts` ARRIVE |
| Button + label states | Pit (Web's slot, no move) | `main.ts` |

**Tests (fail-first, each in its PR).**
- The walk: after a WIN finish, the move intent moves the player's fighter; attack/guard/roll intents do nothing; he stops at the sand circle (r 8.55, *measured* in §1) except inside the gate arc, where he may go to the wall line.
- The trigger: a crossing at the gate arc opens once (one `openPit` for one crossing, none for a second while the first is pending); a crossing outside the arc does nothing; the op-id rule from #1122 holds (a Rematch during the fade cancels the open).
- The camera: from a tour pose the move to the gate pose is one continuous path (no frame moves the camera further than TOUR's own max per-frame speed).
- Stills at 375: the gate pose after the loot pick (idle, button shown), mid-walk (button hidden), at the gate line with *Opening the gate…*, and the arrival in the Pit.

**Budget.** No new chunk: the trigger and the pick are ~60 lines in the entry chunk; the fade is CSS. The Pit chunk gains an arrival speed parameter only.

**Strategy's rulings (2026-09-30 10:3x, Dom can override).** (a) The loss screen stays *Recover* → rack for the beta; a side-door walk after a defeat is a post-beta idea, not in this spec. (b) The shortcut button HIDES as soon as the stick moves and comes back when the fighter has stood still for 3 s: the walk is the clean path (Dom called the button ugly). Both are part of the build: the hide/return is the Pit's (main.ts door wiring), with a test (a move intent hides it; 3 s of no movement shows it again; a tap on it while shown opens as before).

**ETA (after Lead's go):** Combat's walk + camera PR ~half a day; the Pit's trigger PR ~3 h after it, plus a 10 min box slot for stills.
