# Sandbox archive manifest (Deploy, DRAFT 2026-10-19 11:40 +04, nothing run)

Gate (Lead + Strategy, Dom: "port all, then archive both sandboxes"): run this only when every line of `docs/state/sandbox-master-list.md` (Lead worktree `frankendom-lead-catalogue`) reads PORTED (merged and live), SUPERSEDED by a named merged PR, or DROPPED-BY-DOM (R03 executioner rows, C21 sandbox vite tooling, CS22 crossbow). At 11:40 the master list still had open lines (R10 reach/stand-back: #3266 in JL, #3221 open; combat BULK-CS is live as JK3 but other lines are IN PR / NOT STARTED). Target 15:30.

Target tip values below were read from `origin` at drafting time; the script re-reads and refuses a tip that moved.

## What is archived, what is kept

| Sandbox | Session | Worktree (kept) | Source branch (frozen tip) |
|---|---|---|---|
| Combat sandbox | the "combat sandbox" Claude session | `~/Developer/frankendom-sandbox` | `sandbox/page` @93b1138c7 |
| Test Zone sandbox | "Test Zone Sandbox" Claude session | `~/Developer/frankendom-zone-sandbox` | `zone/goblin-field-dome` @5da7b0388 |

**Archived = an annotated tag on each branch tip, pushed to origin (`sandbox-archive-2026-10-19/<branch>`), plus this manifest committed.** The tag convention follows the two existing tags (`sandbox-layoutA-v2-2026-10-13`, `sandbox-plain-posture-2026-10-14`). **No branch is deleted and no folder is removed by this manifest.** Branches stay on origin. The two sessions are archived in the Claude app by Dom or Strategy (`archive_session`), not by Deploy.

Branches tagged (tip at drafting):

sandbox/ (Combat): bow-wip 678a31f0d, creature-motion-probe 72fdec45c, foe-spells 1fea5ac00, page 93b1138c7, page-pre-EF c053ba0fe, port-docs 52f6d16ff, port-shards d9d1be511, port-sound a54a4ae88, rv79 3aab281da, rv81 d0e8c835b, special-clips 6e00905f3, special2 7a95aa8c4.
zone/ (Test Zone): goblin-field-dome 5da7b0388, port-breath e9d545c70, port-fp 7d3c9edb8, port-loot b55a0fbcc, port-loot-wired f683af02e, port-rows b081e9d93, port-warband c0fd82393, promotion-list ba6878aa0, promotion-list-jh2 c6cb14561, test-zone-proof 090400644, troll-render 49444cbeb, troll-render2 3ddf56675, tz-evidence c2726de66, tz-evidence-jh2 9d1313489.

Local branches with no origin ref (`sandbox/rv80` @3aab281da, `sandbox/spell-range` @d379d5bea) and other lane branches that merely look similar (`combat/rv79-sandbox-rows`) are listed but NOT tagged; their owner says whether they count.

## Worktrees on this Mac (kept; removal is Dom's word, per folder)

`frankendom-sandbox`, `-sandbox-foe`, `-sandbox-port1` (the 10-18 note says port1/port2 were swept: port1 is still present, check with Hooks Dev before touching), `-sandbox-rv80`, `-sandbox-rv81`, `-sandbox-spells`, `-zone-sandbox`, `-zone-breath`, `-zone-list`, `-zone-troll`, `-zone-warband`, `-tz-evidence`, `-rv79`. Each is a worktree of a branch above. Folders are removed only when Dom (or a ruling Lead/Strategy relays as his) names that folder, with `git worktree remove` after a clean-status check. Nothing under any ARMAGEDOM path is ever touched. On the VPS only `vps-scratch-sweep --path=<exact> --apply` (no by-age or hand deletes).

## The one command (run by Deploy only after the gate and a written GO from Lead or Strategy)

```bash
cd ~/Developer/frankendom-deploy && git fetch -q origin
while read -r branch tip; do
  full=$(git rev-parse --verify "origin/$branch^{commit}") || { echo "MISSING $branch"; continue; }
  [ "${full:0:9}" = "$tip" ] || { echo "MOVED $branch ($tip -> ${full:0:9}); skipped"; continue; }
  tag="sandbox-archive-2026-10-19/$branch"
  git rev-parse -q --verify "refs/tags/$tag" >/dev/null && { echo "EXISTS $tag"; continue; }
  git tag -a "$tag" -m "Sandbox archived 2026-10-19: all master-list lines PORTED/SUPERSEDED/DROPPED-BY-DOM; branch frozen at $tip" "$full" && git push -q origin "refs/tags/$tag" && echo "TAGGED $tag"
done <<'EOF'
sandbox/bow-wip 678a31f0d
sandbox/creature-motion-probe 72fdec45c
sandbox/foe-spells 1fea5ac00
sandbox/page 93b1138c7
sandbox/page-pre-EF c053ba0fe
sandbox/port-docs 52f6d16ff
sandbox/port-shards d9d1be511
sandbox/port-sound a54a4ae88
sandbox/rv79 3aab281da
sandbox/rv81 d0e8c835b
sandbox/special-clips 6e00905f3
sandbox/special2 7a95aa8c4
zone/goblin-field-dome 5da7b0388
zone/port-breath e9d545c70
zone/port-fp 7d3c9edb8
zone/port-loot b55a0fbcc
zone/port-loot-wired f683af02e
zone/port-rows b081e9d93
zone/port-warband c0fd82393
zone/promotion-list ba6878aa0
zone/promotion-list-jh2 c6cb14561
zone/test-zone-proof 090400644
zone/troll-render 49444cbeb
zone/troll-render2 3ddf56675
zone/tz-evidence c2726de66
zone/tz-evidence-jh2 9d1313489
EOF
```

Receipt after the run: the TAGGED/MOVED/EXISTS lines, `git ls-remote --tags origin 'sandbox-archive-2026-10-19/*' | wc -l` (expect 26), and the master-list status read at the same minute.

## RUN RECEIPT (2026-10-19, after JP 979f4513f went live; Lead's written GO, Strategy's written exception for Z1b and CS35 item 2)

24 of 26 tags created and pushed (`git ls-remote --tags origin 'sandbox-archive-2026-10-19/*'` = 24). Skipped by the moved-tip guard, NOT tagged, because the branch moved after drafting: `zone/promotion-list-jh2` (drafted c6cb14561, now 3963193c0) and `zone/tz-evidence-jh2` (drafted 9d1313489, now a8763edc0). Both are Test Zone evidence/list branches; tag their current tips only on the owner's word. No branch deleted, no folder removed, nothing under ARMAGEDOM touched.

## Open before it runs (historical, from the draft)

- Gate not yet true (see top). Lead flips the last line; Deploy re-reads the list at run time.
- Do the two sandbox sessions still need their branches? Each says so on its thread (Test Zone's `docs/sandbox/HANDOFF.md` on `zone/promotion-list`, Combat's `docs/sandbox/promotion-list.md` on `sandbox/port-docs`).
- Whether Dom wants any worktree folder removed, and which (default: none).
