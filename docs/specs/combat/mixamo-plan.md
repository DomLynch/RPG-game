# Mixamo animation plan (plan only, nothing downloaded)

Status: plan. No Mixamo login, download or credential was used. Not legal advice.

## A. Licence

Sources: Adobe's FAQ https://helpx.adobe.com/creative-cloud/faq/mixamo-faq.html (returned 403 to our fetch; its terms were read through the Adobe community copy https://community.adobe.com/t5/mixamo-discussions/mixamo-faq-licensing-royalties-ownership-eula-and-tos/m-p/13234775 and a search summary of the official page). Our earlier scan is in docs/research/donor-scan-free-libraries.md (Mixamo section, verdict GREY).

Allowed (per the FAQ):
- Free with an Adobe ID. Characters and animations are royalty free "for personal, commercial, and non-profit projects", video games included. No royalties.
- "You can use the auto-rigger, characters and animations in any type of creative project."
- Credit is optional: "not required to give credit to Adobe, Mixamo, or Fuse in any way".
- Shipping them inside a game build is the intended use.

Not allowed:
- Distributing the raw files: "really the only thing you can't do is distribute the raw character and animation files". Examples barred: asset-store packs, engine templates or blueprints that redistribute the raw files as the product, and free distribution of the raw files.
- Training machine-learning models: "The only research application Mixamo content can't be used in is training machine-learning models." So no AI training or fine-tuning on Mixamo clips.
- Reselling or giving away the clips as an animation pack.
- Bipedal humanoids only (the auto-rigger and library).

Open points (be honest):
- The FAQ never mentions web games. A browser game serves its GLB from a public URL where anyone can save it. That is arguably "distributing the raw file". Adobe has not said it is fine. Retargeting and baking into our own rig narrows the risk but does not remove it (still extractable).
- The FAQ text we could read dates from the 2022 "technology preview" era; the current official page may word it differently. Re-read the live page on the day Dom downloads.

