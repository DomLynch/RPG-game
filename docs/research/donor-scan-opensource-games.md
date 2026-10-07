# Donor scan: open-source games and open-movie projects (3D characters and creatures)

Scope: open-source games and open projects whose 3D character/creature ART is released under an open licence. Researched 2026-10-07 from project pages, licence files and repo listings. Not legal advice; get a licence review before shipping anything CC-BY-SA.

Legend: VERIFIED = read from the licence file/page this session. SEARCH-ONLY = from a search summary, not re-read at source. UNVERIFIED = inferred or not checked.

Hard facts that frame the whole list:
- No open-source GAME in this scope ships art at the quality of our fighters (46k-62k tris, painted PBR). Game art is 2-12 years behind: low-poly RTS meshes, 2004-era MMO meshes, Quake-engine monsters, voxels.
- The highest-quality legal donors are the Blender Foundation / Blender Studio open-movie rigs (CC-BY, film-grade, Blender-only). They are not games, but they are the only candidates in this scan that approach our bar.
- CC-BY-SA donors (Ryzom, 0 A.D., Unvanquished, Warzone, Red Eclipse) force any edited model we ship to be re-released CC-BY-SA with credit. Treat as "usable, but the edited mesh becomes public".
- GPL art (Xonotic) is the riskiest: GPL on a mesh/texture has no settled position for closed games. Avoid.

## TOP 10 (best quality + safest licence first)

| # | Candidate | Art licence | Closed commercial? | What we would take | Quality | Fit for Frankendom |
|---|---|---|---|---|---|---|
| 1 | Blender Studio "Charge": Einar (and Huginn robot) | CC-BY | Yes, credit | Einar: Icelandic scavenger humanoid, realistic-stylised, full facial rig | Film grade, 553 MB rig file | Human NPC / bandit base; Blender 3.5+ only |
| 2 | Blender Foundation "Sintel": Scales adult dragon + baby dragon, Sintel, Emo, Proog | CC-BY | Yes, credit | Adult dragon (wings, 5 viewport detail levels), warrior woman Sintel | Film grade 2010, reworked 2022 | Best dragon candidate; Blender 3.4 |
| 3 | Blender Studio "Spring": Alpha creatures (and Spring, forest animals) | CC-BY | Yes, credit | Alpha "ominous and majestic creatures", forest animals | Film grade, Alpha rig 496 MB | Wild-mob creatures; Blender 2.8+ |
| 4 | Blender Studio "Sprite Fright": Sprite, Elder Sprite | CC-BY | Yes, credit | Mushroom monsters, small rigs | Stylised cartoon-horror | Small mobs only; 6.9 MB / 2.9 MB |
| 5 | Ryzom (ryzom-data / Ryzom Commons) | CC-BY-SA (3.0 per release, 4.0 licence file in repo) | Yes, but edits must be CC-BY-SA | ~200 monsters, 5 races, ~1200 animations, mounts | 2004-era MMO, low-mid poly, painted textures | Real fantasy fauna; 3ds Max / NeL .shape; needs conversion |
| 6 | 0 A.D. | CC-BY-SA 3.0 | Yes, but edits must be CC-BY-SA | ~87 animals (bear, wolf, lion, tiger, horse, mastiff, dragon), human soldiers | Low-poly RTS (hundreds to ~1-3k tris est.) | Too low-poly; Collada .dae |
| 7 | Unvanquished | CC-BY-SA 2.5/3.0/4.0 mixed | Yes, but SA | Alien creatures (Tyrant, Dragoon, Marauder, Mantis, Dretch, Granger), armoured humans | Q3-engine era, md5/iqm | Sci-fi, wrong theme |
| 8 | Red Eclipse | CC-BY-SA (default) | Yes, but SA | Player model + weapons (.blend available) | Low-poly arena shooter | Sci-fi, wrong theme |
| 9 | Warzone 2100 | CC-BY-SA 3.0 (some CC0) | Yes, but SA | Mechs/tanks/cyborgs | Low-poly RTS | Wrong theme |
| 10 | Veloren | CC-BY and CC-BY-SA mix, per-asset | Yes, per-asset terms | Voxel humans, monsters, dragons | Voxel (.vox) | Style mismatch with realistic target |

