# Ashcourt warden asset

Foundation: Quaternius, Universal Base Characters (Standard), Superhero_Male_FullBody.
https://quaternius.com/packs/universalbasecharacters.html
https://quaternius.itch.io/universal-base-characters

Motion: Quaternius and Gonzalo Furnier, Universal Animation Library (Standard v3),
Unreal-Godot/UAL1_Standard.glb (root motion disabled).
https://quaternius.com/packs/universalanimationlibrary.html
https://quaternius.itch.io/universal-animation-library

Both foundations are CC0 1.0: https://creativecommons.org/publicdomain/zero/1.0/
Retrieved from the creator's free itch.io downloads on 2026-09-13; no purchase or seller contact.
The original animation archive's License.txt is preserved alongside this file.

Original project work: helmet, fitted plate harness, heraldry, scabbard, surface maps,
body proportion adjustment, sword geometry, authored guard pose, draw transition and animation retargeting. This is an early original character
art pass; no claim of final AAA art or complete combat animation coverage.

Rebuild: extract the two official Standard archives into artifacts/source/base and
artifacts/source/animations, preserving their archive directory names. Run
`node scripts/build-warrior.mjs` from the repository root. The script uses only
locked project dependencies and writes warrior.glb. Source archives stay ignored.
The free body has broader proportions; the finished model narrows its width by 10%.
Included source clips: Idle_Loop, Walk_Loop, Jog_Fwd_Loop, Sprint_Loop, Sword_Idle,
Sword_Attack, Hit_Chest, Death01 and Roll. Draw and Guard are authored offline on the same rig. Roll pelvis translation is kept in place horizontally; the simulation owns travel. Runtime animation
never moves simulation. The two fighters share geometry and use separate skeletons.

Source archive SHA-256:
- base.zip: fdbf1804c90dfc1ea03e992bff7da2dfd1a79318e13270a660180f9308455f40
- animations.zip: cc73fc4e495b82958207316596317a3f40b9fa38065bde1027937452da537724

Combat feel pass: the same CC0 Sword_Attack supplies a reversed Return (backhand) clip. Heavy and Riposte are original offline-authored two-arm poses on this rig, exported by scripts/build-warrior.mjs. No additional third-party source, audio sample or licence is introduced. Runtime audio is original procedural noise/resonance synthesis. These 14 exported clips include the three additions; this is not a claim that all 14 distinct spec checklist roles are filled (bespoke guard impact and alternate hit remain absent).
