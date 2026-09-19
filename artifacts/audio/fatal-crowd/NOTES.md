Objective: owner-approved fatal-contact/death/crowd pass, preserving deployed PR147.
Success: clear fatal hit first; recorded dying vocal; body/gear settling; gasp then 2–3 second crowd reaction for either winner; gore cues tied to the selected visual finish and blood setting; no gameplay timing changes; <=1MB gzip audio, <=8 simultaneous sample voices, same audio on/off/quiet controls.
Approaches: synthesize crowd (rejected: human voice quality); one long combined kill sample per outcome (rejected: payload and timing); reuse impacts/body plus short CC0 vocal/organic layers and three short recorded crowd takes (chosen).
Known files: src/feedback.ts, src/audio/{cues,exchange,manifest}.ts, scripts/{build-audio,audio-preview}.mjs, audio assets/tests; tiny main.ts audio-only presentation hookup to pass already-selected finish/blood mode. Simulation and rendering behavior remain unchanged. This hookup is necessary for the newly approved exact visual/audio matching; no event inferred from health/HUD and no guessed opponent weapon.
Discovery: three distinct Semble searches, CodeGraph call/impact review, direct event/finisher/main seams. Existing Killed includes weapon/location/material but not visual override; use shared existing selectFinisher and existing override UI value at the audio call only.
Sources: public primary Freesound CC0 recordings, archived identifiers/URLs/SHA256 in artifacts/audio/SOURCES.json; no purchases or AI voices. Build script must reproduce from hash-pinned downloads/cache. Source bytes remain build-time only.
Checks: winner/loser/double-fall, kick, plain/decapitation/split/run-through, blood off, no duplicated fatal hit, delayed source cancellation on mute/rematch, sprite cap and payload, both codecs, repeatability, full quality/completion gates and live audio flow.
Risks: physical phone listening not available. Fixed presentation delays must match existing finisher clock; don't imply frame-perfect platform timing or AAA subjective approval.

- Review 1: event-only mapping, explicit existing presentation descriptor, shared selector, no gameplay mutation; kicks/double
  deaths/player death/blood-off and unsupported finisher fallback covered. Split Crown crack uses actual 4.5% threshold;
  decap tear 5%. Estoc fatal contact uses puncture.
- Review 2: real OfflineAudioContext decoding, repeated PCM, peak and post-cancellation silence pass. Future gain/send automation
  cleared on quiet/mute, so a restarted voice cannot inherit delayed crowd/body volume changes.
- F2 closed: old kill-only test assertion replaced with the authorized fatal sequence and timing assertions; 15/15 audio tests pass.
- F3 closed: preview assertion used fatal-* instead of existing finish-* probe names; corrected harness naming, same checks pass.
- Public first-pass receipt: f5129ea published; game browser, native dodge sample playback, mute, public index/release/sprite hash parity
  and nginx active passed. Initial parry gate failure passed unchanged on retry. First-pass Sentry release error count 0 at check.

- Native gameplay receipt: actual Veteran opponent defeated the player at tick 882; real sprite death_voice, crowd_cheer and kill
  sources observed; crowd delay >=340 ms, menu stopped it, resume did not replay it; no browser errors. See browser.json.
- 17 existing nonfatal probes retain identical measured integrated loudness and peak (0.0 dB difference); nonfatal-parity.json.
- Integrated upstream PR149 (Run Through visual correction) before the full gate; its new completion command remains required.

- F4: full gate found three old FakeContext tests missing standard AudioParam.cancelScheduledValues. Updated the stand-in; retained all lifecycle assertions. Real browser cancellation had already passed. Full gate rerun required.
