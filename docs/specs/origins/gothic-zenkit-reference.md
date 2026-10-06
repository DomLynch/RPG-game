# Reference: ZenKit file formats (offline research only)

- Spec author: analyst-gothic
- Donor: ZenKit @ `ddf27decd5eeb48ec715e6e66e5f5072c51d88ee`
- Licence: MIT, verified from `license.md` ("The MIT license", "Copyright 2021-2024 GothicKit Contributors"). Vendored dirs `vendor/libsquish` and `vendor/doctest` are empty git submodules in this checkout; check their own licences (libsquish is MIT upstream; doctest is MIT upstream) before any build that pulls them. We do not build it.
- Decision: reference only. Nothing in ZenKit ships in Frankendom. It parses Piranha Bytes' proprietary data formats; we have no Gothic data and must not fetch any.

## What it parses (from `readme.md` table and `include/zenkit/*.hh`)
| Format | Ext | Class | Relevance to us |
|---|---|---|---|
| Virtual file system archive | .VDF | `Vfs` | None (container for retail data). |
| ZenGin archive (object persistence, ASCII/binary/safe-binary) | .ZEN | `ReadArchive` | Background: how a world, vob tree and waynet are serialised. |
| World (mesh + BSP + vob tree + waynet) | .ZEN | `World`, `world/WayNet.hh:16-33`, `world/VobTree.hh`, `world/BspTree.hh` | Research: waypoint graph model (waypoints with name, position, direction, under-water flag; edges) - informs our routine waypoint format. |
| Vobs (camera, light, sound, trigger, zone, movable/interactive) | in .ZEN | `vobs/*.hh` | Research: what properties interactive furniture (mobsi) carries - owner, owner guild, scheme name, state count. |
| Compiled Daedalus script | .DAT | `DaedalusScript`, `DaedalusVm` | Research only: symbol table, bytecode, externals mechanism. We will not run Daedalus. |
| Script class layouts | n/a | `addon/daedalus.hh` (`INpc` :178, `IInfo` :348, `IGuildValues` :22, items, spells, missions, menus, SVM) | USEFUL as a field checklist for our TS data model (NPC record, info record, guild values). Field names only; no data. |
| Save game | .SAV dir | `SaveGame.hh` (`SaveMetadata` :24, log topics :59, info state :66, symbol state :71) | Research: what Gothic persists (told infos, quest log, script globals) - a checklist for our save schema. |
| Cutscene / output-unit library | .CSL/.BIN/.DAT/.LSC | `CutsceneLibrary` | Research: dialogue line ids -> text/voice mapping. |
| Model, hierarchy, mesh, morph mesh, soft-skin, multi-res mesh, animation, model script | .MDL .MDH .MDM .MMB .MRM .MSH .MAN .MDS/.MSB | `Model*`, `MorphMesh`, `MultiResolutionMesh`, `ModelAnimation`, `ModelScript` | None (art pipeline is ours: Blender/TRELLIS). |
| Texture, font | .TEX .FNT | `Texture`, `Font` | None. |
| Material | in meshes | `Material` | None. |

## Which matter for offline research
1. `addon/daedalus.hh` class layouts - field checklist for NPC/info/guild records (already used by the gothic-* specs).
2. `world/WayNet.hh` - waypoint/edge model for routine destinations.
3. `SaveGame.hh` - persistence checklist (told-set, quest log, globals, per-NPC state).
4. `docs/engine/formats/*.md` (animation, archive, bytecode, font, savegame, script_binaries, texture, vdf) - prose docs, safe to read for background.

Everything else: reject for Frankendom (proprietary-asset parsers with no data to feed them).
