# Project state

## Ordered lead cleanup — 2026-09-19 (PR #171)
Owner requested readability, existing-recipe cleanup, obsolete QA retirement, then reliability/product gaps.
The main/scene TypeScript syntax trees and parsed CSS rules were preserved while unpacking dense formatting.
Input/audio tests retain their behavioral requirements across formatting; missing-event and touch-rule mutations fail.
Equipment defaults now live in appearance presets; Veteran/Executioner rebuilds are byte-identical to baseline.
Retired the rejected procedural pilot generator/check (508 source lines). Actual shipped-creature integrity and
browser gates remain, including both rigs and 250 sampled poses.

Startup now preserves the original renderer exception and stack while retaining the friendly fallback. The regression
fails before the change and passes after it; actual Chromium with WebGL disabled verifies the original error and disabled
combat. Audio e867 is integrated, including Draw-only bell behavior. All 24 configured commands passed on 17218e6:
291 tests, typecheck/lint/audit, gameplay/recovery/layout, finishers, account/database, audio and creature checks.
Independent clean Node 22 and real PostgreSQL checks also pass. The subsequent review-record edits were documentation/comments only.
The final pre-merge check then found published weapons revision 68ccdf2. It is integrated with its new creature-weapon
pose gate retained; the combined 25-command contract is revalidated before publication. Release-window coordination
is explicit in AGENTS.md so every active lane is included before the lead reserves the shared GPU/release window.
Deployment and public verification receipts are maintained under artifacts/cleanup/ and PR #171; served release.json
identifies the published revision. GitHub's hosted job was billing-blocked before start; it is not reported green.

The owner permits up to 12 MB per fight when needed; the separate 32 MB distribution cap is unchanged.
Release-specific Sentry triage and remaining acceptance: docs/reliability-audit.md. Physical-phone and external-player
validation remain unpassed. Career practice-win award policy awaits owner confirmation; no rank ledger or end-game
system was added. The shared automatic hook's 420-second ceiling is shorter than this 1,111-second full suite;
all commands were run directly without deleting checks or altering shared enforcement.

## Creature weapons — weapons lane, 2026-09-19
Owner enables stone maul for Minotaur and bare claws for Wraith. Additive offline authoring preserves original creature surfaces/maps/weights and old clips. Twelve new clips per creature cover ready/gaits/attacks/guard/reactions/death/roll/kick. Maul front hand slides within reach; Wraith contact is derived from actual hand/finger vertices and includes its existing 1.5 presentation scale in the bake. Maul shove samples the haft, other attacks sample the stone head. New geometry/contact regression covers all new clips, exact baked/rendered paths, close hits and measured outer misses. Existing head-region grid now uses each weapon's actual timing instead of the sword clock; all previous expected regions remain pinned. All26 configured local gates passed, including real-game creature damage/death/rematch. Integrated draw-bell trunk e8670fa; full quality293/293 and both affected audio gates pass. Final front/side/rear pose sheets reviewed. Creature browser gate now selects full Chromium consistently with the combat gate; default headless-shell timing failures and diagnostics are retained. GitHub Actions did not start because of account billing/spending limits; no CI success claimed. Full contract and deployment receipts: artifacts/weapons/creature-weapons/. Public release authority remains release.json plus live/receipt.json; physical handset review remains owner-only.

## Finisher blood upgrade — 2026-09-19 (PR #165)
Owner requests substantially more blood at actual finishing wounds and floor spills beside the body. New fixed pool:160 ballistic droplets and80 growing floor stains, two draw calls; source locations follow neck/head, separated waist faces, jugular or chest entry/exit. Jets taper to drips and stop; red/dark/off and rematch apply. No simulation, input, GLB or dependency changes. CPU source/ballistic/resource checks pass; Integrated published Wraith c757d87 with its arm correction and creature guards preserved; Independent source/lifecycle and refined motion-frame review pass; small/large Decapitation, Opened and Quiet One red/dark/off/hold/rematch checks pass. Final24-command release validation and public receipts are maintained in artifacts/finishers/blood/.

## Wraith size feedback — 2026-09-19
Owner approves both creatures and requests Wraith +50% size. Scoped presentation change in spectral.ts scales the complete Wraith rig 1.5 about its floor, keeping weapon and wisps attached. Minotaur and all shared assets stay unchanged. Considered asset rebuild versus runtime uniform scaling; runtime scaling is the smallest reversible option and adds no geometry/download cost. Existing lifecycle test pins Wraith 1.5 and Minotaur 1.0. Simulation remains the Nightborn archetype: rendered weapon/body grow while collision dimensions and attack reach retain existing tuning; this is an explicit playtest limitation, not a combat rebalance. Camera/ground/grip and public-game checks recorded in artifacts/character/wraith-size/. Integrated Opened94d988a. Audit found root scaling raised light/thrust strikes above hero height; a Wraith-only upper-arm aim correction blends through wind-up/recovery and restores before each mixer update. Real-GLB regression pins torso-height contact, unchanged grip, zero-dt stability, exact1.5 rematch scale and guard reset. All configured gates and public parity are required.

## Opened waist finisher — 2026-09-19 (PR #163)
Owner explicitly authorized a horizontal waist separation: torso slides sideways and falls; legs hold briefly and
fall separately. Own-model static geometry is sliced and capped during loading/reset, outside the killing frame;
closed cut surfaces, original exterior maps, arms retained with torso, victim weapon released to the sand, cached floor supports.
Blood-off keeps the intact collapse. Red/dark/off changes and rematch restore the rig cleanly. Six-way deterministic
pool and journal option; early side camera and two timed landing cues reuse existing resources. No GLB, simulation,
input or dependency change. New creature bodies remain outside finisher support until their separate anatomy review.
Initial CPU checks pass275/275, lint/typecheck/build/audit, 8,933,674-byte worst-fight budget. Tests cover all six
humanoids, grounded halves, held pose, source geometry preservation, mode changes including late enable, and disposal.
First visual review rejected limb-propped landing and portrait crop. A bounded broad-rest-face search, cached floor
supports, one outer cut cap per half, and a wider/higher side view correct them. Stronger tests measure the waist
itself as well as floor contact. Lower-half pivot and resting orientation are fitted at the waist; the victim weapon drops flat independently. All-six CPU checks and Goblin/Pitborn/Nightborn/Executioner final image reviews pass. Corrected Veteran real-scene red/dark/off, portrait/landscape, reduced motion and
rematch checks pass. Integrated creature597ee849 retains spectral rendering and supportsFinishers guards before
both selecting and preparing the effect. The sixth Auto outcome exposed Quiet One large-rig portrait cropping at seed741; its lateral camera margin is widened and that exact real kill is pinned in the existing gate. Small/large, mode/reset/reduced-motion and arena-edge checks pass. Combined budget9,325,213 bytes gzip per fight. The complete23-command
contract includes Opened normal/large-rig scene checks and real phone-size UI victory/hold/rematch. Final integrated
validation, review, exact-head CI and public publication receipts are maintained in artifacts/finishers/opened/;
use public release.json as the served revision authority. Physical-phone feel remains owner-only.

## Reconstructed creature integration — 2026-09-19 (owner playtest)
Owner explicitly requests Minotaur and Wraith live in the game with actual pictures for playtesting.
Both approved reference images exported through signed-in official TRELLIS.2; raw GLBs and MIT software
licence retained in src/assets/source/creatures/. This supersedes the earlier no-export/art-only state below;
procedural and MPFB studies remain rejected. No paid job or new runtime dependency.

Added the two encounters after the five existing entries. Pitborn cleaver and Nightborn estoc simulation,
clips and exact weapon geometry are reused. Fitted intact A-pose surfaces have corrected inverse binds,
four normalized influences, 45k body triangles and original compressed textures. Including weapons:
Minotaur 45,611 triangles, Wraith 46,214. Wraith has graded transparency, moving wisps and 28 ash points.
Paired executions are disabled for these creatures; ordinary death/reset remains the fallback.

Audit caught and fixed A-pose binding mistakes, claw-to-thigh transfer and leg/shoulder seam stretching.
Visual review caught UV-island cracks missed by edge-only sampling: welding coincident vertices before decimation fixed them while preserving per-corner UVs. The Wraith donor arm angle/length/depth was fitted to its actual claw; grip proximity now passes all sampled armed/attack/guard poses. Isolated fur/cloth bend edges still flag 12–15cm stretch in the diagnostic; no runaway geometry is accepted, and final deformation polish remains an owner visual-review item. The formal
asset check validates base/source/generator hashes, exact animation channels and weapon geometry,
original map bytes, four-influence normalization, triangle ceiling and 125 finite poses per creature.
Integrated published weapon/auth/Quiet One/dust/audio trunk 5c46f46 while retaining every inherited completion gate.
Account encounter constraint migration adds the two IDs; local real-PostgreSQL saves and existing RLS checks pass.
Hosted migration applied with verified TLS; authenticated saves/revisions, invalid-opponent rejection, two-user isolation and anonymous denial pass. Test data rolled back. Exact receipt: lead checkout artifacts/account/live/hosted-creature-migration.md. First actual-game phone landscape/portrait tests passed both opponents: served rig hashes, attacks/damage, ordinary player death, rematch and zero browser/shader errors. Final welded/grip build visual pose review passed. All 20 configured commands pass on 819697e, including 277 tests, both real creature fights/rematches, existing finishers/weapons/audio, and account browser/database checks. Exact-head GitHub CI also passed. The final publish/live-model checks are recorded in artifacts/character/creatures/RECEIPT.md and PR #150; physical-phone and owner art feedback remain open.
Evidence: artifacts/character/creatures/. Physical-phone performance and owner art/playtest feedback remain open.

## Earlier character direction correction — 2026-09-19 (historical art review)
Owner rejected the procedural Wraith/Minotaur pilots as amateur. Installed and tested official MPFB 2.0.17
in Blender 5.2.1; editable macro/target sources, rig test and static GLB exports exist under
artifacts/character/mpfb-test/. MPFB test: Minotaur 29,436 triangles; Wraith 27,802 and BLEND transparency.
Both load in Three.js, but visual audit rejects them as final creature art. No Frankendom combat retarget claimed.
Owner approved newly generated seven-view reference sheets: integrated muscular bovine anatomy for Minotaur;
skeletal, crowned, wispy and semi-transparent Wraith. Prior solid-bodied Wraith direction is superseded.
Official free TRELLIS.2 generated a stronger Minotaur shape and 48 native preview frames. GLB extraction
failed on anonymous ZeroGPU quota; no exported TRELLIS mesh exists yet. Browser sign-in requested;
connected HF account does not automatically authenticate the local Gradio client or browser.
No Wraith reconstruction or production integration claimed. Recipes, source/licence hashes and current
gate distinctions: docs/character-pilots.md. All outputs remain local art-review material.
Revalidation: full quality (252 tests, lint/build/audit/budget/browser) and all six completion
commands passed; receipts in artifacts/character/mpfb-test/gates.json. These baseline checks
do not close the failed art acceptance or blocked GLB extraction. World release hold respected.

## Multi-character anatomy pilots — 2026-09-19 (character lane, NOT LIVE)
Owner authorized Wraith/Minotaur pilots, efficient shared production, an audit and previews for iteration.
Isolated `codex/01a0b8f7/main` from 15bea7e. Offline Blender maker and existing-viewer capture/judge create
editable component scenes and animated GLBs from committed Nightborn/Pitborn assets. No archive/API dependency.
No roster, combat, blade bake, live GLB, camera or finisher changes. All 24 original clips, inverse binds,
weapon nodes/meshes and original binary payload are preserved. Wraith retains the existing face UVs with a
bounded cheek sculpt; Minotaur has original head/neck/horn geometry. Full production art is not approved.
Audit caught initial 70k-triangle outputs; final Wraith 59,745 and Minotaur 57,207 stay below the existing
60k ceiling (including rigid weapons). Added draws: 2 and 5. The judge now enforces that ceiling and source/generator hashes.
Verification: full quality PASS (252 tests, lint/typecheck/build/audit/budget and browser), all existing completion
commands PASS; final pilot completion rerun after geometry fixes. Receipts: artifacts/character/pilots/.
Self-review covered payload/rig isolation then front/profile/rear, eight motion samples and phone framing.
Art verdict: useful first silhouette/fit studies, not A-grade final characters. Wraith still needs independent
face/cloth identity; Minotaur needs stronger anatomical planes, head/body material continuity and fitted kit.
Inherited human feet, no validated creature hit regions/finishers, unmeasured physical-phone performance.
Workflow and exact commands: docs/character-pilots.md. Owner reviews these before any roster integration/release.
## Polearm rear-arm visibility — weapons, 2026-09-19
Owner's rear/front phone captures exposed a second pose defect after PR157: the rear hand was authored on +X (the rig's left side), sending the right elbow through the torso. Both arms and their skin weights were present. Reauthored ready, gait, guard, attack and reaction goals keep the rear grip on the right side; the raised attack passes in front of the shoulder, and supporting-hand slides stay reachable. The shared polearm IK bends outward and forward while retaining the anatomical hinge constraint.

Both live rigs and the canonical scythe bake rig are rebuilt, with collision paths rebaked. New 120 Hz regression samples both upper/lower arms against the posed torso core in all clips; the old shipped rig fails it. Existing hinge, grip, contact-height, head-region and reach pins pass. Mesh attributes, material definitions, texture pixels and 2,354 non-arm tracks per rig remain unchanged. A new completion gate captures front, side and rear views at eight ready/gait/guard/attack poses. Initial full quality: 267/267 plus build/audit/budget/browser PASS; account-integrated CPU quality: 270/270. Integrated Quiet One and warm dust trunk 1ee616d, regenerated the three rigs with Death_QuietOne retained, and made its append-preservation fixture cover full exports and additive rigs. All 16 contract commands, final gates and release receipts are recorded in artifacts/weapons/polearm-rear-arm. Sentry FRANKENDOM-5 latest event is texture loading on 714e969; FRANKENDOM-6 is a stackless load failure on f7a1e99. Neither explains the reproduced offline pose; neither is claimed resolved. Physical-phone review remains owner-only.

## The Quiet One — 2026-09-19 (PR #159)
Owner authorized the next finisher: restrained neck reaction, left hand at throat, failing backward step, held beat,
knee buckle and right-side collapse. Additive `Death_QuietOne` on all six live fighters and four shelf/bake rigs;
2.4 s authored / 3.2 s presented, final pose held until rematch. The five-way deterministic rotation includes plain death.
Small animated neck wound reuses the existing pool, red/dark/off apply, earlier side camera exposes the held beat,
and existing quieter contact/voice plus delayed body/gasp cues complete the scene. No simulation or input change.

Original offline authoring in `scripts/build-quiet-one.mjs`, also called by the full warrior builder. Binary append
preserves all old clips, meshes, skinning, textures and weapon elbow repairs; preservation verified against f7a1e99
on all ten GLBs. Blade rebake is unchanged. Initial visual review corrected inward elbow, knee/foot ground clipping
and portrait crop; baked skin-envelope clearance accommodates each body. Initial full quality passes 268/268 plus build,
lint, dependency audit, per-fight budget and game browser. All-rig tests cover throat alignment, upright beat,
intact head, ground contact and held corpse; additive-builder test verifies preservation, idempotence and rejection
of a later appended clip. Camera edge/aspect tests include the new ending. Earlier rigid-clip comparison tests now
exempt only the separately authored Quiet One values while retaining clip names, tracks/times and legacy assertions.

Real-scene Veteran/Goblin/Executioner captures cover red/dark/off, portrait/landscape, reduced motion and rematch.
Final sequence video and phone UI/contract gate receipts: `artifacts/finishers/quiet-one/` and
`artifacts/character/quiet-final-scene/`. Two-pass review: pure simulation/input unchanged; then rendered poses,
continuity, modes and reset behavior. All 11 initial completion commands passed, including a real phone-size UI victory/hold/rematch.
A whole-body portrait bound now guards the large Executioner ending as an additional completion command.
Decoded audio QC verifies a silent held beat, late fall/gasp, cancellation and <= -1.54 dBTP fatal peaks;
Quiet One measures -12.2 LUFS against decapitation -10.7 LUFS on the integrated phone mix.
Integrated world/audio 03282b0, Google account e5339e9 and approved dust tint 6bf1399, preserving all account gates/settings.
Final combined checks, exact-head CI, deployment and live playback receipts are recorded in
`artifacts/finishers/quiet-one/`; public `release.json` identifies the served revision. The lead allocated this
release after AUTH FREE; later lanes must wait for its RELEASE FREE. Physical-phone feel remains owner-only.
Sentry inspection found existing asset-fetch/texture/WebGL issues (5/6/A/9/8 and older), not evidence about this
finisher at the time of inspection. No claim of a clean live error stream or public publication.

## Google account integration — lead, 2026-09-19 (live e5339e9, PR #152)
Owner requested Google login/Supabase with controls inside Field Journal. Added a lazy account SDK, PKCE login,
explicit cloud save/load of name and practice opponent, session sign-out, revision conflict checks and owner-only RLS.
Sign-in never overwrites device/cloud data; explicit load restarts practice. Career marks/results remain outside this
client-editable table. No combat, renderer or input code changed. Details/setup: docs/account-integration.md.

Integrated evidence at 30b5e48 (trunk 714e969): npm run quality passed 263/263, lint/typecheck/build/audit/budget
and gameplay browser; all nine additional completion commands passed. CI 35436347273 passed. Enabled account build:
8,486,798 bytes gzip per fight / 10 MB. Account browser uses controlled provider responses with the real SDK;
it does not prove live Google configuration. Screenshots/logs/receipts: artifacts/account/integrated-{0..9}.log,
browser-receipt.json, mobile-guest.png, mobile-signed-in.png and desktop-menu.png. Runtime addition: 161 lines.

Dedicated free project rxbewmzmovelckzoosss created by owner in Mumbai. Applied the checked-in migration via psql
with TLSv1.3 and verify-full using the official Supabase CA. Hosted transaction tested both users' own save/read,
cross-user read/write denial, anonymous denial, immutable ownership/revision, stale saves and constraints;
rolled back both test users and saves (zero profile rows remain). Receipt: artifacts/account/hosted-rls-receipt.txt.
Hosted site URL and exact /?account=return redirect saved and verified in dashboard. Public REST read without a user
session returns 401/42501 as intended. Ignored public production configuration and exact-origin CSP are prepared;
The exact Supabase origin is now installed in the Frankendom nginx CSP (backup retained); nginx -t and public header checks pass.

Failure ledger: F1 callback fixture wrote its PKCE verifier without SDK JSON encoding; corrected fixture and reruns pass.
F2 logout-failure test expected a retained session; verified current SDK deliberately clears local credentials even when
remote revoke fails. Corrected regression requires cleared tokens/cloud controls and failed-read retry; passes.
F3 world integration documentation conflict resolved preserving both lanes; combined quality and CI pass.
F4 Safari multiline SQL entry was unreliable; nothing executed, switched to exact-file psql migration.
F5 system CA rejected the pooler certificate; official dashboard CA with verify-full fixed it (TLS not weakened).
F6 focused test was invoked with absent tsx loader; corrected to this repo's native node --test runner: 3/3 pass.
F7 / review F1: adding the exact Supabase CSP origin in 51597f8 invalidated the old three-source monitoring
assertion. Its local/CI failure supersedes the earlier runtime pass for that revision. Updated the test to pin all four
sources exactly (self, blob, the specific Sentry and Supabase origins); added the configured release success case.
Focused monitoring/config checks pass 4/4. Full contract rerun logs: artifacts/account/review-f1/{0..9}.log;
check the latest PR152 CI before integration. No wildcard, assertion removal or runtime behavior change.
Two-pass review covered ownership/concurrency/retry and mobile/desktop placement/guest startup. No new background task.

Activation: owner approved Google credential creation. Dedicated Google project principal-zoo-509110-v0 has a web
OAuth client with frankendom.com origin and https://rxbewmzmovelckzoosss.supabase.co/auth/v1/callback. Secret saved
only in Supabase; public settings confirms Google enabled. Email/password provider disabled. Public privacy page
added at /privacy.html and linked inside the journal. Google is In production with only OpenID/email/profile scopes.
Production CSP and all public assets were verified on live e5339e9. PR #152 merged after exact-head and merge CI;
all 12 configured commands and deployment quality passed (269 tests). Actual Safari Google sign-in, save, reload,
cloud restore and sign-out passed against the real services. Phone-size guest menu checks passed; physical-phone
login and separate-device recovery remain unmeasured. Authoritative receipt: lead checkout
`artifacts/account/live/RECEIPT.md` and PR #152 body. These supersede the earlier activation-pending notes.
Calibre untouched.

## Mixed, populated crowd and stronger foot sand — world, 2026-09-19
Colour follow-up: owner approved dust size, motion and one-second life but found it grey against the sand. Live phone step capture confirmed the mismatch; a muted golden-tan tint (`#b99a68`, previously `#c9b493`) now sits closer to the lit ground. Only the particle material colour changes. Close/portrait render review and existing lifecycle test pass; release receipts: artifacts/world/warm-dust-notes.

