# RV80 follow-up (draft): sandbox migration close-out

Branch `combat/rv80-followup`, based on `combat/sandbox-default-on` (#3317). Retarget to trunk once #3317 merges. This file is the plan; code lands in commits on this branch.

| Item | What | Estimate (from 2026-10-19) |
|---|---|---|
| 9 | MANA third bar shows on a default build (Strategy's visual audit); data row, not a literal | 2026-10-20 |
| 10 | Mid-fight camera pulls back to show rim and sky: `camera.fightBack` row, not started | 2026-10-21 |
| 13 | Play every sandbox special on a default build (Skull Crack, Whirlwind, Ground Slam, Lunge, four bow specials, shards/trails, staff/arrow fx); fix any that do not fire | 2026-10-21 |
| RV81 | One bump: stance picker B (four icons under the bars, mid-fight switch as a recorded input) plus bow/staff sim rows from `char/bow-staff-sim` @a4baa36b8; separate branch `combat/rv81` from trunk after #3317 merges | 2026-10-22 |

Estimates assume #3317 merges by 2026-10-20. RV81 is a separate PR, not part of this one.
