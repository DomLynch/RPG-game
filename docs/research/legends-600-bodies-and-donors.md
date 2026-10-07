# Legends ladder, bodies and donors (research, 2026-10-07)

Companion to `docs/research/legends-600-ladder.csv`. Analyst output only: nothing in `src/` was touched. Inputs read from trunk `origin/codex/01a09a76/task-1` (CSV, `src/legends.ts`, `src/roster.ts`, `src/moves.ts`, `src/career.ts`, `.claude/skills/legends-rule/SKILL.md`, `docs/specs/origins/legends-500.md`, `body-families.md`, `living-world.md` s10.1), plus the donor library on the VPS and `~/Developer/donors/world-of-claudecraft`.

## 1. Method and rank distribution

**Pool.** Union of the 600-row CSV and the 100 Pit legends in `src/legends.ts`, deduplicated by person. 16 people are in both (Mars, Loki, Lord Ruthven, Sir Francis Varney, Carmilla, Set, Hades, Hel, Anubis, Ereshkigal, the Morrigan, Ptah, Sekhmet, Nergal, Odin, Thor). 84 Pit legends exist only in `src/legends.ts` and are added (source = `src/legends.ts`). Then 11 Greek/Roman duplicates were merged into one row each (Strategy audit): Zeus/Jupiter, Poseidon/Neptune, Hera/Juno, Ares/Mars, Athena/Minerva, Artemis/Diana, Aphrodite/Venus, Hephaestus/Vulcan, Hermes/Mercury, Kronos/Saturn, Hades/Dis Pater (the better-known name is the row; the twin is an alias in notes). **Merged total: 673 rows** (600 + 84 - 11; no cap). The 84 added are listed below.

**Rank scale learned from `src/legends.ts`.** `LEGENDS` holds 10 archetypes x 10 rungs; the rung (1-10) is the career tier (`TITLES` in `src/career.ts`: Recruit, Legionary, Gladiator, Veteran, Champion, Praetorian, Master, Primus, Invictus, Origin; 5 levels each, `rungOf` in `src/legends.ts`). Rung 1 is a nameless generic (Pit Thrall, Squire); rungs 2-4 are minor figures and fiction (Ruthven 2, Carmilla 4); 5-7 are famous heroes and monsters (Musashi 5, Leonidas 7, Vlad 7); 8-9 are great heroes and dark gods (Apollo 8, Alexander 9, Achilles 9, Hades 9); 10 is chief gods, primordials and Death (Odin, Thor, Loki, Mars, Nyx, Athena, the Reaper). Rank is independent of body: Loki is rank 10 on the small goblin body.

**Ranking method (inference, mine).** Every CSV row got a hand-set stature score 0-100 from its mythic standing and source. Rules, in order (updated after the Strategy audit):
1. **Every patron is rank 9 or 10 and challengeable** ("gods are the hardest", owner 2026-10-07), including the 12 Pit/patron overlaps (Ruthven, Varney, Carmilla, Hel, Anubis, Ereshkigal, Sekhmet, Morrigan, Nergal, Set, Ptah, Hades) whose old Pit rung is superseded. The Pit-only gods Apollo, Athena, Hermes, Hephaestus, Hecate, Nyx and Thanatos are treated as patrons too. 120 patrons in total, split 9/10 by score; the old rung is kept in notes.
2. Non-patron apex figures with score >= 94 (Jormungandr, Apep, Tiamat, Cthulhu, Sun Wukong...) also sit in 9-10; Hercules is fixed at rank 9.
3. The other 84-minus-7 Pit legends (77: humans, monsters, generics) keep their Pit rung.
4. The remaining CSV rows are sorted by score and spread over ranks 1-8 so that ranks 1-8 come out equal.

**Distribution (merged 673).**

| Rank | Count |
|---|---|
| 1 | 67 |
| 2 | 67 |
| 3 | 67 |
| 4 | 67 |
| 5 | 67 |
| 6 | 67 |
| 7 | 67 |
| 8 | 67 |
| 9 | 69 |
| 10 | 68 |

The ~60-per-rank target was not met because the pool is 673: ranks 1-8 have 67 each and ranks 9-10 have 69 and 68. Moving every patron to 9-10 would have emptied the old Pit rungs, so ranks 1-8 were re-spread over the non-patrons. Ranks 9 and 10 hold 62 and 58 patrons respectively (patrons make up 88% of those two ranks), so ranks 9-10 are god-heavy by the owner's rule.

