---
name: no-idle-lane
description: The queue runs around the clock and no lane sits idle while work exists. A green PR waiting on a free box is a defect; an idle lane is Lead's defect; Strategy finds work when Lead cannot. Includes the hourly overnight wake and where to find each lane's next task. Lead and Strategy.
---

# No idle lane, no idle box

> **Mac busy? Move the job (Dom, standing, 2026-10-08):** ANY work — deploys and release builds, test suites, Chromium, Blender, any CPU job — runs on the VPS or the Hugging Face 32 GB CPU instance ($0.03/h). Never wait on a busy Mac and never let a build time out on it (fold6 died that way). How: the `vps-heavy-jobs` skill. Only Safari/WebKit rows and real-iPhone checks stay on the Mac.

Dom, 2026-09-26 06:0x: "4 hours no action?" after a 02:00 stop. The queue runs 24 h. Lead self-wakes once an hour overnight; daytime is event-driven (READY, sha, still), never by the clock.

## The two defects
1. A CI-green mergeable PR while the box is free and no run is in flight. Owner: Deploy launches; if it did not, Strategy asks Deploy why in one line.
2. A lane with nothing assigned. Owner: Lead. Strategy asks Lead "who is idle" and gives work to any lane Lead cannot fill.

## Where a lane's next work comes from, in order
1. Its own state doc's NOW / next list.
2. docs/SCOPE.md beta items for its area.
3. Legends and backstory checks for its opponent's ten names (character lanes).
4. Stills and gates for another lane's PR that touches its opponent (Finishers look-on stills, closed-helm finisher gate).
5. A brief from Strategy.

## Rules
- Lanes follow their names: an opponent lane builds only its own opponent; never reassign work under way.
- A fix Dom asks for skips the line and ships now.
- Lead reports milestones only; no hourly lines to Strategy; no "are you done" polls from anyone.
- A lane that finishes tells Lead in one line with its receipt and takes the next item without waiting.
