# Donor scan: PAID packs and marketplaces (2026-10-07)

Scope: what money would buy for a realistic fantasy roster (mobs, maybe duel opponents) in a closed-source commercial WEB game (three.js) where the browser downloads the model files. Not legal advice; every licence line below should be re-read on the day of purchase. Items marked **[UNVERIFIED]** came from search snippets only, or the page blocked fetching (Fab, TurboSquid, ArtStation and CGTrader pages returned 403 to our fetcher).

## The one problem every paid licence shares

A browser game ships its GLBs to the player. Almost every paid licence says "embedded in a product, not extractable / not downloadable on its own". A plain `.glb` served from a CDN is arguably an extractable open-format file. So for any purchase we should plan on:

- Serving models only as an encrypted or custom-packed blob, decoded in a worker or WASM into GPU buffers (no `.glb`/`.gltf` URL a user can right-click save).
- No import/export of open 3D formats anywhere in the game (TurboSquid says this outright).
- Keep the original purchased source files off the public repo and off the CDN (Synty: "must not share the source files outside your team").
- This reduces, but cannot remove, extraction risk (anyone can read the GPU buffers). The licences ask for "reasonable measures", not impossibility. [Owner/legal call.]

Fit warning: our own fighters are 46k-62k tris with painted PBR. Most paid fantasy packs are LOW-POLY or stylised (Synty, Dexsoft, most Infinity PBR). Truly realistic ones are mostly single-model listings on Fab, CGTrader, TurboSquid, ArtStation, or Reallusion humans.

## RANKED TOP 10 (best value for a realistic fantasy roster + clean web licence first)

1. **Fab.com paid listings, Standard licence (realistic single models and packs)**: licence is engine-agnostic and allows shipping games that include the content. Typical $10-$150 per model/pack [UNVERIFIED range]. Example found: "Dark Fantasy Characters - Knights Pack", 11 low-poly characters, rigged to the Epic skeleton, 2k/4k PBR, attack/death/hit/idle/walk/run animations (price not retrieved). Cleanest licence, but check each seller's file formats (many are Unreal-only `.uasset`).
2. **CGTrader Royalty Free individual models**: about $20-$400 per realistic creature/knight [UNVERIFIED range]. Games explicitly allowed, provided you "take all reasonable measures to prevent the end user from gaining access". Best source of true high-poly realistic assets with FBX/GLB downloads.
3. **Synty POLYGON Dark Fantasy**: $199.99 (one-time, 5 seats), 14 characters (Dark Lord, 2 demons, gargoyle, skeletons x4, plague doctor, witch, hunters...), Unity/Unreal/Godot/FBX. Licence is the clearest of all ("not limited by game engine, OS, platform or device"; "any videogame"). Style is low-poly: poor visual match, useful only as a cheap fallback or for background mobs. Also: POLYGON Fantasy Characters $29.99 (20 characters incl. troll, giants, golems, demon, medusa; Unity store price).
4. **Infinity PBR packs (itch.io / Unity)**: stylised-realistic rigged creatures. Dragon Monster Pack $75 (3 dragon heads, 4 backs, 2 tails, morph targets, 30+ animations, about 4k-30k tris by LOD, Substance sources included). Licence note: source files may not be shared or resold; engine listed as Unity, but FBX/textures are portable. Best "rigged and animated, many creatures" value.
5. **Reallusion ActorCore / Character Creator humans**: realistic rigged humans with a large animation library. Content EULA gives an export licence into listed 3D formats for commercial games, but content "must not be available for public download" and Reallusion says a Mass Distribution licence (free on request) is needed [UNVERIFIED wording]. Native GLB export is not confirmed (FBX is the documented route; GLB would be a Blender conversion). Weak on fantasy monsters. Per-character price [UNVERIFIED]; motion clips about $1.50-$12.
6. **"Realistic Animated Dragons 3D Model Pack"**: 6 dragons (black, green, red, blue, white, gold), each rigged with 16 animations, about 38,550 polys, 4k PBR (colour/metal/AO/rough/normal). Matches our polycount class well. Seller, store and price [UNVERIFIED]; a search snippet only.
7. **Mythic Realms (Factex@Lab, itch.io)**: $79 minimum, 14 "photorealistic" fantasy guardians, PBR, rigged. Described as AI-generated then artist-refined, so copyright/ownership and licence quality are doubtful. Only buy after reading the itch licence text; probably skip.
8. **Unity Asset Store realistic creature packs**: Unity's support page says assets may be used with other engines under the EULA ("as incorporated and embedded components of electronic games and interactive media"; no standalone sharing). Catches: downloads normally go through the Unity Editor, some individual assets are Unity-only, and the EULA bans AI training use. Prices $20-$100 typical for creature packs (e.g. "Mythical creatures pack" $99.99) [UNVERIFIED]; polish varies widely.
9. **ArtStation Marketplace listings**: licence is per-seller. One listing's EULA showed three tiers: Standard $35 (non-commercial), Extended Commercial $70 (one commercial project, up to 10,000 copies or $100k budget), Studio $150 (unlimited) [UNVERIFIED, one listing only]. Good realistic artists (e.g. "Realistic Vampire Lord Dracula rigged low poly"). Model count and price vary; check the cap clause before buying.
10. **TurboSquid Royalty Free**: biggest realistic catalogue, but the strictest web clause: models must be in a "proprietary format that cannot be opened in a publicly available software application", and the game must have no functionality to import or export open 3D formats. Workable only with encrypted custom packing; ask TurboSquid support whether a browser game qualifies. Price $30-$500 per model [UNVERIFIED range].