**Added from `src/legends.ts` (84; 9 are the nameless generic rung-1 style names):**
- rung 1: Beak, Crixus, Forge Hand, Headsman, Hedge Witch, Night Page, Pit Thrall, Sewer Imp, Shield Girl, Squire
- rung 2: Alvis, Ankou, Bedivere, Cacus, Hervor, Kobold, Mother Shipton, Paracelsus, Ragnar Lothbrok
- rung 3: Beowulf, Camilla, Charon, Gawain, Grimhild, Locusta, Nain Rouge, Redcap, Regin
- rung 4: Andvari, Brokkr, Ceridwen, Gogmagog, Lagertha, Medea, Roland, Spartacus
- rung 5: Alberich, Boudica, Circe, Eitri, El Cid, Erlking, Grendel, Miyamoto Musashi, Nimue
- rung 6: Hannibal, Lancelot, Louhi, Mordred, Polyphemus, Rumpelstiltskin, Tomyris, Wayland
- rung 7: Baba Yaga, Humbaba, Kothar-wa-Khasis, Leonidas, Puck, Scathach, Siegfried, Vlad
- rung 8: Ajax, Antaeus, Arawn, Hector, Morgan le Fay, Penthesilea, Reynard the Fox
- rung 9: Achilles, Alexander, Brynhildr, Goibniu, Hermes, Merlin, Surtr
- rung 10: Apollo, Athena, Hecate, Hephaestus, Nyx, Resheph, Thanatos, The Reaper, Typhon

**Pit rows with a god or primordial and a non-patron rank (Surtr, Typhon, Nyx...):** Nyx is a patron-for-ranking and sits at 9-10; Surtr, Typhon, the Reaper and Resheph are monsters or Death-lore, not gods in the CSV, and keep their Pit rungs.

**Challengeable.** 662 yes, 11 blocked (see section 6 for reasons). Fame: 95 household, 172 known, 406 obscure.

## 2. Famous names per rank (3-10)

`fame` column: household = most players know the name; known = a sizeable minority do; obscure = almost nobody (most of the 673). Fame is my judgement, not measured data.

**Rank 3** (5 household, 9 known)
- household: Victor Frankenstein, Dorian Gray, Sweeney Todd, Beowulf, Charon
- known: Griffin, the Invisible Man, The Lorelei, The Oni, La Llorona, Rob Roy MacGregor, The Jersey Devil, Redcap, Camilla, Gawain

**Rank 4** (6 household, 11 known)
- household: Pegasus, The Pied Piper of Hamelin, Edward Teach, Spartacus, Lagertha, Medea
- known: Dido, Horatius Cocles, The Dullahan, Erik, the Opera Ghost, Doctor Moreau, Bluebeard, The Huli Jing, The Tengu, Yuki-onna, Cincinnatus, Roland

**Rank 5** (9 household, 10 known)
- household: Abraham Van Helsing, Robin Hood, Macbeth, Sasquatch, The Yeti, Miyamoto Musashi, Grendel, Boudica, Circe
- known: Castor, The Questing Beast, Sha Wujing, Momotaro, Francis Drake, The Beast of Gevaudan, Alberich, Erlking, Nimue, El Cid

**Rank 6** (8 household, 17 known)
- household: Orpheus, Mr Hyde, Hattori Hanzo, The Loch Ness Monster, Hannibal, Polyphemus, Rumpelstiltskin, Lancelot
- known: Atalanta, Pollux, Lamia, Mimir, Tristan, The Hound of the Baskervilles, Melusine, Zhu Bajie, Mulciber, Vercingetorix, Arminius, Ivar the Boneless, Gotz von Berlichingen, Mordred, Wayland, Tomyris, Louhi

**Rank 7** (10 household, 22 known)
- household: Jason, The Valkyries, The Headless Horseman, The Flying Dutchman, Hua Mulan, Cleopatra VII, Leonidas, Puck, Vlad, Baba Yaga
- known: Bellerophon, Agamemnon, Hippolyta, The Nemean Lion, Aeneas, Sleipnir, Medb, Percival, Queen Tera, The Snow Queen, Cain, Doctor Faustus, Scipio Africanus, Zenobia, Bayard, Sasaki Kojiro, The Nuckelavee, Anansi, The Great Sea Serpent, Humbaba, Scathach, Siegfried

**Rank 8** (14 household, 33 known)
- household: Perseus, Theseus, Odysseus, Medusa, The Minotaur, The Lernaean Hydra, Cerberus, The Sphinx of Thebes, Gilgamesh, Mephistopheles, Julius Caesar, The Kraken, Morgan le Fay, Hector
- known: The Chimera, Scylla, Charybdis, Echidna, Nidhogg, Fafnir, The Norns, Enkidu, Cu Chulainn, Fionn mac Cumhaill, Galahad, The Green Knight, Koschei the Deathless, Zmey Gorynych, The Wild Hunt, The Bull Demon King, Shuten-doji, Tamamo-no-Mae, Benkei, Azazel, Harald Hardrada, Richard the Lionheart, Lu Bu, Zhao Yun, Ramesses II, Sundiata Keita, Rostam, The Simurgh, Ajax, Antaeus, Reynard the Fox, Arawn, Penthesilea

