# The sheet in the world: one contract for PR 2 / PR 3 / PR 4 (Combat, 2026-10-13)

Branch `combat/world-hero` carries PR 2 (the hero through the Pit's builders). PR 3 (World, per-bout seed) and PR 4 (Backend, record carries the sheet) build against THIS file. WORLD_SIM_VERSION order: #2529 = 8, World's goblin-camp stopgap #2553 = 9, the threat margin = 10, the series = 11 onward (each sim PR takes the next number and carries its own fingerprint receipt on its own head).

## PR 2: the builder (src/fight/world.ts, src/fight/open-fight.ts)
- `Fighter` (world) gains `weapon?: WeaponId` and `sheet?: Sheet` (hero only; `Sheet` = sheet-rows.ts, dial/skill id -> effective value).
- `player(id, x, z, facing, gear: Loadout, level, skill, build?: { weapon?: WeaponId; sheet?: Sheet }): Fighter`. With a sheet: `attack = res = 1` (the sheet carries Attack and armour; no double count) and `maxHealth = health` come from the Pit's own `withSheet`.
- open-fight.ts exports `heroSheeted(f: Fighter): PitFighter` = `createFighter(body(f), 'ready', f.weapon ?? DEFAULT_WEAPON)` then `withSheet({ tick: 0, fighters: [hero, hero], finish: null, events: [] }, [f.sheet, undefined]).fighters[0]`. No Pit file changes (the Pit fingerprint cannot move; the receipt proves it).
- world-combat's `hero()` dep gains `weapon?: WeaponId` and `sheet?: Sheet`.
- directionalGuard: the world uses the Pit's RULES unchanged (Dom 2026-10-13: the guard thumbs exist in the open world); OPEN_RULES' override is deleted and the world input passes the guard direction the way the Pit's does. Parity row "closed".

## The record (src/fight/world-record.ts), shape every PR writes to
```ts
export type RecordHero = { level: number; attack: number; res: number; weapon: WeaponId; health: number; stamina: number; posture: number; exhausted: boolean; sheet?: Sheet };   // PR 4 adds `sheet?`; PR 5 removes attack/res
export type JoinEvent = { s: number; id: string; kind: string; x: number; z: number; level: number; seed: number };   // PR 3 adds `seed`
```
- **`seed`** (the per-bout seed, PR 3): a **u32** integer, one per `JoinEvent` (the bout that creature's join opens), in `WorldRecord.joins[i].seed`. In the packed header it is 4 bytes little-endian written right after the join's `level` byte. Minted by the zone client as `hash32(engageToken, joinTick)` where `joinTick` = the world clock tick of the join (`Math.round(world.time * 60)`); the server re-derives it from the kill's own engage token and the join's tick and refuses a record whose seed differs (nothing the client sent is trusted). The sim reads it only through the Pit's own doors: `duel.roll = { seed, hits: 0 }` (duel.ts `withRoll`) and, with a spell, `duel.cast = { seed ^ 0x5bd1e995, n: 0 }` (`withSpell`'s formula). The hash lives in a new `src/fight/bout-seed.ts` (pure integer, outside the Pit sim files).
- **`sheet`** (PR 4): header field, count then (rowIndex u8, value u8) pairs in sheet-defs row order; absent = count 0. The server compares it to `expectedSheet` from the HELD worn set and the stored build exactly as the Pit sweeps do (the claim must EQUAL the expectation); `decodeWorldRecord`'s `h.health <= RULES.health` bound widens to the sheet-sized maximum.
- The hero's `weapon` is honoured by the sim (PR 2) and must be a PLAYER_WEAPON; the server bounds it by the held main-hand weapon (origins/server/world-verify.ts, as heroOf does for level and gear).
