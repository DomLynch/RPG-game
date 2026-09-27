---
name: receipts-not-reports
description: How to state facts about other lanes and the live game without overclaiming. Use before every status line, ruling or report to Dom, and whenever a stop-hook reviewer flags "stated as fact". A lane's plan is "Lead reports…" until a receipt exists; every fact in a report comes from a command or message read in this turn.
---

# Receipts, not reports (learned 2026-09-27, eight reviewer catches in one day)

## The rule
A thing is a FACT only when one of these exists in the current turn:
- your own command output (curl, git, gh, cat of a state file, a log grep)
- a message from the lane that owns it, quoted or dated
- a still or artifact you opened

Everything else is a REPORT and is worded as one: "Lead reports…", "Deploy says…", "Web has the message, no reply yet".

## Traps that bit
- A SendMessage result of "queued there" is not delivery, not agreement and not a start. Say "sent, not yet acknowledged" until the reply arrives.
- "The box is free" and "X is using the box" cannot both be true. Pick the one your last command showed.
- Repeating half a lane's report ("tests pass") while dropping the other half ("… but the row is untested") is a false claim.
- A rule you "narrowed" or "set" is a plan until a diff, a test or the owner's confirmation shows it.
- Old logs: check the file's date before quoting a "Published" line; deploy-<sha>.log names the run.
- Stamps come from `date`, never from adding to another lane's Z times.

## Before sending
Read your own last paragraph. For every verb in the past tense, ask: which tool output in this turn shows it? If none, change the verb to "reports" or run the command now.
