# Arena audio review

Asset audit: all new recordings CC0 with source/hash pins; existing sprite bytes/manifest preserved. Rebuild byte-identical.
15 nonzero bounded regions in both codecs;388785B combined gzip. Original110Hz bell with331/552Hz partials raised following
phone-band measurement (23.7% ->35.3%); no global loudness increase. Other new voices63–97% energy in300–5000Hz phone proxy.

State/input audit: presentation-only frame identity/ended flag; simulation unaffected. Independent RNG and maximum6voices,
no core-voice stealing. First decode has no playback callback. Quiet/mute stop future and active sources; match identity
resets the bell; actual match tick suppresses a late first unmute bell; resume consumes late bell, accents restart with a fresh12–22s interval. Death clears all optional layers.
Review found pending-suspend/unlock ordering at Enter: resume now queues in the user gesture, with a regression test.

Rendered audit: actual OfflineAudioContext output, AAC/Opus decoding and forced AAC full fatal render. Bed -38.58dBFS RMS,
active fight -24.61dBFS; peak at most-1.0dBTP. Silent pause/mute intervals, no decode resurrection, new-match bell and no
resume bell, optional-bank failure retaining combat, overlapping nonrepeating beds, accent/grunt cooldowns and voice cap
all pass. Existing audio gate17ordinary/8crowd-tail/12fatal baseline probes passed before QuietOne integration; QuietOne's
new decoded/cancellation gate is retained for final checks.

Native audit passed after the weapons release freed the shared GPU: welcome silent, Enter starts bed/bell, menu stops,
resume no duplicate bell, actual opponent defeat clears ambience, rematch rings once. Initial stalls occurred during confirmed
QuietOne GPU occupation. Native observer records natural ended events as well as stop calls, and waits for normal rig
readiness before clicking Enter (same readiness contract as the existing main browser gate). No timeout relaxation or
state injection. Final integrated release contract: all inherited checks plus arena audio; native menu/resume/actual death/rematch; live
public asset/revision checks. Physical handset listening remains unverified; preview.wav/m4a is rendered evidence only.
