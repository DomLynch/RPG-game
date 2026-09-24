# Three briefs for an outside model (Dom pastes these; Strategy 2026-09-24)

Ground rules for all three: the game is Frankendom (frankendom.com), a phone-first sword duel where skill decides and no
item changes a timing. Output is judged by Strategy on the same rules as a lane: name defects, quote evidence, no advice
without a concrete failing case. Do not propose scope; scope is docs/SCOPE.md.

## Brief 1 — Adversarial review of the fight bump (PR #695 + #697)

You are a hostile reviewer. Attached: the unified diff of PR #695 (kick vsGuard stagger 36→48, straight-back roll "Evaded!"
text, the Witch's own Easy profile, RECORD_VERSION 9→10 with regenerated replay refs) and #697 (rain as one static mesh
falling in the vertex shader). The sim is deterministic and replayed from records; a record's digest must not change
except through the version bump. Find, in priority order: (1) any path where the sim's outcome depends on something
outside the record (time, device, Math.random, float non-determinism across arm64/x64); (2) any place the new stagger
window can be entered or left without the player having a legal action inside it, on any weapon; (3) any way the Witch
profile changes a shared timing table rather than her own choices; (4) any text path where "Evaded!" can print without
an avoided hit, or an avoided hit can print nothing; (5) anything in the rain shader that reads per-frame CPU state or
allocates per frame. For each finding: file and line from the diff, a 6–25 word verbatim quote, the concrete failing
input, and the smallest fix. Then a one-line verdict: SHIP / FIX FIRST. No style comments. No praise.

## Brief 3 — The grafting data model (design doc, not code)

Read the attached docs/briefs/grafting-direction.md (beta scope, all of it except the listed cuts) and docs/SCOPE.md.
Write the data model that a TypeScript sim and a Supabase backend would share, as a document with tables, not code:
(a) Anatomy slots (head, brain, eyes, heart, torso, left arm, right arm, legs, skin) and what each may hold; (b) a Part:
identity (creature, slot, mutation), shape on the body grid, stability cost, provenance (hosts, kills, famous wins),
preservation state (embalming fluid, rot clock), rolled property; (c) the Stability budget per body and how a pure human
in the ten-tier kit is at parity with a grafted body under the same cap, stated as a rule the sim can check; (d) the
incompatibility table format (pairs that hate each other, the forbidden pairs that hide a bonus, never published);
(e) inherited moves: how a creature's one signature move is represented so the sim adds a discrete action, never a
timing change, and how the pre-duel active set of a few powers is chosen and validated; (f) mutation as a flag on the
creature that propagates to its parts; (g) what is server-authoritative (awards, provenance, rot) and what the client
may hold. For each table give the minimum columns, the invariants, and one worked example: a Recruit with a human body,
and a grafted body with a witch arm, a vampire heart and one forbidden pair. End with the ten open questions the
design cannot answer without a playtest. Do not invent creatures beyond the ten archetypes plus: orc, troll, cyclops,
vampire, werewolf, demon, giant, spider, raven, basilisk.

## Brief 4 — Creature and part references for the pipeline

For each of the ten creatures above, produce a one-page reference the art pipeline (TRELLIS image-to-3D from a single
front view, then rig fit) can build from: a 60-word silhouette description readable at phone size against a stone arena;
the ONE signature move a player would learn to read (stomp, grab, leap, charge, cast) in one sentence; the three parts a
player would most want to take from it and what each would visibly do on a human body (arm, heart, eyes, legs, skin, head);
one plausible visible mutation (two-headed, albino, crystal, winged) and how it reads before the kill; palette in three
named colours with hex; and three prompt lines for a front-view concept render, gritty, in-world, no game-show framing,
no cage, no glow. Style anchors: rusted iron, rags then leather, blood that stays. Nothing cartoon, nothing neon. Output
as ten short sections with identical headings so the pipeline can diff them.
