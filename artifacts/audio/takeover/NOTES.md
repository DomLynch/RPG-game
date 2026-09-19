# Audio takeover — 2026-09-19
Objective: preserve shipped impacts while adding event-driven roll/backstep cloth and sand, and repair audio lifecycle and evidence reliability.
Success: before/after WAVs, AAC/Opus decoding, bounded render repeatability, no resumed stale sources, required quality/completion gates; audio-only PR to trunk.
Context: fresh origin trunk 32f783e; Claude worktree audio/foley-v2 untouched. Runtime contract remains unlock/quiet/toggle/update(events).
Files: feedback.ts, audio/cues.ts and generated manifest, build-audio/audio-preview scripts, audio tests, audio assets and evidence. Game/shell/renderer/other lanes read-only. No deployment from this lane.
Candidates: replace impacts with sourced Foley (needs curation/listening); add music/ambience (larger mix and lifecycle scope); strengthen playback plus existing dodge event cues (chosen bounded slice).
No fabricated footsteps, breath state or landing timing: current event contract has no necessary continuous-state fields. Dodge sounds are movement-start textures only.
Risks: physical phone acceptance unverified; procedural sounds remain procedural; convolver can vary at PCM rounding level.
Checks: regression tests, real Chromium offline output/quiet/codec checks, npm run quality, configured completion commands. Audio browser validation stays in allowed preview script; gate wiring requested from lead in REQUESTS.md.

## Review and validation
- Main entry points stay unchanged: browser gestures call unlock; mute calls toggle; hidden/focus/menu paths call quiet; event updates remain read-only consumers.
- Bug fixes: first cue could never choose variant zero; room gain was multiplied twice; quiet depended on async AudioContext state and did not cancel queued sources; preview PCM conversion ignored Buffer byteOffset/length. Added regression assertions for first selection, synchronous quiet, and sample/fallback cancellation.
- Real Chromium: all 54 AAC and Opus regions audible and in bounds; forced primary-format failure recovers; three renders differ by at most 1 PCM unit; eight stacked cues -2.85 dBFS. Existing light/parry LUFS exactly unchanged; exchange -15.1 to -15.0 LUFS. exchange-matched.wav attenuates the after clip by 0.1 dB for like-level comparison.
- Movement is authored original procedural friction, not recorded Foley and not a claim of AAA sound quality. No purchases, external assets, dependencies, combat or renderer edits.
- Source table: scripts/build-audio.mjs RECIPES.roll/backstep; original 2026-09-19; no external licence; seeded filters/envelopes/fades, existing normalization and encoders. Assets README carries reproduction notes.
- Index: initial worktree sync reported no index; initialized this worktree for the already-authorized indexed repository. Fresh CodeGraph has 2238 nodes and 8902 edges; post-edit call-path check completed.
- Inherited limitations: fallback synthesizer uses more nodes than sample path and does not share its eight-voice pool; quiet stops voices but does not flush convolution/compressor history. No claim to complete the original foundation contract. Continuous locomotion/breath/material metadata still needs lead events; recorded Foley, ambience and music remain later audio work.
- Production release read-only receipt: 32f783e8d2aa671daca418d2cde1ade04ffba4bd. This lane will submit a PR; no deployment command or VPS write is authorized by the lane brief.

Final gates: npm run quality PASS (253/253; lint/typecheck/build/audit/budget/game browser); roster completion PASS; Split Crown completion PASS; audio completion PASS. Code/source review completed, no outstanding current-task failures. No background jobs left running. Commit is limited to audio runtime/assets/tests, required completion-gate registration and source/state/evidence documentation.

Integration closure: PR #147 initially conflicted after trunk advanced to d3114a9 (Nightborn estoc). Preserved both completion-command lists, merged all upstream changes, refreshed CodeGraph and reran every gate. 254/254 tests; quality + roster + Split Crown + audio + estoc browser PASS. Final fight payload 8,423,166 B gzip. Receipts: merged-gate-0..4.log. No deploy; PR handoff only.

Final gameplay integration: trunk 3bfb0eb adds button-consistent counters. Merged it, preserved the fixed exchange Stab input, mapped slash_riposte to existing riposte-weight cues, and pinned both attack and hit mappings. All six configured commands pass: quality 254/254 plus game browser, roster, Split Crown, audio, estoc and counter-button checks. Final fight budget 8,427,081 B gzip. Receipts final-gate-0..5.log. Moved only the audio handoff section to the end of PROJECT_STATE to avoid competing top-of-file notes; newer appearance-tooling/docs trunk 0c7b03f is outside this branch validation. Normalized captured-log whitespace; diff check passes. CodeGraph refreshed after the cue mapping.
