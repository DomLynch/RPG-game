# Donor scan: FREE asset libraries (not games)

Scope: free libraries whose models we may legally use and edit in a closed-source commercial web game, where the GLB is downloadable by anyone with browser dev tools. Researched 2026-10-07.

Evidence key
- VERIFIED = read this session from the live page, from Sketchfab's public API (`api.sketchfab.com/v3/models/<uid>`, fields `license`, `faceCount`, `animationCount`, `isDownloadable`) or from the licence text itself.
- UNVERIFIED = from a search-result summary, from memory, or the page blocked me (Fab, Adobe, CGTrader, TurboSquid and BlenderKit full text returned 403/redirect). Re-check before spending art budget.
- Not legal advice. Anything marked "grey" needs Dom's decision or a lawyer's read.

Headline findings
1. Nothing free matches our own fighters (46-62k tris, painted PBR, our rig) as a ready drop-in. The only free sources with high-detail, textured, rigged-or-riggable fantasy bodies are individual Sketchfab CC-BY uploads. The safest (CC0 / Quaternius) are stylised low-poly (about 4-13k tris).
2. The "downloadable GLB" condition kills the stock-marketplace licences. TurboSquid, CGTrader and BlenderKit Royalty-Free licences require the model not be retrievable by end users. A browser-served GLB is retrievable. Treat them as NO for runtime assets.
3. CC0 and CC-BY are the only two licences that are safe with a browser-served GLB. CC-BY needs a visible credits line (title, author, source link, licence link, "modified" note when we edit).
4. Exclude every Sketchfab upload that is fan art or a game rip (Tarisland, Mir4, Skyrim, Fortnite, Hollow Knight, League of Legends and similar). They show as "CC-BY" but the uploader cannot grant rights to someone else's IP. I filtered them out of the table.
5. Trap: a Sketchfab model titled "CC0 - Free Rigged Character" (reinhpash, 27k tris) is actually licensed CC Attribution (VERIFIED by API). Always read the licence field, not the title.
6. Sketchfab's `animationCount` counts clips; it does not prove a skeletal rig. Download the GLB and check for a skin before committing (UNVERIFIED for every row below).

---

## TOP 15 ranked (best quality first, then safest licence)

Tris are Sketchfab API `faceCount` (VERIFIED) unless noted. All "CC-BY" rows need credit. "Rig" is UNVERIFIED unless stated.