**Rank 9** (12 household, 23 known)
- household: Dionysus, Persephone, Aphrodite, Hercules, Janus, Frankenstein's Creature, Carmilla, William Wallace, Alexander, Hermes, Merlin, Achilles
- known: Nemesis, Eris, Pan, Hypnos, Fortuna, Vesta, Freyr, Baldr, Frigg, Skadi, Bastet, Nephthys, Ptah, Imhotep, Nergal, The Morrigan, Lord Ruthven, Sir Francis Varney, Lycaon, William Tell, Robert the Bruce, Surtr, Brynhildr

**Rank 10** (27 household, 22 known)
- household: Zeus, Poseidon, Hades, Hera, Ares, Artemis, Prometheus, Atlas, Odin, Thor, Hel, Loki, Fenrir, Ra, Osiris, Isis, Anubis, King Arthur, Count Dracula, Cthulhu, Sun Wukong, Nyx, The Reaper, Hephaestus, Athena, Apollo, Hecate
- known: Demeter, Kronos, Gaia, Mithras, Freyja, Tyr, Heimdall, Jormungandr, Ymir, Horus, Set, Thoth, Sekhmet, Apep, Tiamat, Ereshkigal, Marduk, Inanna, The Dagda, Lugh, Typhon, Thanatos

**Result.** Every rank 3-10 has at least 3 household or known names (lowest: rank 3 with 5 household + 9 known). No rank fails, so no forced move is needed. Ranks 1-2 have almost none (rank 2: the Banshee, Dr Jekyll, the Chupacabra (now blocked), Ragnar Lothbrok), which is fine.

**Optional moves for a stronger early draw (none required):** Dr Jekyll 2 to 3 and the Banshee 2 to 3 (household names met only at levels 6-10 today); Robin Hood stays at 5.

**Proposed draw rule for the random levels 1-50 ladder.**
- Draw by the fight's rung (`rungOf(level)`), uniform over the legends of that rung that are `challengeable=yes`.
- **Level guarantee (owner 2026-10-07, replaces the band rule):** EVERY level from L2 to L50 includes a few household or known names; only L1 may be all obscure. Each level's fight draw takes at least 2 opponents from household+known at that rank (or 1 when the level has fewer than 4 fights), the rest from the whole rank. Rank 2 has 4 household + 18 known, enough for L6-L10.
- No repeat of the same person within the last 10 fights; never draw the same name twice in a rung until the rung's household/known pool is exhausted.
- Origin (rung 10, levels 46-50) draws patrons plus apex figures; the rank-10 rows are all Origin fights.
- Honourable folk heroes use the "You stood against ..." win line (section 6 conflict 6); the draw must carry that flag.
- Blocked rows are excluded from the draw until their flag is cleared.

## 3. Body gap analysis

**Existing bodies (confirmed from `git ls-tree` of trunk `src/assets/` and `src/roster.ts`):** warrior (the hero), veteran, knight, goblin, nightborn, witch, dwarf, pitborn, executioner, plaguedoctor, shieldmaiden, plus minotaur, wraith, skeleton, werewolf (built, `hold:true` in `src/roster.ts`; need un-hold plus an `ARCHETYPES` row in `src/moves.ts`). Recoverable from git history (`git log --all --diff-filter=D`): legionary (`src/assets/source/creatures/legionary*.glb`, `src/assets/source/loot/legionary.glb`) and ranger (`src/assets/source/items/ranger.glb`). The `body-families` PR branch is already merged into trunk; its spec is `docs/specs/origins/body-families.md`: humanoid-s/m/l live, giant and quadruped designed (FLUX done, TRELLIS next), undead/spirit live bodies, serpent and flyer "later".

Roster note: a body also needs a combat row (`ARCHETYPES` in `src/moves.ts`); the roster comment says "Adding an individual must not add AI branches", so new bodies reuse an archetype profile.

**Owner steer applied:** most legends are humanoid. Animal-headed figures are a humanoid body plus a swappable HEAD, and winged figures are a humanoid plus a WING KIT; these are counted separately and are not body families.

| Body | State | exact | reskin | new | total |
|---|---|---|---|---|---|
| veteran | built | 85 | 30 | 0 | 115 |
| witch | built | 30 | 64 | 0 | 94 |
| nightborn | built | 13 | 73 | 0 | 86 |
| knight | built | 44 | 26 | 0 | 70 |
| shieldmaiden | built | 30 | 12 | 0 | 42 |
| pitborn | built | 14 | 23 | 0 | 37 |
| goblin | built | 15 | 19 | 0 | 34 |
| serpent | NEW (planned, "later") | 0 | 0 | 28 | 28 |
| werewolf | built, held | 18 | 10 | 0 | 28 |
| executioner | built | 12 | 14 | 0 | 26 |
| quadruped | NEW (planned in body-families.md) | 0 | 0 | 22 | 22 |
| giant | NEW (planned in body-families.md) | 0 | 0 | 17 | 17 |
| plaguedoctor | built | 13 | 4 | 0 | 17 |
| wraith | built, held | 16 | 1 | 0 | 17 |
| dwarf | built | 10 | 5 | 0 | 15 |
| skeleton | built, held | 11 | 0 | 0 | 11 |
| legionary | recoverable from git history | 7 | 1 | 0 | 8 |
| ranger | recoverable from git history | 3 | 2 | 0 | 5 |
| minotaur | built, held | 1 | 0 | 0 | 1 |