Not worth buying for this brief: Daz3D (needs a per-product Interactive licence, not all products offer one, WebGL exposure of mesh/textures reported as not permitted by forum posters [UNVERIFIED]); KitBash3D (environment kits; the creature kits are Blender/stylised; individual licence bars distributing editable 3D scenes); Dexsoft (stylised low-poly, e.g. Animated Fantasy Characters $19.99 for 11 characters, 50+ animations); Polygon Runway (nothing relevant found; the search only returned Synty/Polygonal low-poly packs).

## Details by source

### Synty (syntystore.com)
- URL: https://syntystore.com/products/polygon-dark-fantasy ; https://syntystore.com/products/polygon-fantasy-kingdom ; licences https://syntystore.com/pages/licences-overview
- Licence (one-time purchase, https://syntystore.com/pages/one-time-purchase-licence): "not limited by game engine, OS, platform or device"; covers "any videogame". Restrictions: "You must not distribute our Assets as stock images or stock art (2D or 3D) or otherwise share them for re-use by third parties"; "You must not share the source files of any Assets outside your team"; modification allowed but "does not mean you own that Asset"; generative-AI dataset use and AI generation of 3D models from the assets are prohibited. Visual-showcase rule (search snippet [UNVERIFIED]): 3D assets must only be Synty's in games promoted as Synty showcases (applies to promotions, check).
- Web/closed source: Yes by wording; no explicit anti-extraction clause was found, but sharing files for reuse is banned, so ship encrypted. Extra requirement: none beyond that.
- Price: Dark Fantasy $199.99; Fantasy Kingdom $349.99 (Unity store listing; 22 characters, 2,100 prefabs); Fantasy Characters $29.99; Dungeon Pack about GBP 72.86. All Access subscription exists, price not retrieved [UNVERIFIED]. POLYGON packs stay purchasable one-time.
- Included: 14 characters in Dark Fantasy, modular armour/capes/weapons, Mecanim humanoid rig, no bundled animations in that pack. Formats: Unity 2022.3, Unreal 5.3, Godot 4.6, FBX. Engine-lock: none (FBX included).
- Style: low-poly faceted; polycount in the low thousands; poor match to our realistic roster.

### Fab.com (Epic)
- URL: https://www.fab.com/eula ; https://www.fab.com/legal (both blocked our fetcher; wording from search summaries [UNVERIFIED]).
- Licence: Standard License grants a "non-exclusive and non-transferable license to privately use, reproduce, display, perform, and modify the Content"; may be used with any tools, not limited to Unreal; you may distribute a Project that incorporates Content "as an included dependency" to end users, including video games; standalone resale or free redistribution of the content is banned; extra limits for fully open-source projects.
- Web/closed source: Yes; same extraction caution. Check each listing's file formats: Unreal-only packs ("Unreal only") need conversion, often impossible. Listings offering FBX/glTF/Blender files are the ones to buy.
- Price: per listing, mostly $10-$150 [UNVERIFIED].
- Example listing: Dark Fantasy Characters - Knights Pack, https://www.fab.com/listings/24df117f-00dc-4054-8371-9bdbbf52aa08 : 11 characters (Dark Elf Female Boss, Inquisitor of Death, several Death Knights, Dead King, Skeleton), 2k/4k PBR, Epic skeleton rig, combat animation set, "low-poly" [UNVERIFIED details from search snippet].

### Unity Asset Store
- URL: https://assetstore.unity.com ; EULA https://unity.com/legal/as-terms ; Unity help: https://support.unity.com/hc/en-us/articles/34387186019988-Can-I-use-assets-from-the-Asset-Store-with-other-engines
- Licence: assets are licensed for incorporation "into an electronic application or digital media" as "an embedded component"; may not "rent, lease, lend, sell, trade, resell, or otherwise commercialize or monetize any Asset"; cannot be a "substantial portion" of a product's value as stand-alone asset; AI/ML training use banned. Unity support: other engines are fine if you follow the EULA.
- Web/closed source: Yes in principle (embedded, no raw files exposed). Practical issue: you must pull FBX/textures from a Unity project and convert to GLB; some assets use Unity-only shaders; some creators add Unity-only terms.
- Examples: Synty Fantasy Characters $29.99; Synty Fantasy Kingdom $349.99; Stylized Fantasy Dragons Pack (4 dragons); Complete Stylized Dragons and Dungeon (32 dragons); Fantasy Monsters Pack (20 characters). Mostly stylised.

### CGTrader
- URL: https://www.cgtrader.com ; licence help https://help.cgtrader.com/hc/en-us/articles/360015124437 (blocked; wording from search summaries [UNVERIFIED]).
- Licence: Royalty Free allows commercial use "in video games, VR/AR applications"; for software you "must take all reasonable measures to prevent the end user from gaining access to the Product"; product may not be resold or given in the form downloaded; the model must be "incorporated into the product" so a third party "cannot retrieve it on its own".
- Web/closed source: Yes with encrypted packing; stronger-than-usual duty to protect.
- Price: per model, roughly $20-$400 [UNVERIFIED]. Many realistic rigged/animated knights, orcs, dragons with 4k PBR; polycount 20k-150k; check each seller's formats (FBX/GLB/Blender common).

### TurboSquid
- URL: https://www.turbosquid.com/licensing ; RF FAQ https://www.turbosquid.com/help/en/articles/9937423-royalty-free-license-faq (both 403; wording from search results/tool summary).
- Licence quotes (as reported): game use allowed (console, PC, web, mobile; closed MMOs) "if the TurboSquid material is contained in the interactive experience and not made available outside of such use"; the 3D model "is contained in proprietary format that cannot be opened in a publicly available software application"; and the game has "no functionality for end users to import any open 3D file format or export any 3D model"; assets must not be "extracted, exported, or decompiled without reverse engineering".
- Web/closed source: Doubtful as a plain GLB; only with a custom encrypted container and no import/export. Ask support in writing. Most restrictive of the marketplaces.
- Price: roughly $30-$500 per model [UNVERIFIED]. Highest-quality realistic creatures and armour sets exist here; heavy meshes need retopology to ship on mobile.

### ArtStation Marketplace
- URL: https://www.artstation.com/marketplace ; sample EULA on https://www.artstation.com/marketplace/p/j7lqO/realistic-vampire-lord-dracula-rigged-low-poly-3d-model-low-poly-3d-model (blocked; summary from search).
- Licence: per-seller EULA. Sample tiers: Standard $35 (no commercial use), Extended Commercial $70 (one project, 10,000 copies or $100k budget cap), Studio $150 (unlimited); no re-sale/sub-licence of files "in their original or modified forms" [UNVERIFIED, one listing].
- Web/closed source: usually fine if you take the Studio tier or the cap fits; protect files.
- Price: $35-$150 per model per tier (above) [UNVERIFIED].

### Humble Bundle
- Ultimate Fantasy Game Development Bundle (Infinity PBR): $1 tier plant/rock/mushroom monsters; $15 tier giant worm, minotaur, mimics, medusa; $25 tier spiders, dragons, humans, armour packs, trolls, demons, devils; delivered as Unity and Unreal store keys, "rigged, textured and animated". Source: https://gamefromscratch.com/humble-ultimate-fantasy-game-development-bundle/
- Status: that bundle is historical (circa 2020-21); no current equivalent verified [UNVERIFIED whether live]. Licence = the underlying Unity/Unreal store EULA. Watch for repeats; it is the best price per creature if it returns ($25 for dozens). Also "Game Dev's Guide to Fantasy Creatures" $15 (Infinity PBR). Style: stylised-realistic, painterly.

### Reallusion (Character Creator / ActorCore)
- URL: https://actorcore.reallusion.com ; Content EULA https://www.reallusion.com/Content/EULA/EULA.htm ; update post https://forum.reallusion.com/511311/Reallusion-Content-EULA-Update-Apr-26th-2022
- Licence: content "licensed with the rights that allows users to export content via iClone and Character Creator into specified 3D formats listed in the content EULA for commercial use and distribution"; embedding in games is allowed but content must not be available for public download; resale of content in any format is banned. Reallusion forum says a free Mass Distribution licence is needed for large distribution [UNVERIFIED].
- Engine-lock: FBX with Unity/Unreal presets; GLB not officially confirmed (feature request page exists).
- Fit: realistic humans (soldiers, peasants, knights-adjacent), good animation library; few monsters. Fits as human mobs/NPCs, not creatures.

### Daz3D
- URL: https://www.daz3d.com/interactive-license-info
- Interactive licence is required for games; not offered on every product; price per product not retrieved. Forum reports say WebGL exposure of original mesh/textures may not be allowed [UNVERIFIED]. Skip unless an exact product offers a clear interactive licence.

### KitBash3D
- URL: https://help.kitbash3d.com/en/articles/6449681-can-i-use-kitbash3d-assets-for-commercial-projects-or-for-nfts
- Commercial use allowed (perpetual or Unlimited subscription); no redistribution; individual licence bars distributing editable 3D scenes. Mostly environments and props; creature kits found are stylised animal kitbashes on Blender marketplaces. Not a character source.

### Dexsoft Games
- URL: https://dexsoft-games.itch.io/animated-fantasy-characters : $19.99 minimum, 11 characters (dwarf knight, elf, goblin, mage, rogue...), 50+ animations, low and very-low poly, hand-painted. Stylised; Unity-oriented; licence text not retrieved [UNVERIFIED]. Poor fit.

### itch.io paid packs
- Infinity PBR and Factex@Lab (see above). Licences are per-seller; Infinity PBR page: "personal use only; source files cannot be shared or resold" for the Dragon pack (the page wording is store-generic, confirm that commercial game use is included).

### Polygon Runway
- No relevant product found by search; treat as not available/unknown.

## Recommended next step for the owner

1. Buy nothing in bulk. Pick 3 realistic candidates from Fab and CGTrader (one knight, one undead, one beast/dragon), check they ship FBX/GLB, and test them through our rig and encrypted-delivery pipeline.
2. Before purchase, email the seller/marketplace one question: "Is shipping this model inside an encrypted package in a browser (WebGL) game acceptable?" Keep the reply with the receipt.
3. Use Synty only if cheap stylised filler is wanted; it has the clearest licence but the worst visual match.