| # | Model / pack | Source + URL | Licence | Tris | Textures | Rigged / animated | Style | Notes |
|---|---|---|---|---|---|---|---|---|
| 1 | Medieval Knight (Sculpture, game ready), by__Rx | Sketchfab https://sketchfab.com/3d-models/medieval-knight-sculpture-game-ready-6cdd055b4afa41eb9360dbbfe75c7f10 | CC-BY 4.0 (VERIFIED) | 41,654 | PBR (UNVERIFIED sizes) | 1 anim (idle). Author says Mixamo was used, so Mixamo terms apply to that animation | Realistic ZBrush-sculpted plate knight | Closest free match to our hero tier. 2,018 likes. Re-rig to our skeleton |
| 2 | Medieval Knight rigged for UE4/5, Andy Woodhead | https://sketchfab.com/3d-models/medieval-knight-rigged-for-ue45-1c7a83c0832a4ab28d9f1a46d282fcf9 | CC-BY 4.0 (VERIFIED) | 51,054 | Colour + normal embedded; metal/rough manual | Rigged to UE mannequin skeleton; 0 anims | Realistic, ZBrush | Same tri budget as our fighters. Page says "use this model in any way" |
| 3 | European Dragon, Regina Cachoa | https://sketchfab.com/3d-models/european-dragon-82f393a2e6c048ad80c171ce3b3a7b87 | CC-BY (VERIFIED) | 42,338 | 2k and 4k hand-painted | Rigged; idle, sit, walk, run, fly (5) | Painted-realistic quadruped dragon | Best dragon found that is rigged, animated and on a usable licence |
| 4 | Orc Warrior, SamThePie | https://sketchfab.com/3d-models/orc-warrior-b69a4206ea934b8f84fb8da696bc3a44 | CC-BY (VERIFIED) | 48,746 | Base, rough, cavity, normal, metal (UNVERIFIED) | 10 anims, author says Mixamo-sourced | Realistic painted orc | Mixamo clips: see Mixamo row. Re-use the body, drop their clips |
| 5 | Realistic Animated Bear, WildMesh 3D | https://sketchfab.com/3d-models/realistic-animated-bear-3d-model-bffc3c87d2d148ff8533e1cc8a11c9f1 | CC-BY (VERIFIED) | 7,508 | Realistic fur (UNVERIFIED) | 81 anims | Realistic animal | Best wild-mob animal. Its sibling "WOLF - Realistic" (22,924 tris, 59 anims) shows `downloadable: false`, so not available. Deer/bear "DEMO FREE" variants: licence UNVERIFIED |
| 6 | PBR Velociraptor (Animated), Ferocious Industries | https://sketchfab.com/3d-models/pbr-velociraptor-animated-8f1744af7b0847a2aabe3df90be802f0 | CC-BY (VERIFIED) | 15,098 | Albedo, normal, AO, 2k; 5 skins | 26 anims | Realistic PBR beast | Good drake/lizard mob |
| 7 | Bestiary: Dungeon Monsters Kit, Quaternius | https://quaternius.com/packs/bestiarydungeonmonsterskit.html | Quaternius Asset License, "Free to use in personal, educational and commercial projects" (VERIFIED) | not stated | 7 monsters x 3 colour variants | Humanoid rig, retargetable; pack itself unanimated; works with Universal Animation Library | Stylised low-poly | Free tier is about 60-70% of pack; Pro/Source $20. glTF in paid tiers |
| 8 | Universal Base Characters + Modular Character Outfits Fantasy + Universal Animation Library, Quaternius | https://quaternius.com/packs/universalbasecharacters.html and /modularcharacteroutfitsfantasy.html | CC0 (VERIFIED) | about 13,000 avg per body | Painted, 3 outfit variants | Humanoid rig, retargetable | Stylised, not realistic | Safest humanoid kit; 12 outfits / 62 parts. Low fidelity next to our fighters |
| 9 | Ultimate Monsters (50 monsters), Quaternius | https://quaternius.com/packs/ultimatemonsters.html | CC0 (VERIFIED) | about 4,000 each (Sketchfab mirror of the whole pack is 212k tris / 50) | Untextured per page (flat colour) | Animated | Low-poly | Cheapest bulk mob fodder; also on Poly Pizza. Needs a repaint to look "realistic" |
| 10 | Stelae Knight, Muru | https://sketchfab.com/3d-models/stelae-knight-0a795ae613f2496e955974ca37bf1e94 | CC-BY (VERIFIED) | 20,060 | 2 maps at 2k | 1 anim | Realtime undead-knight, painted-realistic. Based on ArtStation concept by Shuohan | Concept-art origin: confirm the concept artist's consent (UNVERIFIED) |
| 11 | White Tiger (RIGGED ANIMATED), MotionStreamStudios | https://sketchfab.com/3d-models/white-tiger-rigged-animated-9dd099d283e54f99b7cbd40b531b1a29 | CC-BY (VERIFIED) | 33,142 | Fur texture | Rigged, 1 anim | Realistic | Big-cat wild mob |
| 12 | KayKit Character Pack: Skeletons, Kay Lousberg | https://kaylousberg.itch.io/kaykit-skeletons | CC0 v1.0, author asks not to resell unmodified copies (VERIFIED) | low-poly (not stated) | One 1024 gradient atlas | Rigged; shares free KayKit animation library | Stylised low-poly | 4 skeletons free (+2 at $7.95, .blend at $11.95). FBX and glTF |
| 13 | Cry Wolf Game Character, SkinRender | https://sketchfab.com/3d-models/cry-wolf-game-character-c8ae11fe9aa44455ae1bc93f7744b3df | CC-BY (VERIFIED) | 18,920 | not stated | 10 anims | Horror beast, PS1-era feel | Werewolf-like mob |
| 14 | Skeleton Dragon, LivindorCreation | https://sketchfab.com/3d-models/skeleton-dragon-0ae92a30d2c242069acd61ed432f6c32 | CC-BY (VERIFIED) | 7,993 | not stated | 23 anims | Low-poly undead dragon | Cheap undead dragon |
| 15 | Mixamo monsters/characters (Warrok, Skeletonzombie, Mutant, Pumpkinhulk, Paladin, Knight and others) | https://www.mixamo.com | Adobe Mixamo FAQ, see per-source section (grey for web) | about 10-30k (UNVERIFIED) | Included | Auto-rigged, huge animation library | Game-ready humanoid, mixed realism | Allowed for games, but "raw files" wording makes a browser-served GLB a grey area. Listed last for that reason |