(exact = same role as the existing Pit legends on that body; reskin = nearest body with dress, gender, head or kit changes. Held-body rows count as exact where the role matches: werewolf group, undead, spirits. 16 of the 28 werewolf rows are hounds and wolves: Fenrir, Skoll, Hati, Beast of Gevaudan, Black Shuck, Barghest, Cu Sith, El Cadejo, Hound of the Baskervilles, Chupacabra use the werewolf body as a proxy; a true quadruped would look better.)

**Everything except 67 of 673 rows fits an existing or recoverable body.** Only 67 legends (10%) need a body that does not exist: serpent 28, quadruped 22, giant 17.

**Non-body build items (kits on existing bodies):**
- **Wing kit: 48 legends** (Valkyries, the Watchers, Pazuzu, Anzu, Simurgh, Bennu, Camazotz, Tengu, Mothman, several Goetia). One wing attachment on the nightborn or shieldmaiden body; no rig.
- **Head variants: 60 legends across 33 distinct heads.** Horns alone cover 21 (Goetia, oni, demons). Others: antlers 2, owl 3, crow 3, lion 2, horse 2, falcon, ibis, cat, crocodile, scorpion, heron, boar, monkey, bat, moth and more. List: The Strix (owl), Horus (falcon), Thoth (ibis), Bastet (cat), Hathor (cow horns), Sobek (crocodile), Khonsu (moon crown), Serket (scorpion crown), Ammit (croc/lion/hippo composite), Bennu (heron), Lamashtu (horns), Pazuzu (bird/lion), Kingu (horns), Anzu (lion-eagle), The Scorpion Men (scorpion tail), Ugallu (lion), Asag (horns), Cernunnos (antlers), Herne the Hunter (antlers), Sun Wukong (monkey), Zhu Bajie (boar), The Bull Demon King (horns), The Oni (horns), Shuten-doji (horns), Ibaraki-doji (horns), The Kappa (turtle-beak), The Tengu (crow), El Chonchon (flying head), Agares (horns), Vassago (horns), Marbas (horns), Barbatos (horns), Paimon (horns), Beleth (horns), Eligos (horns), Glasya-Labolas (dog), Bune (three heads), Forneus (sea-monster), Furfur (stag), Marchosias (wolf), Stolas (owl), Phenex (bird), Halphas (stork), Malphas (crow), Raum (crow), Focalor (horns), Sabnock (lion), Murmur (horns), Orobas (horse), Gremory (horns), Andras (owl), Dantalion (horns), Andromalius (horns), Mephistopheles (horns), Zahhak (horns), The Simurgh (great bird), Seven Macaw (macaw), Camazotz (bat), The Jersey Devil (horse), Mothman (moth).
- Animal-headed Egyptians (Horus, Thoth, Bastet, Sobek, Ammit) are covered this way; the Pit's Anubis already runs on the executioner body.

**New body families, ranked by legends unlocked per body (best value first):**

| Rank | New family | Legends | Of which challengeable now | Examples | Build note |
|---|---|---|---|---|---|
| 1 | serpent / dragon (incl. sea) | 28 | 28 | Jormungandr, Tiamat, Apep, Nidhogg, Fafnir, Lernaean Hydra, Zmey Gorynych, Lambton Worm, Kraken, Loch Ness | one rig, long spine; dragons (about 8) can also take wings |
| 2 | quadruped (horse, big cat, bull, boar) | 22 | 19 | Chimera, Cerberus, Nemean Lion, Pegasus, Sleipnir, Questing Beast, Kelpie, Bull of Heaven | spec already has the rig plan (spine 5, 4 legs, tail, jaw; Flee clip) |
| 3 | giant | 17 | 17 | Ymir, Kronos, Gaia, Atlas, Briareus, Balor, Thrym, Utgarda-Loki | spec: hero rig scaled 1.8-2.0 with long arms; can be a scale of an existing body first (pitborn) |

Not needed as families (checked): centaur 0 legends (no Chiron or Nessus in the list), multi-armed 1 (Briareus, a giant variant), large female sorceress 0 extra (witch body at scale), horned demon (a head variant on nightborn/pitborn), water creature (folded into serpent), harpy/valkyrie (shieldmaiden plus wing kit), insect/arachnid 2 (Jorogumo, Omukade; head or serpent). The owner's earlier "undead/skeletal" family is the existing skeleton body (11 legends).

**Top 5 build items by legends unlocked:** wing kit 48, head set 60 (33 heads; horns 21 first), serpent 28, quadruped 22, giant 17.

## 4. Donor asset review (main recommendation path, per owner priority 2026-10-07)

### Decision table (one row per candidate body source; the owner decides, nothing is ruled out on licence alone)

