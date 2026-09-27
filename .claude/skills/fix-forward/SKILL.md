---
name: fix-forward
description: What to do when a release row fails after a deliberate change (a pin, snapshot or count that no longer matches because a feature was removed or retuned on purpose). Re-pin with the reason, never revert the feature; test:all is the gate for profile, record and snapshot changes. Lead, Deploy and any lane whose PR broke a row.
---

# Fix forward, never revert a deliberate change

## When this applies
A release row or [slow] test fails and the cause is the feature you MEANT to ship:
- a probe count pinned in a gate (audio fatal 16 → 14 after the Quiet One was removed, #924)
- a record version pin, a weapon over-cap snapshot, a roster count
- a golden still that changed because the look changed on Dom's order

## Steps
1. Read the failing assertion and the commit that changed the thing. Confirm the change was ordered (state doc, Dom's words, a brief). If it was not ordered, this is a real bug: fix the bug instead.
2. Move the pin to the new value in the SMALLEST diff, with a comment naming the reason and the order ("14 fatal probes after Quiet One left the runtime, Dom 2026-09-27"), and fix every comment and doc line beside the pin (#924 first shipped a stale "16 fatal … Quiet One's gasp" comment; review caught it).
3. Run the row locally, paste EXIT 0 and the timing into the PR body, plus the mutation proof: the OLD value fails on the same head (the 1094653e run's 14-vs-16 failure is that proof).
4. Close any duplicate PR another lane opened for the same pin (Audio's #925 vs Lead's #924).
5. If the pin lives in a [slow] test that the normal gate skips, run `npm run test:all`; that is the gate for any profile, record or snapshot change (ladder run 1, 2026-09-27 10:33).

## Never
- Revert the feature to make the old pin pass.
- Widen the assertion to a range "so it stops flaking".
- Trust the row without running it once on the fixed head.