Runner-ups (not ranked): Armored Guard Knight Rig, DM-913 (25,513 tris, CC-BY); Strong Knight, DJMaesen (12,944 tris, CC-BY); Skeleton Lord, DJMaesen (8,665 tris, 3 anims, CC-BY); Mushroom Warrior, Muru (14,135 tris, CC-BY, based on a concept the author says is used with permission); Cethiel's Dragon, OpenGameArt (CC0, hand-painted, rigged, animated, but very low-poly 2D-sprite origin: https://opengameart.org/content/cethiels-dragon-3d); Knight (Rigged, Mid Poly), crownjoshua, OpenGameArt (CC0, ~20k verts, Rigify rig, no animations: https://opengameart.org/content/knight-rigged-mid-poly); Gobkit free packs, itch.io (CC0, GLB, rigged, low-poly animals/dinosaurs/minions, three.js-ready: https://gobkit.itch.io/gobkit-free-animal-pack).

Excluded for licence: Black Dragon with Idle Animation, 3DHaupt (CC-BY-NC, VERIFIED, not usable commercially); Wolf with Animations, 3DHaupt (CC-BY-NC-SA, VERIFIED); OpenGameArt "Simple 3D Dragon Model" (CC-BY-SA 4.0, share-alike, UNVERIFIED but stated in search result).

---

## Per-source licence verdicts

Verdict scale for our case (closed-source commercial web game, GLB fetchable by the browser): YES / YES WITH CREDIT / SHARE-ALIKE / GREY / NO.

### Quaternius
- URL: https://quaternius.com and https://quaternius.com/license.html
- Licence (VERIFIED): "You can use these assets, free of charge, in personal, educational, and commercial games and other projects, with no credit required." Cannot resell or redistribute the assets as standalone packs. Several packs are tagged CC0 (Ultimate Monsters, Universal Base Characters, Modular Outfits Fantasy).
- Verdict: YES. Browser-served GLB is "incorporated in a finished work", so it is fine; the standalone-redistribution ban means do not publish a zip of the raw models.
- Engine restrictions: none.
- Best models: items 7, 8, 9 above. Others listed on the site: Animated Knight, Animated Zombie, Animated Dinosaur, Animated Monster, Ultimate Animated Animal pack, RPG Character Pack, Animated Dragon-like monsters in Ultimate Monsters. All stylised low-poly (about 1-13k tris).
- Style: stylised low-poly. Free tier is a partial subset; $20 Pro/Source unlock full glTF and .blend.

### Kenney
- URL: https://kenney.nl
- Licence (VERIFIED): "All game assets on the asset pages are public domain licensed (CC0). You're free to use them, even in commercial projects."
- Verdict: YES. No engine restriction.
- Best models: nothing at our quality; Kenney's 3D characters are blocky/low-poly. Skip for fighters; fine only for props.

### Poly Pizza
- URL: https://poly.pizza
- Licence: per model, CC0 or CC-BY. The ToS says users must follow "the terms of the Creative Commons license that applies at the time of download" (VERIFIED, but the page gave no more detail). Models include Quaternius and Kay Lousberg packs. UNVERIFIED: which uploaders are what.
- Verdict: YES for CC0 models, YES WITH CREDIT for CC-BY. Record the licence per model at download time. ToS bans AI/ML scraping.
- Best models: mirrors of Quaternius and KayKit; no high-detail realistic characters found.

### OpenGameArt (3D section)
- URL: https://opengameart.org
- Licence: per asset. CC0 = YES; CC-BY 3.0/4.0 = YES WITH CREDIT; CC-BY-SA, GPL, LGPL = SHARE-ALIKE/copyleft (avoid; share-alike on a shipped, modifiable GLB is risky for a closed-source game). The licence-FAQ URL returned 404 so the share-alike scope reading is UNVERIFIED.
- Best models: Cethiel's Dragon (CC0, VERIFIED), Knight Rigged Mid Poly (CC0, VERIFIED), Goblin 1 by CDmir (CC0 rigged and animated per search result, UNVERIFIED), 3D Humanoids under CC0 collection (https://opengameart.org/content/3d-humanoids-under-cc0), Zombie - Fully Animated (CC0, UNVERIFIED). Mostly low/mid-poly, older, uneven quality.

