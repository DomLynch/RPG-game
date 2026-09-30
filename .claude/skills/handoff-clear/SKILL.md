---
name: handoff-clear
description: What to save before a /clear or when Dom says "save your work", and who may clear when. State-doc entry at the top with LIVE, in-flight, queue, rulings and a READ FIRST pointer; memory files for every ruling; cron and worktree notes. Never clear on the critical path while Dom is away; Strategy may restart a cleared lane. Every lane.
---

# Handoff before /clear

A restart proves itself by loading memory and the state doc (Trap 1, 2, 3 in `restart`). This skill is the other half: what must exist for that load to be worth anything.

## The state-doc entry (top of docs/state/<lane>.md)
Heading: `## YYYY-MM-DD HH:MM (+04) — HANDOFF before /clear. READ FIRST, then <previous entry>, then memory`. Time from `date`.
1. LIVE <sha8> by your own curl at HH:MM; lock present or not; run in flight or not.
2. What went live today, in Dom's words, with times.
3. NOT LIVE and why, one line each, with the fix PR and its state.
4. Sessions down that Dom must restart, in the order they are needed.
5. Rulings made today, one line each, pointing at the memory file.
6. QUEUE after the current run, in order.
7. Cron ids (they die with the session; re-arm on restart), worktree path, branch, PR.
Do not rewrite older entries. If the doc lives on a branch, say which; the restart hook reads the newest remote copy.

## Memory
One file per ruling or lesson, written when it happens, not at the handoff. Index line in MEMORY.md. Today's files listed in the handoff entry so the restart reads them first.

## Who may clear
- Never while you own the critical path and Dom is asleep or away (Lead, Combat and Auditer cleared 2026-09-26 morning and did not come back for hours).
- Tell Dom the context figure and that you are clearing; the restart paste comes from him.
- Strategy may wake a self-cleared lane by sending its restart prompt, by LANE TITLE not by id.
- A worktree session says once, and does not wait: "when you're home, reopen me on ~/Developer/frankendom-<lane> with the worktree switch off".