Owner accepted the softened colours and mixed crowd, then requested busy seating around all 360 degrees including the gate, and more visible one-second foot sand. Six subdued garment dyes (dusty maroon/charcoal navy/earth tones) and five body families are assigned independently using nearby-seat diversity before GPU batching. On 291 occupied seats, only 27/844 nearby pairs repeat a body and 10/844 repeat a dye. Every 30-degree sector has at least 24 spectators and 8 on the lower two tiers; rubble, arch lip and flames retain clearance. Tread height follows tessellated stone; actual support raycasts and full-vertex play/camera clearance checks pass. Arena 114,440 triangles / 120k, unchanged meshes and 11.01 MB textures. Physical phone timing remains unmeasured.

Foot sand uses a 48-point pool, five larger denser particles per plant, low lateral curls with drag and a 1-second fade. Idle, combat-pose suppression, teleport rejection, hit-stop and disposal remain intact. Lifecycle check verifies the longer tail and lower-leg height. Existing world preview now captures 12 sectors plus normal portrait dust on/off. Focused arena/dust 11/11, lint and typecheck pass; all 12 sector renders and stronger dust at portrait combat distance reviewed. Full contract, CI and live receipts are tracked under PR #156 and artifacts/world/mixed-crowd-notes. Integrated weapons f7a1e99 and its polearm browser gate; no fighter, combat, audio, camera or lighting edits from world.

## Polearm elbow correction — weapons, 2026-09-19
Owner reproduced inward, twisted elbows on the Executioner and Veteran in the live game. Their correct polearm gait clips were already selected. Offline IK used reversed left/right bend poles for this rig and shortest-arc bone aiming left axial roll unconstrained. Polearm-only authoring now places elbows outward and aligns the anatomical hinge from the library stance; sword authoring and all combat timings stay unchanged. The Executioner slides his supporting hand down the haft during the raised wind-up to stay within reach.

Both live rigs and the canonical scythe bake rig are rebuilt, with collision paths rebaked. A 120 Hz shipped-rig regression checks every polearm clip for hinge direction and front-wrist distance, plus outward elbows throughout ready gaits. Original shipped rigs fail this regression. Mesh attributes, material definitions, texture pixels and all 2,354 non-arm animation tracks per live rig are unchanged (procedural PNG compression bytes vary on rebuild). Close-up render evidence and validation logs: `artifacts/weapons/polearm-elbows`; delivery is tracked in PR #157. Integrated camera/audio trunk `a8e72e6`: full quality 265/265, build, audit, budget and browser PASS. New real-game desktop/phone-viewport polearm gate verifies served asset hashes and actual polearm playback. Physical-phone validation remains owner-only.

## Crowd variety and foot sand — world, 2026-09-19
Owner requested subdued ruby/navy/brown/grey and other muted clothing, stronger sizes, lower-tier audience and restrained grounded foot sand. Six garment-only dyes preserve skin; separate trousers, two stances per five roster families, independent height/build variation. 219 spectators redistribute across five tiers with gate/flame/collapse clearance. Initial render rejected bright clothes and matching trousers; refined captures in artifacts/world/crowd-dust-final. Arena 9/9 and dust lifecycle check pass; full contract receipts in artifacts/world/crowd-variety-notes. Arena 26 measured draws,92,126 triangles,11.01MB textures; physical phone p95 remains owner-only/unmeasured.

Presentation seam coordinated with lead: cached animated feet feed a 24-point pool, one transient draw, 0.55s fade, no idle or combat-pose emission. Real walking-clip preview verifies emission and expiry; hit-stop, teleport and disposal verified separately. No audio/combat/fighter asset/global light edits. All eight local contract commands passed, including npm run quality (260/260 tests), both finishers, roster, audio, estoc, counter and world render checks. Delivery tracked in PR #151; exact merge/deployment and live receipts are kept in artifacts/world/crowd-variety-notes.

## World polish — 2026-09-19 (world/crowd-grounding-light; local, not yet shipped)
Owner approved four sequential passes: roster spectators, settled debris, softer gate light, selective masonry staining.
Step 1: replace the narrow crossed cards with five opaque instanced body silhouettes: human, goblin, Pitborn, executioner, Nightborn. No fighter assets, animation clips or gameplay changed. Irregular gaps and slight depth/yaw variation; existing bounded crowd reactions retained. First judge rejected boxy torsos; refined rounded bodies, darker clothes, hair and robe silhouettes. Arena tests 8/8; first full quality 246/246 + browser gate passed; refined geometry typechecks and arena tests pass. Fixed-camera captures: artifacts/world/polish-1-crowd-refined. Cost: 88,798 triangles / 120k, 21 measured arena draws (+1), 11.01 MB textures (-0.35 MB), floor luminance 0.105 unchanged. Physical phone performance remains unmeasured.

Step 2: settle curved shields, helmet and snapped shaft into the sand; small rubble and pottery gather around three existing column drums. Preserve all five separated in-ring gear sites. Dust uses existing iron vertex colours only, no wear decals. Arena 8/8, lint/typecheck and fixed-camera debris + duel review pass; play/clamp bounds hold. Captures: artifacts/world/polish-2-debris.

Step 3: soften the existing gate shaft through a broader feathered falloff, low-contrast bar interruption and lower peak; warm ground pool and geometry unchanged. Arena 8/8, fixed gate/duel captures reviewed (artifacts/world/polish-3-gate); zero texture/draw/triangle growth.

Step 4: localized dirt at the wall foot and tapering soot above the braziers, baked into existing vertex colours; 552 extra wall triangles keep stains near the ground. Stone albedo/normal pixels unchanged. Arena 8/8 and fixed-camera review pass (artifacts/world/polish-4-masonry). Final local npm run quality: 246/246 + real browser + dependency audit + budget PASS. World preview now runs as a completion command: node scripts/arena-preview.mjs --label quality-world (passed). Final arena: 89,482 triangles, 21 measured draws, 11.01 MB textures, floor luminance 0.105. Two-pass self-review checked clearance/reaction/disposal and fixed-camera materials/readability; no audio, combat, fighter assets, global lighting or camera edits. Integrated trunk 32f783e (roster and Split Crown) preserving both completion commands. Integrated npm run quality: 250/250 plus real browser, audit and budget PASS; all three completion commands (roster routes/migration, Split Crown modes/rematch, world captures) PASS. CodeGraph refreshed in the isolated worktree. PR #145 initial CI passed; integrated newly merged estoc d3114a9 and preserved its completion gate. Revalidation/release receipts pending in artifacts/world/polish-notes.
The subsequent estoc integration passed full quality and all four completion commands. Integrated counter release 3bfb0eb, preserving its browser gate; counter release verified by its lane and window released. Integrated lead 0c7b03f, preserving its Season 1 state. World owns the next release window; final combined gates/live receipts are recorded in artifacts/world/polish-notes.



## Season 1 scope and material cleanup — lead, 2026-09-19
Owner chose Recruit → Origin as the complete Season 1 core, with the RPG endgame built after launch. Canonical scope is
in GAME_SPEC.md; docs/progression-direction.md records future choices, persistence/result boundaries, migrations,
release checks and lane ownership. No stat rebalance, build allocation, inventory, purchases or backend is implemented
by this change. Recoverable identity/career persistence and physical/external-player gates still precede a progression launch.

Code-quality review: the earlier roster foundation already fixed scattered weapon defaults and health reporting. This
pass moves repeated warrior material values into one offline palette, preserving existing appearance and the Executioner's
matte overrides. Broad main/input splitting and a new item framework were rejected as churn without a current requirement.
All six fighters' four material constructors and final material GLB output compare byte-for-byte with the pre-change code,
both with and without authored maps (12 cases). This is material-pipeline equivalence, not a full geometry rebuild.
Source art needed for a complete UAL2 rebuild is absent in the lead source directory; shipped GLBs remain unchanged.
Local validation at the initial base: npm run quality passed (250 tests, lint/typecheck/build/audit, budget and browser);
roster and Split Crown completion checks passed. Evidence: artifacts/lead-quality/. Lead reported integrated 251/251 full quality and roster/Split Crown/estoc/counter completion gates PASS; #148 CI passed and merged as 0c7b03f. Included in the world lane combined release; live receipts pending in artifacts/world/polish-notes.
Two-pass review: preset identity/isolation and unchanged simulation/input; then authored-map precedence, dye retention,
matte overrides and browser/render/persistence gates. No new runtime dependency or module added.

## Button-consistent parry counters — weapons, 2026-09-19
Owner authorized fix and deployment. After a successful parry, Slash selects `slash_riposte` with each weapon's cut clip
and a separately baked collision path; Stab retains `riposte`; Heavy retains `heavy_riposte` (or the earned posture critical).
The counter cut keeps that weapon's existing riposte damage, stamina and timing. The scythe reap retains its 1.4 m dead band;
the trident counter sweep uses its low direction. Ordinary blocks still yield normal Slash/Stab and the existing Heavy counter.
No new control or GLB. Field Journal now describes the actual buttons. Audio's fixed thrust exchange explicitly presses Stab.
Verification: real-touch browser captured the hero's Slash/Attack/24, Stab/Riposte/24 and Heavy/Heavy/30 after actual parries.
Regression checks all light inputs, Stab and Heavy after a real parry, reward consumption, costs, damage and ordinary blocks.
Restoring the old forced-thrust selector fails the regression. Render/bake tests include the new path across weapon families.
The first full run exposed two old assumptions: the AI opener filter counted earned counter cuts as ordinary openers, and
an audio fixture pressed Slash to request its fixed thrust. Those fixtures now name the correct moves; focused 83/83 pass.
Integrated full quality passes 250/250 tests, lint, build, audit, budget and the shared browser gate. Estoc #142 is merged
as d3114a9 with Split Crown #144 preserved. All earlier blade tables are byte-identical; only the new counter paths are added.
Completion and release receipts: `artifacts/weapons/counter-buttons/`. Public deployment remains pending.


## Split Crown visible skull split — 2026-09-19 (finishers lane, local gate passed)
Owner approved a skull-only centre split: the halves open slightly and the body collapses intact. Work is isolated from
both the lead checkout and the unfinished Run Through alignment worktrees. Runtime path: real Killed event → existing
selection/clock → `characters.splitCrown` → `skull.splitSkull`; no simulation, weapon data or GLB changes.
Selected triangle clipping with closed cut faces from the existing head bake; rejected a blood-only decal (no silhouette
change) and shader-only separation (faces bridge the gap). The split follows the Head bone as a sibling, using the victim's
own exterior materials; blood off restores the intact head, red/dark toggle the cut, rematch disposes the split resources.
Discovery: three Semble queries plus CodeGraph impact review, with direct review of the sever/rematch and scene seams.
Checks: all six shipped rigs pass geometry/mode/rematch/decapitation regression checks. All five opponents pass real-scene
phone/landscape/rear captures, mode cycling and rematch. Before integrating roster #143, full quality: 247/247 tests, build, audit, 8,361,824/10 MB budget,
Playwright gate PASS; dedicated finisher completion gate PASS. Added the translated/rotated, pre-render head-bake regression.
The initial timed-parry browser failure under concurrent capture load is closed by a full isolated quality pass.
CodeGraph refreshed; two-pass review covered geometry/resource isolation, render placement and browser cleanup.
Evidence: artifacts/finishers/split-crown/REPORT.md. Physical iPhone performance and owner visual acceptance remain unclaimed.
Existing Sentry issues 6/A/5/9/8 concern fetch, texture loading and WebGL initialization; no skull-split event predates this
change. They remain unresolved and outside this visual feature's scope; this change does not claim to repair them.
At the Split Crown release, Run Through remained separate. Its repair is recorded in the Run Through section below;
the inherited failure and earlier partial alignment worktrees remain preserved as historical evidence.
## Estoc A activation — 2026-09-19 — PR #142, NOT DEPLOYED
Weapons branch `weapons/estoc-live`, based on trunk `d383b66`. Variant A is built on the current Nightborn,
with matching render/bake GLBs, manifest entry, real ESTOC data, rebaked paths and flipped shelf receipts. Existing clips,
body geometry and textures preserved; all five other weapon trajectory tables unchanged. Preview `--azimuth` added.
The longer point initially registered head hits on the upright Nightborn. The estoc part now carries a 10-degree grip tilt,
composed with the hand attachment by the builder. Only WeaponDrawn's quaternion changes in the GLB: geometry, animations,
textures and every other node remain identical. The unchanged head-region rule passes; no contact remapping or clip edits.
A new real-duel regression checks non-head contacts and measured cut/heavy/thrust frontiers of 2.0/2.5/2.3 m.
Restoring the old blade paths makes that regression fail. The .75 thrust share remains necessary: .70 still fails the unchanged
roll-and-punish cap (3/24 untouched); .75 passes both fairness batteries. AI-vs-AI median 20.9 s, hero wins 9/24.
No AI, damage, timing or spacing edits. Full `npm run quality`: 246/246 tests, build, audit, budget and browser gate PASS.
Estoc browser completion verifies the served rig SHA, WeaponDrawn, portrait/landscape layout and an opponent hit.
Evidence: `artifacts/weapons/estoc-live/` (logs, browser JSON, probes), `estoc-aim/` (reviewed captures).
Lead owns roster integration and deployment; no weapons-lane deployment was attempted. Physical-phone validation outstanding.
Sentry still has earlier unresolved load/texture/WebGL issues (6/A/5/9/8); this unshipped branch cannot resolve those.


## Roster foundations — lead, 2026-09-19
Owner approved the GPT Pro content-reuse direction. Work on `lead/opponent-catalogue`, based on d383b66.
One typed recipe catalogue supplies identities, bodies, archetype references and weapon defaults. All five serialized combat definitions deep-equal the pre-change baseline; combat, timings, rigs and introductory order are preserved. Executioner default build resolves to scythe; shelved estoc still resolves to its shipped sword until the weapons lane activates it.
Encounter selection is separate from optional career marks. Existing guest ID/name and legacy opponent rung survive migration; saves retain a legacy alias for safe rollback. No marks are awarded and no server persistence/recovery is claimed. Scorecard now uses actual fighter health ceilings.
Ownership and the two-opponent/six-opponent sequence: docs/roster-pipeline.md. Estoc PR #142 and Run Through alignment remain their lanes' work, not included here.

Current-task verification ledger:
- F1: camera tests rejected the initial Vite-only asset glob. Replaced with Node-compatible URL construction; camera 3/3 pass.
- F2: graphics harness lacked the new real catalogue module. Wired it into the harness without changing assertions; 27/27 pass.
- F3: shared browser gate confused enemy kick HUD text with the player's kick. Actor/target events and exact HP reconciliation replace the 335 ms text guess. Enemy counters alone cannot pass; bounded attempts require an accepted, completed player kick. Full quality browser run passed with actor 0 AttackStarted → AttackMissed, no page errors; repeated/public verification pending.
- F4: new roster browser harness initially used the software headless-shell path and stalled; stopped only that owned browser and matched the shared gate's real Chromium executable. Corrected roster browser rerun passed all five opponents, two rigs per route, save migration and zero page errors.
- Focused catalogue/profile/ladder/scorecard: 12/12 pass; rollback migration separately 5/5. Full final npm run quality passed: 248/248, lint/typecheck/build/audit and browser; 8,361,205-byte per-fight budget. Release receipts pending.
- Sentry inspected: FRANKENDOM-A is an unresolved texture failure on old release 9587019 (2026-09-18); current catalogue checks do not prove that historic issue fixed. Load/GPU issues stay open. Hardware/external-player gates unchanged.


