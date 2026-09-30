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

## Brief 5 — Opponent reveal: options after three rejected overlays (Dom pastes this; Strategy 2026-09-24 22:0x)

The game: Frankendom, a phone-first browser sword duel, portrait 375×812, camera high behind the player looking down a
sand-and-stone pit at one opponent. The look is gritty and plain: earth tones, real shadows, no particles, no flashes,
no gold glass. What is on screen at the fight opening today, top to bottom: opponent name + health/stamina bars, the
player's rank line, one line of fight text, the arena with both fighters standing (a plain still, no camera move), the
DRAW / HEAVY / STEP / GUARD controls. The player taps DRAW to start. Every opponent is one of ten named archetypes
(Centurion, Veteran, Pitborn, Nightborn, Executioner, Plague Doctor, Knight, Witch, Shieldmaiden, Dwarf, Goblin), each
with a fixed weapon and a six-piece kit; after a kill the player takes one worn piece off the body. Soon each opponent
will wear the kit of their ladder tier, so tier reads off the body.

The problem: before the draw the player does not know who this is, what they carry, or what can be taken from them.
The name in the top bar is a label, not a reveal.

What has been REJECTED, all by the owner on sight, so do not propose these or their near relatives:
1. A lighting-led opening (dramatic rim light, vignette): "cheap".
2. An "Arena Draw": a vertical strip of opponent portraits dropping on a chain behind an iron frame, slamming on the
   ladder's opponent (built, shipped, reverted same day): "really cheap, not the gritty game we designed".
3. Three overlays tonight (a card with name + kit icons in the top-left; a nameplate floating over each fighter; a
   banner laid on the sand between them): "terrible, ugly, and crass".
The pattern: any panel, plate, card, banner, badge, frame or glassy rectangle drawn over the arena fails. So does any
theatrical effect. The owner wants the reveal to feel like it belongs to the pit, not to a menu.

Hard rules: no sim change and no timing change (skill decides, nothing an item does alters a clock); fight text states
what IS or what HAPPENED, never what to do; performance must hold on an iPhone 15-class GPU (no per-frame CPU work,
no new particle systems); the plain still stays the fight opening unless the option explicitly replaces it and says why;
must read in one glance at 375 wide with a thumb over the bottom third; no reading required beyond a name and a weapon
word; tap to skip anything that takes time.

Produce EIGHT options, spread across these families, at least one each: (a) the opponent's own body and behaviour
(posture, a gesture, a weapon presentation, where they stand, how they enter); (b) the arena itself (what the pit shows,
marks, objects, the crowd, the gate); (c) the camera (a beat before the still, then the still); (d) typography only
(where the name and weapon can live so they are part of the scene, not a plate over it, e.g. carved, painted, cast on
the floor as shadow, on the fighter's kit); (e) sound-led (the reveal is heard, the screen barely changes); (f) NOTHING
new, argued honestly: the tier kit on the body plus the existing name line is the reveal.

For each option, in this order and nothing else: name (3 words); what the player sees, described as one 375×812 frame
in under 60 words; how the name, weapon and takeable piece are learned; cost (which of: animation, model, shader, audio,
text, camera; and a rough size); the one way it could fail against the rejections above; whether it survives the tier
kit landing. Then rank the eight by "belongs to the pit" first and cost second, and name the two you would build as
labelled stills for the owner to judge. No mockup images. No UI rectangles. No praise.