### Sketchfab (CC0 and CC-BY downloadable)
- URL: https://sketchfab.com; filter Downloadable + License = CC0 / CC Attribution + Animated.
- Licence (VERIFIED from API): each model carries its own licence. CC Attribution = commercial use and modification allowed with credit. Sketchfab "Standard"/"Editorial" licences are for Store purchases, not for these free downloads. NC, SA and ND variants appear in search; never take them.
- Verdict: YES WITH CREDIT for CC-BY, YES for CC0. Browser-served GLB is fine under CC-BY/CC0.
- Engine restrictions: none. Free download needs a (free) Sketchfab login; glTF/GLB is offered.
- Best models: items 1-6, 10, 11, 13, 14 above.
- Risks: uploader may not own the IP (fan art and game rips are common even under CC-BY); some have animations that were taken from Mixamo; `animationCount` is not proof of a skeleton. CC0 hits for characters/creatures were only museum scans and a triceratops skeleton ("Animated triceratops skeleton", Zacxophone, CC0, 29,160 tris, 6 anims, VERIFIED by API: https://sketchfab.com/3d-models/animated-triceratops-skeleton-06cb55f941d94dc8b95ac46f92d89e7c). I found no high-quality CC0 fantasy humanoid.

### Mixamo (Adobe)
- URL: https://www.mixamo.com, FAQ https://helpx.adobe.com/creative-cloud/faq/mixamo-faq.html (403 to me; text below from search summary and an Adobe community FAQ post, partly UNVERIFIED)
- Licence: characters and animations are free "royalty free for personal, commercial, and non-profit projects" including video games. Not allowed: "blueprints, templates, or asset packages for video game engines which redistribute character or animation raw files as the product", asset-store packages, or "any type of free distribution of character or animation raw files". No ML training with Mixamo content. The community post paraphrase: "really the only thing you can't do is distribute the raw character and animation files".
- Verdict: GREY for a web game. Shipping a game is explicitly allowed, but the GLB sits in a public URL where anyone can save it, which is arguably distributing the raw file. Adobe has not said web delivery is fine. If we use it, get written confirmation from Adobe or accept the risk. Safer use: take Mixamo animations only as reference, or retarget and bake them into our own file (still an extractable derivative, so still grey).
- Engine restrictions: none stated.
- Best models: Warrok, Skeletonzombie, Mutant, Pumpkinhulk, Maw, Ganfaul, Vampire, Paladin, Knight (names from memory, UNVERIFIED). About 10-30k tris, auto-rigged, humanoid only.

### Poly Haven
- URL: https://polyhaven.com
- Licence (VERIFIED): "You can use our assets for any purpose, including commercial work. You do not need to give credit or attribution when using them" (CC0).
- Verdict: YES, but there are no rigged characters or creatures (props, plants, rocks, scans; I did not enumerate the model list, UNVERIFIED). Useful for props and textures only.

### Smithsonian 3D (Open Access)
- URL: https://3d.si.edu
- Licence: CC0 for items tagged Open Access; commercial use, no attribution, no fee (search summary, UNVERIFIED on the primary page). Downloads as OBJ and GLB.
- Verdict: YES for tagged items. They are photogrammetry scans of specimens and skeletons (dinosaur, mammal, bone scans), not rigged, very high poly. They would need retopology and a rig. Possible source for skeleton/skull props and undead bones, not for animated mobs.

### BlenderKit (free tier)
- URL: https://www.blenderkit.com/docs/licenses/ (the server redirected to a different domain, `blendkit.com`; I did not follow it)
- Licence (search-result summary of their FAQ, UNVERIFIED): two licences, Royalty Free and CC0. Royalty Free allows commercial use without credit but not resale in the same form; you can sell games made with the models "if these can't be extracted by users in an easy way".
- Verdict: NO for Royalty Free assets in a browser-served GLB (extractable). YES only for assets explicitly tagged CC0. Few high-quality CC0 characters.
- Engine restrictions: add-on is Blender-based; assets may be used elsewhere per FAQ (UNVERIFIED).

### CGTrader free models
- URL: https://www.cgtrader.com/free-3d-models
- Licence (search summary of their help pages, UNVERIFIED): Royalty Free licence permits models incorporated into a product only if "the 3rd party cannot retrieve it on its own in both digital and physical form"; for games "you must take all reasonable measures to prevent the end user from gaining access to the Product" and "contained inside a proprietary format". Standalone redistribution banned. Some free models carry other licences (Editorial, Personal use, CC); check per model.
- Verdict: NO for a browser-served GLB under Royalty Free. Per-model exceptions possible only where the model is CC0/CC-BY.

### TurboSquid free models
- URL: https://www.turbosquid.com/Search/3D-Models/free
- Licence (VERIFIED from TurboSquid's Royalty Free FAQ via fetch): game use only if the material is "contained in the interactive experience", in "proprietary format that cannot be opened in a publicly available software application", and the software has "no functionality for end users to import any open 3D file format or export any 3D model".
- Verdict: NO. A GLB is an open format. Do not use.

### itch.io free 3D packs
- URL: https://itch.io/game-assets/free/tag-3d (tags cc0, glb, rigged)
- Licence: per pack; the good ones are CC0. VERIFIED: KayKit Skeletons (CC0, with polite no-resale note) and Gobkit packs (CC0, GLB, three.js-ready). Others are custom "free for commercial use but no redistribution" licences; read each page.
- Verdict: YES for CC0 packs; GREY for custom licences (some forbid redistributing the files, which a browser-served GLB arguably does).
- Best models: KayKit Skeletons (item 12), Gobkit packs. All stylised low-poly. UNVERIFIED: any realistic free pack on itch.io; none surfaced in search.

### Fab.com free assets
- URL: https://www.fab.com ; Epic doc https://dev.epicgames.com/documentation/en-us/fab/licenses-and-pricing-in-fab
- Licence: Fab Standard License. Epic and press state it can be used "in any engine or tool" (CG Channel summary, search-result summaries), commercial use allowed, limitations on "completely open-source projects". The EULA page itself (fab.com/eula, fab.com/legal) returned 403 so I could NOT read the clause on redistribution of raw files inside a shipped product. UNVERIFIED.
- Verdict: GREY, leaning NO until the clause is read. Fab/Epic and Unity-era marketplace EULAs normally permit shipping assets "embedded" in a product but forbid making them retrievable as standalone assets. A browser-fetchable GLB is retrievable. Needs a read of the Fab EULA (ask Dom to open it in a browser) or a written answer from Fab support. Some individual Fab listings carry CC-BY / CC0 instead of the Standard licence; those are fine.
- Engine restrictions: the Standard licence is advertised as engine-agnostic. Some listings are UE-format only.
- Best models: free-of-the-month character kits exist but I could not enumerate or verify any.

### Unity Asset Store free assets
- URL: https://assetstore.unity.com ; EULA https://unity.com/legal/as-terms (Appendix 1)
- Licence (VERIFIED by reading the live EULA text): 2.2.1 grants a licence "to incorporate the Asset, together with substantial, original content ... into an electronic application or digital media ... as an embedded component of that Licensed Product, such that the Asset does not comprise a substantial portion", and "to reproduce, publicly display, publicly perform, transmit, and distribute the Asset as incorporated and embedded in that Licensed Product". Prohibited: sublicensing/reselling or otherwise commercialising "any Asset except as expressly permitted", and AI/ML training. "Restricted Assets" have their own terms.
- Engine restrictions: I found no clause limiting use to the Unity engine (VERIFIED in the EULA text above). Individual publishers can attach their own EULA ("certain Assets may be governed by a separate Provider end user license agreement").
- Verdict: GREY. Engine is not the problem; "as incorporated and embedded" is. A GLB that anyone can download from a URL is the asset distributed in raw form, which the EULA does not clearly permit. Also you would have to convert FBX/prefabs to GLB, which is a modification (allowed) but doing so does not fix extractability. Do not use without legal sign-off or publisher permission.

### Other free sources spotted
- Blender Studio open-movie rigs (https://studio.blender.org/characters/sprite/): CC-BY, free, high-quality production rigs (Sprite, Elder Sprite and others), but cartoon style and Blender-rig based (Blender 3.3-3.6 per page); not realistic. YES WITH CREDIT; UNVERIFIED which have usable meshes at low poly.
- Khronos glTF sample assets, Sketchfab museum scans, NASA: not useful for fantasy mobs.

---

## Practical rules if we adopt any of this
1. Keep a credits file per model: title, author, source URL, licence name and URL, and "modified" if we edit. Show it in a visible credits screen (and ship it in the repo).
2. Download the actual GLB and read the licence field again on the day of use; save a screenshot or PDF of the model page and licence as evidence.
3. Skip anything that is fan art or a rip, any NC/ND/SA licence, any model whose uploader is not obviously the creator.
4. Mixamo-sourced animations bundled in a Sketchfab upload carry Mixamo's terms, not just CC-BY.
5. For realistic fantasy bodies at our fighters' tier, expect to retopologise/re-rig and repaint the free CC-BY knights, orc and dragon rather than ship them as is.