GREEN = CC0/MIT/BSD/Mixamo: free use, credit. AMBER = CC-BY / CC-BY-SA: credits page, and for SA we also share our edited model under CC-BY-SA. RED = GPL art: RED. Possible claim that our game code must be GPL too; legal check needed. Becomes AMBER if the owner releases the game code under GPL (then: credits, licence text and source offer via a linked page). Owner is still deciding that, so GPL rows stay RED.

| Candidate body source | Licence (as read) | Colour and what we must do | Style fit | Rig fit (humanoid, retargetable to hero rig?) | Legends covered |
|---|---|---|---|---|---|
| Quaternius animals/monsters (wolf, bull, fox, stag, alpaca, spider, dragon, demon, yeti, orc...; copies in WoC `public/models/creatures/`) | CC0 1.0 (WoC `CREDITS.md` line 101) | GREEN. Free use; credit anyway. Take originals, not WoC's re-compressed copies | low-poly, flat colour (stylised) | quadruped and dragon rigs, 38-51 joints; not humanoid; the humanoid-ish ones (orc, goblin, demon) not tested against hero rig (inference: retarget possible but not checked) | quadruped 22, dragons about 8 of serpent 28, yeti/orc as giant proxy |
| KayKit characters and skeletons (WoC `chars/players`, `chars/enemies`) | CC0 1.0 (`CREDITS.md`) | GREEN. Free use; credit | low-poly cartoon | humanoid `Rig_Medium`, 23 joints, 22-25 clips; retargetable to our hero rig: likely yes (inference, bone names not compared) | duplicates our humanoid bodies; clip source; ranger/legionary-type rows |
| Mixamo (outside the box) | Adobe terms, free for game use, no standalone redistribution (to verify) | GREEN per owner: free use, credit | realistic to stylised, varied | humanoid, one standard skeleton; retargetable: yes (standard) | animation donor for all humanoid rows (about 616 on existing bodies); few creatures |
| Kenney packs (outside the box) | CC0 | GREEN. Free use; credit | low-poly | mostly props; few characters | little |
| 0 A.D. meshes (horses, lions, tigers, bears, wolves, boar, croc, elephants, rhino, hawk, dragon) | CC-BY-SA 3.0 (`art/LICENSE.txt`) | AMBER. Credits page naming Wildfire Games; share our edited model under CC-BY-SA | realistic low-poly | animal skeletons (`art/skeletons`: boar, bovidae, camelus); not humanoid | horses and big cats for quadruped (Sleipnir, Pegasus, Kelpie, Rakhsh, Nemean Lion), Sobek body |
| Flare game (`flareteam-flare-game`) | CC-BY-SA 3.0 | AMBER. Credits; share edits | 2D sprites | none (2D) | none usable for 3D |
| Lincity-ng models | dual GPL and CC-by-sa-v2 (`COPYING-data.txt`) | AMBER if taken under the CC-BY-SA option | low-poly buildings | none | none (buildings) |
| KeeperRL `data_free` | CC-BY-SA 2.0; `data` only with the official binary | AMBER for `data_free`; `data` has no licence for us | 2D | none | none |
| Veloren voxel NPCs (219 creature dirs, 4,517 `.vox`: cyclops, minotaur, troll, hydra, wyverns, jiangshi, oni, werewolf...) | repo GPL v3 (`README.md` line 100); `credits.ron` also has CC-BY-NC-SA 4.0 (11 entries) and CC BY-SA 3.0 (4) | RED. Possible claim that our game code must be GPL too; legal check needed. Becomes AMBER if the owner releases the game code under GPL (then: credits, licence text and source offer via a linked page). NC entries also need a per-asset check | voxel (blocky) | skeletal voxel rigs; not humanoid-retargetable (inference) | cyclops/giant 17, serpents, quadrupeds, werewolf, undead: broad but voxel |
| freeciv, OpenRCT2, widelands, OpenTTD (GPL) | GPL-2.0 / GPL-3.0 (`PINS.txt`) | RED. Possible claim that our game code must be GPL too; legal check needed. Becomes AMBER if the owner releases the game code under GPL (then: credits, licence text and source offer via a linked page). | 2D / iso sprites and `.blend` unit renders (`legion4.blend`) | none | none |
| WoC project-generated creatures (`hoard_*`, mounts, Meshy/Tripo models) | "With the project only" / "No, permission required" (`CREDITS.md`) | NOT AVAILABLE: no licence to extract; ask Levy Street if wanted | stylised | rigged | none until permission |

Conclusion for the owner: the only candidates that are GREEN and 3D and useful are Quaternius, KayKit, Mixamo (and Kenney). AMBER adds realistic animals (0 A.D.). RED (Veloren) is the only large creature library but is voxel style.

Licence tiers: see the decision table above (GREEN / AMBER / RED); NC entries and proprietary assets have no licence for us.