What we must do:
1. Keep the downloaded FBX files OUT of the public repo. The repo is public, so a committed FBX is a plain raw-file redistribution. Keep them in a private place (Dom's Mac and the VPS, outside any git tree; add a gitignore line for the drop folder).
2. Commit only our own baked output (clip JSON like src/assets/hamstrung-killer.json, or a rig GLB), never the Mixamo rig, never the FBX.
3. Credit anyway on the credits page (courtesy, optional): "Some combat motion from Adobe Mixamo." Add a row to the provenance list in src/assets/README.md (clip name, Mixamo name, date downloaded, settings).
4. Never feed the clips into any ML tool (no HF motion model, no AI retargeter trained on them).
5. Optional but wise: ask Adobe support in writing whether baked clips in a browser-served game are fine; if the answer matters to Dom, that is his call.
6. Do NOT reuse the SoulsLike repo (/mnt/frankendom-donors/pabloolvr-SoulsLike, 59 Mixamo FBX, no licence). It has no licence granting us anything, and re-hosting its FBX is exactly the raw-file case. We may only read its file names (done below as a naming check).

## B. Our rig and clip pipeline (read from the repo)

- Rig: 65-bone skin in src/assets/warrior.glb, Unreal/Quaternius-style names, NOT "mixamorig:": root, pelvis, spine_01..03, neck_01, Head, clavicle_l/r, upperarm, lowerarm, hand, 5 fingers x 4 (incl. *_04_leaf), thigh, calf, foot, ball, ball_leaf. Mixamo uses mixamorig:Hips, Spine/Spine1/Spine2, Neck, LeftArm, LeftForeArm, LeftHand, LeftUpLeg... with different rest orientation and no root bone.
- 27 clips on warrior.glb (Idle, Walk, Jog, Run, Armed, Attack, Hit, Death, Draw, Roll, Guard, Return, Heavy, Riposte, ArmedWalk, StrafeLeft/Right, Kick, BlockImpact, Parry, Deflected, Death_SplitCrown, Death_RunThrough, Fin_RunThrough, Death_QuietOne, Skill_WitchArm, Skill_Pommel).
- Provenance: the base motion is CC0 Quaternius UAL1/UAL2, retargeted by hand-written code inside scripts/build-warrior.mjs (src/assets/README.md "Motion pass"); polearm and maul families are authored in code with a two-bone arm reach onto the shaft. GAME_SPEC.md line 216 states plainly: "The earlier generic retargeting code does not establish Mixamo compatibility." So there is NO Mixamo retarget path today. No Blender retarget script exists in scripts/character/ (it holds mesh, head, parts and creature rigs only).
- Per-weapon clips: src/fight/characters.ts WEAPON_CLIPS maps roles to clips (maul: Maul_*, reaper/scythe: Scythe_*, warhammer, trident; sword family uses the shared clips; longsword/cleaver/knife/estoc/gladius only override Thrust: 'Riposte'). PLAYER_CLIPS overrides per player. clipFor(weapon, role, player) resolves it.
- How a new clip is added (two ways in the repo):
  1. New role in ROLES / COMBAT_CLIPS, clip appended to the GLB, WEAPON_CLIPS row names it (tests/characters.test.ts checks every role resolves).
  2. Additive, no GLB change: ADDITIVE_ROLES (Death_Hamstrung, Fin_Hamstrung, Death_Execution, Fin_Execution). scripts/build-hamstrung.mjs and build-execution.mjs build the clip against the rig, write plain clip JSON (src/assets/hamstrung-killer.json), adopted at runtime by adoptClip in characters.ts. scripts/append-finisher.mjs appends clips to a GLB with provenance, byte-stable and re-runnable. PLAYER_ONLY_CLIPS ['Skill_WitchArm','Skill_Pommel'] are clips only the player's rig carries.
  For special moves, route 2 (JSON beside the rig, adopted on demand) is the least invasive and keeps warrior.glb untouched.
- Cost: Blender 5.2.2 LTS is on the VPS (/usr/local/bin/blender, confirmed by ssh). A Mixamo-to-our-rig retarget is a small headless Blender job (CPU, minutes per clip, VPS per Dom's heavy-job rule; no GPU). The real cost is the one-time bone map and tuning (rest-pose differences, hand/shaft grip fixes, foot plant), roughly one lane-day for the mapper, then about an hour per clip to check against the weapon blade paths (scripts/bake-blades.mjs regenerates collision paths).

## C. Shopping list (Mixamo names)

Name confidence: the "Standing Melee ..." names are CONFIRMED as real Mixamo file names, because the SoulsLike repo's FBX list carries them (standing melee attack 360 high / 360 low / backhand / downward / horizontal / kick ver. 1,2 / combo attack ver. 1-3 / run jump attack). Web search could not list Mixamo's catalogue, so every other name below is from memory and UNVERIFIED: Dom must confirm each by typing it in Mixamo's search box and picking the nearest if it was renamed.

Download settings for every clip: Format FBX Binary (.fbx), Frame rate 30, Skin "Without Skin", Keyframe Reduction "none", and tick **In Place** for every move our sim drives (the sim owns position; root motion would fight the pelvis tracks). Exception: lunge and run-jump, download BOTH in-place and with-root-motion so we can read the travel distance, then use in-place plus our own sim step.
Character for preview only: any default (Y Bot); use "T-pose" upload not needed because we download without skin.

| # | Mixamo name | Our move | Weapon class | Variant |
|---|---|---|---|---|
| 1 | Standing Melee Attack Downward (confirmed) | Skull Crack (overhead) | sword, maul, warhammer | in place |
| 2 | Two Handed Sword Heavy Attack (unverified) | Skull Crack, heavy | maul, warhammer, greatsword | in place |
| 3 | Great Sword Slash (unverified) | Side Head-Smash / heavy horizontal | maul, sword | in place |
| 4 | Standing Melee Attack Horizontal (confirmed) | Reaping Sweep | scythe, trident sweep, sword | in place |
| 5 | Standing Melee Attack 360 High (confirmed) | Whirlwind | sword, scythe, trident | in place |
| 6 | Standing Melee Attack 360 Low (confirmed) | Whirlwind low / leg sweep | scythe, polearm | in place |
| 7 | Standing Melee Attack Backhand (confirmed) | Side Head-Smash (backhand) | maul, sword | in place |
| 8 | Standing Melee Run Jump Attack (confirmed) | Ground Slam (leap and smash) | maul, warhammer | in place AND root motion |
| 9 | Standing Melee Combo Attack Ver. 1 (confirmed) | combo source, lunge poses | sword | in place |
| 10 | Sword And Shield Slash (unverified) | one-hand cut variants | sword, gladius | in place |
| 11 | Sword And Shield Power Up (unverified) | special wind-up / charge tell | all | in place |
| 12 | Standing Melee Attack Kick Ver. 1 (confirmed) | Kick alt | all | in place |
| 13 | Sword And Shield Attack (unverified) | Lunge / Impale (thrust) | sword, estoc, trident | in place AND root motion |
| 14 | Mutant Swiping (unverified) | Reaping Sweep, heavy / creature | scythe, big creatures | in place |
| 15 | Zombie Attack or Mutant Jump Attack (unverified, pick the ground-pound-looking one) | Ground Slam alt | maul, creatures | in place |
| 16 | Standing Taunt Battlecry (confirmed) | special start roar | all | in place |

Notes: Mixamo has few true spear/polearm thrusts; if no thrust (13) reads as a lunge, author the lunge from the sword Riposte clip with our own reach code (as the trident does now). Scythe and trident need the two-bone arm reach re-solved onto the shaft after retarget, as Heavy and Riposte were. Polearm grips will not match Mixamo's one/two-hand sword grips; expect hand fixes for maul, scythe, trident.

## What Dom must do himself

1. Log into mixamo.com with his own Adobe ID (we never log in, never enter credentials).
2. Search each name in the table, preview it on any character, and for each: set Skin "Without Skin", Format "FBX Binary (.fbx)", Frame rate "30", Keyframe Reduction "none", tick "In Place" (and for rows 8 and 13 also download a second copy with In Place unticked, saved with "-rootmotion" in the name). Download.
3. Note which names did not exist or were renamed and tell us the replacement.
4. Put the FBX files in ONE folder outside any git repo (for example ~/Documents/mixamo-drop/), then copy them to the VPS at /srv/dev-jobs/mixamo-drop/. Do not commit or share them.
5. Optional: send Adobe support the web-game question (section A) and keep the reply.

## What we do after

1. Build scripts/character/mixamo_retarget.py (Blender headless on the VPS): import the FBX, map mixamorig bones to our 65 names, bake onto our armature, fix rest-pose twists, plant feet, solve weapon grip per class.
2. Output clip JSON per move beside the rig, adopted by adoptClip, new ADDITIVE_ROLES / special roles in characters.ts and WEAPON_CLIPS rows; collision paths via bake-blades; the clips stay data rows (as-data gate).
3. Preview in the sandbox for Dom's phone; Lead publishes.
4. Commit only baked clip JSON and a provenance row in src/assets/README.md plus the credits line. FBX stay out of the repo.