NOT USABLE (details below): PlaneShift (custom non-free content licence), Eternal Lands (proprietary binary data), Overgrowth (art not released), The Dark Mod (CC-BY-NC-SA, NC = no), GDQuest 3D Characters (CC-BY-NC-SA and robots), Xonotic (GPL, risky; listed as a flag, not recommended).

## Candidate details

### 1-4. Blender Foundation / Blender Studio open-movie characters
- URL: https://studio.blender.org/characters/ (listing). Character pages checked: Einar https://studio.blender.org/characters/einar/v1/ , Huginn https://studio.blender.org/characters/huginn/v2/ , Scales adult https://studio.blender.org/characters/5d403c21ee3219164b952e20/v2/ , Scales baby https://studio.blender.org/characters/5703a17dc379cf032c7b2616/v2/ , Sintel https://studio.blender.org/characters/5d41a32b8307e9cd1023fa78/v2/ , Alpha https://studio.blender.org/characters/alpha/ , Sprite https://studio.blender.org/characters/sprite/v1/ .
- Art licence (VERIFIED on each page): "CC-BY (Creative Commons Attribution)". Required credit text on Einar page: "Einar Rig (CC-BY) Blender Foundation | studio.blender.org". Sprite Fright project page https://studio.blender.org/projects/sprite-fright/pages/about/ : content can be freely reused and distributed "also commercially, as long you include proper attribution" and the stated attribution is "(CC) Blender Foundation | studio.blender.org". Exceptions: logos, trademarks, non-Blender-produced materials are excluded from the CC licence. Note: that page cites Creative Commons Attribution 1.0 for Sprite Fright; character pages say CC-BY without version. Confirm the version on each file we use.
- Code licence: n/a (character .blend files). Blender itself is GPL, which does not affect the output meshes.
- Closed-source commercial: YES with credit. No share-alike. Best licence in this whole scan.
- Characters (VERIFIED from listing, https://studio.blender.org/characters/ ): Einar, Huginn (Charge); Sprite, Elder Sprite (Sprite Fright); Scales baby dragon, Scales adult dragon, Sintel, Emo, Proog (Sintel); Spring and Alpha (Spring); Snow, Rain (listed "Free"); Forest Animals, Cat, Dog, Whale, Ballan Wrasse, Critter, Critter Evolved, Space Creatures, One (Singularity), Storm, Mikassa (licence field "not specified" on the listing page, check each page before use).
- Quality: production film rigs. Hi-res, subdivision/modifier based, Principled BSDF materials; adult dragon page lists 5 viewport detail levels plus a low-detail preview. Exact triangle counts NOT published (UNVERIFIED). Expect far above our 46-62k budget before decimation (dragon, Einar likely hundreds of thousands once subdivision is applied) so we must retopologise/bake down.
- Rig: full production rigs (Rigify/CloudRig/BlenRig style), facial controls. Linked collection + Library Override workflow, which means we cannot just open and export; we must make the override real/apply modifiers in Blender, then bake and re-rig to our humanoid skeleton or export as GLB.
- Format: .blend only. Version gates: Einar and Huginn need Blender 3.5+ (Einar reports problems on 4.0), Scales/Sintel need 3.4, Sprite needs 3.3-3.6, Alpha 2.80+, One needs 5.0.
- Style: Sintel/Scales/Alpha are painted-realistic fantasy; Einar stylised-realistic; Sprites cartoon-horror. Sintel dragon (Scales) is the one clearly fantasy-creature donor with matching look.
- Access: downloads need a free Blender Studio account (page says so for Sintel and One). Whoever downloads must do it by hand. Sizes: Spring 406.5 MB, Alpha 496.5 MB, Einar 553 MB, Huginn 248.6 MB, Sprite 6.9 MB, Elder Sprite 2.9 MB.
- Other Blender open-movie sources: https://download.blender.org/demo/ and https://download.blender.org/durian/ host older production files; Big Buck Bunny, Elephants Dream (CC-BY 2.5 per project, UNVERIFIED here), Sintel. Yo Frankie! (below).
- Verdict: top donor for dragon, creature and a human NPC. Cost: Blender-only conversion work, retopo, re-rig.

### Yo Frankie! (Blender Institute "Apricot" game)
- URL: https://apricot.blender.org/ (archive); Wikipedia: https://en.wikipedia.org/wiki/Yo_Frankie!
- Art licence (SEARCH-ONLY): "all content being licensed under Creative Commons license Attribution 3.0"; game code GPL/LGPL.
- Closed commercial: yes with credit.
- Characters: Frankie (flying squirrel), Momo (monkey), Big Buck Bunny cast, Sir Fatwhisker not confirmed.
- Quality: 2008, low-poly for Blender Game Engine, cartoon. Not suitable for realistic duel; at most background animals. UNVERIFIED tri counts.
- Format .blend.

### 5. Ryzom Core / ryzom-data (Atys)
- URLs: https://gitlab.com/ryzom/ryzom-data (description: "Open Source Ryzom Data (code are released under AGPLv3, assets are released under CC-BY-SA)", VERIFIED via GitLab API); https://atys.wiki.ryzom.com/wiki/Ryzom_Commons:About ; Blender port https://www.sourceforge.net/projects/ryzomblend .
- Art licence: CC-BY-SA. Original 2010 release: "models, textures, and other art are covered by CC-BY-SA 3.0" (SEARCH-ONLY, FSF/Ryzom announcement; FSF blog https://www.fsf.org/blogs/licensing/ryzom-free-software cited via LWN). The data repo ships both `LICENSE` (AGPLv3, code) and `LICENSE-CC-BY-SA` (VERIFIED: "Attribution-ShareAlike 4.0 International"). Ryzom Commons says "Individual media files have their own license conditions displayed on their description pages" so per-file checks are required. OpenGameArt texture subset: attribution "Nevrax SARL / Winch Gate Properties Ltd. Ryzom. https://atys.wiki.ryzom.com/wiki/Ryzom_Commons:About" (https://opengameart.org/content/ryzom-selected-textures , VERIFIED).
- Code licence: AGPLv3 (separate; irrelevant if we only take art).
- Closed commercial: yes, but any edited model/texture we distribute must be released CC-BY-SA with credit. Also the repo README says primitives are "private data", so not everything is public; assume the public data is the CC-BY-SA subset.
- Content: ryzomblend (SourceForge, last updated 2016-01-22, alpha) states "1200 animations, ~200 monsters, 5 races, and lots of vegetation" (VERIFIED on page), licence "Creative Commons Attribution ShareAlike License V3.0". ryzom-data `final_bnps/fauna_shapes` lists mounts and bosses (capryni, gnoof, gubani, mektoub, carnitree boss, kitinega, phytopsy; VERIFIED). Playable races: Fyros, Matis, Tryker, Zorai (humanoid male/female). Hand-picked textures also on OpenGameArt.
- Quality: 2004 MMO. Characters low-mid poly (UNVERIFIED, expect a few thousand tris), hand-painted textures; monsters stylised fantasy (kitin insects, goo, kami). Not realistic PBR.
- Rig: NeL skeleton (.skel) + animation sets; 1200 animations.
- Format: source in 3ds Max (.max) plus NeL .shape/.skel/.anim; Blender conversion via ryzomblend (third party, 2016); also an assimp_py repo at https://gitlab.com/ryzom/assimp_py. Needs conversion work; Windows/3ds Max centric pipeline per the README.
- Style: painted fantasy, stylised-realistic. Best game-based source of fantasy monsters, but SA and low fidelity.

### 6. 0 A.D.
- URL: https://gitea.wildfiregames.com/0ad/0ad (migrated from https://github.com/0ad/0ad , archived mirror).
- Art licence (VERIFIED, https://raw.githubusercontent.com/0ad/0ad/master/LICENSE.txt): "binaries/data/mods/*/art ... Creative Commons Attribution-Share Alike 3.0". Art dir LICENSE.txt: "If you distribute one of these files, you must release it (and any modifications you have made to it) under the CC-by-sa license." Attribution must name "Wildfire Games" and link http://www.wildfiregames.com/ . Some textures derived from CGTextures with special permission as CC-BY-SA. Code/data: GPL v2 or later.
- Closed commercial: yes, SA on edits.
- Content (VERIFIED from repo listing, art/meshes/skeletal): ~87 skeletal meshes, mostly animals: bear, polar bear, wolf, wolfhound, mastiff, lion, tiger, boar, horse variants, elephants (incl. armoured war elephants), crocodile, fox, rhino, hippo, walrus, dragon.dae, hawk, crow. Human bodies under skeletal/new: male/female bodies with tunic/armour variants (m_naked, m_armor_*, m_hero_caros ...).
- Quality: RTS low-poly. dragon.dae is tiny (339 vertices in the visible file counts, UNVERIFIED mapping); wolf.dae 123 KB, bear.dae 708 KB. Textures typically 512-1024 (UNVERIFIED).
- Rig: skeletal with animations (animation dir); Format Collada .dae + textures.
- Style: low-poly realistic RTS. Not enough fidelity for close duel cameras; maybe distant mob filler.

### 7. Unvanquished
- URL: https://unvanquished.net/ ; media credits https://wiki.unvanquished.net/wiki/Credits/Media (VERIFIED).
- Art licence: models "primarily released under CC BY-SA, most CC BY-SA 3.0 or 4.0"; Marauder CC BY-SA 2.5; project says assets cleaned up fully open after a 3-year effort (SEARCH-ONLY: Phoronix https://phoronix.com/news/Unvanquished-Open-Source-2020 ). Engine Daemon GPLv3.
- Closed commercial: yes, SA on edits.
- Content: aliens (Tyrant, Dragoon, Marauder, Mantis, Dretch, Granger), human armour (Battlesuit, Light/Medium Armor male), buildings, weapons.
- Quality: Q3-derived engine, mid-poly models with normal/spec maps. Counts UNVERIFIED.
- Rig/format: MD5 (md5mesh/md5anim) and IQM; Blender export possible.
- Style: sci-fi alien creatures; only the Tyrant/Dragoon style big monsters could be re-skinned as fantasy beasts.

### 8. Red Eclipse
- URL: https://www.redeclipse.net/ ; licence statement via Debian copyright https://metadata.ftp-master.debian.org/changelogs/main/r/redeclipse-data/stable_copyright (SEARCH-ONLY): "In the absence of an explicit license, content ... is considered to be covered by the CC-BY-SA license, either version 3.0 or (at your option) any later version." Content not covered by the code licence. Player model and some weapons ship with .blend files (SEARCH-ONLY).
- Closed commercial: yes with SA caveat; check per-file lines (some content has individual restrictions).
- Fit: sci-fi arena shooter, low-poly. Skip.

### 9. Warzone 2100
- URL: https://wz2100.net/ ; Debian copyright https://metadata.ftp-master.debian.org/changelogs/main/w/warzone2100/stable_copyright (SEARCH-ONLY). Art Revolution (ARmod) is CC-BY-SA-3.0+ or GPL2+ (SEARCH-ONLY, https://www.sourceforge.net/projects/artrev2100 ). Some data CC0.
- Fit: tanks/mechs, no fantasy creatures. Skip.

### 10. Veloren
- URL: https://veloren.net/ , repo https://gitlab.com/veloren/veloren
- Licence: code GPL-3 (VERIFIED, README FAQ). Art: devblog/search summary says artwork under CC-BY and CC-BY-SA after weighing both (SEARCH-ONLY, https://planet.freegamedev.net/?p=80690). Attribution per asset in https://gitlab.com/veloren/veloren/-/blob/master/assets/credits.ron (file exists, VERIFIED listing). No single art licence file found at assets/ (404 on LICENSE/README).
- Content: large voxel creature roster (dragons, golems, humanoid species, wild animals), community made.
- Format: MagicaVoxel .vox, stylised voxel. Conversion to PBR realistic would need full retopo and repaint. Not recommended.

## Checked and rejected

- PlaneShift (https://www.planeshift.it/): source GPL, "artwork, text and rules ... use a custom nonfree license called the PlaneShift Content License" (SEARCH-ONLY via https://b.mtjm.eu/planeshift-free-software.html and LWN). Client may only connect to official servers, cannot be sold. Do not use. Do NOT rip.
- Eternal Lands (https://www.eternal-lands.com/): "Eternal Lands Client Public License" treats Binary Data (art, 3D, animations) as proprietary, "should not be used without permission" (SEARCH-ONLY, Gentoo licence file https://mirror.umd.edu/gentoo-portage/licenses/eternal_lands ). Do not use.
- Overgrowth (Wolfire): code Apache 2.0, but "game data (art assets and levels) can only be legally obtained by purchasing"; distributing assets needs written permission (SEARCH-ONLY, https://gameworldobserver.com/2022/04/22/wolfire-turns-overgrowth-into-open-source-game-making-it-free-for-modding-and-changing ). Not open art. Do not use.
- The Dark Mod: "Many non-software components are released under the Creative Commons BY-NC-SA" (VERIFIED on https://en.wikipedia.org/wiki/The_Dark_Mod ). NC means no commercial use. Do not use.
- GDQuest godot-4-3D-Characters (https://github.com/gdquest-demos/godot-4-3D-Characters): "Art assets (image textures and 3D models) are CC-BY-NC-SA 4.0" (VERIFIED, readme). Also robots only (GDBot, Sophia, Gobot, bats/bugs). Do not use.
- Godot demo projects (https://github.com/godotengine/godot-demo-projects): "distributed under the terms of the MIT license" (VERIFIED, README). Characters are simple demo meshes (robot etc.), not a donor.
- Xonotic (https://xonotic.org/): game stated as "copyleft GPLv3+" (VERIFIED on homepage); media "GPL or CC0 CCBY or CCBYSA" (SEARCH-ONLY). Monster models present in `models/monsters` (VERIFIED listing): golem, nanomage, spider, wyvern, zombie, each with LOD1/LOD2 in Darkplaces .dpm format (zombie.dpm 3.1 MB, spider.dpm 4.8 MB, wyvern.dpm 3.4 MB, golem.dpm 3.2 MB, nanomage.dpm 2.6 MB incl. animation frames; triangle counts not extracted, UNVERIFIED). Licence for these specific files not checked, likely GPL. GPL on art in a closed game is an unsettled risk, so flag: avoid.
- Not individually researched (UNVERIFIED, expected low fit): Tremulous, OpenArena, Sauerbraten, SuperTuxKart, Beyond All Reason, Stunt Rally, Vega Strike, Glest/MegaGlest, Hedgewars, Solarus, Freedoom, Unknown Horizons, FLARE (2D), The Mana World (2D). None is known to carry realistic fantasy humanoid/creature art.

## Practical recommendation

1. Start with Blender Studio CC-BY rigs: Scales (adult dragon), Alpha (Spring), Einar. They are the only candidates near our quality bar and carry the safest licence.
2. Ryzom is the only game that gives us a big roster of ready fantasy monsters and 4 races; usable only if we accept CC-BY-SA on edited meshes and a conversion pipeline (3ds Max / NeL to Blender to GLB).
3. Everything else in this scan is low-poly, sci-fi, voxel, or non-commercial.

## Open questions to settle before any use
- Confirm exact CC-BY version on each Blender Studio file after download (page text omits the version for most rigs).
- Pull real triangle counts in Blender for Scales, Einar, Alpha after applying modifiers; none are published.
- CC-BY-SA: get a decision on whether our game build counts as a "collection" vs an adaptation of the SA models; until decided, assume edited meshes must be published CC-BY-SA.
- Per-file licence check of Ryzom data (Ryzom Commons says each file has its own page).
