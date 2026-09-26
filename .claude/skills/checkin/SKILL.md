---
name: checkin
description: The 20-minute Strategy check-in on the live game and the deploy queue. Curl live, read the deploy lock, disk, ListAgents and any Lead or Deploy messages, compare with the queue in the state doc, report to Dom only on change. Also arms the recurring cron. Strategy lane; Lead may use it while Strategy is down.
---

# Strategy check-in (every 20 minutes, Dom's standing order 2026-09-26)

## Arm it once per session (after /restart)

CronCreate, cron `8,28,48 * * * *`, prompt = the block under "Each firing". Session-only; it dies with the session, so re-arm on every restart while Dom is up. Do not arm a second copy: CronList first.

## Each firing

```bash
date
curl -s https://frankendom.com/release.json
cat ~/.claude/state/deploy_in_flight.json 2>/dev/null
df -h / | tail -1
git fetch -q origin && S=docs/state/strategy.md && git show "$(git log --remotes -1 --format=%h -- $S):$S" | grep -o 'Queue after: [^.]*\.' | head -1
```

Then ListAgents and read any Lead or Deploy message that arrived. Do not message lanes; Lead is the channel.

## Report to Dom ONLY if one of these changed

- A new live revision: name what is now live in his words (feature names, not PR numbers).
- A run failed, or the lock is older than 45 minutes with no Published line: say which row and who is on it.
- Disk under 6 GB (the deploy watcher aborts there).
- A Lead milestone: a deliverable, a slip with its cause, or a ruling request.

Otherwise one line: `No change at HH:MM: live <sha8>, <in-flight or box FREE>, disk <N> GB, no new Lead or Deploy message.`

Every fact in the line comes from a command or a message you just read in this firing, never from the previous one.

## Rules

- No lane polling, no "are you done" messages; Lead reports milestones.
- Never forward a lane's estimate as your own; halve it in your head and ask what makes the halved number impossible.
- A green PR idle while the box is free is a defect: say so to Lead.
- Stamps from `date` only.
