# Versions registry

A version stamp is a number or string that names the version of a data format, record, wire protocol, schema or simulation era, and is bumped when that format changes.
Surveyed on trunk `codex/01a09a76/task-1` on 2026-10-15 and spot-checked.
Line numbers drift: re-check with the recount commands below before relying on one.

## Recount

```bash
B=origin/codex/01a09a76/task-1
# registered (40): the as-data allow-list entries marked "format/era version stamp"
git grep -hIoE '"file": "[^"]+", "name": "[^"]+", "kind": "exempt", "reason": "format/era version stamp' $B -- scripts/as-data | sed -E 's/"kind.*//' | sort -u | wc -l
# unregistered candidates: version/protocol constants
git grep -nIE "const [A-Za-z_0-9]*(_VERSION|PROTOCOL)[A-Za-z0-9_]* *(:[^=]+)?= *[0-9'\"]" $B -- src origins scripts ':!*.test.*' ':!*.json'
# unregistered candidates: version literals
git grep -nIE "version: *[0-9]+[,} ]|schemaVersion: *1\b|storyVersion" $B -- src origins ':!*.test.*' ':!*.json'
# localStorage keys ending .vN (19 strings; 2 are the presence protocols, so 17 storage keys)
git grep -ohIE "['\"\`](frankendom|origins-preview|origins)[.a-zA-Z_-]*\.v[0-9]+[a-z-]*['\"\`]" $B -- src origins ':!*.test.*' | sort -u | wc -l
# contract constants (16)
git grep -hE "^export const [A-Z_]+_VERSION = 1" $B -- src/core/contracts | wc -l
```

Totals: 68 distinct = 40 registered in the as-data allow-list + 28 not registered. This table enumerates all of them.

## Table

