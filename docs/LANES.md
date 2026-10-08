# Frankendom lanes — reorganised 2026-10-03 (Dom + Strategy)

Twenty-two lanes became eight, then nine (Expansion was added and removed again on 2026-10-08, see below). Split **by system, not by character**: one owner per kind of work, for all ten characters, so no two lanes edit the same files. **At most 2–3 specialists run at once**, picked by the week's goal; the rest stay parked.

| Lane (session title) | Owns | Folded in (read their `docs/state/<file>.md` first when you wake) |
|---|---|---|
| **Lead** | Queue, READY calls, briefs, the weekly goal; world design docs (quests, towns, bounties, economy rules, mobs.md, one-shard.md) and the #1758 plan document. Coordination and docs only, no building (Dom, 2026-10-08) | — |
| **Deploy** | The only one who runs `scripts/deploy.sh`, VPS ops, relay | — |
| **Strategy (advisor)** | Dom's occasional strategic input only; no lane orders | — |
| **Auditor** | PR review (`PASS @ <sha>`), receipts | code-quality |
| **Characters & Art** | Every character's model, armour, looks, hero look, weapon meshes, the FLUX/TRELLIS/Blender pipeline; creature and NPC art (Dom, 2026-10-08) | character, armour, herolook, multichar, pitborn, executioner, goblin, nightborn, veteran-polish, weapons (meshes) |
| **Combat & Specials** | Every move, special (R1–10), finisher, gore logic, stats/balance, the sim; hostile creature fighting: the hostile flag, up to 7 attackers, N-vs-1 (Dom, 2026-10-08) | combat, finishers, stats, weapons (class specials), and the specials parts of the character lanes |
| **World, Pit & Audio** | Arenas, the Pit room, lighting, VFX look, crowd, all sound; the open-world client: zones, scenery, towns, creatures on screen, the Zone 1 preview, the in-place world fight, the client half of the one-world plan (Dom, 2026-10-08) | world, pit, audio |
| **Web & UI** | Menus, win screen, share row, loot UI, site pages | web |
| **Duels & Backend** | Duel netcode, relay, Supabase, accounts, rewards, migrations; the server-run world (zone and spawn rules), saving, the economy gates (Dom, 2026-10-08) | duel, backend, career |

Archived (2026-10-03, reopenable from the Archived list): Armour, Audio, Duel, Executioner, Finishers & Gore, Goblin, Hero Look, Multi Chars, Nightborn, Pitborn, Stats, The Pit, Veteran, Weapons. Their handoffs are in `docs/state/*.md` and summarised in `docs/HANDOVER-GPT-lanes.md`.

**Expansion lane removed (Dom, 2026-10-08 07:3x).** Its work moved to the lanes above; the handover is `docs/handover/expansion-lane.md` (PR #1765) and the item-by-item owners are in `docs/TOP10.md`.

## Rules learned (Sept–Oct 2026)

1. **Done = live and tried on Dom's phone.** Not "PR open", not "CI green".
2. **One weekly goal judged by players.** Nothing outside it ships that week.
3. **One owner per system, one code module per system.** Six character lanes each building specials six ways cost two days of merging (the specials base fell 483 commits behind trunk).
4. **Expertise lives in the lane's state doc, not the agent.** Every handoff updates Now / Done / Open / Gotchas; a woken lane reads it first.
5. **Token budget per task.** Not live by the budget → stop and report why; never loop.
6. **Desktop pauses peer messages after 10 sends without Dom typing.** Hold; never side-channel via GitHub comments.
7. **Visual PRs:** full-res stills at 375 **and desktop** for end screens; judge from full-res frames, never scaled contact sheets.
8. **Night Pit look:** quiet beats pale, but quiet ≠ invisible (a special must read at 375 in ≥ 2 frames).
9. **Before any release:** confirm the build checkout matches live (`release.json`).
10. **Kill switch for duels:** `DUEL_RELAY_PLAYERS` in `/etc/frankendom/duel-relay.env` on the VPS (unset + restart the unit = admins only).