## Arena life — 2026-09-18 (world lane, owner's picks #1–#5)
Owner: "anything else we can add to make the environment more engaging?" — approved five, built in order, each audited
(tests + captures) before the next. Sound left to the audio lane. **Ash motes**: 220-Point cloud, per-pixel sprite, slow
two-frequency drift + a gust on landed blows (`motes` — Points, not Mesh: the solid-geometry rules are about camera
collision); first pass was invisible at 5 cm/35 % — the brick's luminance noise floor — so 0.14 m, light-toned, reads as
dust. **Firelight**: `fireGlow` warm vertex tint on wall+tier bands above each brazier (angular proximity × height
window; static — the coals' emissive flicker carries motion). ~~**Battle-worn sand**~~ — owner rejected the decals on
review ("3 i dont like"), dropped pre-merge; the `sandWearAtlas` lessons (decal albedo must land below sunlit sand,
≈0.8×) are recorded here in case the idea returns. **Fallen gear**: dented
helmet, snapped spear, broken blade in the iron merge (zero draw calls), yaw-only + low (camera-clamp rule). **Gate
light**: the low sun spills through the arch — beam rides the real sun direction but lives inside the passage (r ≥ 11.7;
the contract caught the first cut at 11.35 m) fading to the floor, plus an additive warm pool where it lands (y < 0.5 is
exempt). Cost: 21/40 draw calls, 21.2k tris, 11.71/12 MB textures. Captures: `artifacts/world/arena-life-*/`.

## Flames frayed — 2026-09-18 (world lane, owner's art direction)
Owner, from the phone, after flames-fatter (PR #106): flames are ~50% of the pot, too pointy, too clean — "more like 70-80% of
the pot size… less pointy at top… more frayed/jaggy, separated a bit… gritty and realistic, not fake cartoony". `flamePixels`
(textures.ts) reworks the silhouette only (quad, anchors, palette and wave motion untouched): body width 0.65 → 0.88 with a
blunter profile (pow 0.5 → 0.42), two noise slots that drift apart with height split the upper flame into separate tongues,
high-frequency fray bites the silhouette harder toward the tip, the tip dies in a ragged noise line instead of a point, and a
per-pixel grain keeps the colour gritty. Measured on the brazier close-up: 145 px vs the 200 px pot rim (72%, was 55%).
Contract 226/226, zero draw-call/triangle/texture delta (+509 B source). Captures: `artifacts/world/flames-frayed/`; brazier
close-ups (new `scripts/arena-closeup.mjs` harness — the wide/lock views render flames at ~15 px, too small to art-direct):
`artifacts/world/flames-2-closeup/`, `flames-fatter-closeup/`, `flames-frayed/brazier.png`.

Objective: live responsive longsword practice on frankendom.com, with canonical persistent-fighter RPG direction.
Success: draw/strike, light chain/heavy/riposte, dodge/roll, directional block/timed parry, stamina, moving/guarding warden, player defeat/rematch; functioning movement/camera and saved guest identity; isolated verified HTTPS deployment. No claim of a passed player/hardware or online-combat gate.
Scope: GAME_SPEC.md. Semble discovery is working; CodeGraph was initialized with owner authorization on 2026-09-13. Use both for code work, and run `codegraph sync` after edits.
Files: src/{main,scene,sim,profile}.ts, src/style.css; tests; scripts/deploy.sh; deployment vhost.
Do not inspect/change other business products or existing VPS services.
Selected approach: Vite + TypeScript + Three.js static build, no framework/backend. Babylon and native web exports rejected for additional surface in this bounded gate.
Known risks: no physical minimum-phone tests or external player feedback yet; character art is an early original pass; server storage and actual PvP belong to 0B. VPS had ~1.3 GB free at discovery; deploy only a small static build and do not clean unrelated data.
Next validation: pure simulation invariants, storage failure/reload, touch cancellation, camera edge positions, rendered desktop/mobile layout, public HTTPS and source parity.

## The Executioner — fifth opponent, v5 — 2026-09-18 (character lane, owner brief; NOT SHIPPED — branch `char/executioner-v1`, PR #111 owner-approved, merge pending)
The owner's brief (7 masked reference portraits, `artifacts/source/face/executioner/reference/`): a giant headsman — iron
half-mask riveted over nose/cheeks/mouth, ragged hood, buckle harness, ~20 % over the Pitborn. v5 (owner, 2026-09-18, on
approving the PR visuals): his skin is DARK CHOCOLATE, mid-African — "not full black" — where the v1–v4 stand-in shipped him
white/olive like the Veteran. `skin_mul (0.66, 0.55, 0.46)` paints the body and the new `photo_mul (0.66, 0.55, 0.46)`
tints the STAND-IN photograph (applied after delight, before the neck band, so the collar ring the body continues is the
tinted tone) — one factor both sides, so the hue stays matched; body bakes to median sRGB (94, 60, 40), the face tile to
(80, 51, 35). The mask/hood could not go to
the KeenTools scanner (it would bake iron and cloth into the skull), so a bare-head 7-angle portrait set was generated to the
handover spec (`artifacts/source/face/executioner/executioner-01..07.png`) and uploaded — then `/process` returned 402
Insufficient credits, same block as the Nightborn (owner declined the €11 top-up there). The head ships as the STAND-IN (the
hero's scan, nightborn precedent): `head.FIGHTERS.executioner` (chin off — the jaw lives behind iron; buzz 0.14) records the
one-command resume, avatar `01a0b094-dcd8-7792-835d-5bdb88f42cf6`, no re-upload needed. decimate 0.08, far below every other
fighter: his face is never seen (eyes/brow are separate meshes, skin normal baked from the full-res head) and the v3 head at
the Veteran's helmed 0.26 broke the 60k skinned-triangle ceiling (61,363; 0.20 still shipped 60,827) — v5 ships 53,839.
Registrations: `parts.KIT.executioner` (charcoal linen (0.16, 0.15, 0.17) — above the 12 % phone floor; grime 0.85;
build + brute; greaves, boots, helm slot), `build-warrior BUILD.executioner scale 1.36` (owner: "20 % larger than Pitborn",
no hunch — he stands straight; numerically verified against the pitborn GLB), runtime `OpponentId` + `OPPONENTS.executioner`
(longsword placeholder, health 160, poise 12, `PROFILES` — the combat lead owns his real profile; he fights the Veteran's
brain until then) + `OPPONENT_GLB`, and the LADDER: fifth rung after the Nightborn (owner, 2026-09-18 — src/ladder.ts;
characters/graphics/ladder tests enumerate him). Kit parts authored in `parts.py`:
`executioner_mask` (iron half-mask raycast-fitted to the face, Steel, ships via the Helmet slot) and `executioner_hood`
(ragged hood, Heraldry near-black, ships via the Crest slot so it survives the mask's Helmet replacement); pteruges dye
near-black; NO tusks (they are the Pitborn's). v3 on the owner's v2 review: the hood's throat bib is CUT (it read as a
floating black plate on the sternum — the throat is bare under the mask now) and the greaves are blackened iron, a dark
baseColor factor over the bronze map. v4 on the owner's v3 review: the mask and greaves read darker-and-shinier than the
hood ("fake") — `finishMaterials` now drops the ORM map for Steel/Bronze on HIS GLB only and lands scalar matte factors
(metalness 0.45, roughness 0.88), greaves baseColor `#4a4239`; every other fighter untouched. Also v4: the Jog flight bound
in tests/characters scales with the fighter's scale k (probe: man 0.285, pitborn 0.323 @1.13, goblin 0.193 @0.835,
executioner 0.379 @1.36 — the fixed 0.32 only survived on the Pitborn by 12-frame sampling luck). Evidence:
`artifacts/character/executioner-v1/` (baseline audit), `-v2/` (mask + hood + near-black kit), `-v3/` (no bib, black
greaves) and `-v4/` (matte iron), `-v5/` (dark-chocolate skin — the approved look; turntable, details, gameplay
portrait/attack, faces, sequence); executioner.glb 6.22 MB
raw, 21 clips, per-fight budget PASS. Gate: green at df0e4e3, after the 1afa0cb trunk merge, on v3 (9d26d9a), and v4/v5 node
tests 227/227 (characters triangle + scaled-flight assertions included). Not done: the real KeenTools head (one top-up +
one command), his real weapon (weapons lane — the sword on his back is theirs), his combat profile (combat lane), mask
rivets/perforations (texture-level).

## Flames fatter still — 2026-09-18 (world lane, owner's art direction)
Owner, from the phone, after flames v2 (PR #104): "fire fatter still, still only 50% of pot size". The flame quads widen
0.95 → 1.3 m (`arena.ts`) and the texture body 0.5 → 0.65 (`flamePixels`), keeping the ragged tongue and wave motion. The wider
quad's vertices (with the lick scale) reached 11.49 m — inside the 11.5 m camera clamp — so the flame anchors move
`wall.inner + 0.42 → +0.55`; the 13 cm offset from the coal pans is invisible. Contract 7/7, zero cost delta. Captures:
`artifacts/world/flames-fatter/` vs `flames-2/`.

## Stone relief: the wall gets its surface — 2026-09-18 (world lane, owner's art direction)
The owner, from the phone: the masonry colour is right but the wall reads flat and machine-smooth — "add some dents, or bits, or
other surface imperfections randomly". The diagnosis: the wall had albedo only, no light response; the sand reads real because it
has a normal map. `stoneNormal` (textures.ts) carves the relief the albedo prints: the ashlar layout is extracted into `ashlar()`
and shared (the albedo is proven pixel-identical by checksum — the owner-approved colour is untouched), so mortar grooves,
proud/recessed blocks, chamfers and the albedo's own cracks land exactly on their printed lines, plus erosion undulation, surface
tooth, two layers of pitted dents and knocked corners. The stone material gains the normal map at scale 1.1. Cost: +1 texture,
11.0 / 12 MB texture memory, +0.8 KB source gzip, zero draw-call or triangle growth. Contract 7/7, full gate + real-browser gate
green. Captures: `artifacts/world/stone-relief/` vs `polish-4/`.

## Finishers & gore milestone authorized — 2026-09-17 (lead, owner's call)
The owner authorized the finishers milestone the 2026-09-13 blood layer deferred ("mortal kombat closers, but gritty,
realistic"; the flat fall-backwards death is the target). Spec: GAME_SPEC.md "Owner-authorized finishers & gore —
2026-09-17" — selection is a pure function of the deterministic `Killed` event (victim/location/move/heading +
weapons), simulation untouched (`RULES.death`, the 220 ms Killed hit-stop, "death has no tail" stand); six v1
finishers (Split Crown, Run Through, The Quiet One, Opened, Hamstrung, Execution); a slow camera push-in over the
death window authorized (no cuts/FOV punch/slow-mo); gore upgrades on the existing pooled systems under the
red/dark/off modes; the 21 clip names/durations stay frozen, finisher clips additive (`Death_*`); NO split
geometry/detachable limbs in v1. Budget: per-fight cap 9 → 10 MB gzip in `scripts/check-budget.mjs` (11 MB needs
further owner sign-off); mesh compression (~half) is the approved later lever. The roadmap deferral line drops
finishers and wounds. Handover brief for the new lane: `artifacts/character/BRIEF-finishers.md` (suggested lane
`finishers/gore-v1`, ship Split Crown end-to-end first for the owner's phone judgment). No code, asset or behaviour
change beyond the budget constant.

## The Nightborn's face — the no-credits pass — 2026-09-17 (nightborn lane)
The owner spotted the Nightborn shipped with a borrowed face (the stand-in: the hero's KeenTools scan, credits exhausted at 402) and
declined the €11 top-up for now — "try the free version." The stand-in is RESTYLED to his owner-locked identity on its own texture,
no new assets, no scan: `head.FIGHTERS.nightborn` gains `skin_mul` (1.28, 1.35, 1.50), `pallor` and `dark_eyes`. The photographed head
is restyled in `keentools_head` on `filled` (position grids from normalised vertex-group bakes, the az_c/az_s pattern): skin paled
grey-white and cooled with the dark features keeping their ink, the buzz and the synthesised crown strands gone cold black, the
photographed stubble melted into the surrounding skin, the eye sockets sunk, a thin old scar across the throat 2.5 cm under the chin
tip; `eye_colour` takes the iris toward black and halves the sclera lift; `body_colour`'s own pallor block drains the body to match
(skin_mul alone brightened but stayed warm — tan shoulders beside a grey face). Pointed ears land as geometry: `parts.ear_points`
(`KIT 'ears': 'points'`), two 3 cm cones on the scan's own helix tops, rigid on `Head`, wearing the face's photo tile — the goblin's
`ears()` untouched. Not done, by design: the shoulder-length hair fall (REQUESTS #2 — a new part, and at the duel camera the black
buzz + pale face + black kit already carries him) and the unique KeenTools face (REQUESTS #1, ~€11, the flags restyle the real scan
the same way). Evidence: `artifacts/character/nightborn-face-v{1,2,3}/` (faces, details, gameplay stills, sequence.webm); v1 exposed
that the photographed face never took skin_mul, v2 the tan-body mismatch. Gate 224/224 + browser gate; blade paths byte-identical
(texture-and-ears only: no clip, timing, weapon or sim change); per-fight budget 8.36 / 9 MB.

## Rename: Origins Arena — 2026-09-17 (lead, owner's call)
The owner named the place **Origins Arena** (the world lane's three proposals — The Ashpit · Worldsedge · The Bonehollow — are
declined; REQUESTS #1 closed). *Ashcourt / The Old Keep* is retired everywhere player-facing: the place block reads
THE PROVING GROUND / Origins Arena (the eyebrow inherits the retired brand subtitle), the HUD opponent is ARENA WARDEN
(mobile label "Warden" unchanged; ladder rungs still override dynamically), the brand line and `<title>` carry the locked
game title **Frankendom: Origins**, and the stale "courtyard" strings ("Enter the arena", the WebGL fallback and recovery
messages, the loading line, the noscript) now say arena — the browser gate's two matching references and the audio
reverb's comment/function name (`courtyard` → `arena`, the impulse itself unchanged) moved with them. No runtime,
asset or behaviour change beyond strings. Gate + browser gate green on the branch.

## Arena v1 — The Ashpit — 2026-09-17 (world lane)
The courtyard is replaced behind the lead's seam (`src/arena.ts`, `scene.ts` untouched): a sand-and-gravel pit (owner's call: a
traditional coliseum floor, no tiles) to a podium wall whose inner face stands outside the camera clamp, a portcullis gate on the far
side with a dark passage, chains, six braziers with flickering emissive coals (no lights), eight torn instanced banners, five broken
tiers with fallen blocks, a ruined colonnade and parapet, 235 crowd silhouettes on the upper tiers that bob on a blow, lean in on a parry
and recoil on a kill (≤ 0.1 m / 8°, still in a hit-stop), an ash sky dome with one break of light and fogged mesas. Every texture is
generated at load from seeded noise (`src/assets/arena/textures.ts`; +9.8 KB gzip on the shell, 9.6 MB of texture memory, no
downloads, no licences). The seam gains `floor` (the sand mesh, planar UVs `x / 3, z / 3`) as the decal slot. Measured with the new
harness `scripts/arena-preview.mjs` (game renderer/lights/fog/lock camera, rigs at the start, settled camera; before/after in
`artifacts/world/{baseline,arena-v1}`): 263 → 12 meshes, 330 → 15 arena draw calls in the portrait lock, 4.4k → 19.4k triangles,
floor albedo ≈ 0.24 → 0.088 against the hero's skin sample 0.166 (fighters are now the brightest thing on screen). Contract
(`tests/arena.test.ts`, 7 tests, instances walked): exclusion volume, boundary ring, floor darker than skin with decal UVs, crowd
placement and reaction caps, ≤ 40 meshes / 120k tris / 12 MB textures; 5 mutations caught. Gate 223/223 + browser gate on the new
arena. Not done: phone frame-time and startup measurement (no route from the lane), lighting values (proposal), the rename — three names
proposed (The Ashpit · Worldsedge · The Bonehollow) in `artifacts/world/REQUESTS.md`; report in `artifacts/world/REPORT.md`.

## Arena seam for the world lane — 2026-09-17 (lead)
The courtyard moved out of `scene.ts` into `src/arena.ts` behind `buildArena(scene)`; `scene.ts` keeps lights, fog, tone
mapping, camera, the fighters, the target marker (its brass is the threat tell and is no longer shared with the banners) and
effects. `arena.update(dt, events)` runs each frame (0 dt while frozen) so the lane can hang crowd/banner reactions on the
event stream; `arena.dispose()` removes it. `tests/arena.test.ts` is the contract: play radius = sim RADIUS, no vertex above
the floor inside the play circle, no vertex between 0.5 and 6 m inside the camera clamp (11.5 m), a boundary ring at the
play radius, update/dispose, and a cost baseline (263 meshes = draw calls before merging, 4,424 triangles) — mutations
placing a pillar in the circle or moving the bays to 11 m are caught. Visual no-op proven at a static settled state:
0.00 % pixels changed portrait and landscape (artifacts/camera-ab, ignored); the fight-moment capture differs only by camera
settle timing. Gate 197/197 + browser gate passed. CI (`.github/workflows/quality.yml`, quality:ci on push/PR to trunk) was
added earlier today by another session (477f2c3) and is green. Brief handed to the owner for the world lane.

## Opponent ladder — 2026-09-16 (lead/shell)
Veteran → Pitborn. `src/ladder.ts` (LADDER order, `opponentFor`, `won`, `nextAfter`); the device profile gains an optional validated
`ladder` rung; `main.ts` picks the opponent from the rung (URL `?opponent=` still overrides for the harness), labels the HUD for a
non-Veteran, and after a clean win the Rematch button reads "Next: the Pitborn" — pressing it saves the rung and reloads so the next
rig loads; a loss or draw keeps the rung and offers a rematch (recorded as before). Goblin and Nightborn append to LADDER when they land.
Evidence: 182/182 gate; a draw-counts-as-win mutation caught; real-browser check (artifacts/ladder-check.mjs, ignored): fresh device
= ASHCOURT WARDEN/150, rung=pitborn = THE PITBORN/190 on his rig, a loss = "Rematch" with the rung kept, no page errors. The win→Next
→reload path is covered by the pure rules and the shell wiring, not by a scripted real-browser win. Harness note: the graphics
harness's default profile id 'test' fails the profile's 8-char rule and always boots a fresh guest; tests that need saved state pass a
valid id.

## Origins direction recorded in GAME_SPEC — 2026-09-15
Docs-only. GAME_SPEC.md now carries the owner-locked title (Frankendom: Origins), setting line, pitch, simplicity rule, art direction with the materials rule (retiring the ESO/Black Desert references), Origins list, opponent roster order, collection loops, five-stat model, locational deaths and NOT NOW additions, written to sit consistently with the 2026-09-15 Souls-slice principles (four principal controls, skill wins mismatches / builds win margins, readable brutality). Closes the character lane's REQUESTS.md #1. No runtime, asset or test change; quality gate on this tree: 94/94 tests, build, 0 vulnerabilities, budget PASS (fight-ready 6.57 MB raw / 3.44 MB gzip against the 5 MB limit — headroom is now ~1.5 MB after character pass v1). Stale uncommitted graphics-test edit from 2026-09-13 was saved to ignored artifacts/stale-graphics-framing-test-2026-09-13.patch and discarded; primary checkout fast-forwarded to the live revision.

## First release audit — 2026-09-13
- Runtime: Node 25.8.1 for local tooling; pinned Three.js 0.186.0, Vite 8.3.0, TypeScript. One production dependency. Browser needs WebGL2.
- Pass 1 (code/state): pure movement and bounded collision, normalized diagonals, input clearing on blur/visibility/cancel, textContent for guest names, storage failure handling, separated rendering. No secrets, engine physics, backend or unrequested combat.
- Pass 2 (behavior): guest name survived browser reload; rendered 390x844 and 844x390 controls fit without horizontal overflow; pointer-pad circling and release, camera toggle, journal and live renderer reviewed. Desktop rendering approximately 60 fps / p95 17–18 ms during these checks, not a five-minute phone benchmark.
- Regression found: clamping camera inside colonnade initially cropped the player at maximum separation. Raised locked-camera framing with distance. Projection tests now exercise near contact and all boundary angles across portrait/landscape; both capsule endpoints stay within the frame. Transient camera motion still requires human comfort testing.
- Automated: 11 tests, including 20,000 seeded movement inputs replayed twice, typecheck, ESLint, production build, full dependency audit (zero known vulnerabilities), shell syntax and payload budget. Three isolated mutations (diagonal speed, boundary clamp, guest write) were all caught by tests.
- Build payload approximately 140 KB gzip / 557 KB raw. Vite warns about a >500 KB raw JS chunk; intentional single fight-ready bundle avoids an unnecessary split. Measured total compressed payload is far below 5 MB.
- Live regression: the initial Nginx try_files accepted explicit files but returned 404 for /. Browser and HTTP checks caught it. Added directory/index resolution; deploy now compares both the public homepage and revision response byte-for-byte with the local build.
- Release fallback: macOS rsync rejected numeric chmod syntax on the first transfer; switched to portable symbolic modes. The failed attempt did not switch the live symlink. GitHub CLI account display was stale; verified the actual authenticated owner through the API before creating the private repository.
- Tooling: greenfield first write had no search corpus. Three Semble searches ran once code existed (movement, persistence, input/camera). No .codegraph exists; not indexed without owner decision. Early automatic hook dependency discovery failed before repository initialization; project-local tsc/ESLint are installed and actual checks now pass.
- Browser QA used CUA in-app browser. Viewport tests are not touch hardware tests. Real multitouch simultaneous run/move, OS interruptions, GPU context loss and unsupported-GPU entry are code-reviewed but not fully exercised on devices. Guest corrupted/blocked storage is covered by unit tests.
- HTTPS provisioned for apex and www using existing VPS ACME account and renewal timer. Isolated Nginx virtual host only; existing unrelated Nginx warning existed before this work. No Sentry project is configured for this new prototype.

## Run / release
- Local: npm ci; npm run dev. Verify: npm run quality.
- Initial hosting: bash scripts/provision.sh (frankendom.com only).
- Release from a clean committed checkout: bash scripts/deploy.sh. It validates, transfers only built assets, and atomically switches the site symlink. Public /release.json records the exact source revision.
- Rollback: on VPS, cd /var/www/frankendom; ln -sfn "$(readlink previous)" next; mv -Tf next current. Verify public /release.json after switching. Each source revision retains its own static release directory.
- Remote source: private DomLynch/RPG-game repository (previous origin preserved as legacy); verify local/remote HEAD and /release.json on every close-out.
- No recurring background agent or automatic development task is installed. The static site remains available between sessions.

## Still gated
- Physical iPhone 12 / Pixel 6 performance, five-minute sessions and independent player usability remain required before a validated combat-gate decision; owner authorized the bounded first-hit development slice below.
- A humanoid rig and four movement clips are implemented in the character pass below. Full combat animation coverage, online combat, recoverable identity and RPG progression remain deferred.

## Character art pass — 2026-09-13
- Owner authorized the free Quaternius foundation with original armour after an iPhone 15 movement spot check at 59 fps / p95 18 ms. This does not pass the minimum-device/external-player gate. Paid sourcing is superseded; no purchase or outreach occurred.
- Implementation: one self-contained CC0-derived GLB, original fitted helmet/plate harness/scabbard/heraldry and baked surface textures. Free Standard base narrowed by 10%; four retargeted clips (idle/walk/jog/run). Provenance, source hashes and rebuild instructions: src/assets/README.md; generator: scripts/build-warrior.mjs. No additional runtime dependencies.
- Rendering only: cloned independent skeletons share geometry/textures. Gaits follow actual displacement, including collision stops. Locked camera still frames the opponent; the body turns with travel during locomotion to avoid forward clips sliding sideways. Directional combat locomotion remains a later requirement. Pure simulation, collision and guest state are unchanged.
- Rejected approaches: hand-keying all locomotion would discard the coherent foundation; a runtime modular armour system adds unnecessary code/draw calls. Bake original armour into four skinned material groups offline instead. Geometry welding and removal of unused face morphs reduced the asset to 2.28 MB raw.
- Review pass 1: 17 tests cover prior simulation/storage/camera behavior plus normalized gait blending, actual shipped animated mesh bounds/foot contact, finite poses and independent skeletons. ESLint, typecheck/build, dependency audit and payload budget pass. Static output approximately 3.03 MB raw / 1.00 MB gzip; actual HTTP compression must be checked after deployment.
- Review pass 2: production-CSP preview caught blocked embedded textures. Add blob sources for model image decoding and validate required textures so a partial load cannot silently pass. Portrait 390x844 and landscape 844x390 were inspected; joystick release resets, camera lock works, journal opens/closes, and Aldren survives reload. Successful preview has no new console errors. A separate deliberately missing-model preview shows the retry message and retains capsule movement. Failure QA used an empty build DSN to avoid sending expected test errors to production monitoring.
- Browser preview reports about 60 fps / p95 17–18 ms on the desktop host. Physical iPhone 15 with this new asset, minimum phones, multitouch interruptions and five-minute thermal performance remain unverified. Art is an early original pass, not final AAA production art or full combat coverage.
- Release procedure: CodeGraph synced; 17 tests and final checks passed. Scoped Nginx texture/compression policy applied with successful nginx -t and active service. The first asset transfer hit a transient public SSH refusal before release switch; saved public key retry succeeded, Tailscale timed out. Deploy now reuses one bounded SSH connection for mkdir/transfer/switch. Public checks passed: homepage, revision, JS, CSS and GLB all HTTP 200 and byte-identical to the local build; local/remote/deployed revision matched and the checkout was clean. Active Nginx config matched the repository. Model compressed transfer: 827,457 bytes. Live portrait rendering, textures, camera lock and touch release were checked; no live console errors or release-matching Sentry issues at verification time. Detailed HTTP receipts are in ignored artifacts/release-audit.json.

## Monitoring and code discovery - 2026-09-13
- Authorized addition: pinned @sentry/browser 10.74.0, the second runtime dependency, for production error reporting. No gameplay changes, tracing, session replay or session tracking; request, user, extra and breadcrumb fields are removed before sending.
- Sentry project: na-wnr/frankendom. Build connection setting is in ignored .env.production.local (mode 600); .env.example documents setup. This is a public browser ingest key, never a management credential. Release script refuses an absent/non-HTTPS DSN and stamps errors with the committed SHA.
- Two new regression tests cover disabled configuration, selected integrations and real SDK event serialization/privacy. Browser auto-capture and live ingestion must be checked on release; unit tests alone do not prove ingestion.
- CodeGraph index is local/ignored, not a runtime dependency. Semble and CodeGraph are complementary discovery/structure tools; Sentry supplies runtime error evidence. Do not equate telemetry ingestion with validated gameplay.
- Release validation caught CSP blocking Sentry: the site now allows only its explicit HTTPS ingest origin, with a regression assertion and deployment configuration check. Browser auto-capture reached HTTP 200 after the fix; remote event lookup is a separate required verification. Total quality suite: 14 passing tests, typecheck/lint/build/audit/budget pass. Desktop/mobile renders were checked with blocked telemetry; software-rendered browser timing is not a phone-performance benchmark.

## First-hit slice — implemented 2026-09-13
- Owner explicitly authorized: sync baseline to DomLynch/RPG-game first, audit code/bloat, then implement the first convincing longsword hit. This overrides the no-combat-before-0A development restriction for this bounded local slice only; hardware/usability and full online-combat validation remain unpassed.
- Baseline complete: clean c4461da on MacBook, new private GitHub origin, VPS current symlink and public release. All 17 tests, lint, tsc/build, audit/budget passed. Homepage, JS, CSS, GLB and release HTTP 200 and byte-equal to dist. Nginx active/config check passed; live camera/model rendered with no console errors. Existing old GitHub remote retained as legacy. No empty commit needed.
- Required discovery BEFORE edits: three Semble MCP searches: (1) deployment atomic releases revision parity; (2) fixed timestep player input collision attack integration; (3) humanoid animation mixer sword clips asset generation. Results localized scripts/deploy.sh, main.ts, sim.ts, characters.ts, scene.ts and build-warrior.mjs.
- Required structural/impact evidence BEFORE edits: CodeGraph MCP explore query main.ts sim.ts characters.ts scene.ts scripts/deploy.sh scripts/build-warrior.mjs; then src/main.ts advance initialState clearInput frame loadProfile monitoringOptions. Reviewed live source and caller/test impact for advance, initialState, createScene, loadWarriors, clearInput and monitoringOptions. CodeGraph omitted top-level builder sections; read only missing sections directly. No fallback search required.
- Audit baseline: 403 TypeScript lines, 951 lines including CSS/scripts/tests (CSS is compact, LOC alone understates it). Two runtime dependencies. No broad rewrite warranted. Need freeze animations when simulation is paused and keep attack event delivery single-shot across fixed substeps. No new runtime dependency, physics, backend, item framework or visual-refinement scope.
- Alternatives: animation-owned damage rejected (violates fixed simulation); generic combat framework rejected (speculative); selected a small pure practice state composed with existing movement plus presentation driven by its ticks.
- Source clip inspection: Sword_Attack 1.533s, Sword_Idle 1.667s, Hit_Chest .333s, Death01 2.4s. Four coherent clips added to offline export; full 14-clip combat coverage remains absent. Sword now separate from scabbard for hand attachment. Need visual pose/contact review before release.
- Next validation: owner phone feel/performance, then scoped defensive combat. First-hit implementation, two review passes, tests, browser QA, index sync and publication completed below. Five-minute iPhone result requested from owner; cannot substitute desktop/browser emulation.

- Review pass 1 complete: simulation remains pure and composes existing movement. Contact tick 18 of 66 is checked against the actual exported blade crossing the target; input is consumed once per fixed step. Tests cover wind-up, recovery spam, range/facing misses, four-hit defeat, immutability and 10,000 seeded input replay. Three isolated mutants (repeated damage, ignored range, ignored facing) were all caught. No graph-edge dispute or unresolved structural bug required a separate Tree-sitter/ast-grep audit.
- Review pass 2 complete: portrait 390x844 and landscape 844x390; real UI controls produced an out-of-range miss, four close strikes reduced health 100 to 0, and Reset restored 100 health and Draw sword. Journal held health at 100 during an interrupted pre-contact strike, then resumed to 75. Animation uses paused dt=0. Production-CSP preview loaded textures without console errors; deliberate missing-GLB preview showed the error and disabled attacks while capsule movement remained available. Expected-failure preview built with empty DSN; release rebuild restores configured monitoring.
- Bloat audit: runtime TypeScript 479 lines versus baseline 403 (+76), still only Three.js and Sentry runtime dependencies. No new framework/service/package. Offline authoring adds a separate sword and baked draw clip. Removed continuous HUD DOM replacement; update only when displayed values change. Baseline CSS is already densely formatted, so physical LOC is not a standalone complexity score. First-hit asset bundle approximately 1.15 MB estimated gzip versus 1.00 MB baseline; final deployment checks measure actual compressed HTTP.
- Remaining limits: stationary local target only; no heavy/dodge/guard/stamina, opponent AI, network fairness, progression or full animation coverage. Five-minute physical iPhone result has not been received; minimum phones and independent testers remain unverified. Desktop browser spot checks ~60 fps / p95 18–19 ms are not phone measurements.
- Final pre-release checks: 24 tests pass; ESLint, tsc/Vite build, dependency audit (zero known vulnerabilities), gzip budget, shell syntax and diff whitespace checks pass. CodeGraph synced after the final test edit. Deploy phase receipt is now 0B-first-hit; this label names the slice, not a passed gate. No GitHub Actions CI workflow is configured; these are local release-gate results.

- Live release receipt: implementation 7a2ee74c53232b969c2028b262712a05bf7b9ffd pushed to DomLynch/RPG-game and published through scripts/deploy.sh. MacBook/remote/public revision and VPS current symlink matched; git status --porcelain empty. Public homepage, release, JS, CSS and GLB were HTTP 200 and byte-equal to local dist. Nginx active and nginx -t passed; scoped config SHA-256 ee8d847c8354e5cdf04b0171fbfad9d8dc797b91688640d14fef0c03f64fe7f1 matched local. Existing unrelated Nginx warning unchanged. Live portrait controls completed draw, approach, four hits, defeat and reset to 100 health; Aldren persisted. No live console errors or issues matching this release in Sentry at verification time. Detailed per-asset receipts: ignored artifacts/release-audit.json. A notes-only follow-up records this receipt; verify its final revision separately on close-out.

## Mobile zoom repair — 2026-09-13
- Request: fix the enlarged/cropped page after drawing, test it, then explain next combat steps. No authorization inferred to add kicks/defence in this repair.
- Discovery before edits: Semble queries (1) attack button pointerdown disabled state touch-action default gestures; (2) mobile viewport zoom responsive footer controls CSS; (3) cameraPose field of view draw phase resize render. CodeGraph MCP explored updateHud/requestStrike/cameraPose/src/style.css/index.html, showing the input-to-HUD path and camera independence from drawing. Read CSS/header sections not returned by CodeGraph. Existing playbook/session conventions already loaded; no repeated history discovery.
- Evidence: owner iPhone screenshot enlarges HUD and controls together. Live DOM after draw: attackButton.disabled=true, its touch-action=none but footer/root=auto. No draw-driven camera zoom exists. Sentry production/release aa668a2 query had no matching issues (absence of JS errors cannot diagnose native gestures). Native iOS double-tap itself is not reproducible on the connected desktop; the input-state transition was reproduced and the screenshot supplies the physical symptom.
- Candidate fixes: global maximum-scale/user-scalable=no rejected (blocks accessibility and is unreliable on iOS); camera changes rejected (HUD magnifies too); event timing hacks rejected (unnecessary global gesture listeners). Selected stable native hit target with aria-disabled plus guarded requests, and root touch-action:manipulation. Preserve intentional pinch zoom and dialog scrolling. No camera/sim timing/asset changes.
- Regression first: tests/input.test.ts failed against the original native disabled button. It structurally checks the HTML and TypeScript AST so the discarded touch target cannot silently return. Need real UI repeat-tap/layout/cooldown checks, full quality gate, index sync and verified release.

- Review pass 1: native attack disabled removed from HTML/updateHud/failure path; aria-disabled preserves semantics/visual state while pointerdown still prevents default. Shared pure canStrike gates both input admission and simulation; no queued repeats during draw/recovery, and loading/dead/paused guards remain. Root manipulation disables double-tap gestures without maximum-scale/user-scalable restrictions. No camera, weapon timing, new gameplay features or dependencies changed. ast-grep is not installed; the regression uses the already-installed TypeScript AST for this structural property-access audit. No disputed CodeGraph edge or performance hang required other diagnostics.
- Review pass 2: actual local browser at 390x844 and 844x390, draw/rapid repeated pointer activations, movement into range, keyboard F, journal scroll/Escape and rotation checked. During cooldown native disabled=false and aria-disabled=true; afterward aria-disabled=false. Two bursts of 24 rapid activations: distant burst missed, in-range burst dealt exactly one 25-point hit and stayed at 75 after recovery. Viewport scale remained 1, portrait bounds 390x844, landscape 844x390, no horizontal overflow or console errors. These are desktop/browser checks; no claim of reproducing/fixing native iOS zoom on physical hardware until owner retries. Pinch behavior is preserved by policy, not device-tested.
- Verification: all 27 tests, lint, typecheck/build, dependency audit (zero vulnerabilities), budget and diff checks passed. Mutations restoring native disabled and removing root manipulation were each caught. CodeGraph synced. Runtime growth is four TypeScript lines with no dependency additions; payload remains ~1.15 MB estimated gzip. Publication follows via the configured atomic release; final external receipt is kept in artifacts/release-audit.json to avoid a notes-only release cycle.

## Defensive practice — 2026-09-13
- Owner confirmed the zoom repair on iPhone and authorized defensive combat. This slice adds roll, guard/parry, stamina, player damage/defeat and rematch against a warden that holds its position and counterattacks. Heavy attacks and kicks remain later work; no online/AI framework or progression. Hardware/external-player gates remain unpassed.
- Pre-edit discovery: playbook loaded; three materially different Semble queries covered fixed-tick combat/damage, touch/keyboard cancellation/HUD, and rig/roll/guard sourcing. CodeGraph explored stepPractice/initialPractice/practiceHint/advance, main input, character animation and scene callers. No disputed graph edges or fallback search. Files outside this repo were not touched.
- Alternatives: generic mirrored actor/AI framework rejected for unnecessary scope; animation-owned damage rejected; selected compact pure defensive state composed with existing movement. Boundaries: fixed 60 Hz, no rendering imports in sim, same guest storage, stable native button hit targets, no new runtime packages.
- Rig audit: existing nine clips retained, licensed CC0 Roll retargeted with horizontal pelvis translation removed, original Guard authored on the same skeleton. Eleven shipped clips now. Guard impact/parry use existing reaction plus guard; bespoke impact/riposte/heavy clips remain absent. Asset provenance updated; no purchases.
- Pass 1 (simulation/input): commitment, one hit per swing, directional guard, fresh-press parry/cooldown, finite stamina, guard break, no queued roll spam, arena/target collision, defeat freeze and rematch reviewed. Defence input clears on blur/visibility/journal and cancellation; held guard resumes as a block after other actions, without creating a fresh parry. No native disabled attribute added to combat controls.
- Tests: 35 passing, including 12,000 seeded defence/order frames replayed with immutable-state/resource checks, boundary invulnerability checks and rendered-asset roll/guard bounds. Three isolated mutations (ignore guard facing, unlimited roll invulnerability, free block) were each caught and restored. ast-grep is unavailable; existing TypeScript AST checks cover combat-button structure. No slowness hang or disputed graph edge warranted profiler/Tree-sitter diagnostics.
- Pass 2 (browser): actual buttons/joystick/draw/roll checked at 390x844 and 844x390; scale=1, no overflow, all combat hit targets remain native enabled. Test-only ignored keyboard harness exercised held guard (100 health, stamina 100→75), fresh-warning timed parry (health 100), roll with Evaded feedback, held-input blur release, player defeat and real Rematch button restoring all resources/start position. Roll and guard poses inspected. Desktop render spot checks 60 fps / p95 17–18 ms. Harness synthesizes key input, not physical touch; no physical five-minute/min-device claim. One UI locator wait hit the browser adapter deadline; subsequent observed UI confirmed defeat normally. The reused iframe harness tab logged MutationObserver errors (no such call in project code or harness); a fresh standalone game tab had no console errors. Live standalone logs are checked separately.
- Bloat: runtime TypeScript 483→563 lines, two unchanged runtime dependencies. Added no application module, backend, UI framework or service. Asset +131,348 bytes raw; complete fight-ready build ~1.20 MB estimated gzip (previous ~1.15 MB). Vite's existing raw-chunk advisory remains; payload gate passes.
- Release: configured quality gate (35 tests, lint, typecheck/build, zero runtime vulnerabilities, payload budget), shell syntax and whitespace checks passed; CodeGraph synced and post-edit caller impact inspected; scripts/deploy.sh labels this slice 0B-defence. No VPS configuration change. Atomic rollback remains available. Final release/HTTP/asset/service/clean-tree evidence goes to ignored artifacts/release-audit.json. Temporary keyboard harness is ignored and not part of dist. No background development automation was created.

## Graphics interruption recovery — 2026-09-13
- Owner screenshot showed the explicit WebGL context-lost message; owner subsequently confirmed mobile works. This is a recovery repair, with no combat/visual-design changes. Scope: main.ts frame/input lifecycle, scene.ts generated environment resource, graphics regression tests.
- Evidence: Sentry FRANKENDOM-3, production release a83e2a77879a3ee2e889357f41ebd82ce2050e72, event edcefcaf6e404ecbbc6f77427a2f14fe at 16:40:21Z: shaderSource received an invalid shader during renderer shadow compilation. This establishes the failing render path, not the cause of the browser/OS GPU reset. Three's pinned renderer checks a deferred context-lost flag and rebuilds its internals on restore; project code canceled RAF permanently and never handled restoration.
- Before edits: three Semble queries covered context lifecycle, generated PMREM texture disposal, and pause/input/RAF. CodeGraph mapped createScene/frame/clearInput and impact; reviewed pinned Three renderer/shader source and Khronos handling-context-lost/extension documentation. Playbook already loaded this session. No graph fallback or disputed edges.
- Reproducer: ignored local graphics-qa.html uses the actual WEBGL_lose_context extension on the game canvas. Before the fix, lose then restore left the original error and stopped rendering. Selected in-place recovery over automatic full reload (loses fight state) or full scene recreation (unnecessary duplication).
- Pass 1: graphicsLost gates simulation and input, cancels RAF, clears held/queued actions and pauses HUD controls. GPU loss during a draw is handled without swallowing unrelated errors. On restoration, rebuild generated environment pixels, dispose old render target, lower existing pixel-ratio cap to 1, reset clock/accumulator and resume exactly one RAF. Failed/no restoration shows a real Reload game button after 10 seconds; no automatic reset loop. Combat state, profile and resources remain intact on successful recovery.
- Pass 2: genuine browser GPU loss/restoration recovered geometry, armour lighting/textures and controls. In-progress fight retained warden health 75, player health 100 and stamina 80 across recovery, with no reset/catch-up. Multiple loss/restore cycles tested; delayed restoration showed the fallback, and its Reload game button returned to fresh practice. Browser test harness is ignored and excluded from dist; physical GPU-reset origin remains unverified.
- Automated: tests execute the actual transpiled entry point with controlled GPU/RAF/timers and real combat modules. They cover repeated/reordered loss/restoration, paused state, input clearing, clock reset, shader-loss race, failed rebuild/fallback and propagation of unrelated render errors. The pre-fix entry and mutations deleting resume scheduling or recovery clock reset were caught. ast-grep remains unavailable; no profiler/Tree-sitter diagnostic is relevant to this demonstrated lifecycle failure. Final configured quality gate and index refresh follow before release.
- No dependencies, assets, combat values, VPS config or monitoring policy changed. Existing Sentry issue remains open pending real-world observation; absence of new errors is not proof that the browser will never reset its GPU. Public release and per-asset/service parity receipt is stored in ignored artifacts/release-audit.json after deployment.

## Combat feel upgrade — in progress, 2026-09-13
Owner authorized all three passes in order and one audit before completing each, then supplied Claude's review. Scope expands to combos/heavy/riposte, moving/defending warden and feedback; no online/build economy, purchases or dependencies. Candidates: cosmetic-only changes cannot address static combat; a generic AI/animation framework adds scope; selected small fixed-tick rules plus existing renderer/rig. Keep steady camera, deterministic simulation, touch cancellation, resource budgets and guest persistence.
- Pass 1 audit: shortened light contact/recovery 18/66→14/40 ticks; source contact pose remains mapped to 18/66 through eased timing. Exponential action-weight transitions, one buffered attack in the last eight ticks, cleared on interruption. Brief presentation-only impact pause, 12 reusable sparks and original procedural Web Audio (mute control, gesture unlock, node cleanup). No simulation hitstop or camera shake. Required quality gate passes, 42 tests including contact pose and entry-point buffering/cancellation. Browser actual hit 100→75, counter damage and scene continued; no error/warning logs. Spot-check 60fps/p95 17ms is not phone/thermal validation. Audio sound quality still requires listening on user hardware.
- Safari remains separately unresolved: native Safari failed a raw 640x480 WebGL clear before the first frame; matching IOSurface allocation errors. Restart requested; no unverified claim that combat changes fix this OS/browser failure.
- Pass 2 audit: two-hit light chain with expiry, distinct 35-stamina/38-damage heavy and one 40-damage parry riposte. New Return/Heavy/Riposte clips on the existing rig; contact-pose tests inspect actual exported blade positions. Controlled wind-up turning replaces snap; bounded step-in shares arena collision. Late dodge/attack buffers stay one-action and clear on interruption. Required gate passes: 45 tests plus lint/typecheck/build/audit/budget. Browser heavy contact: warden 100→62, player 100, stamina 100→65; rendered pose inspected, no console errors. No purchased assets or runtime dependencies. Original heavy/thrust and reversed coherent backhand are prototype motion, not a claim of AAA motion capture.
- Pass 3 audit: warden approach/circle/retreat/visible guard, seeded bounded decision waits, delayed response to a confirmed whiff, finite guard stamina and heavy guard break. No random hit cancellation, hidden-input anticipation, behaviour-tree framework or camera shake. Dynamic opponent position now feeds collision, facing, marker and duel camera; both actors remain bounded/separated in 16,000-frame replay tests. Impact recoil and short blade ribbon are render/sim-separated; game rules never read animation. Fixed attack-start distance so the approach/lunge reaches a stationary player.
- Verification: required gate currently 49 passing tests, lint, typecheck/build, zero runtime vulnerabilities and budget pass (about 3.76MB raw / 1.25MB gzip, same two dependencies). Isolated mutations bypassing enemy guard and removing heavy cost were both caught. Entry-point buffer interruption and GPU restoration regressions still pass. CodeGraph synced; refresh after final renderer edit. Runtime TypeScript 760 lines including new 42-line audio module, versus 606 at prior release; no new framework/service.
- Browser: actual game embedded at 375x812 and 844x390 has no horizontal overflow; four combat targets >=44px high. Warden approached and dealt damage; held guard kept health100 while spending100→25 stamina; guard stance and heavy-break hint visible. 60fps/p95 18ms desktop spot checks. The iframe test tab logged an injected MutationObserver error (no occurrence in project source or harness); fresh standalone browser logs remain a separate release check. This is emulation/controlled keyboard input, not a physical phone/5-minute/minimum-hardware result. Native Safari still needs the requested restart/retest.

- Final manual check: portrait rematch returned both health bars and stamina to100, sheathed state/start positions, retained guest name; landscape844x390 and portrait375x812 receipts include button bounds and screenshots. Final pre-release gate49/49; whitespace/shell checks pass. Public standalone/CSP/service/artifact checks follow the configured release workflow; detailed receipts stay ignored under artifacts.

## Mobile HUD simplification — 2026-09-13
- Owner screenshot/request: phone view too busy; preserve desktop. Selected compact HUD plus existing journal as menu, instead of shrinking all controls or introducing another panel/framework. No renderer, assets, combat rules or dependencies changed by this task.
- Mobile only (<=900px or coarse pointer): remove brand/identity/large place text, debug FPS and redundant help from gameplay; slim accessible health/stamina meters, four 70x56px action targets, one menu. Menu retains sound, camera, rename, instructions and performance. Outer joystick edge sprints; cancellation, menu opening and focus loss clear it. Desktop controls/layout retained.
- Audit: native meter specificity conflict corrected; custom mobile bars keep distinct colours, full accessible meter names/values and stable button semantics. Actual 375x812/844x390 layouts show no overflow and separated thumb areas; 1280x800 retains original full HUD. Menu opens/closes with fight paused. 51 tests pass, including sprint cancellation and shared menu/desktop settings; lint, typecheck/build, audit and payload pass. No physical iPhone performance claim. CodeGraph synced after edits.
- Concurrent unrelated changes appeared in src/combat.ts and tests/combat.test.ts. Preserve them; mobile release uses a clean detached worktree containing only this task's committed files. Do not call the shared source checkout fully clean while those changes remain. Final HTTP/revision/service evidence is kept in artifacts/mobile-hud-release.json.


## Claude feedback integration and release checkpoint — 2026-09-13
- Claude's scoped commit 64a5b26 landed before mobile commit eab6860: the 1.8–2.2m warden dead band is already fixed and its stationary-guard regression passes. The earlier concurrent files were committed by that session; the shared checkout was subsequently verified clean. No duplicate implementation.
- Stale notices reproduced with a failing real-simulation regression. Two-second fixed-tick notice age now refreshes at both player/enemy contacts, including repeated identical results. Only display expires: result remains available for riposte, whiff AI and renderer feedback. Death/rematch and incoming/guard/chain priority retained. Reviewed early returns, pause semantics and repeated events.
- Three focused Semble searches plus CodeGraph impact covered result producers, HUD priority and regression helpers. CodeGraph synced after edits. Full configured gate: 53/53 tests, ESLint, typecheck/build, zero runtime vulnerabilities, payload budget pass. Existing 10,000/16,000-frame seeded state replays cover deterministic order; pre-fix code fails the new notice regression. ast-grep unavailable on PATH; no disputed graph edge or profiling symptom requiring unrelated diagnostics.
- Browser review: compact 375x812 view, combat approach/damage/defeat and full-width rematch render correctly with no horizontal overflow. Prior 844x390/1280x800 checks verify landscape/desktop. Physical phone performance/audio evaluation remains outstanding.
- Deployment blocked: configured scripts/deploy.sh passed its isolated quality gate, then public SSH 49.12.7.18:22 returned Connection refused (also on retry); saved-key Tailscale 100.96.74.1:22 timed out. HTTPS release.json remains HTTP200 at 58821417391576c257c61d10041c1ebd9197bb73. No claim these updates are live. Sentry search for that production release returned no grouped issues; this does not validate the unpublished changes. Resume configured deployment and public asset/service/browser checks when SSH is reachable. Evidence logs/receipt remain under ignored artifacts/.

## Polished exchange / optional swipe trial — 2026-09-13
- Current user task: integrate the useful Claude proposals and follow-up into a focused local combat upgrade. No purchases, external animation accounts, player outreach, other-project fixes or full networking/physics scope. Design revised in GAME_SPEC.md; share/challenge loop retained as future work.
- Before editing: three Semble queries covered rig/gait blending, animation export and sim/browser contact; CodeGraph traced characters/update and simulation consumers. Selected existing-rig offline authored motion plus baked blade paths. Rejected renderer-owned damage, new physics framework and making ambiguous gesture controls the default. Playbook read; no unrelated workspace edits.
- Simulation pass: offline 182-pose blade tables, swept finite segment vs upright body capsule sampled at <=2cm with 1cm tolerance; four-tick follow-through window, one hit per swing, both actors' movement accounted for. Fixed-tick parry/guard/stamina rules retained; locked armed footwork now faces the opponent. Regressions cover the old cone's empty space, moving-target tunneling, actual exported blade/path agreement, duplicate damage and 10k/16k seeded replays. Removing contact tolerance was caught by an isolated mutation test. No cross-engine determinism claim.
- Animation pass: original same-rig left/right strafe cycles, armed forward/back locomotion, hip/spine anticipation on heavy/thrust, directional hit lean and guard recoil. Audit caught missing pelvis-position tracks causing floating strafe poses; fixed and tested grounded support/loop seams. Mesh textures/materials/CC0 foundation unchanged. npm run build:warrior regenerates the GLB and its collision data together; asset agreement tests catch stale tables. Authored prototype motion, not mocap.
- Input pass: optional mobile Controls: swipes (trial), default buttons. Horizontal=light chain, up=heavy, down=dodge; guard/parry immediate separate button. One action per drag; threshold/diagonal dead band; cancel/lost capture/menu/focus/mode changes clear pending gesture state; keyboard equivalence retained. Actions container suppresses native touch gestures across its button gaps. No global zoom lock or camera change.
- Required gate: 69 tests, lint/typecheck/build, production audit and budget pass. About 4.0MB raw/1.29MB gzip fight-ready versus 3.77MB/1.25MB prior; two runtime dependencies unchanged. Actual asset, geometry, input and seeded-state tests used; ast-grep unavailable on PATH (TypeScript AST input audit present), no profiling symptom/disputed graph edge requiring extra tools. Local/live browser and revision/service receipts are recorded under ignored artifacts/fencing-*; deployment receipt is authoritative over earlier checkpoints. Physical-phone thermal/performance and animation taste remain unvalidated.

- Expanded owner scope during implementation: original same-rig kick, four-second nonstacking stamina-recovery wounds, coarse upright hit-region/kill data, blood spray and pooled splashes with red/dark/off menu. No dismemberment, paired finishers, physics engine, camera effects, new dependency or purchase. Asset provenance updated.
- Audit caught and fixed missing Guard/Draw pelvis tracks, early miss/evade notices, collision-driven warden spacing, kick foot/contact reach mismatch, and overlapping mobile Kick placement. Kick contacts once at tick18, blocks are bloodless, wounds clear on rematch; pending kicks clear on cancel/focus/GPU loss. Seeded 16k replay includes kick inputs.
- Local browser receipt: actual timed parry then riposte reduced warden100→60; close kick60→52; swipe heavy consumed its stamina cost. Portrait393x852 and landscape844x390 fit; five targets do not overlap. Blood red/dark/off controls exercised; screenshots reviewed. Replaced square particle/flat polygon blood with original alpha sprites after visual review. Sustained final public run and service/revision receipts follow under ignored artifacts/fencing-*. Physical-device thermal and external-player gates remain unpassed.

- Public f7822e1: configured deployment succeeded, all five HTTPS resources byte-identical, Mac/GitHub/public revisions matched, Nginx active and config hash matched. Final public two-thumb run 139.236s: scale1/no overflow, fights/rematches, parry→40-damage riposte, kick8 damage, swipe heavy cost, blood mode cycling; zero page errors. A separate 1280x800 desktop check caught FPS text overlapping Heavy after adding the kick row; final CSS-only follow-up raises that desktop readout. Final revision and corrected-desktop receipt are under artifacts/fencing-release.json.

## Defensive motion and enforced browser gate — 2026-09-13
- Continued owner-authorized realism work: three original same-rig clips (BlockImpact, Parry, Deflected), confirmed-contact presentation, immediate precedence for new actions/death. Simulation timing, damage and collision unchanged. A failing asset test caught counteracting blade motion in BlockImpact; corrected its recoil vector/orientation rather than reducing the minimum visible movement.
- Required npm run quality now includes scripts/browser-check.mjs using pinned dev-only Playwright 1.62.1. New checkout setup: npm ci; npx playwright install chromium. Full Chromium is used consistently (the separate headless shell had inconsistent form navigation). Runtime dependencies remain two. Browser gate verifies actual WebGL loss/recovery, touch parry→40 damage counter, kick8 damage, exact single35 stamina swipe deduction, blood controls, menu pause, portrait/landscape hit-target separation and zero unexpected page errors. QA blocks Sentry transport during deliberate context-loss testing. Missing browser/install or failed interactions fail the gate; nothing is skipped.
- Swipe test diagnosis: end-of-action balance could be73→40 because regeneration occurred between browser commands. Relaxing the net-drop threshold was not accepted as closure. The checked-in replacement observes every real meter value mutation and requires exactly one35 deduction; local receipt reports swipeDeltas:[35]. Fixed sim tests still require cost35. No game-state override, clock override or relaxed gameplay assertion.
- Sentry triage: FRANKENDOM-2 event d6d303ef1c674cd2a41ae9e876f52a77, release6b9393f, is initial WebGL creation failure; its device/cause is not established by retained telemetry. The unsupported-GPU message is intentional; no claim its historical cause was fixed. FRANKENDOM-3 event edcefcaf6e404ecbbc6f77427a2f14fe, releasea83e2a7, is shaderSource(createShader null) during render. Later commit19fade6 adds pre-frame and in-render context-loss recovery absent from that release; current real context-loss browser check passes. Neither issue is marked resolved; Safari/hardware recurrence remains unverified. Current-release searches have returned no matching errors, a narrower observation than project-wide health.
- Two-pass review: generated blade/path agreement and finite/grounded defensive poses plus action/death precedence; rendered parry and counter inspected in actual Chromium. Final publication uses scripts/deploy.sh with the browser gate included, then public browser/HTTP/revision/Nginx checks. Receipts: artifacts/deflection-* and artifacts/fencing-release.json.

- Browser assertion negative control: deliberately horizontal/light gesture produced an observed20 deduction; the exact35 gate failed as required. This expected failure validates the gate, not a production bug. Required gate also exercises real Chromium with WebGL disabled: verifies explicit fallback UI/disabled combat and the expected initialization error with telemetry blocked; it cannot establish the historical device configuration of FRANKENDOM-2.

## Completion-gate follow-up — 2026-09-13
- Shared enforcement is already installed by the hooks task at c4aa0ce, not pending: independently compared all 28 Codex/23 Claude tracked files with the Mac installs, checked global registrations, verified GitHub CI success, and reran 14 enforcement tests per installed agent on Mac and VPS. No duplicate shared-hook edit.
- Fresh RPG reruns exposed a brittle parry browser driver. Replaced post-poll fixed sleep/layout lookup with a timestamp captured on the first rendered warning and a precomputed target after Draw finishes. Diagnostics caught an intermediate stale target hitting the newly shown Kick row; waiting for armed Guard/Kick readiness fixes the coordinates. A successful public rerun recorded the real Guard pointer event at ~520ms, Parried, 40-damage counter, 8-damage kick and exact35 swipe cost. Assertions and simulation rules are unchanged. Final required/local and public reruns follow this source revision.
- Earlier timing/target failures are harness failures, retained in tool output; a deliberately late guard remains an expected negative control. Physical Safari and original-device recurrence of the two historical graphics issues remain outside these Chromium receipts.

## Character pass v1 — 2026-09-14 (branch `char/hero-v1`, worktree, no runtime files changed)
Owner decision: one universal humanoid with collectable equipment slots; level-1 starting kit first. The tin-can knight is
replaced by the whole CC0 body (face, eyes, eyebrows, buzzed hair, own skin/normal/roughness maps at 1024/512 JPEG with an
original ash-and-grit pass) and a level-1 kit generated headlessly in Blender from the body surface (sleeveless linen tunic,
studded leather baldric and belt, forearm wraps, sandal-boots, dyed under-skirt and kilt strips on the Heraldry surface,
iron studs on the Steel surface). Longsword rebuilt with a diamond blade, bronze furniture and a real scabbard; the
SwordDrawn/SwordSheathed nodes and sampled tip are unchanged, so `src/blade-paths.ts` is byte-identical after re-bake.

Evidence (identical camera/lighting per view; harness in `character-preview.html` + `scripts/character-preview.mjs`):
`artifacts/character/baseline/*` (60e94b3) vs `artifacts/character/humanoid-v5/*` — turntable, 21-clip sheet, 12 close-ups,
lock-camera stills at 390×844 and 844×390 @1.5, 6 s combat sequence. Audit of the baseline: `artifacts/character/audit/DEFECTS.md`.

| resource (per fighter unless noted) | baseline 60e94b3 | character pass v1 |
|---|---|---|
| triangles | 35,330 | 25,208 |
| draw calls, two fighters incl. shadow pass | 36 | 56 (10 materials; Eyes/Eyebrows/Hair/Blade are candidates to merge) |
| GLB raw / gzip | 3.39 MB / 1.10 MB | 3.51 MB / 1.64 MB (JPEG maps do not gzip) |
| texture memory with mips | 1.4 MB (four 256² maps) | 15.4 MB (1024² skin colour+normal, 512² ORM, rest 256²) |
| dist gzip (check-budget) | 1.28 MB | 1.82 MB (limit 5 MB) |

GAMEPLAY CHANGE flags: none. Contract held: 21 clips in order and duration, `Steel` skinned mesh with maps, both sword
attachments under `hand_r`, `Heraldry` material recoloured by the runtime, blade paths unchanged, 71 tests, budget and browser
gate green on every commit.

Reproducible build: `blender -b -P scripts/character/parts.py` (writes `src/assets/source/parts/level1.glb` and the skin maps +
`manifest.json`; committed) → `npm run build:warrior` → `node scripts/bake-blades.mjs` → `npm run quality`.

Since then (same branch, through 735a1bf): equipment-slot draws (one skinned mesh per slot × material, `extras.slot`; hair is
its own slot); Guard replaced by the CC0 UAL2 `Sword_Block` raise-and-hold retimed to 1 s (Parry/BlockImpact derive from its
hold; blade paths unchanged); UAL2 attack candidates as an opt-in build (`WARRIOR_UAL2_ATTACKS=1`, fails 3/71 on contact
geometry → combat review, REQUESTS.md #6); equipment items as demo builds (`WARRIOR_ITEMS=ranger,helmet_bronze`): Ranger boots,
bracers and pauldron from the CC0 outfit pack with re-tinted maps, and an original bronze crested helm (first Helmet slot; hides
hair). Per-fighter triangle ceiling raised 40k→60k by the owner (REQUESTS.md #7). Evidence per label under
`artifacts/character/` (`humanoid-v6` = shipped default; `items-ranger`, `items-helmet` = demo builds). Remaining for the lead:
runtime slot show/hide/swap, the helmet-height test ceiling (REQUESTS.md #9), combat review of the attack candidates. Requests to the lead in
`artifacts/character/REQUESTS.md` (GAME_SPEC art-direction text, equipment-slot contract, N8AO, Guard clip duration).
Integration for the lead: merge branch → `node scripts/bake-blades.mjs` → `npm run quality` → deploy.

## Combat core (symmetric engine, data-driven moves, utility AI) — 2026-09-14
- Owner brief authorized the combat-developer scope; branch `combat/core-v1` from live trunk `codex/01a09a76/task-1` (60e94b3), isolated worktree. No visual-developer files touched: `scripts/character/*`, `src/assets/**`, `build-warrior.mjs` untouched; `characters.ts` untouched; `scene.ts` changed in three blocks only (event-driven contact sparks, per-actor poses via `actorPose`, threat colour) so the warden animates its own heavy/kick/guard/roll instead of a hard-coded 36/100 timeline.
- Discovery: three Semble queries (result consumers, buffering, timing constants) and CodeGraph impact on `stepPractice`/constants found the hidden seam `scripts/bake-blades.mjs` reads attack timings; blade sides verified empirically from tip x over the swing (Attack = right cut, Return = left cut, Heavy = overhead). Baseline on the clean trunk: 71/71 tests.
- Engine: `duel.ts` steps both fighters with one rule set from pre-tick state, expires phases, moves in index order, then resolves contacts simultaneously against a snapshot (trades land both blows). Sim-owned input buffer (one action, last 8 ticks, 9-tick TTL, cancel on interruption) replaced the entry-point buffers. Events per tick: ActionStarted, AttackStarted/Active/Missed, Hit, Blocked, Parried, GuardBroken, Dodged, Staggered, StaminaExhausted, Killed. Rules injectable for tests. `combat.ts` projects `Practice` for the renderer/HUD (all previously read fields kept, plus threat/threatMove/exhausted/events) and keeps SWORD/ATTACKS/KICK/DEFENCE views equal to the move data (tested).
- AI: reaction-delayed perception, one plan per noticed attack (parry/dodge/block/evade/ignore), utility scores (punish, chain, kick, heavy, light), seeded bounded movement, guard-probe baiting, stamina discipline above a heavy's cost. Bugs found and fixed by the new tests: exhaustion spiral (attack cost with a 30 floor), whiffing heavies from 2.2 m (reach margin), a stale-guard release rule that dropped a fresh parry, blocking swings from 4 m away, per-tick light/heavy roll that never reached light range, evade turning its back.
- Tests: 81 passing (was 71): duel rules (attack phases, draw, range/facing, death, block/break, parry window boundaries and cooldown, exposure and directional guard under rule overrides, roll boundaries, stamina/exhaustion, chains, buffering, interrupts/poise trades, heavy vs guard, kick, wounds, 16k-tick event fuzz with sticky held guard, 12k-tick determinism/immutability/bounds), AI (reaction honesty per profile, same API and stamina, readable opener across seeds, punish/kick behaviour, parry/roll rates, no idling ≤480 ticks, modes and arena bounds, committed-state-only, difficulty ordering), projection/HUD (constant views, mirrored fields, threat, hint priorities, control gating, defeat/reset/describe, 16k seeded replay, and a sim replica of the browser gate's parry→60→52 sequence). Entry-point suite (`graphics.test.ts`, real transpiled main.ts) passed unchanged throughout. Determinism lint proven by injecting `Math.random`/`Date.now` (2 violations caught).
- Gate: `npm run quality` passes — lint, 81 tests, typecheck/build (777.9 kB JS / 211 kB gzip), 0 vulnerabilities, budget PASS (4.19 MB raw / 1.31 MB gzip fight-ready), Playwright receipt: real touch parry at 514.5 ms after the tell → "Parried! The warden is open.", riposte → warden 60, kick → 52, exactly one 35 swipe deduction, blood modes, GPU loss/restore, zero page errors. Browser pane: art loads, `?debug` overlay live (`#debug`), warden plays its own heavy wind-up with the heavy-specific banner, mobile 375×812 journal shows Warden/Combat-debug controls without overflow. A stale `artifacts/serve-production.mjs` from 2026-09-13 still listens on 4173/4174 in the main checkout (not killed).
- Feel changes to evaluate in play: warden damage is now symmetric (25 light / 38 heavy vs 20 before), so an idle player falls to three heavies in ~8 s at normal; exhaustion refuses guard until stamina 20; heavy has late-wind-up poise. Directional guard and parry exposure are implemented but off. Remaining for the visual developer: `characters.ts` clip selection for `enemyParried`/warden roll poses uses the same `actorPose`/events API; `Practice` view stays until their migration.
- Release follow-up (same day): the first deploy attempt's browser gate failed once on the kick (warden 60, not 52). Sim replay of the gate's timing showed the warden counter-attacking straight out of its stagger with a poised heavy: its cadence timer kept running while staggered and a landed hit's recovery counted as an "opening". Fixed: AI timers pause while staggered and the cadence re-rolls on being hit (a landed blow earns a punish window, as the old warden gave); only whiffs, staggers and exhaustion are openings; a swing is a threat only until its active window closes (the AI previously sat in defence through a whiff's recovery and never punished it); kicks lunge like sword moves (`MoveDef.stepIn`) so a backstep cannot walk out of a point-blank kick by 1 cm. Kick-margin grid now HIT for wait 30–48 ticks × walk 6–24 ticks around the gate's 36×14. Two regression tests added (82 total). Test harness bug fixed: the "immortal" observation fight had left the warden in the dead phase after its first death, which had masked per-level defence; corrected numbers vs a light spammer over 3600 ticks — hits taken easy 60 / normal 45 / hard 34, parries 0 / 2 / 9. Browser gate rerun four times consecutively: parry → 60 → 52 → [35], zero errors.

## Swordplay pass P0–P1 — 2026-09-15
- Branch `combat/swordplay-v2` from trunk 399b998 (visual lane had merged; no combat files touched overnight). Discovery: three Semble queries (guard entry/release, dodge input path, renderer clip mapping) and CodeGraph impact over `stepDuel/legal/inBufferWindow/actorPose`.
- PR 0 deletion pass: dead `pathOf/pathFor`, internal-only `isLight/phaseLength/chooseMove`, legacy `KICK/DEFENCE/WOUND` views (tests read move data), six unread Practice fields. 82/82 unchanged. The optional `stepDuel` split was deliberately not done: the plumbing to keep it byte-identical outweighs the readability gain while P1–P5 still reshape the action section.
- PR 1: guard yields (attack legal from guard; attack wins over a same-tick hold), feint (`feintUntil`, `feintCost`, event `ActionStarted:feint`, control gate lights the guard button during the window), `parryRecovery` 0→8, `guardProfile` seam (costScale/arc/window/stopsHeavy) used at contact resolution and for the guard window. Hints: "Parry window open", "Parry missed · guard down for a moment"; journal line added. Tests 82→86 (guard yields, feint window/cost/cooldown/kick/exhaustion, exposure on by default with connected-parry exemption, guard profile, feint→raised guard→kick mind-game vs a blocking AI). Mutations: 7/7 caught (feint window, feint cost, attack-from-guard, exposure, profile cost/stopsHeavy/window). Gate green incl. browser parry→60→52→[35].
- PR 4: `inBufferWindow` covers every committed phase tail (attack/draw/roll/hurt; dead excluded); window 8→10, TTL 9→11. Tests: queued light out of a roll tail, queued heavy out of a stagger tail, too-early stagger press not queued; shipped numbers pinned. Mutation: roll-tail removal caught; the window-size mutation only survives because tests are parametrised on the rule, hence the pin. Gate green.
- PR 2: `backstep` phase/action (RULES.backstep: 12 ticks, speed 1 = 0.6 m, cost 10, cancelFrom 8), hold-to-roll conversion (dodge legal from backstep, charged rollCost−backstep cost), AI evade plan prefers backstep. Input layer: Dodge press = backstep, held ≥150 ms (frame-clock, testable) = roll; swipe-down = roll; keyboard E tap/hold; release/cancel/GPU loss clear the hold. Presentation: backstep renders as armed footwork ('ready' pose; travel sign drives the walk). Tests 86→89 (distance/heading/cost/no i-frames/spam/arena/tail cancel/queued cancel/hold conversion boundaries; AI evade backstep; projection; entry-point tap/hold/interruption through the real main.ts with a new `release()` harness helper). Mutations 6/6 caught (i-frames on backstep, facing away, free backstep, tail cancel, conversion cost, input hold). Gate green.
- PR 3: `heavy_overhead.chained` 22/5/31 with its own baked path `heavy_overhead_chain`; lights' follow lists include the heavy; `Fighter.evaded` (RULES.dodgeAttackWindow 2) makes a light out of an evade tail chained; `heavy_riposte` move (48 dmg, 20/5/25, path baked from Heavy at 20/50); `chooseMove` picks it for heavy during the punish window. Re-baked 8 tables (368 poses); rig-agreement test iterates PATHS. Tests 89→90; mutations 5/5 caught (follow list, dodge-attack, evade window, riposte choice, stale table). Gate green.
- PR 5: perfect block (RULES.perfectBlock 3, perfectBlockCost .5) resolved in the Blocked branch from `d.age − guard window`; `Blocked` events carry `stamina`/`perfect`; the projection keeps `result: 'blocked'` (renderer keys block recoil/pose on it in files outside this lane) and adds `resultPerfect` for the hint. Tests 90→91 (just-in-time vs settled guard, parry-window exclusion, exposure interplay, guard-profile composition, hint text); mutations 3/3 caught. Journal line updated.
- Lane status after P0–P5: all shipped to the trunk and live; live gate green after each deploy. Not done: the optional `stepDuel` split (deliberate). Remaining risk: all new numbers are untested on a phone; the roll now starts ~150 ms after a button press (tap = backstep) — swipe-down keeps the instant roll.

## Souls slice I — duel length — 2026-09-15
- Measured first: AI vs AI at normal was 13.7 s / 5 hits median. Candidate tables compared in-memory; chosen light 11 / heavy 18 / riposte 24 / heavy riposte 30 / kick 4 → normal 35 s, 9 hits (5–12); hard 20 s; easy 37 s (24 seeds each). Health, stamina, stagger, knockback unchanged, so the parry/riposte/kick punish remains the largest single swing.
- Tests made data-driven (`100 - move.damage`) rather than literal; the kill test loops `ceil(100/damage)` swings and refills stamina (the stamina economy is tested elsewhere); the event fuzz re-centres without healing and tops up stamina so Killed/Parried keep occurring at lower damage. Browser gate expectations updated deliberately: riposte 76, kick 72. Gate green.

## Souls slice A — counter-hit + rear hit — 2026-09-15
- RULES.counter {damage 1.25, stagger 1.5} applied when the target is in any attack phase or past a roll's i-frames; RULES.rear {arc 90°, damage 1.15, stagger 1.25} inside the rear arc; multiplicative; clean hits only. `Hit` events carry `counter`/`rear`; hints read "Counter … hit" / "Countered". Tests 91→93 (wind-up, whiff recovery, roll tail, ready target, guard exclusion, kicks/heavies; rear arc boundary, front, stacking). Mutations 4/4 caught. Gate: the kick after the riposte can now land as a counter (5) when the warden's re-engagement starts a tick before contact — the gate accepts both exact outcomes (72/71) rather than tuning gameplay to the script.
- Gate hardening (same PR): the parry press had drifted to 512–518 ms against a 533 ms contact ceiling (one flake in ~15 runs today, pre-existing). The script now presses at ≥430 ms (observed ~467 ms, tick 28; window 28–37 covers contact at 32 with ~67 ms margin both sides). Assertions unchanged; 3/3 green.

## Souls slice D — guard counter — 2026-09-15
- `Fighter.counterWindow` set to RULES.guardCounter (20) on every Blocked; `chooseMove('heavy')` → `heavy_counter` while open (punish → heavy riposte outranks); cleared by any attack start and by stagger. New move reuses the heavy riposte path/timing (no extra bake). Hint appends "· heavy to counter" while the window is open; journal line updated. Tests 93→94; mutations 4/4 caught after fixing a vacuous trade scenario (the warden had still been recovering from its blocked swing, so the poise check never ran).

## Souls slice E — charged heavy — 2026-09-15
- RULES.charge {at 10, min 12, max 40, damage 1.5, stagger 1.5}; `Intent.heavyHeld` level; `Fighter.charge/charged`; the wind-up section rewinds age to the charge point while held (Charging event once); hyper-armour while charging; charged multipliers on Hit and GuardBroken. Input: Heavy button/G hold → `heavyHeld`; release/cancel/GPU loss clear it. Overlay shows `charge n` / CHARGED. Tests 94→96 (hold/early release/long hold/max auto-release/hyper-armour with counter-hit/feint from charge/no charge for chained-riposte heavies; entry-point hold via the real main.ts with a `rendered` capture added to the harness). Mutations 7/7 caught incl. the input layer.
- Slice complete: I, A(+soft B), D, E all live. Next per plan: phone playtest, then C (thrust) and G (poise/posture).

## Souls slice F — guard takes a heavy for chip; charged heavy breaks guard; deliberate charge press — 2026-09-15
- Owner phone playtest found guard useless vs the warden (its heavies broke a guard for full damage + all stamina) and hold-Heavy indistinguishable from a press (a 400 ms press already charged; no cue). Live probe `artifacts/tap-vs-hold.mjs`: 60 ms → plain, 300 ms → charging, 400 ms → CHARGED on 690fee5.
- moves.ts: `MoveDef.chip` (heavy .4, others 0), heavy_overhead `breaksGuard false, staminaDamage 40`, RULES.charge {at 10, min 30, max 54}. duel.ts: `breaks = (breaksGuard || charged) && !stopsHeavy`; block branch applies chip (0 on a perfect block) through `wound(chip, 0, false)` (no wound mark, normal death path), `Blocked.damage`; `Charged` event once at min. ai.ts: `AiState.hold` + `Intent.heavyHeld` (held heavy at a settled guard, released at charge.min), plan `affordable ? 'block' : 'evade'`, re-plan off a charging heavy. combat.ts: `resultStamina`, hints. feedback.ts: `charged` tone. scene.ts: per-fighter charge PointLight.
- Live re-check after the first deploy (225106f): the warden charged *every* heavy at a guard, so a turtling player still died without ever seeing a block. Charge-through now rolls against `aggression − .25` (measured 8/15/24 of 40 at easy/normal/hard); the rest are plain heavies the guard takes for chip.
- Second live re-check (5a1e02e, HUD MutationObserver): the fixed 731 warden's first heavy at a guard is the charged one, and the old break rule drained *all* stamina, so the turtle was exhausted and punished to death every time. Now `RULES.breakCost` 60 (a broken guard keeps one roll from a full bar; still exhausts a low bar) and `main.ts` seeds each rematch differently (first match stays 731 for the gate).
- Evidence: 101/101 node tests; 13/13 rule mutations caught (charged-breaks, chip, perfect-no-chip, chip-kill, wound-mark, threshold, short-charge, AI hold/release/re-plan/afford/charge-at-reaction, hint); `npm run quality` green incl. Playwright gate (parry 466 ms, riposte 76, kick 72).

## Slice C — thrust, chamber and the weapon-disc control trial — 2026-09-15
- Owner asked for slash / overhead / stab and a way to A/B three right-thumb grammars; chose a menu switch over `/v1` paths (a subfolder per version would be served by nginx as-is — verified with a throwaway folder in the live release: `/zz-probe-7f3a/` → 200, `/v1` → 404 without one — but one build with a runtime scheme keeps engine, tests and gate identical).
- moves.ts: `thrust` (PATHS + MOVES, Riposte clip, 16/5/21, dmg 14, stepIn 1 → lands from 2.0 m; measured cut 1.75 / heavy 2.20), `MoveDef.chamber` (light 6, heavy 10, thrust 8, punish moves and kick null) and `charges` (heavy only); RULES.charge loses `at`. duel.ts: `Action` 'thrust', `Intent.held` (was heavyHeld), generalised chamber block, hyper-armour only for charging moves. ai.ts: `charging()` guard so a chambered light is blockable and a planned block is kept. gestures.ts returns a `Flick` direction (nearest axis, no diagonal dead zone). trial.ts (new, 40 lines): scheme + per-scheme scorecard in `frankendom.controls.v1`. main.ts: scheme cycle on the Controls button, DISC map (← → cuts, ↑ thrust, ↓ heavy), drag grammars hold and feint on return to centre, v2 releases before the charge, T = thrust, fight/rematch tallies, scorecard in the journal. style.css keeps Step visible beside Guard under the disc. Gate: the disc stroke is now downward (heavy, 35).
- Evidence: 106/106 node tests (new: thrust/chamber engine, AI chambered-light, disc grammars, scorecard, trial storage); 14/14 rule mutations caught (thrust map, chamber scope, charge scope, hyper-armour scope, lunge, AI ×2, flick/drag/feint/direction/tally rules, diagonal dead zone).

## Slice C2 — v4 invisible gesture field — 2026-09-15
- Owner prefers v1; asked for GPT's "invisible right-half gesture field" as v4. `Scheme` 'field': `beginStroke/moveStroke/endStroke` shared by the disc and the canvas; on the canvas a pointerdown at `clientX ≥ innerWidth/2` starts a stroke (left half orbits as before); `#touch-mark` ring follows the touch and hides on release/clearInput; `#field-help` line replaces the disc in the actions grid (`data-gestures=field`); HUD refreshes on a scheme change (`lastHud = ''`). Gate walks five labels back to buttons.
- Evidence: 107/107 tests (new v4 test: thrust on ↑, charge on a long hold, feint on return, left half never attacks, mark visibility); 5/5 v4 mutations caught.

## Slice C3 — v4 dropped; v5 thumb cluster and v6 segmented disc — 2026-09-15
- Owner disliked v4 after playing it; asked for an FPS-style round-button cluster (v5) and, per external review, the segmented disc (v6). v4 code removed (canvas field branch, touch mark, field help); a stored 'field' scheme falls back to buttons.
- v5: `#thrust-button` (Stab; hold = chamber) shown only in the cluster; CSS `.actions[data-gestures=cluster]` positions six round targets in a 176×200 arc (Slash 66 / Stab 50 / Heavy 50 / Kick 40 / Step 56 / Guard 64; the id-specific `#kick-button` rule needed explicit sizes). v6: `tapSector()` on the pad (centre-relative `swipeAction`, 28 px dead zone) → ↑ thrust · ← light · → heavy · ↓ kick with `held` while down; `#sectors` label overlay; Kick button hidden. `layout()` → `data-gestures` 'false' | 'true' | 'cluster' | 'sectors'. Gate walks six labels.
- Evidence: 107/107 tests (v5/v6 test: cluster layout, Stab thrusts and holds, each sector's attack, dead zone, held sector charges); local screenshots `artifacts/crop-v5.png` / `crop-v6.png` match the intended arc and disc.
- Live probe of c8cbc99 (real taps): v6 sectors all correct, v5 Slash fine, but a same-frame tap on **Stab** was lost. Root cause, latent for every captured button: `lostpointercapture` follows each ordinary `pointerup` and the release handlers treated it as a cancellation (`name !== 'pointerup'` → queued action withdrawn) — a tap that ends before the next 60 Hz tick (or under a dropped frame on a phone) lost its heavy / thrust / step / parry / flick. Now only `pointercancel` (and focus loss) withdraws a queued press. Regression test proves the old main.ts fails it.

## Control lock-in — thumb cluster is the mobile layout — 2026-09-16
- Owner chose v5. `Scheme` is now `'cluster' | 'flick'` (cluster default; any other stored value → cluster); `data-gestures` = the scheme name. Removed: the square-grid mobile layout as a scheme, the drag/charge disc grammars (held/feint on the pad), the segmented disc (`tapSector`, `#sectors`). Cluster design pass: `#17232952` fill, `#f0e3c94d` ring, inset ring, 11 px small-caps labels, `:active` brighten + scale(.95), `aria-disabled` at .5, Slash primary `#b7a27680`, Guard pressed tint. Gate: taps `Controls: thumb cluster`, walks back `['Controls: weapon disc · flick','Controls: thumb cluster']`.
- Evidence: 117/117 tests (suite also gained other lanes' tests via trunk); local screenshot `artifacts/crop-lock.png`; `npm run quality` green.

## Hotfix — the movement stick could stay pushed — 2026-09-16
- Owner report on the phone (screenshot: knob offset with no thumb on it, fighter circling the warden). Cause class: the joystick only released on events delivered *to the joystick* for its captured pointer; if iOS never delivered that pointerup (capture lost, or a gesture swallowed it) the stick stayed pushed and, worse, `moveId !== null` rejected every later touch on the pad. Fix: `releaseStick()` on window-level pointerup/pointercancel for the stick's pointer, on `touchend`/`touchcancel` with no fingers left, and a new touch on the pad always takes the stick over. Regression test fails on the previous main.ts.

## Slice G — posture and the critical — 2026-09-16
- moves.ts: `MoveDef.posture`, `critical` move, `RULES.posture {max 100, decay .2, stun 90, parry 35, perfect .5}`. duel.ts: `Fighter.posture/critical`, per-tick drain (not while hurt/dead), `shake()` in the contact loop (block, kick-vs-guard, clean hit, parried attacker), break → stun 90 + opponent `punish`+`critical` 90, `PostureBroken` event, guard break resets posture, `chooseMove` heavy → `critical` inside the window. ai.ts: `shaky` retreat/circle, `critical` score 1.6. combat.ts: `posture/enemyPosture` on Practice, results `postureBroken/enemyPostureBroken`, hints, overlay `po N CRIT n`. HUD: `#posture`, `#target-posture` (mobile grid rows re-numbered; pseudo-element rules needed id selectors to beat the desktop `.combat-hud meter::-webkit-meter-bar` rule — verified with a 4× zoom screenshot).
- Evidence: 121/121 tests; 15/15 posture mutations caught (after strengthening the HUD flag test); `artifacts/duel-length.mjs` 24 seeds per level (numbers in GAME_SPEC); `npm run quality` green.

## Slice H — hit-stop and camera kick — 2026-09-16
- main.ts: `HIT_STOP` table + `stopFor(events)`; on a contact tick the step loop empties the accumulator (the frame ends on the contact tick, no `break` needed) and `hitStop` holds stepping for the duration while frames render; `clearInput` clears it. scene.ts: `kick/kickHeading` nudge after the camera lerp, 2 / 4.5 cm, decays at .3 m/s, disabled by `prefers-reduced-motion`.
- Evidence: graphics test measures every contact of both fighters: frames on the contact tick = ceil(ms/17) + 1 exactly (Blocked 3, Hit 4, Parried 6, heavy Hit 7 …); long-frame run (51 ms, three ticks per frame) renders the identical contact-tick set as the 17 ms run and never jumps more than the frame's own ticks. Mutations: no hit-stop, heavy = light, light too long, leftover accumulator replay → all caught. Camera kick is not harness-testable (scene stubbed); verified by build + gate + live load.

## Slice J — adaptive warden — 2026-09-16
- ai.ts: `Habits`, `Reads`, `READ` thresholds, `readOpponent()`; observation from state edges each tick; `parryChance` (spammer), `opening` includes roll tails (roller), kick score/chance boost (turtle), `chargeChance` boost + held heavies without a guard (turtle/roller/parrier), baited lights (`hold` for lights, released after `READ.baitHold` ticks). combat.ts overlay: `habits g% parry n/m roll n/m Lx Hy reads …`. Tried and removed as redundant (mutation-equivalent): a heavy range gate and three movement tweaks against a turtle — the kick boost alone puts kicks ahead (23 kicks vs 4 heavies after the read at normal).
- Evidence: 124/124 tests; adaptation mutations 11/11 meaningful caught (observation ×4, parry boost, tail punish, kick boost, charge boost, baits/held heavies, light hold release, evidence gate); AI-vs-AI length unchanged (normal 22.6 s / 7 hits, hard 17.2 s / 8).
- Gate hardening in the same PR: the kick step failed once on wall-clock (warden hp 76: the kick whiffed on a retreating warden; 3/3 reruns passed). The HUD now flags kick reach (`#kick-button[data-reach]`, 1.5 m = the measured landing range of the lunge, pinned by a duel test; the cluster's Kick brightens when it can land) and the gate waits for that flag instead of a fixed 240 ms walk + tap. Lesson recorded: `npm run test:browser` alone serves the *previous* `dist/` — rebuild first.

## Slice K — the thrust in the warden's kit — 2026-09-16
- ai.ts: `AiState.next` gains 'thrust'; `THRUST_SHARE` .35 after the first attack; score `thrust` needs `gap ≥ cut reach` and no guard; a planned thrust inside cutting range sets `retreat`; approach stops at thrust reach − .2 when a thrust is planned; spammer parry cap `1 − dodge`. combat.ts: thrust threat hint (keeps the 'Incoming strike' prefix the gate keys on).
- Test lessons: consecutive small LCG seeds give near-identical first draws — spread test seeds with the golden-ratio hash; a passive player at hard is a punching bag (punish/chain loop starves openers), so opener behaviour is tested from constructed states plus a 'peek' player (guard 1.5 s / open 1.5 s).
- Evidence: 127/127 tests; 7/7 thrust mutations caught (first-opener gate, kit, range gate, step-back, no-guard, parry cap, hint); duel length above.

## DNA table closed for the sword loop — 2026-09-16
- Items 1–4 shipped and live (`4507458` posture, `d2ef97c` hit-stop, `ca38941` adaptive warden, `06fced0` thrust opener). Item 5 (momentum/dominance/crowd) proposed as a tug-of-war bar with a posture-break payoff and **rejected by the owner as cheesy — removed from the plan**; GAME_SPEC records the decision so it is not rebuilt. Item 6 (weapon families) parked by the owner until the longsword loop is perfect.
- Next, owner's choice: phone-playtest tuning pass; the hybrid build/stat layer (data-only margins); online 1v1 on the deterministic sim.

## Slice L — correctness pass from the external audits — 2026-09-16
- Three audits (GPT file + two reviews) distilled into a seven-block plan; block 1 (correctness) shipped here. Every claim was re-verified against the live sim before fixing (perception blind to held heavies, 2.26 m hold lunge, charged kick 6 dmg, perfect-block guard break at 15 stamina, mutual kill = loss, 5 cm index privilege, held-guard hole confirmed for block 2). duel.ts: `elapsed()`, `beginAttack()`, `parked` lunge gate, cost-first block affordability, armour scope, `Finish.draw`, movement vs `before` bodies + separation pass. ai.ts: perception on `elapsed`. main.ts: `withdraw()` with `sent` ownership → `Intent.cancel`. combat.ts: draw hint.
- Evidence: 132/132 tests (new: correctness pass, side symmetry, perception while parked incl. acting on the plan, cancel propagation with ownership); 11/11 mutations caught; duel length re-measured below.

## Slice M — fairness pass (audit block 2) — 2026-09-16
- Held Guard has no hole (exposure only after a released tap); the warden never guards or parries a kick (rolls it with its dodge share, otherwise takes it); a read spammer's cuts are anticipated (7 ticks, after 9 swings) so they can be parried, and the warden guard-walks into a spammer with the guard counter, whiff punish and cut conversions instead of throwing 32-tick heavies into cuts; reads after two exchanges; parrier sees baits/feints/kicks; ripostes carry no posture (two parries ≠ kill); hard reaction 10; `GuardBroken` sides fixed (attacker = actor). Thrusts counted separately from cuts in habits.
- New `tests/battery.test.ts`: nine scripted strategies × 24 seeds × 2 min at normal and hard; gate = no script wins > 50 % (normal) / > 35 % (hard), every script gets touched (perfect parry ≤ 6 untouched). Light spam went 18/24 → 7/24 at normal (owner asked for 5–8: the first pass at 5 ticks / 6 swings gave 1/24).
- Evidence: 136/136 tests (new: battery, fairness pass, kick never guarded, habit bins + reaction floors, event sides); 14/14 mutations caught (held-guard rule, kick answer, anticipation, counter score, exposed opening, pressure guard, standing-guard stall, heavy→cut conversion, feint execution, thrust bin, riposte posture, GuardBroken sides, READ.after, hard reaction); `npm run quality` green incl. browser gate.
- Remaining audit blocks: 3 presentation (hit-stop pose/owner, blocked-heavy hit-stop scaling), 4 controls, 5 stamina/tempo, 6 gladiator identity, 7 process (CI, reference reconciliation).

## Slice N — presentation correctness (audit block 3) — 2026-09-16
- One impact-pause owner (main's hit-stop; scene's own 50 ms animation pause removed; rigs evaluate at dt 0), contact tick's bodies on the frozen frames, overshoot carried into the next tick, blocked heavy 50 ms, journal Hit-stop on/off (persisted), real seconds on the scorecard, `?debug` frame probe (`#debug` data-frozen/tick/tip).
- Evidence: graphics tests (contact body + frozen flag, overshoot 0/1/4/6 under 40 ms frames, heavy Blocked 50, toggle off = no pause + persisted), characters test (zero-dt pose evaluation, no frozen trail samples), trial test (real seconds). Mutations: 8/9 caught in node; the scene's animation clock has no node harness and is checked by the live frame probe.

## Slice O — controls pass (audit block 4) — 2026-09-16
- Slash sends held; per-control held ownership (`holders` set, owner of the current swing); drag-off feint on Slash/Heavy/Stab; Kick 44 px + cluster re-laid 176×210; Step rolls at once with a deflected stick; v7 guard ring scheme (`ring`) with the gate walking all three schemes and checking ≥ 44 px targets and no overlaps (Slash-in-ring excepted).
- Evidence: graphics tests (held Slash chambers, drag-off feint + release, held ownership, deflected-stick roll vs neutral backstep, scheme cycle incl. ring); trial test (3 schemes); 8/8 mutations caught; screenshots `artifacts/cluster-v44.png`, `artifacts/ring-v7.png`.

## Slice P — stamina and tempo (audit block 5) — 2026-09-16
- Sprint: deliberate 1.4-rim push, lit knob, no regen-delay reset. Regen 40/s after .75 s; guard regenerates at half rate; block costs 15/20/30; health 150 (`RULES.health` everywhere); journal Tempo 60/50 Hz toggle. Spammer read re-swept (11 swings / 8 ticks → light spam 7/24 at normal).
- Measured AI-vs-AI (24 seeds): normal 12 hits / 24 s median, hard 13 / 27.6 s, easy 12 / 22.9 s — the 8–15 target met at every level (at health 100 with the new regen it was 8 / 16 s).
- Evidence: 141/141 tests (tests parameterised on `RULES.health`; new tuning-pins test; stamina test rewritten for guard/sprint regen; tempo toggle test); 10/10 mutations caught; browser gate updated (riposte = HP − 24). Remaining: 6 gladiator identity, 7 process.

## Slice Q — gladiator identity (audit block 6) — 2026-09-16
- Ring wall (stagger/posture on wall impacts, no backstep when cornered, warden footwork), attrition wounds (stamina ceiling −8 per wound, leg wound 85 % speed, AI floor scaled to the ceiling), thrust as the stop-hit (×1.5/×1.75 into a swing or a 0.3 m walk-in; whiff hangs 10 ticks; AI share 20 %, cadence-gated, no walk-back), posture retune (gain pauses drain 45 ticks; 20/32/16, parry 25) swept to ~one break per two duels at normal.
- Evidence: 147/147 tests (new: wall, attrition, stop-hit/whiff, posture pins, warden wall footwork, scaled floor); 12/12 mutations caught; battery green (light spam 5/24); AI-vs-AI normal 11 hits / 21 s. Remaining: 7 process.

## Slice R — process (audit block 7) — 2026-09-16
- CI workflow (`quality.yml`) runs `quality:ci` (lint, tests incl. the battery, build, audit, budget) on pushes/PRs to the live trunk; the Playwright gate needs a real GPU and stays pre-deploy + live (gate prints diagnostics on failure); reference doc reconciled (turn clamps in radians, hard's first opener, perfect block, all block 2–6 numbers, open questions rewritten).
- The seven-block audit plan is complete: M fairness (`0f40848`), N presentation (`d7b83f5`), O controls (`3a670f3`), P stamina/tempo (`3d16b02`), Q gladiator identity (`67109de`), R process.
- Next, owner's choice: feel the 50 Hz tempo and decide on the move re-timing (blade re-bake); play the v7 guard ring vs the cluster and let the scorecard decide; the reference's open questions (§11).

## Slice S — the cut is a cut — 2026-09-16
- Play audit on the live build (human-reaction bot, HUD-only): normal open 3W/2L in 21–38 s, turtle 0/5, hard 0/3, easy 3/3; warden cuts parried 1/36 (233 ms tell, under reaction). Owner: "slash too quick and shallow". Cut re-timed 20/8/22 and authored as a horizontal arc (both rigs rebuilt, paths re-baked); `lapse` profile field so the warden does not answer every readable cut.
- Evidence: 149/149 tests (timing-dependent tests rewritten against MOVES; perfect-parry script times on the tell); battery green (light spam 0/24 at normal — see GAME_SPEC S for why the old 5–8 target no longer applies); AI-vs-AI normal 12 hits / 21 s; frames `artifacts/mine-3/5/7.png` show cocked → front → across.
- Cross-lane note: `scripts/build-warrior.mjs` (authored Attack/Return keys; UAL2 candidates gated to the cuts with `WARRIOR_UAL2_ATTACKS=lights`), `src/assets/warrior.glb` + `veteran.glb` rebuilt from the committed sources — the char lane should rebuild from trunk before its next art change.

## Slice U — the weapon slot seam — 2026-09-16
- `Weapon`/`WEAPONS`/`weaponOf` (moves.ts), `Fighter.weapon` + `movesOf` (duel.ts), AI reads own/their tables, blade paths keyed by weapon from `scripts/blade-manifest.json`, contact events carry weapon + material. Trident = longsword placeholder; both fighters longsword on trunk.
- Evidence: 156/156 tests (new tests/weapons.test.ts: 5); 7/7 mutations caught; quality gate green. Weapons lane brief can land on it: add a manifest entry + a `WEAPONS.trident` table + clips on the Veteran rig; flip `initialDuel`'s opponent to 'trident' with combat review.

## Slice X — fight-identity knobs (for the goblin) — 2026-09-17
- `AiProfile.feint / guard / disengage / circle` (optional) and `Opponent.regen` → `Fighter.regen`; ai.ts/duel.ts read them with today's behaviour as the default (RNG sequence preserved: existing wardens' battery tables byte-identical). Tests: 5 new in tests/ai.test.ts, each with a control; 9/9 mutations caught; 197/197.
- **The goblin fights (part 2, same day):** #86 and #87 merged; `WEAPONS.knife = KNIFE`, manifest → `src/assets/goblin.glb` (rebuilt with the knife, his build default; the shelf duplicate removed); `OPPONENTS.goblin` gets regen 1.5, **speed 1.2** (new `Opponent.speed` → `Fighter.speed`, a pace multiplier through `advance()`), knobs feint/guard 0/disengage/circle plus the darter's `step`/`interrupt`/`kick`/`dash`; reads `stepper`/`poker`/`kicker`; `opponentFighter()` builds any opponent from all his data (the batteries use it). Ladder: Veteran → Pitborn → Goblin → Nightborn. Gate in tests/opponents.test.ts (caps, touched, patient whiff punisher the answer, never holds a guard, AI-vs-AI 38.8 s). **Health 100 → 120 the same day (owner):** rung 3 now out-fights the Pitborn (hero brain loses 15/24, was 8/24; AI-vs-AI median 42 s); patient play never loses to him but mostly runs out the two-minute clock (3/24 wins at normal) — the gate's floor is 2 + never loses. 21/21 mutations caught; 215/215 tests. Harness `artifacts/weapons/live-knife/`; game probe `OPP=goblin node artifacts/live-trident.mjs <url>`. **Character lane:** `WARRIOR_FIGHTER=goblin node scripts/build-warrior.mjs` keeps the knife. **Not done:** the camera request (#8 in his REQUESTS: the lock look-at for a 1.36 m man) is the camera lane's.

## Slice W — the Pitborn fights with the cleaver — 2026-09-17
- Flip: `WEAPONS.cleaver = CLEAVER`; manifest → `src/assets/weapons/cleaver/veteran-cleaver.glb` (1.0× bake, his sword's convention); `pitborn.glb` rebuilt with the cleaver (variant A, owner's pick; `WARRIOR_FIGHTER=pitborn` now defaults to the cleaver); `pitborn-cleaver.glb` removed (stale duplicate, 172 bytes behind the dark bone plates). Numbers kept as shipped.
- Combat fixes: ai.ts turns a planned opener the worn stamina ceiling can no longer pay for into a cut (the hack costs 42 > the attrition floor 40 — the 6/24 stalls); Pitborn hard discipline 20 → 24 (whiff punisher 10/24 → 7/24 at hard, under the 35 % cap; normal 9/24).
- Evidence: 186/186 tests; 5/5 mutations caught; `tests/opponents.test.ts` gate green (AI-vs-AI median 27.5 s); harness `artifacts/weapons/live-cleaver/`; game probe on the built dist: the Pitborn's rig plays under `WeaponDrawn` for every sample. **Character lane:** a Pitborn rebuild is `WARRIOR_FIGHTER=pitborn node scripts/build-warrior.mjs` (cleaver A by default); the bake source is the Veteran's body with the cleaver (`WARRIOR_WEAPON=cleaver WARRIOR_OUT=…/veteran-cleaver.glb`).

## Slice V (combat) — the Veteran fights with the trident — 2026-09-16
- Renderer plays roles from a per-weapon clip table (`characters.ts` `WEAPON_CLIPS`, `clipFor`), keeps `WeaponDrawn` in hand, trails its `extras.contact`; `combat.ts` `attackSpecs(weapon)`, thrust role; `scene.ts` passes the sim's weapons; `veteran.glb` = the trident Veteran (`WARRIOR_FIGHTER=veteran` now defaults to `WARRIOR_WEAPON=trident`; `src/assets/weapons/trident/veteran-trident.glb` removed, manifest → `veteran.glb`). Gameplay: `OPPONENTS.veteran.weapon = 'trident'` (the opponent seam below); `minReach` 1 m on the thrust (from where it started), shaft guard ×1.15 and broken by a plain overhead, the sweep trips a roll in its first half, `Weapon.fight` stance (thrust share .6, close 1.4, kick/backstep inside the point, no shaft vs heavies).
- Evidence: 166/166 tests (+ characters 3, weapons 3, combat 1, the old Veteran-parity and trunk-unchanged tests rewritten; battery now gates the trident AND the longsword warden); 17/17 mutations caught; AI-vs-AI duels longer (median 27 s normal vs 23); harness `artifacts/weapons/live/`; game probe `artifacts/live-trident.mjs` (the Veteran plays only Trident_* + body clips). **Character lane:** a Veteran rebuild is `WARRIOR_FIGHTER=veteran node scripts/build-warrior.mjs` (the trident is the default now; `WARRIOR_WEAPON=longsword` would hand him the sword back), then `node scripts/bake-blades.mjs`. **Weapons lane:** iterate the part in `scripts/build-weapon.mjs`, rebuild `veteran.glb`, re-bake; the harness `--enemy` default is `veteran.glb`.

## Slice V — the opponent seam (Opponent 3: the Pitborn, part 1) — 2026-09-16
- `Opponent`/`OPPONENTS`/`Level` (moves.ts): weapon, body `scale`, `health`, `poise`, a profile per easy/normal/hard. `initialDuel(opponent = veteran)`, `initialPractice(seed, opponent)`; `Fighter.scale/poise/maxHealth`; the blade sweep's capsule and hit regions scale with the target (blade.ts); a plain clean hit under `poise` damage wounds and builds posture but never staggers or moves him (heavies, counter/stop/rear hits and charged blows always do); HUD bars take their ceilings from the fighters. `WEAPONS.cleaver` = longsword placeholder (the weapons lane's fat cleaver replaces the data). `?opponent=pitborn` picks him at boot until the ladder (lead) sets it; scene.ts maps `OpponentId → GLB` (Pitborn borrows the Veteran's until `pitborn.glb` ships).
- Pitborn data (provisional, combat-owned): 1.13×, health 190, poise 16, normal `{reaction 18, parry .15, aggression .8, pressure .7, discipline 25}`. Probe (24 seeds): battery caps hold at normal and hard; a held guard is broken in every fight (median 72 ticks, 23/24 inside 6 s); the off-line whiff punisher wins 6/24 — the best honest script; AI-vs-AI (Veteran brain vs him) median 26.4 s. Discipline 15 made the punisher win 17/24 (rejected); accuracy is not a lever; a literal `StaminaExhausted` never fires at 40/s regen — the whiff window is the weakness.
- Evidence: 163/163 tests (new tests/opponents.test.ts: 7; battery takes an opponent and records first guard break), quality gate green incl. the browser gate. Veteran default byte-for-byte unchanged (`initialDuel()` deep-equals `initialDuel(OPPONENTS.veteran)`).
- Next (part 2, character lane): `pitborn.glb` from the KeenTools scan `01a0ab5b…` (7 owner portraits in `artifacts/source/face/pitborn/`), 1.13× hunched build, tusks, bone/iron kit; budget cap up from 12 MB as needed; per-fighter scale in tests/characters.test.ts.
## Trident v1 — the weapons lane — 2026-09-16
- Branch `weapons/trident-v1` from trunk 86189a5 (slice U). The Veteran's short trident: a rigid part under `hand_r` (`WeaponDrawn`,
  `extras.contact` on the tines, 652 triangles, no textures) and 13 original clips on the rig (`Trident_Idle/Walk/StrafeLeft/StrafeRight/
  Thrust/ThrustChain/Sweep/High/Guard/BlockImpact/Deflected/Hit/Death`), all two-handed; built by `scripts/build-weapon.mjs` through
  `build-warrior.mjs` (`WARRIOR_WEAPON=trident`, default output byte-identical) into `src/assets/weapons/trident/veteran-trident.glb`
  (not imported by the runtime: the bundle is unchanged until the render lane switches the opponent).
- Data: `WEAPONS.trident` is real (`TRIDENT_MOVES` / `TRIDENT_PATHS`, guard `shaft`, material `bronze`), baked from its own rig via
  `scripts/blade-manifest.json`. Slash = low sweep, Stab = thrust (chains into a second thrust), Heavy = the overhead pin. Measured
  against a standing target with the owner's pick (variant `short`: B's wide fork on a 60% stick, 1.42 m, brown shaft; the thrust reaches
  by driving the rear arm to full extension): thrust lands to 2.25 m (sword stab 2.0), sweep 1.75 (cut 1.7), pin 2.15 (heavy 2.2);
  every `reach` is that number (tests assert ±0.1 m). All numbers provisional — GAMEPLAY CHANGE for combat review; nothing changes on trunk (`initialDuel`
  still longsword vs longsword).
- Harness: `scripts/character-preview.mjs --weapons [--enemy <glb>]` — weapon turntable, on-rig close-ups, clip sheet, 393×852 /
  852×393 lock stills, a 6 s scripted exchange, a cost table; baseline and three passes under `artifacts/weapons/` (REPORT.md).
- Evidence: tests/weapons.test.ts 8 tests (rig + contact segment + clip set, clips agree with the data's contact keys, reach frontier);
  quality gate per the PR. Requests to other lanes in `artifacts/weapons/REQUESTS.md`: the renderer's per-weapon clip list and weapon
  node (the trident is not visible in the game until then), the combat flip and review, a rule for "weak inside the point" (the sim
  sweeps the tines from the wind-up pose, so a thrust lands from 0.4 m like the sword's), the shaft guard profile. Silhouette picked
  by the owner 2026-09-16 (`short`); A/B/C remain as `WEAPON_VARIANT` options.
## Slice V — the opponent seam (Opponent 3: the Pitborn, part 1) — 2026-09-16
- `Opponent`/`OPPONENTS`/`Level` (moves.ts): weapon, body `scale`, `health`, `poise`, a profile per easy/normal/hard. `initialDuel(opponent = veteran)`, `initialPractice(seed, opponent)`; `Fighter.scale/poise/maxHealth`; the blade sweep's capsule and hit regions scale with the target (blade.ts); a plain clean hit under `poise` damage wounds and builds posture but never staggers or moves him (heavies, counter/stop/rear hits and charged blows always do); HUD bars take their ceilings from the fighters. `WEAPONS.cleaver` = longsword placeholder (the weapons lane's fat cleaver replaces the data). `?opponent=pitborn` picks him at boot until the ladder (lead) sets it; scene.ts maps `OpponentId → GLB` (Pitborn borrows the Veteran's until `pitborn.glb` ships).
- Pitborn data (provisional, combat-owned): 1.13×, health 190, poise 16, normal `{reaction 18, parry .15, aggression .8, pressure .7, discipline 25}`. Probe (24 seeds): battery caps hold at normal and hard; a held guard is broken in every fight (median 72 ticks, 23/24 inside 6 s); the off-line whiff punisher wins 6/24 — the best honest script; AI-vs-AI (Veteran brain vs him) median 26.4 s. Discipline 15 made the punisher win 17/24 (rejected); accuracy is not a lever; a literal `StaminaExhausted` never fires at 40/s regen — the whiff window is the weakness.
- Evidence: 163/163 tests (new tests/opponents.test.ts: 7; battery takes an opponent and records first guard break), quality gate green incl. the browser gate. Veteran default byte-for-byte unchanged (`initialDuel()` deep-equals `initialDuel(OPPONENTS.veteran)`).
- Next (part 2, character lane): `pitborn.glb` from the KeenTools scan `01a0ab5b…` (7 owner portraits in `artifacts/source/face/pitborn/`), 1.13× hunched build, tusks, bone/iron kit; budget cap up from 12 MB as needed; per-fighter scale in tests/characters.test.ts.

## Cleaver v1 — the weapons lane — 2026-09-16
- Branch `weapons/cleaver-v1` (stacked on #80 trident + #81 Pitborn seam). The Pitborn's cleaver: "a fat scythe-type cleaver, wider and
  the same length as the longsword" (owner). A procedural single-edged loft (0.19 m belly toward a hooked tip, 0.20 m forward sweep, 615
  triangles, no textures; silhouette A picked by the owner 2026-09-17, B/C remain options) under `hand_r` as `WeaponDrawn` (contact = the edge .14–.86). It rides
  the **sword's clip family** — same 21 clips, same order; only `Heavy` is re-keyed on its rig as a diagonal hack so the edge leads
  (edge·motion .95 vs the sword's .68) — so the renderer needs nothing; `pitborn-cleaver.glb` is his own body carrying it, and the
  shipped `pitborn.glb` takes it with the build flag + one test relaxation (REQUESTS §5). Baked at 1.0× like his sword; at his real
  1.13× the chop reaches 1.85 and the whiff punisher goes 0/24 — the scale call is the combat lane's (REQUESTS §6). `build-warrior.mjs` takes a per-weapon `{ part, clips, keys }` table; default output byte-identical.
- ON THE SHELF (the lanes' split): `CLEAVER` is exported real data — the chop (17, chip .2), the back of the cleaver (the backhand leads
  with the spine: 9 dmg, posture 34 — a hammer), the hack (26, chip .5, posture 42), the poke (7) — but `WEAPONS.cleaver` still borrows the
  longsword and there is no manifest entry: the Pitborn is unchanged until the combat lane flips it (REQUESTS §5). Measured for that flip:
  with lunges equal to the sword's and the sword's reach convention, the Pitborn battery passes 4/24 normal · 6/24 hard with 6/24 stalls at a
  1.0× bake; at his 1.13× the whiff punisher goes 0/24 (REQUESTS §6). The whiff-punisher script now reads the warden's own weapon table.
- Evidence: tests/weapons.test.ts +3 (rig + clip set + edge segment; edge-leading per cut; reach and lunge parity with the sword),
  169/169; `artifacts/weapons/REPORT.md` (cleaver section), sheets under `artifacts/weapons/cleaver-v3/`, `cleaver-B/`, `cleaver-C/`.

## Slice W — the Pitborn's body (Opponent 3, part 2) — 2026-09-16
- `src/assets/pitborn.glb` from the pipeline per fighter: `parts.py --fighter pitborn` (KIT `bare`/`brute`/no `helm`: rag sash instead of the tunic, crude iron belt, rag kilt, wraps, barefoot; `build_shape` shoulders and chest at 2× the Veteran's gain plus a thick neck; `tusks()` on the KeenTools head — seven owner portraits, scan `01a0ab5b…`, `skin_mul` (0.74, 0.80, 0.84) because the scan's neck band is lit paler and warmer than the grey-green cheeks) → `WARRIOR_FIGHTER=pitborn build-warrior.mjs` (`BUILD.pitborn`: root scale 1.13 = `OPPONENTS.pitborn.scale`, hunch spine_02/03 +7°, neck_01 −7°, Head −6° post-rotated into every clip's keys about each bone's bind-pose sideways axis; `Bone` material; three bone plates on the left shoulder, two on the sword forearm; blackened `Steel`, undyed `Heraldry`). No helm, so no items.
- Contract: 21 clips, same durations, every bone track byte-identical to the hero's except the four hunched bones; `hand_r`/`SwordDrawn`/`SwordSheathed` transforms identical; stands 1.957 m to the hero's 1.745 (×1.12 = scale less the hunch). 58.3k tris, 3.19 MB gzip. Harness `--enemy /src/assets/pitborn.glb` → `artifacts/character/pitborn-v3/`. Lock views at 390×844 and 844×390 frame him with headroom: no camera request.
- Open for a kit pass (owner's eye first): iron knee plates (the classic-body `knee()` primitive read as boxes and was dropped), rope-textured wraps, bone plates as authored parts instead of ellipsoids; the cleaver is the weapons lane's (BRIEF-pitborn.md § Weapon). Budget cap 12 → 16 MB gzip (owner: "expand as needed, not excessive").

## Slice X — the goblin (Opponent 4, character lane) — 2026-09-16
- `src/assets/goblin.glb` from the per-fighter pipeline: KeenTools scan of the owner's seven portraits (`artifacts/source/face/goblin/`, scan `01a0ab81…`), `head.FIGHTERS.goblin` (buzz stubble, scars, `skin_mul (0.80, 0.77, 0.78)`), `parts.KIT.goblin` (rag tunic, baldric scrap, thin belt, wraps, barefoot, no helm) + `parts.ears()` (flattened cones rooted by raycast at the scan's ears, on the photo tile at a cheek texel) → `WARRIOR_FIGHTER=goblin build-warrior.mjs`. Brief + decisions + evidence index: `artifacts/character/BRIEF-goblin.md`; requests to the other lanes: `artifacts/goblin/REQUESTS.md`.
- **The rig is re-proportioned in data, not shrunk** (`BUILD.goblin`, `reproportion` in build-warrior.mjs): per-bone scale about the joint in the rest frame through every part's skin weights, rest positions + inverse binds rebuilt — legs ×.84, arms ×1.16, neck ×.9/.86, head ×1.17, hunch 9/9/−8/−8°, pelvis dropped by the legs' loss (0.142 m, soles unchanged), walk bob ×.84, root .835; standing 1.357 m = ×0.778 → `OPPONENTS.goblin.scale .78` (the measured height ratio; the capsule follows it). Library clips bit-identical to the hero's except the hunch; IK-authored clips re-solve on his limbs with the hand goals lifted by the drop; the Roll gets a floor clamp on the arms (was −0.104 m, now +0.045). `stride .70` on the GLB root → `characters.ts` plays ArmedWalk/strafes faster by it (no clip change). Necklace cord fitted by raycast over everything worn; one iron bracer, left forearm. 55.9k tris, 3.26 MB gzip; dist 14.63 / 16 MB.
- Data: `OPPONENTS.goblin { knife (longsword placeholder, alias re-baked), .78, health 100, poise 0 }`, PROVISIONAL profile on today's knobs (parry 0, dodge .5, reaction 10); `?opponent=goblin`. The fight identity (feints, guard share 0, back-step after landing, circling, regen) needs AI knobs — REQUESTS #1–7; the fairness battery is not pinned for him. AI-vs-AI today: median 18.2 s. Tests 171/171; `npm run quality` green (gate incl. browser); real-app probe `artifacts/goblin/live-goblin.mjs` (GLB loads, HUD 100/100, fight starts, no errors, phone screens). Camera request: at close range on 393×852 he hides behind the hero's back (REQUESTS #8). Head pass: the portraits' grey backdrop smeared onto the crown is marked unseen (`backdrop_cool`, b ≥ .85 r above the hairline) and the fill tone follows the stubble (`hair_lum .42`); the scan's pinnae are flattened under the goblin ears. Open: the flattened pinna's pinker patch in profile, ear shape, bracer maps.

## Knife v1 — the weapons lane — 2026-09-17
- Branch `weapons/knife-v1` (stacked on #86 goblin + #82 cleaver). The goblin's short hooked knife: a **sica** — forward grip, inward hook,
  double-edged over the hook so the backhand cuts — 943 triangles, no textures, a 0.42 m blade in his 0.81× hand; his own re-proportioned rig
  carries it (`src/assets/weapons/knife/goblin-knife.glb`) on the sword's clip family, only `Heavy` re-keyed (the diagonal hack). On the shelf:
  `KNIFE` exported (the character lane's proposed timings: wind-ups ≥ 12, feints ≈ 40 % of the wind-up, damage/cost below a sword's; the
  critical's cost 26 → 20), `WEAPONS.knife` still the placeholder, no manifest entry.
- Measured on his rig with the knife's timings: slash lands to 1.2 m, stab 1.45, hack 1.55 (a man's sword 1.7 / 2.0 / 2.2; his placeholder
  today swings the man's table). The character lane's reverse-grip suggestion rejected with numbers: on the sword's clips it never lands (0 m
  at every gap) — it would need its own clips. Owner picked A, the sica (2026-09-17); C stays an option (REQUESTS §11).
- Evidence: tests/weapons.test.ts +4 (193/193 on the merged tree), `artifacts/weapons/REPORT.md` (knife section), sheets `knife-v1/`,
  `knife-B/`, `knife-C/`, `goblin-baseline/`. Hand-off to the combat lane: REQUESTS §9–10.

## Estoc v1 — the weapons lane — 2026-09-17
- Branch `weapons/estoc-v1` from trunk 9d08824. The Nightborn's estoc: a long, thin, thrust-first square-section blade with no edge,
  black iron cross + side ring, wire grip — 1,252 triangles, no textures, contact = the last 40 cm (the point); his own rig carries it
  (`src/assets/weapons/estoc/nightborn-estoc.glb`) with EVERY clip byte-identical to nightborn.glb (nothing re-keyed). On the shelf:
  `ESTOC` exported (the sword's timings and lunges exactly; cuts weaker, no chip; the thrust stronger and chaining; the riposte his payoff;
  `fight.thrustShare .7`; material `'steel'`, a new word in `Material` for audio), `WEAPONS.estoc` still the placeholder, no manifest entry.
- Measured on his rig: the blade lands 0.30 m past the sword everywhere (thrust 2.35, cut 2.0, heavy 2.5); `reach` stays the sword's
  conservative numbers per his brief, the margin reported for combat review. Owner's pick pending: A estoc (default), B rapier cut, C long
  tuck (REQUESTS §14). Hand-off: REQUESTS §12–13. Tests: 224/224.

## Arena life 2 — 2026-09-18 (owner's phone pass)
On the live build the owner approved firelight + gate light, rejected nothing new, and asked for two fixes. **Motes were
invisible in gameplay** — the phone camera looks down at busy, dark-speckled sand where a mid-grey speck has no contrast
and the drift was too slow to catch the eye: now 260 (62 % inside r 7.2), 0.2 m, 0.62 opacity, ~1.8× drift speed; owner: "too large, floating grey circles" → half size (0.1 m), kept the contrast + drift.
**Gear wanted inside the ring**: five more pieces (sunk shield, blade fragment, trodden helmet, snapped shaft) scattered
r 2.8–7.6, ≥ ~1 rad apart. The play-circle rule (nothing solid above 6 cm inside r 8.55) means everything lies flat or
squashed into the sand — the contract caught the shield boss at 7 cm. Captures: `artifacts/world/arena-life-2-tuning/`.

## Scythe v1 — the weapons lane — 2026-09-18
- Branch `weapons/scythe-v1` from trunk 7ee6e34. The Executioner's scythe (owner picked B over axe, 2026-09-18: the axe duplicated the
  Pitborn's cleaver): 1.32 m haft, 0.74 m blade, sweep .30, iron `#4c4946` — 495 triangles, no textures, contact = the head (1.22–1.32 m).
  His own 1.36× rig carries it (`src/assets/weapons/scythe/executioner-scythe.glb`) with a 13-clip `Scythe_*` family authored on it (the
  trident's two-hand grip solver, per-key blade roll so the crescent reads from the game camera). On the shelf: `SCYTHE` exported,
  `WEAPONS.scythe` still the placeholder, no manifest entry; the combat lane's flip is REQUESTS §15–17 and every part of it is a
  GAMEPLAY CHANGE (new timings, shaft guard profile, chip profile, the arc's dead band).
- Measured on the man-scale bake rig `warrior-scythe.glb` (the cleaver convention — his own 1.36× GLB bakes over a man's capsule and
  everything whiffs): reap lands 1.40–2.10 m, the headsman's high 2.30, the heel-jab 2.05; `reach` = the conservative spacing estimates
  1.8 / 2.0 / 1.8. The dead band is 1.40 m, not the brief's ~1 m — flagged for combat review. The bake caught and the rig test now pins:
  the striking segment must sit ON the target line at the clip's contact key (the first reap keyed it 0.7 m past the crossing and the
  whole active window whiffed).
- Evidence: tests/weapons.test.ts +4 (231/231 on the branch; shelf state, rig contract, contact-pose regression guard, data rules),
  `artifacts/weapons/scythe-notes.md`, sheets `scythe-A/`, `sche-B/…`, `scythe-C/`, `scythe-v1…v5/`, `executioner-baseline/`.
- 2026-09-18 (world lane): motes doubled 260 → 520 per owner live feedback ("motes are good. just double their number") after the
  half-size deploy (PR #123). Size stays 0.1 m, opacity 0.62, drift and gust unchanged — same specks, twice the air.

## Run Through repair — 2026-09-19 (implementation and local gates passed)
Goal: keep the blade through the animated torso and visible behind the kneeling opponent, until rematch.
Scope: characters.ts pose/aim, scene.ts post-pose alignment, rig regression and finisher-preview completion gate.
Fresh branch from trunk 3bfb0eb; inherited and partial alignment worktrees remain untouched.
Candidates: re-key every rig (fixed spacing still fails); rotate shoulder toward tip (reproduced 0.572 m miss);
grounded render-only step plus blade-midpoint alignment (selected). No new GLBs, dependencies or simulation data.
Failure F1 closed: the original inherited test reproduces a 0.572 m miss; both corrected regression tests and full quality pass.
Hold clip must be one-shot; reset post-mixer corrections before repeated/zero-dt evaluation and rematch.
Passed: all five real torso rigs, translated/rotated parents, variable frame times, red/dark/off, rematch,
real-scene captures and initial full quality (252/252). Both disabled-aim and loop-only mutations fail the regression.
Integrated quality passed 253/253 with lint/typecheck/build/audit, 8,366,568-byte per-fight budget and browser gate.
After the arena merge, configured browser checks and release receipts are recorded in artifacts/finishers/run-through/.
PR #149 carries the scoped fix; production verification is required before any live-resolution claim.
Sentry: unresolved 5/6/A/9/8 are asset fetch/texture/WebGL errors; no evidence linking them to pose alignment.
Three Semble searches + CodeGraph impact completed. No disputed graph edges or performance incident;
Tree-sitter/CPU profiler are not relevant. No cross-agent handoff or new agents.
## Combat audio takeover — 2026-09-19 (audio/reliable-playback, integration pending)
Distinct original cloth/sand roll and backstep cues consume existing ActionStarted events. Existing impact recipes and four-call shell contract stay unchanged. Quiet/mute stop active sample and fallback sources; quiet blocks scheduling synchronously until unlock. First-variant selection includes region zero; room send no longer squares the cue gain.
Evidence: artifacts/audio/takeover-{before,after}/REPORT.md and WAVs; artifacts/audio/takeover/NOTES.md and quality.log. Added optional --check to the real offline browser harness and registered it as a completion gate. AAC/Opus all 54 regions decode; forced first-format failure recovers; three exchange renders differ by at most one PCM rounding unit; eight stacked cues peak at -2.85 dBFS. Audio assets 605,004 B gzip, +60,706 B, within the 1 MB lane budget. Source/processing recorded in src/assets/README.md. Physical iPhone silent-switch checks, recorded Foley, continuous footsteps, ambience and music remain unverified/unimplemented. Required quality passed: 254/254 tests, lint/build/audit/budget and game browser; roster, Split Crown, estoc, counter-button and audio completion commands all passed. Branch prepared for PR; not deployed.

## Finisher side view — 2026-09-19 (implementation and visual checks passed)
Owner screenshot: hero shoulder hides Run Through and Split Crown at their settled ending. Success: smooth late side
move exposes both fighters in portrait, stays within arena, respects reduced motion/free camera and resets for next fight.
Scope: scene.ts camera endpoint and late blend; camera.test.ts; existing finisher-preview completion checks. No rigs/combat.
Candidates: more fixed lateral offset (unreliable with distance), snap to side (breaks continuous camera), smooth late
move to a fitted side view (selected). Reuse the current camera and presentation clock; no new module or dependency.
Three Semble queries + CodeGraph camera impact reviewed. F1 closed: before correction, the real-scene side-angle assertion
fails; after correction, the same assertion passes for Run Through and Split Crown on Veteran, Goblin and Executioner.
Visual review: both finishers expose the victim in portrait and landscape; red/dark/off, reduced motion, manual orbit and
normal camera return on rematch pass. Late motion stays continuous (maximum measured step 0.077 m/frame at 60 Hz).
Geometric tests cover both finishers around all arena edges, varied headings/spacings and portrait/landscape fields of view.
Evidence: artifacts/character/side-camera-{veteran,goblin,executioner}/ and artifacts/finishers/side-camera/REPORT.md.
Two-pass review: simulation/input/rig behavior untouched; actual rendered victims and existing finisher effects verified.
Local quality passed 261/261 after the arena merge; all seven configured completion commands passed. The subsequent fatal-audio
merge changed no camera/rig code; its new production build passed roster, Split Crown, audio, estoc, counter and arena gates.
PR #154; release quality reruns all tests on the final merge. Deployment and live-UI receipts are recorded separately in
artifacts/finishers/side-camera/ so the served revision remains the authority for publication.

## Fatal contact, death and crowd audio — 2026-09-19
Owner-authorized next audio pass: recorded human death grunts, organic fatal cuts/punctures, finisher-only tear/crack and three
2.5 s arena crowd reactions. The crowd celebrates either winner; simultaneous deaths get one gasp. Fatal impact stays on the
contact tick, voice follows at 30 ms and crowd at 350 ms. Plain falls and kneeling Run Through have different body cues.
Audio reads the same finish/weapon pair/visual override as the scene through one presentation-only main.ts call-site addition.
Blood-off suppresses the added wet layers; no simulation, damage, timing, controls, rigs or renderer changes.
Evidence: `artifacts/audio/fatal-before/` and `fatal-crowd/`; reproducible source hashes and CC0 licences in
`artifacts/audio/SOURCES.json` and `src/assets/README.md`. Audio is 996,816 B gzip (+391,812 vs movement pass), under the unchanged
1 MB limit. 73 AAC and Opus regions decode; format fallback passes; three deterministic exchange renders differ by <=1 PCM unit;
fatal stack peaks -2.85 dBFS; quiet/mute cancel future crowd/collapse sources. Lane quality: 261/261 tests, lint/build/audit/budget/game browser and all seven completion commands passed. Final publication is identified by the served release.json.
Physical phone/silent-switch listening remains unverified. Timing follows current authored presentation durations; no claim of
frame-perfect body contact on every rig. Music, sustained ambience and gait/breath events remain outside this pass.

## Phone audio balance — 2026-09-19 (release authorized)
Owner requested ordinary effects x0.5 and death/kill/crowd x1.5. Post-compressor gain preserves these ratios; an oversampled
output guard limits boosted transient peaks. Existing cue assets, tone recipes, timing and simulation are unchanged.
Measured ordinary loudness -5.9 to -6.0 LUFS; crowd tails +3.52 dB; complete fatal mixes +2.8 to +3.3 LUFS after limiting.
True-peak review caught +2.2 dBTP overshoots missed by sample peaks in the first candidate; corrected version reports at most
-1.0 dBTP with FFmpeg and -1.54 dBFS in browser 4x reconstruction. Five-band spectral energy changes at most 1.67 percentage
points. No additional EQ change justified; this is measurement, not a physical-phone listening claim.
Existing audio completion gate now checks the frozen pre-change mix, empty death ticks, rematch after quiet/mute and
reconstructed peaks. AAC/Opus/fallback, 17 ordinary probes, 12 fatal probes and eight crowd-tail checks pass.
Evidence: artifacts/audio/phone-mix/REVIEW.md, reference.json, frequency.json and gates.json. Full quality passed 264/264 tests,
lint/build/audit/budget/game browser; all eight configured completion commands passed, including native fatal playback/pause.
Release hold acknowledged: no audio trunk merge or deploy until world closeout and lead confirmation. Handset audition remains.
Integration: weapons trunk f7a1e99 merged cleanly; preserved its polearm gate. Integrated quality passed 265/265 tests and all
nine completion commands; GitHub CI passed on 827fe33. Receipt: artifacts/audio/phone-mix/integrated-gates.json. PR #158 held.

Audio release window granted by lead after world 8fcf58e. Current world trunk integrated without runtime conflicts; preserve
all configured gates. Final deployment/public parity and affected audio browser receipts go in artifacts/audio/phone-release/.
The physical phone audition remains unverified; use served release.json as the deployment authority.

## Arena life audio — 2026-09-19 (lane, not yet released)
Owner approved a quiet audience bed, short reactive cheers/gasps, sparse jeers and wordless chants, close hit grunts and an
opening low bell. Separate optional AAC/Opus bank uses pinned CC0 recordings; 15 regions,40.09s,388785B combined gzip under
its450KB cap. Existing combat sprites/cue rotation and half-effects/+50%-fatal mix are unchanged. No music in this pass.
Audio reads match identity and finish state; crowd voices cannot steal combat voices. Pause/mute stop all arena voices,
rematch rings once, no late decode starts playback, and fatal contact clears ambience for the established winning roar.
A pending-suspend/Enter race found during state audit now queues resume within the activating gesture; regression covered.
Rendered browser QC: crowd bed -38.58dBFS RMS, active fight -24.61dBFS; peak at most-1.0dBTP across AAC/Opus idle/fight/fatal/stress.
Both codecs/format fallback, overlap, variation, cooldowns,6-voice cap, quiet/mute/rematch and missing-bank continuity pass.
Evidence/provenance: artifacts/audio/arena-life/ and scripts/arena-audio-check.mjs. New completion gate preserves all inherited
commands. Native mobile-viewport welcome/menu/resume/actual defeat/rematch checks pass. All17 integrated release commands are
recorded in artifacts/audio/arena-release/gates.json; publication requires their success and exact-head CI.
Physical handset audition is still unverified.

## Opening bell repair — 2026-09-19 (Draw-only candidate)
Owner clarified the bell must fire on Draw Sword, not Enter or the rematch button. Returning profiles skip welcome, so the
old tick<120 window expired before their first Draw; waiting for the optional crowd bank also lost the cue on slow downloads.
The player's ActionStarted(draw) now triggers the unchanged original bell, with a local fallback if the bank is unavailable.
A pending draw survives asynchronous Safari unlock only while that same match remains in draw phase; quiet/mute, death,
phase end and match replacement cancel it. Enter, sheathed waiting, opponent draw and later unmute never arm a bell.
No combat/crowd/fatal gains or simulation changes. Rebuilt AAC/Opus assets remain byte-identical.
Offline regression covers fresh/returning Draw, pre-draw pause/mute, interruption, late unmute, opponent draw and rematch.
Six delayed-resume regressions fail before/pass after. Actual saved-profile and fresh/rematch browser checks are in the
existing arena gate; all24 inherited gates plus startup regression are retained. Evidence: artifacts/audio/bell-draw/.
61ed0cc deployment stopped during prepublication checks after owner clarification; it was never served (live remained74df626).
Physical handset listening remains unverified. Publication requires full gates and public verification; GitHub Actions is
billing-blocked, so the lead-approved exception requires fresh clean Node22/macOS reproduction of all CI commands.

## Bell weight — 2026-09-19 (candidate)
Owner confirms Draw bell is audible and requests2xlevel/+50%ring. Bell gain .22→.44 (+6.02dB), duration2.6→3.9s,
modal decay/release1.5x with original frequencies and attack. Shared generated fallback and rebuilt AAC/Opus bank agree.
No trigger, combat/crowd gain or simulation changes. Existing cancellation/startup/native gates use authored bell duration;
rematch silence is measured after the full ring. Focused units/typecheck and ten offline lifecycle cases pass.
Full offline mix across AAC/Opus/fallback passes truepeak<=-1dBTP; bell-only truepeak-13.3dBTP;401719B gzip under450KB.
Source/state audit completed. Evidence: artifacts/audio/bell-weight/. Game-browser/release work waits for lead window;
latest npm audit returned503maintenance, not bypassed. Full inherited gates and public verification required before done.
