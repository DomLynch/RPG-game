# Frankendom V2: the feel layer, line by line (Strategy, 2026-10-25 night)

Dom's verdict on step 1: "quite floaty, very different feeling, not comparable to the original." The controls page carried inputs and timings; none of what makes V1 heavy came across. Every item below is a data row plus the smallest code that reads it. V1 numbers where known; `frankendom-lead-catalogue/docs/v2/feel-layer-for-v2.md` (Frankendom Lead) fills the rest with files and numbers. Dom's bans: no screen shake, no FOV punch, no stagger on every hit. The gate is Dom's "feels the same" on his phone.

## A. Weight (first)
1. Blend times as rows per transition: idle->attack 60-90 ms, attack->recovery 80 ms, hit reaction in 40 ms, locomotion 120 ms; nothing above 150 ms in combat.
2. Attack commit: no cancel after wind-up starts except by being hit or by the parry window; roll cancels only in recovery after the combo window. Flag per move.
3. Clip playback: strike at the data `hit` fraction (0.46), start offset skips the lead-in, wind-up stretched to the tick count, never slowed below 0.9x; cut long clips, do not slow them.
4. Root motion on attacks (forward step on light, lunge on thrust) or a data lunge distance per move (V1 light reach 1.65 m). Feet planted on contact.
5. Locomotion rows: move speed, acceleration, turn rate; turn-to-face in 2-3 ticks; strafe at stick > 0.4.
6. Idle: still half-sword guard; weapon never floats; grip socket per body.

## B. Impact on hit
7. Hit-stop table 30-220 ms by move class (data/hit-stop.json) with a global multiplier (0 = V1 live, 1 = table), chosen by Dom on the URL.
8. Hit-stun clip per zone (head, torso, arm, leg) and side; duration from the move's stagger value (V1 light: 24 ticks).
9. Knockback per zone and move class: distance, ease-out over 6-10 ticks; impulse tiers 0 to 300+ (core doc item 18).
10. Posture break -> stagger dip (strength down 0.5 s, back over 0.35 s) and the riposte window; stagger NOT on every hit.
11. Guard impact: BlockImpact clip, short push-back, spark; chips stamina not health.
12. Parry: 100-150 ms freeze on both bodies, deflect clip, riposte window, distinct sound.
13. Counter-hit multiplier from data when hitting an attacker in wind-up, stronger reaction clip.
14. Whiff: full recovery, no cancel, whoosh, slight forward momentum; a whiff must feel worse than a hit.

## C. Kill
15. Kill freeze 220 ms, slow-mo 0.2x for 1.25 s ramping back over 1.25 s; death ramp (motor 1 -> 0.01 over 1 s) when physics lands, death clip until then.
16. Finisher trigger per the core doc; data table weapon x zone x state; one finisher is enough for now.

## D. Effects and sound (reuse V1 assets as they are)
17. On hit: 1-2 frame flash on the victim, blood burst sized by move class, floor decal on heavy and kills.
18. On guard: sparks and a metal ring; on parry: bigger sparks and the parry sound; on kick: dust and a thud.
19. Sound rows per event (swing light/heavy, hit flesh, hit guard, parry, kick, roll, footsteps synced to foot contacts, death, specials) with volume and pitch jitter; played from sim events, never from the renderer.
20. Camera: V1's fight camera numbers; small push-in on kill only; no shake.

## E. Proof
21. One-hit side-by-side clip V1 vs V2 at 375, same camera, after each block; one line to Dom each time.
22. The timing table test stays green throughout: feel never changes tick numbers.
