# Armagedom: alpha and Steam readiness audit (Strategy, 2026-10-26 ~20:00 Dubai, main aef03f83)

Read-only code audit by two agents on a checkout of main; the hosted database was not queried and nothing was loaded on a phone. Facts carry file paths; Lead verifies the two blockers on the hosted config and a real phone before the alpha line to Dom.

## Verdict
- **Alpha with friends: yes, after one fix.** The server currently clamps every online player's money to zero. Progress is phone-decided and unverified, which is fine for a friends-and-family alpha and must be said to testers.
- **Steam: no, not as it stands.** The web game is more portable than expected (keyboard and mouse exist, resizes, plays offline), but there is no desktop packaging, no Steamworks, phone-resolution art on every device, and the licence record for shipped assets is incomplete. Three to five weeks of focused work after alpha if Dom wants it.

## Alpha: blockers
1. **The server wipes earned money.** `arma_cash_ceiling` (`supabase/migrations/20261024000008_arma_server_cash.sql:73-82`) caps carried + bank at `start_cash_total` (0) + `arma_cash.earned`. `earned` only rises through `arma_spawn_hit`'s kill settle, and the shipped client never calls it (`Web/src` has no `spawn_engage`; `sendHit` in `presence-client.js:250` is never invoked). A new character's first save is cut to 0 and the phone adopts it (`save-client.js:31`, `browser-session.js:405`); the local E2E receipt reads "stored carried/bank = 0/0". The DB tests switch `enforce_cash` off, so nothing tests the real path. **Fix for alpha:** `arma_config.enforce_cash = false` on the hosted DB with a drift-allow entry, until engage + hit settle are wired in the client.
2. **The phone decides almost everything.** All creature and boss AI, HP, damage, kills and loot run locally; the shared-HP path (`arma_spawn_engage` -> presence `hit` -> `arma_spawn_hit_batch`) is built and clamped but nothing calls it. `arma_check_record` (000007) enforces a closed key set and caps but accepts proficiency 100, attributes 20, ammo 9999, fuel 10000 as sent; weapons and boss gear marked owned without a server receipt are stored and only counted (000010). No kill or XP ledger the server trusts. **For alpha:** say so to testers (friends only); no fix now.

## Alpha: should fix
- **No backup or restore of the hosted DB anywhere in the repo** (`ops/`, `supabase/`, `docs/`); `supabase/down/*` drops `arma_runs`. Confirm the Supabase plan's backup setting and record it.
- **A refused refresh token creates a new guest** (`guest-auth.js:122-133`) and orphans the server-side character; the old session is copied to `.previous` and never restored. Safari may clear site data after days of no visits. Testers should Sign in with Google.
- **Error reporting is thin.** The client-log beacon is created only after the world-status check (`browser-session.js:388`), so boot failures and offline errors are never sent; reports go only to the writer's console log; rows carry kind/code/area/release, no session or device id. No Sentry or alerting.
- **No analytics at all:** no sessions, deaths, kills, time in area or tutorial funnel. Presence counters are in memory only (`server/presence/server.js:58`).

## Alpha: fine
- RLS on every table, all access revoked from public/anon/authenticated; every write through SECURITY DEFINER functions on the writer/presence roles with `arma_allowed` and `arma_owns` checks; no delete route; a client can only overwrite its own run; `arma_record_event` refuses kill/loot kinds.
- Rate limits per account on every route (`server/data/rate-limits.json`), auth check cached 60 s with 503-not-401 on auth outages, 5 characters per account, client-log limited per IP, presence closes sockets over rate.
- Saves: one function, one transaction, per-character sequence (retries are no-ops), revision guard, era and shape checks, 256 KB body cap; local save is one complete record, corrupt saves block until Retry/Reset.
- Player-facing failure: boot-failure card, 60 s load stall with Retry, offline play continues on local saves and queues server saves.
- Onboarding: Westminster 6-waypoint tutorial path, three first-time hints, knife at start, south exit always open.
- Content: 9 areas, 7 bosses, 7 creature kinds, 13 weapons, 33 shared spawns; a plausible 30-minute first session.
- Tests: 503 unit test files, pglite DB tests, 8-shard CI gate plus server, release-builder, layout and drift tests; tier-label audit gate. Phone acceptance is manual by design.
- Size: `Web/public` 139 MB on disk but phones load the `backdrop-phone.webp` files (Westminster 328 KB) and the phone models; `assets/lossless` (49 MB) is not loaded by the game. First-visit bytes are not measured in the repo (`Web/scripts/load-bytes.mjs` exists and was not run).

## Steam: what exists and what is missing
- **Exists:** keyboard and mouse (`Web/src/input.js`: WASD, Shift, Q heavy, E special, Space dodge, F guard, G pick up, C cycle, mouse slash/stab); window resize with a 1.5 pixel-ratio cap; landscape and portrait layouts on a 1672x941 painted backdrop (about 16:9); offline play with `?world=0`.
- **Missing:** gamepad, pointer lock, fullscreen; any desktop shell (no Electron, Tauri, Steamworks, app id, achievements, cloud saves); the API base is `location.origin`, so a shell needs a configurable server address; desktop-resolution art (every device loads the phone backdrop and the 256-512 px phone models; 2048 px sources exist in `assets/lossless` and the hi-res GLBs); a credits and licence file.
- **Licensing facts:** audio CC0 per sound (`Web/public/audio/manifest.json`); flamethrower CC0; world textures Poly Haven CC0; donor characters: "Generated head/material/knife service license receipts not fully traced" (`Web/public/assets/donor/manifest.json:106`), donor game named only by commit hash; Flare sources in `art/vendor/flare/` are CC-BY-SA 3.0 / GPL v3 and `art/hero/README.md:62` says enemy sources remain (whether any shipped GLB derives from them is not established); TRELLIS.2-generated bosses and armour have no licence file; painted backdrops have no source record. The scope docs (`briefs/THREEJS-MIGRATION.md:46`, `AGENTS.md`) rule Steam packaging out.
- **Rough cost if wanted:** desktop shell + configurable API + fullscreen/pointer lock + signing, 3-5 days; Steamworks bridge, overlay, achievements, cloud saves, Steam-to-Supabase identity, 1-2 weeks; gamepad 2-3 days; desktop-quality art, days to weeks; provenance and credits file, 1-3 days.

## Strategy's order after alpha
1. Wire the shared-HP path the client already has (engage + hit settle) so money and kills become server-trusted; that also closes the cash clamp properly.
2. Boot-time error beacon with a session id, and one analytics table (session start, death, kill, area enter, tutorial step) written through the existing writer.
3. Hosted DB backup recorded in `ops/`.
4. Only then a Steam decision, starting with the licence record.
