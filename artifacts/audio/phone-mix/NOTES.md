# Phone mix revision
Owner heard effects too loud on the phone; final requested targets are ordinary effects x0.5, crowd and death sequence x1.5 relative to the current mix. Also requested frequency and balance review.

Candidates: cue input gain changes (rejected: 5:1 bus compression largely cancels the requested ratio); separate category buses (rejected: extra graph/room complexity); post-compression duel/finish level with a transparent final peak guard (selected). Existing cues, variants, assets and timing stay unchanged. Half-level applies to the fallback too. Quiet/mute and fresh combat restore normal gain.

Scope: feedback.ts and existing render checks/evidence only. No gameplay, shell or renderer edit. Release hold from lead remains active: isolated commit/PR allowed, no trunk merge/deploy without a coordinated window.

Validation: render ordinary PCM versus baseline (x0.5), fatal body/crowd windows (x1.5 unless peak guard acts), high-frequency balance, phone-band loudness, clipping/codec/cancellation/rematch/mute, full required quality. No actual phone/speaker audition claim; measurements are not subjective hearing.

Final: all checks passed; see REVIEW.md and gates.json. Initial non-oversampled safety shaper was rejected after +2.2 dBTP intersample overshoot. Final oversampled guard reports at most -1.0 dBTP in FFmpeg. Runtime changes remain 20 added lines and three replaced lines in feedback.ts. App checkpoints moved the lane onto codex/01a0b8e3/main; it remains isolated from trunk. No release window granted.