| # | Stamp | Value | Defined (file:line) | Read / checked (file:line) | Registered? | Bumping it means |
|---|---|---|---|---|---|---|
| 1 | `fight/RECORD_VERSION` | **68 FINAL** (live since release GO 1a479e630, #2825) | src/fight/record.ts:25 | src/fight/record.ts:295 (decode accept), :275 (pack); src/net/pvp.ts:198 (peer must match) | yes | Fight record layout/sim changed; old links stay readable via READABLE_VERSIONS or are refused |
| 2 | `fight/READABLE_VERSIONS` | list from 18 | src/fight/record.ts:96 | unsure (exact check line not located) | no | Adds or drops a record version that decode still accepts |
| 3 | `fight/FIRST_DETMATH` | 20 | src/fight/detmath.ts:103 | src/fight/detmath.ts:111 | no | Moves the era boundary: records at or above this version use the new rule; changing it changes how old links replay |
| 4 | `fight/FIRST_SCALED` | 23 | src/fight/play-radius.ts:10 | n/a | yes | Moves the era boundary: records at or above this version use the new rule; changing it changes how old links replay |
| 5 | `fight/FIRST_LATE_NOTICE` | 24 | src/fight/play-radius.ts:27 | src/fight/match.ts:214 | yes | Moves the era boundary: records at or above this version use the new rule; changing it changes how old links replay |
| 6 | `fight/FIRST_STAB_VERSION` | 25 | src/fight/stab-rule.ts:5 | src/fight/match.ts:38 | yes | Moves the era boundary: records at or above this version use the new rule; changing it changes how old links replay |
| 7 | `fight/STAB_VERSION` | 25 | src/fight/record.ts:175 | src/fight/record.ts:295 | yes | The last version without the arena byte; nothing writes it, kept so a fixture can pin the old layout |
| 8 | `fight/FIRST_ARENA` | 26 | src/fight/record.ts:188 | n/a | yes | Moves the era boundary: records at or above this version use the new rule; changing it changes how old links replay |
| 9 | `fight/FIRST_FIFTY` | 27 | src/core/career-ladder.ts:15 | src/awards.ts:8 | yes | Moves the era boundary: records at or above this version use the new rule; changing it changes how old links replay |
| 10 | `fight/FIRST_PATRON` | 32 | src/fight/record.ts:101 | n/a | yes | Moves the era boundary: records at or above this version use the new rule; changing it changes how old links replay |
| 11 | `fight/FIRST_GAMBIT` | 33 | src/fight/record.ts:103 | n/a | yes | Moves the era boundary: records at or above this version use the new rule; changing it changes how old links replay |
| 12 | `fight/FIRST_STANCE` | 34 | src/fight/record.ts:104 | n/a | yes | Moves the era boundary: records at or above this version use the new rule; changing it changes how old links replay |
| 13 | `fight/FIRST_POSE` | 38 | src/fight/record.ts:105 | origins/server/encounter-pose.ts:18 | yes | Moves the era boundary: records at or above this version use the new rule; changing it changes how old links replay |
| 14 | `fight/FIRST_GROUP` | 39 | src/fight/record.ts:106 | n/a | yes | Moves the era boundary: records at or above this version use the new rule; changing it changes how old links replay |
| 15 | `fight/FIRST_SHEET` | 48 | src/fight/record.ts:107 | n/a | yes | Moves the era boundary: records at or above this version use the new rule; changing it changes how old links replay |
| 16 | `fight/FIRST_STANCE_ROWS` | 52 | src/fight/stance-era.ts:5 | src/fight/match.ts:39 | yes | Moves the era boundary: records at or above this version use the new rule; changing it changes how old links replay |
| 17 | `fight/FIRST_SPELL` | 53 | src/fight/record.ts:102 | n/a | yes | Moves the era boundary: records at or above this version use the new rule; changing it changes how old links replay |
| 18 | `fight/FIRST_POISE_LADDER` | 54 | src/fight/poise-era.ts:4 | src/fight/match.ts:40 | yes | Moves the era boundary: records at or above this version use the new rule; changing it changes how old links replay |
| 19 | `fight/FIRST_CONE` | 55 | src/fight/cone-era.ts:4 | src/fight/match.ts:41 | yes | Moves the era boundary: records at or above this version use the new rule; changing it changes how old links replay |
| 20 | `world-sim/WORLD_SIM_VERSION` | **44 FINAL** (live since release GO 1a479e630, #2825) | src/fight/world-record.ts:17 | written src/fight/world-record.ts:68; refused if different :154 | yes | World simulation changed; world records from another version are refused |
| 21 | `kit/KIT_LOGIC_VERSION` | 2 | src/core/world/kit-version.ts:11 | src/core/world/kit-version.ts:27 (feeds kitTag) | yes | Kit logic changed; changes the kit tag so mismatched peers and encounters are rejected |
| 22 | `kit/kitTag (kitBuild)` | computed hash of kit tables + KIT_LOGIC_VERSION | src/core/world/kit-version.ts:24-31 | origins/server/encounter-verify.ts:43; src/net/pvp.ts:275 (hello `kit`) | no | Never hand-bumped; changes whenever kit tables or KIT_LOGIC_VERSION change |
| 23 | `net/SYNC_VERSION` | 1 | src/net/pvp.ts:91 | src/net/pvp.ts:199/:208 (refuses match); sent :229/:275 | yes | Wire sync protocol changed; peers on another value refuse the match |
| 24 | `net/PROTOCOL (presence v1)` | 'frankendom.presence.v1' | origins/presence/server.ts:16 (duplicated origins/preview/presence-client.ts:11) | origins/presence/server.ts:157 (negotiated) | no | Presence wire protocol changed incompatibly; client and server must negotiate |
| 25 | `net/PROTOCOL_V2 (presence v2)` | 'frankendom.presence.v2' | origins/presence/server.ts:17 | n/a | no | New presence protocol revision offered alongside v1 |
| 26 | `contract/ITEM_DEFINITION_VERSION` | 1 | src/core/contracts/items.ts:35 | src/core/contracts/items.ts:77 via readSchemaVersion (src/core/contracts/core.ts:188) | yes | Contract shape changed; needs a migration |
| 27 | `contract/ITEM_INSTANCE_VERSION` | 1 | src/core/contracts/items.ts:119 | src/core/contracts/items.ts:366 via readSchemaVersion (src/core/contracts/core.ts:188) | yes | Contract shape changed; needs a migration |
| 28 | `contract/LOOT_TABLE_VERSION` | 1 | src/core/contracts/items.ts:572 | src/core/contracts/items.ts:638 via readSchemaVersion (src/core/contracts/core.ts:188) | yes | Contract shape changed; needs a migration |
| 29 | `contract/TRADE_VERSION` | 1 | src/core/contracts/economy.ts:119 | src/core/contracts/economy.ts:136 via readSchemaVersion (src/core/contracts/core.ts:188) | yes | Contract shape changed; needs a migration |
| 30 | `contract/SERVICE_DEFINITION_VERSION` | 1 | src/core/contracts/economy.ts:281 | src/core/contracts/economy.ts:301 via readSchemaVersion (src/core/contracts/core.ts:188) | yes | Contract shape changed; needs a migration |
| 31 | `contract/UPGRADE_COST_TABLE_VERSION` | 1 | src/core/contracts/economy.ts:314 | src/core/contracts/economy.ts:324 via readSchemaVersion (src/core/contracts/core.ts:188) | yes | Contract shape changed; needs a migration |
| 32 | `contract/UPGRADE_REQUEST_VERSION` | 1 | src/core/contracts/economy.ts:368 | src/core/contracts/economy.ts:402 via readSchemaVersion (src/core/contracts/core.ts:188) | yes | Contract shape changed; needs a migration |
| 33 | `contract/UPGRADE_RECEIPT_VERSION` | 1 | src/core/contracts/economy.ts:369 | src/core/contracts/economy.ts:417 via readSchemaVersion (src/core/contracts/core.ts:188) | yes | Contract shape changed; needs a migration |
| 34 | `contract/QUEST_DEFINITION_VERSION` | 1 | src/core/contracts/story.ts:18 | src/core/contracts/story.ts:211 via readSchemaVersion (src/core/contracts/core.ts:188) | yes | Contract shape changed; needs a migration |
| 35 | `contract/QUEST_STATE_VERSION` | 1 | src/core/contracts/story.ts:19 | src/core/contracts/story.ts:282 via readSchemaVersion (src/core/contracts/core.ts:188) | yes | Contract shape changed; needs a migration |
| 36 | `contract/CHARACTER_INSTANCE_VERSION` | 1 | src/core/contracts/world.ts:83 | src/core/contracts/world.ts:103 via readSchemaVersion (src/core/contracts/core.ts:188) | yes | Contract shape changed; needs a migration |
| 37 | `contract/CHARACTER_DEFINITION_VERSION` | 1 | src/core/contracts/world.ts:113 | src/core/contracts/world.ts:189 via readSchemaVersion (src/core/contracts/core.ts:188) | yes | Contract shape changed; needs a migration |
| 38 | `contract/FACTION_DEFINITION_VERSION` | 1 | src/core/contracts/world.ts:245 | src/core/contracts/world.ts:283 via readSchemaVersion (src/core/contracts/core.ts:188) | yes | Contract shape changed; needs a migration |
| 39 | `contract/FACTION_STANDING_VERSION` | 1 | src/core/contracts/world.ts:246 | src/core/contracts/world.ts:320 via readSchemaVersion (src/core/contracts/core.ts:188) | yes | Contract shape changed; needs a migration |
| 40 | `contract/REGION_DEFINITION_VERSION` | 1 | src/core/contracts/world.ts:364 | src/core/contracts/world.ts:385 via readSchemaVersion (src/core/contracts/core.ts:188) | yes | Contract shape changed; needs a migration |
| 41 | `contract/ENCOUNTER_DEFINITION_VERSION` | 1 | src/core/contracts/world.ts:445 | src/core/contracts/world.ts:474 via readSchemaVersion (src/core/contracts/core.ts:188) | yes | Contract shape changed; needs a migration |
| 42 | `origins/world SCHEMA_VERSION` | 1 | origins/world/resolve.ts:8 | origins/world/resolve.ts:43 (loadWorld runs MIGRATIONS); origins/world/concord.ts:16; origins/world/generate.ts:77 | yes | World file shape changed; add a MIGRATIONS step |
| 43 | `origins/zones SCHEMA_VERSION` | 1 | origins/zones/schema.ts:5 | unsure | yes | Zone data shape changed |
| 44 | `origins/shops SHOP_LIST_VERSION` | 1 | origins/shops/shop.ts:14 | unsure | yes | Shop list shape changed |
| 45 | `origins/talk TALK_VERSION` | 1 | origins/talk/talk.ts:12 | origins/talk/talk.ts:71 | yes | Dialogue data shape changed |
| 46 | `origins/patrons perk-template schemaVersion` | 1 (literal) | origins/patrons/patrons.ts:69 | origins/patrons/patrons.ts:88 | no | Perk template shape changed |
| 47 | `origins/feuds grudge-roll schemaVersion` | 1 (literal) | origins/feuds/feuds.ts:119/:179 | unsure (no reader found) | no | Grudge roll shape changed |
| 48 | `core/storyVersion` | unsure (value not in survey) | src/core/contracts/story.ts:50 | origins/quests/journal.ts:52 | no | Story data changed; journal reads it |
| 49 | `core/Profile.version` | 1 | src/core/profile.ts:4/:28/:31 | src/core/profile.ts:13 (different version is discarded) | no | Profile shape changed; stored profiles of the old version are discarded |
| 50 | `core/Scorecard.version` | 1 | src/scorecard.ts:8/:16 | src/scorecard.ts:19 | no | Scorecard shape changed |
| 51 | `scripts/HELD_MAX_VERSION` | 19 | scripts/verify-loot.mjs:50 | scripts/verify-loot.mjs:109/:152/:179 | no | Held-max rule version in the loot verifier changed |
| 52 | `localStorage/frankendom.auth.v1` | v1 | n/a | n/a | no | Stored shape changed; bump the suffix to orphan old saved data |
| 53 | `localStorage/frankendom.chunkreload.v1` | v1 | n/a | n/a | no | Stored shape changed; bump the suffix to orphan old saved data |
| 54 | `localStorage/frankendom.claims.v1` | v1 | n/a | n/a | no | Stored shape changed; bump the suffix to orphan old saved data |
| 55 | `localStorage/frankendom.controls.v1` | v1 | n/a | n/a | no | Stored shape changed; bump the suffix to orphan old saved data |
| 56 | `localStorage/frankendom.damage-numbers.v1` | v1 | n/a | n/a | no | Stored shape changed; bump the suffix to orphan old saved data |
| 57 | `localStorage/frankendom.fight.v1` | v1 | n/a | n/a | no | Stored shape changed; bump the suffix to orphan old saved data |
| 58 | `localStorage/frankendom.fighter.hold.v1` | v1 | n/a | n/a | no | Stored shape changed; bump the suffix to orphan old saved data |
| 59 | `localStorage/frankendom.fighter.v1` | v1 | n/a | n/a | no | Stored shape changed; bump the suffix to orphan old saved data |
| 60 | `localStorage/frankendom.firstloss.v1` | v1 | n/a | n/a | no | Stored shape changed; bump the suffix to orphan old saved data |
| 61 | `localStorage/frankendom.gear-import.v1` | v1 | n/a | n/a | no | Stored shape changed; bump the suffix to orphan old saved data |
| 62 | `localStorage/frankendom.lesson.pace.v1` | v1 | n/a | n/a | no | Stored shape changed; bump the suffix to orphan old saved data |
| 63 | `localStorage/frankendom.scorecard.v1` | v1 | n/a | n/a | no | Stored shape changed; bump the suffix to orphan old saved data |
| 64 | `localStorage/frankendom.spell.equipped.v1` | v1 | n/a | n/a | no | Stored shape changed; bump the suffix to orphan old saved data |
| 65 | `localStorage/frankendom.standing.v1` | v1 | n/a | n/a | no | Stored shape changed; bump the suffix to orphan old saved data |
| 66 | `localStorage/frankendom.tempo.v1` | v1 | n/a | n/a | no | Stored shape changed; bump the suffix to orphan old saved data |
| 67 | `localStorage/frankendom.origins-preview.allegiance.v1` | v1 | n/a | n/a | no | Stored shape changed; bump the suffix to orphan old saved data |
| 68 | `localStorage/frankendom.origins-preview.camera-lock.v1` | v1 | n/a | n/a | no | Stored shape changed; bump the suffix to orphan old saved data |

## Caveats

- Registered = 40 by the recount command; the 28 unregistered = 4 consts (FIRST_DETMATH, HELD_MAX_VERSION, PROTOCOL, PROTOCOL_V2) + 5 literals (Profile.version, Scorecard.version, perk-template and grudge-roll schemaVersion, storyVersion) + 17 localStorage keys + READABLE_VERSIONS + kitTag/kitBuild.
- The code comment on RECORD_VERSION still says PROVISIONAL; ignore it. RV 68 and WSV 44 are final (Lead 2026-10-15).
- localStorage key full names are the listed key plus `.v1` (source: keys end `.vN`, all v1); their definition and read lines were not surveyed (n/a).
- Era-row bump text is generic, from the source's "applies from this version".
- Consumers not located (unsure): zones SCHEMA_VERSION, SHOP_LIST_VERSION, the grudge-roll reader, the exact READABLE_VERSIONS check line. storyVersion's value was not given.
- The item-instance `version: N` is an optimistic-lock counter, not a stamp.
- No `version: 3` career object or version field was found in src/core/cloud-profile.ts, career-model.ts, career-client.ts; `*.manifest.json`, scripts/cut-gates.json and release-train scripts showed no stamps (not read in full).
- Test pins (tests/record-version-guard.test.ts etc.) were skipped and are the main enforcement for RV, WSV and the kit tag.
- pvp hello `v` is RECORD_VERSION re-exported, not a separate stamp.