**What I read.** VPS `/mnt/frankendom-donors` (47 repos, `PINS.txt`), listed and searched for model files at `-maxdepth 4`, read licence files; local `~/Developer/donors/world-of-claudecraft` (WoC) `LICENSE`, `CREDITS.md`, GLB headers (parsed read-only: triangles, joints, clip names). Nothing was copied or downloaded.

**EverQuest, Ultima Online, Morrowind, Daggerfall, RuneScape and Gothic original art is proprietary and is NOT in the open repos.** EQEmu, ModernUO, openmw, daggerfall-unity, OpenGothic, ZenKit, 2004Scape-Server, LostCityRS-Engine-TS, OpenTESArena ship engines without game data (OpenTESArena README: "No game assets are distributed"; daggerfall-unity's one model file at depth 4 is a UI arrow `RotateArrows.obj`; EQEmu/ModernUO/openmw/2004Scape returned zero model files). Design reference only; we re-create, never copy likeness or brands.

### 4a. Candidate donors, in order of usefulness

| Donor | Licence (read) | Closed-source safe? | Format / rig | Size read | Style fit | Covers |
|---|---|---|---|---|---|---|
| **WoC: Quaternius animal and monster GLBs** (`public/models/creatures/`: wolf, bull, fox, stag, alpaca, spider, frog, goblin, orc, yeti, demon, ghost, tribal, velociraptor, dragonevolved, glubevolved, golelingevolved) | `CREDITS.md` line 101: "Animated creatures (wolf, bull, fox, stag, alpaca, spider, frog, goblin, orc, yeti, giant, demon, ghost, goleling, glub, tribal, velociraptor, dragon) | Quaternius | CC0 1.0 | Yes". WoC repo `LICENSE` is MIT (code only) | Yes, CC0 needs no credit (credit anyway) | skinned GLB, quadruped rigs with 38-51 joints and clips Idle/Gallop/Attack/Death/HitReact (wolf 51 joints, 12 clips; bull 42 joints, 13 clips); dragon 46 joints, 8 clips (Fast_Flying, Punch, Death...) | wolf 1,962 tris; bull 2,418; fox 1,848; stag 3,667; dragon 7,438; demon 4,784; no textures (flat colours); wolf file 336 KB (meshopt, so triangle counts are from indices, approximate) | low-poly, flat shaded, chunky. Our bodies are TRELLIS reconstructions, more painterly and detailed: a **style gap**, so these read as a different game next to the Centurion. Fine as rig and clip donors; for the look you would re-texture or accept the contrast | **quadruped (22 legends)** and the dragons part of **serpent**; yeti/orc as giant proxy |
| **WoC: KayKit characters** (`public/models/chars/players`, `chars/enemies`: knight, barbarian, mage, rogue, ranger, skeleton_warrior, skeleton_golem, necromancer) | `CREDITS.md`: "Character models + animations (knight, mage, rogue, barbarian, hooded rogue) ... KayKit ... CC0 1.0 | Yes" and the Skeletons pack "CC0 1.0" | Yes | standard humanoid `Rig_Medium`, 23 joints, 22-25 clips each (Idle, Running_A, Death_A, Hit_A, melee attacks) | knight 5,800 tris, barbarian 7,123, rogue 7,562, one small texture | low-poly cartoon; same style gap. Humanoid skeleton is retargetable to our hero rig in Blender (inference; our hero rig bone names were not checked) | humanoid duplicates of what we have; useful as an animation-clip source and for the 5 ranger/legionary-type rows. Low value for new body families |
| **0 A.D. meshes** (`0ad-0ad/binaries/data/mods/public/art/meshes/skeletal/`: animal_lion, tiger, bear, wolf, boar, crocodile (Croc), horse x8, elephant x10, rhino, hawk, shark, dragon) | `LICENSE.txt`: `binaries/data/mods/*/art` is "Creative Commons Attribution-Share Alike 3.0"; `art/LICENSE.txt`: "you must release it (and any modifications you have made to it) under the CC-by-sa license" and credit Wildfire Games | **FLAG: CC-BY-SA.** Modified models must be shared under CC-BY-SA with credit. Legal call for Dom whether a model inside a closed game counts as a distributed derivative; treat as yes | Collada `.dae` with skeleton xml (`art/skeletons/*.xml`: boar, bovidae, biped, camelus) | polycounts and texture sizes not read | realistic low-poly RTS style, closest to our look of all the open donors, but small on screen | horses (Sleipnir, Pegasus, Kelpie, Rakhsh), big cats (Nemean Lion), bull, croc (Sobek body) that Quaternius lacks (no horse or lion in the CC0 set I saw) |
| Veloren (`veloren-veloren/assets/voxygen/voxel/npc`, 219 creature dirs: cyclops, minotaur, troll_*, hydra, wyvern_*, jiangshi, oni, werewolf, dullahan...) | repo `README.md` line 100: GPL v3; `assets/credits.ron` lists CC-BY-NC-SA 4.0 (11 entries) and CC BY-SA 3.0 (4) | RED (see decision table); NC entries also need checking | `.vox` voxel (4,517 files) | blocky voxel | voxel style, does not match | RED by licence and a poor style match (voxel); kept in the table for the owner's decision |
| flareteam-flare-game | README: art CC-BY-SA 3.0 | SA | 2D sprites; `art_src` has spell `.blend` files only | n/a | 2D | AMBER but 2D: nothing usable |
| lincity-ng, freeciv, OpenRCT2, widelands, OpenTTD, simutrans | GPL / CC-by-sa-v2 dual (lincity `COPYING-data.txt`) | RED (GPL art) | buildings and 2D units | n/a | wrong subject | RED, wrong subject |
| KeeperRL | `COPYING-MEDIA.txt`: `data` only with the official binary; `data_free` CC-BY-SA 2.0 | No | 2D | n/a | 2D | RED, wrong subject |
| OpenTESArena, daggerfall-unity, OpenGothic, ZenKit, OpenMW, EQEmu, ModernUO, 2004Scape, LostCityRS | MIT/GPL code | n/a | no character art shipped | n/a | n/a | design reference only |
| Remaining ~25 engine repos (vcmi, wesnoth, gemrb, xoreos, ...) | GPL/MIT code | n/a | no 3D models found at depth 4 (Wesnoth, Cataclysm, DCSS art is 2D and not checked in detail) | n/a | 2D | nothing for 3D bodies |

**Is World of ClaudeCraft's art diverse and reusable?** Diverse in species (about 94 creature GLBs: wolves, bears, dragons, ogres, spiders, elementals) but only a slice is reusable. Reusable: the CC0 Quaternius and KayKit packs (rows above, plus Kenney props). Not reusable: everything marked "Project asset ... With the project only" (project-generated Tripo/Meshy models: `hoard_*`, mounts, props, Meshy creatures; "You may not extract these assets") and "No, permission required". `CREDITS.md` says unlisted assets are "unrecorded rather than free"; for example `ogre.glb` and the `hoard_*` bosses are not in the CC0 row, so do not take them. WoC's MIT licence covers code only. Also: WoC's copies are re-compressed (meshopt, KTX2) and WoC states that simplifying skinned rigs corrupts weights, so take originals from the packs' own pages, not from WoC.

### 4b. Free sources outside the box (candidates to VERIFY, not checked by me)

- Quaternius packs (poly.pizza/u/Quaternius, quaternius.com): CC0 per WoC's credit rows; the animated monsters and animals sets are the source of the WoC creatures. Verify the exact pack licence page and whether a snake, horse or lion is in the set.
- KayKit (Kay Lousberg) character and skeleton packs: CC0 per WoC's credit rows; verify on itch.io.
- Kenney (kenney.nl): CC0, mostly props and kits; few characters.
- Mixamo (Adobe): characters and animations rigged to one humanoid skeleton, free under Adobe's terms (an Adobe account; commercial use in a game is allowed, but you may not redistribute the raw assets standalone). Not CC0; the terms need a read before use. Best as an animation donor for the hero rig, not for creatures.
- OpenGameArt and Sketchfab CC0/CC-BY filters: per-asset licence, check each; CC-BY needs credit, SA and NC rows are out.

### 4c. Take these first (ranked)

1. **Quaternius wolf/bull/stag/fox (CC0)** from the original pack: seed the quadruped family (22 legends; the rig already has Gallop, Attack, Death, HitReact; add a Flee clip per body-families.md). Closed-source safe. Needs re-texturing to close the style gap.
2. **Quaternius dragon (CC0):** seed the serpent/dragon family for the dragon rows (Zmey Gorynych, Fafnir, Nidhogg, lindworms, about 8). True snakes and sea serpents (Jormungandr, Apep, Kraken, Loch Ness, about 20) are not in what I saw: build those on the own pipeline, or verify whether Quaternius ships a snake.
3. **0 A.D. horse and lion meshes (CC-BY-SA 3.0)**, only if Dom accepts share-alike on those two models: they cover Sleipnir, Pegasus, Kelpie, Rakhsh, Nemean Lion that the CC0 set lacks. Otherwise use the stag or alpaca as a proxy.
4. **KayKit / Mixamo as animation donors** for the hero rig (no new bodies).
5. Owner's call, not mine: Veloren (RED, voxel), Flare/KeeperRL (AMBER, 2D, nothing usable), GPL strategy art (RED). Not available at all: any WoC "With the project only" model.

Honest limit: no open donor matches our TRELLIS painted look. The CC0 packs save rigging and animation work (the expensive part), not art direction.

## 5. Recommendation: first 3 new families

1. **Quadruped** (22 legends, 19 challengeable now): start from Quaternius wolf/bull (CC0 mesh and rig), re-texture; horse and lion via 0 A.D. only if share-alike is accepted, else own pipeline (FLUX, TRELLIS, Blender per `body-families.md` and the hero-set skill).
2. **Serpent/dragon** (28 legends, all challengeable now): Quaternius dragon as the dragon seed (CC0), own pipeline for the long snake body (no donor seen).
3. **Giant** (17 legends, all challengeable now): own pipeline per spec (hero rig x1.8-2.0, long arms, `giant-hrungnir-b` design done); no donor needed. As a first step, scale pitborn.
Cheap before any of these: the **wing kit (48)** and **horn head (21)** on existing bodies, and un-holding **werewolf, skeleton, wraith, minotaur** (about 84 rows: werewolf 28, wraith 17, skeleton 11, minotaur 1, plus the hounds as proxies).

## 6. Conflicts flagged and open questions

Resolved by the Strategy audit (2026-10-07) and applied: patrons challengeable and ranked 9-10 (this supersedes `living-world.md` s10.1 "Zeus and Poseidon stay never-beatable" and the CSV "never beatable" notes: **those docs now need updating**); Watchers incl. Azazel and Aztec/Maya gods and monsters unblocked per the owner's 2026-10-06 rulings; Greek/Roman duplicates merged; post-1929 cryptids blocked; Hercules display name kept.

Still open or newly flagged:
1. **Blocked rows (11):** Cain (no ruling, scripture figure); 5 Latin American rows with no confirmed first source (El Sombreron, La Patasola, La Siguanaba, El Familiar, La Luz Mala: blocked:needs-source); 5 post-1929 sources (Mothman 1966, Chupacabra 1995, Beast of Bodmin 1978, Jackalope 1932, Sasquatch: Burns, Maclean's April 1929, borderline).
2. **Other 1930s sources, left `yes`:** Wulver (Saxby 1932), Mmoatia, Onini, Osebo (Rattray 1930). The folklore is old but the cited source is not pre-1929. Same rule as item 1 would block them; your call.
3. **`legends-rule` SKILL.md is stale** against the 2026-10-06 overrides (Hebrew Bible figures and Anansi out; honourable folk heroes). `living-world.md` s10.1 also still says Abrahamic and Aztec/Maya figures are out. Both need editing; I did not touch them.
4. **Win line:** 46 honourable rows need "You stood against X"; Pit wins say "You beat X". The fight code needs a per-legend flag.
5. **Data shape (engineering, not analyst):** the 10x10 `LEGENDS` record in `src/legends.ts` (`legendAt(id, tier)`, one name per body per rung, 100 portraits `<opponent>-<rung>`) needs a data-driven replacement for 673 legends with many per rung, drawn by rank. SKILL.md also says "100 named opponents, one per opponent per rank".
6. **Ptah rung:** CSV note says "ladder dwarf 7"; `src/legends.ts` has him 8th. Moot for rank now (patron, 9-10), but the CSV note is wrong.
7. **Vlad vs Dracula:** Pit Vlad is the historical Vlad III (Dom exception 2026-09-28); Count Dracula (CSV) is Stoker's character. Kept as separate people.
8. **Merges worth a glance:** Ares row carries the Pit Mars (veteran body); Hades row absorbs Dis Pater; Athena, Hermes, Hephaestus are Pit-only rows now holding the Minerva, Mercury, Vulcan aliases. Other twins checked and not merged because the list has only one name for them: Vesta (no Hestia row), Fortuna (no Tyche), Janus. Loki and Utgarda-Loki are different figures.
9. **Nameless generics:** 9 Pit rung-1 names (Pit Thrall, Sewer Imp, Night Page, Headsman, Forge Hand, Shield Girl, Beak, Hedge Witch, Squire) have no source; they stay as rank 1. Drop them?
10. **Hercules** is displayed with the common name (owner's call); `legends-500.md` says `name` is "as the source spells it", a small tension.
11. **Indian figures:** none found in either list, so none assigned.
12. **Closed-source:** is a CC-BY-SA model (0 A.D.) acceptable if modified? Is Mixamo acceptable under Adobe's terms? (Section 4 table.)

## Files
- `docs/research/legends-600-ladder.csv` (673 rows)
- `docs/research/legends-600-bodies-and-donors.md` (this file)


## 7. Owner decisions after audit (2026-10-07)
- Cain unblocked: Dom override 2026-10-06 (legends-500.md rule 15), legend only, never a patron. Blocked rows now 10.
- Giant is NOT a new family: the 17 giant legends use the knight or executioner body scaled about 2x (as the Hrungnir mob look already does at 1.5x). New-body legends drop from 67 to 50.
- Restyling donor bodies to our painted look: Blender on the VPS (CPU, free) for fitting/retarget; texture repaint via the image pipeline on Hugging Face GPU; the paid 32 GB HF CPU is the fallback when the VPS is busy.
- Cut as unrecognisable (owner 2026-10-07: "if not well known and unrecognisable then no point"): The Wulver, Mmoatia, Onini the Python, Osebo the Leopard (sources 1930-32). Pool now 669.
- Owner principle: the names are BRANDS that bring players in on their fame. Recognisability is the main reason a name is on the list.
