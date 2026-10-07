# Legends fame, measured (research, 2026-10-07)

Companion to `docs/research/legends-600-ladder.csv` (669 rows). Analyst output only: nothing in `src/` was touched. Pageviews are English Wikipedia, `all-access`, `user` agent, summed over the 12 full months 2025-09 to 2026-08 (Wikimedia REST API, monthly granularity). New columns in the CSV: `wiki_title`, `pageviews_12m`, `fame_score` (log10, 2 dp; 0.00 where there is no article), `fame_measured`, `pit_status` (keep | park), `park_reason`, `wiki_note`, plus three robustness columns `steady_12m` (median month x 12), `spike_flag` (peak month at least 3x the median) and `fame_steady` (tier on the steady figure). The old guessed `fame` column is kept. `fame_measured` follows the brief (plain 12-month sum); `fame_steady` is the safer read for marketing.

## 1. Method and limits

- Titles were mapped by hand (e.g. Hercules to Heracles, Kronos to Cronus, Sasquatch to Bigfoot, Edward Teach to Blackbeard, Zeus/Hera etc. direct), redirects resolved through the MediaWiki API, and disambiguation pages checked. Where a row has no article of its own the figure is recorded as 0 (`wiki_note`: no en.wikipedia article).
- **Shared articles.** Twin or group rows that share one article (Castor/Pollux, Tristan/Isolde, Erec/Enide, Skoll/Hati, Dr Jekyll/Mr Hyde, Eitri/Brokkr, Hunahpu/Xbalanque as the Hero Twins, Setne Khamwas/Naneferkaptah) carry the shared count, flagged in `wiki_note`. This slightly flatters one half of each pair.
- **Redirect rows.** Where a name is only a redirect into a list or group page (most Ars Goetia demons, several Watchers, Loup-garou, Luz Mala), the views are those of the redirect title itself, not the big target page, so a 72-demon list page does not inflate each demon. Redirect-title traffic undercounts a little (most search traffic goes to the canonical title), which is the safe direction for a park decision.
- **Concept pages.** Pride, Covetousness, Wrath, Envy, Gluttony and Sloth map to the abstract sin articles (120k-250k views). They are flagged `abstract concept page; inflated` and excluded from the marketing list. The Bavarian Illuminati (Illuminati article, 2.3M, modern conspiracy traffic) and Homunculus (601k, alchemy concept page) are flagged inflated and also excluded from the marketing list.
- **Generic creature pages** (Oni, Kobold, Redcap, Kelpie, Banshee...) are real name pulls but are search-for-the-thing, not search-for-the-character. Fine for brand reach, weaker for 'I know this one'.
- 9 generic rung-1 names (Pit Thrall, Squire...) and 7 original Frankendom or invented names (Cinderwing, The Hollow Herald, Vesperel, The Counter-Signer, The Ledger, Lodge of the Compass, Order of the Thorned Rose), plus Alphonse the Werewolf and The Werewolves of Ossory (no article of their own; the generic Werewolf page was not counted) and Bida the Serpent of Wagadu (only a section inside Ghana Empire), have no article and score 0. All score 0.
- Limits: a view is not a fan. Wikipedia undercounts non-English audiences (Japan, China, Brazil, Latin America have their own Wikipedias, so Sun Wukong, Momotaro and El Cid read low against the English-speaking world). Mobile-app players skew to a younger audience that finds characters through games and video, not Wikipedia.

## 2. Thresholds

The requested thresholds were used unchanged: household >= 1,000,000/yr, known 100,000-999,999, obscure < 100,000. They are not silly: the median row has 97,406 views, so the known/obscure line splits the list almost in half. Household is strict (only the very top of the Wikipedia curve crosses 1M): 29 rows (22 once one-month spikes are removed, see 3b). For marketing, the 500,000 line is more useful and gives **84 rows**; both counts are shown below.

## 3. Distribution

| Tier | Rows | Share | Old guessed `fame` |
|---|---|---|---|
| household | 29 | 4.3% | 95 (14.2%) |
| known | 299 | 44.7% | 172 (25.7%) |
| obscure | 341 | 51.0% | 402 (60.1%) |
| **Total** | 669 | 100% | 669 |

Household + known overall: **328 of 669 = 49.0%** (old guess: 267 = 39.9%). Rows at 500k+: 84; rows at 1M+: 29.

Old guess against measurement (rows):

| Old guess | Measured household | Measured known | Measured obscure |
|---|---|---|---|
| household | 23 | 72 | 0 |
| known | 4 | 139 | 29 |
| obscure | 2 | 88 | 312 |

The guesser was good at direction and bad at scale: of 95 'household' guesses, all 95 are at least 'known' (The Reaper is mapped to the Grim Reaper article) but just 23 clear 1M; the old 'household' really means 100k-1M on Wikipedia. The big miss is the other end: 88 names guessed 'obscure' measure 100k+ (Goetia demons, historical orders and generals, Egyptian and Greek deities), so the measured pool of recognisable names is larger than assumed.

### 3b. Spikes (read before using the numbers)

28 rows of the 12-month window have one month at 3x or more the median month; 14 of them peak in **July 2026**, which is the release of Christopher Nolan's film The Odyssey. The Trojan-war and Odyssey cast is inflated by a one-month spike: Odysseus (3,099,043 summed, 1,264,584 steady), Agamemnon (2,379,910 summed, 560,856 steady), Circe, Polyphemus, Scylla, Charybdis, Achilles, Hector, Ajax, Patroclus. This is real but transient interest (a film marketing bump you can ride for a few months, not a permanent brand). `steady_12m` strips it: median month x 12.

On the steady measure the tiers are household 22, known 294, obscure 353 (household+known 47.2%). Other spiking ladder rows: Artemis (Apr 2026), Frankenstein's Creature and Victor Frankenstein (Nov 2025), The Headless Horseman (Oct 2025), Cain (Oct 2025), Cincinnatus (Jan 2026), Sekhmet and The Nekomata (Jun 2026), The Immortals and Zenobia (Mar 2026), Homunculus, Kintaro, Camazotz, Gotz von Berlichingen. Every spike flag is in the CSV `spike_flag` column.

### Household + known per rank (measured, before parking)

| Rank | Rows | Household | Known | Obscure | HH+known % | 500k+ names |
|---|---|---|---|---|---|---|
| 1 | 65 | 1 | 16 | 48 | 26% | 2 |
| 2 | 67 | 0 | 23 | 44 | 34% | 5 |
| 3 | 66 | 0 | 20 | 46 | 30% | 2 |
| 4 | 66 | 2 | 20 | 44 | 33% | 2 |
| 5 | 67 | 3 | 21 | 43 | 36% | 6 |
| 6 | 67 | 2 | 29 | 36 | 46% | 7 |
| 7 | 67 | 3 | 38 | 26 | 61% | 6 |
| 8 | 67 | 5 | 42 | 20 | 70% | 15 |
| 9 | 69 | 7 | 36 | 26 | 62% | 11 |
| 10 | 68 | 6 | 54 | 8 | 88% | 28 |

Fame climbs with rank: ranks 7-10 are 61-87% household+known, ranks 1-6 are 28-46%. Ranks 1-4 hold only 28-36% and carry the obscure mass; fine for volume, weakest marketing surface.

## 4. Top 50 by pageviews (marketing list)

Excludes the six abstract sin pages, Illuminati and Homunculus (flagged inflated) and collapses twin rows to one entry. `*` = article shared with a partner row. Names marked `S` have a one-month spike (see 3b); Odyssey cast rows lose well over half of their count when steady.

| # | Name | Wikipedia article | Views/yr | Rank | Group |
|---|---|---|---|---|---|
| 1 | Cleopatra VII | Cleopatra | 10,945,303 | 7 | historical |
| 2 | Alexander | Alexander the Great | 3,480,116 | 9 | pit-only |
| 3 | Odysseus S | Odysseus | 3,099,043 | 8 | greek |
| 4 | Julius Caesar | Julius Caesar | 2,805,236 | 8 | historical |
| 5 | Agamemnon S | Agamemnon | 2,379,910 | 7 | greek |
| 6 | Vlad | Vlad the Impaler | 2,168,253 | 7 | pit-only |
| 7 | Achilles S | Achilles | 1,879,734 | 9 | pit-only |
| 8 | Circe S | Circe | 1,796,233 | 5 | pit-only |
| 9 | Artemis S | Artemis | 1,423,098 | 10 | greek |
| 10 | Athena | Athena | 1,398,513 | 10 | pit-only |
| 11 | Zeus | Zeus | 1,376,874 | 10 | greek |
| 12 | King Arthur | King Arthur | 1,340,408 | 10 | arthurian |
| 13 | Apollo | Apollo | 1,323,102 | 10 | pit-only |
| 14 | Richard the Lionheart | Richard I of England | 1,291,152 | 8 | historical |
| 15 | Hannibal | Hannibal | 1,252,266 | 6 | pit-only |
| 16 | Robin Hood | Robin Hood | 1,205,007 | 5 | european-folklore |
| 17 | Edward Teach | Blackbeard | 1,201,878 | 4 | historical |
| 18 | William Wallace | William Wallace | 1,166,437 | 9 | scottish |
| 19 | Aphrodite | Aphrodite | 1,140,868 | 9 | greek |
| 20 | The Knights Templar | Knights Templar | 1,096,106 | 8 | dead-order |
| 21 | Robert the Bruce | Robert the Bruce | 1,064,919 | 9 | scottish |
| 22 | Prometheus | Prometheus | 1,063,347 | 10 | greek |
| 23 | Polyphemus S | Polyphemus | 1,057,728 | 6 | pit-only |
| 24 | Spartacus | Spartacus | 1,049,607 | 4 | pit-only |
| 25 | Dionysus | Dionysus | 1,033,467 | 9 | greek |
| 26 | Hermes | Hermes | 1,032,326 | 9 | pit-only |
| 27 | Ramesses II | Ramesses II | 1,006,478 | 8 | historical |
| 28 | Miyamoto Musashi | Miyamoto Musashi | 1,002,391 | 5 | pit-only |
| 29 | Kronos | Cronus | 955,236 | 10 | greek |
| 30 | Beowulf | Beowulf | 919,319 | 3 | pit-only |
| 31 | Boudica | Boudica | 917,893 | 5 | pit-only |
| 32 | Dorian Gray | The Picture of Dorian Gray | 915,263 | 3 | gothic-lit |
| 33 | Medusa | Medusa | 909,109 | 8 | greek |
| 34 | Hecate | Hecate | 907,807 | 10 | pit-only |
| 35 | Persephone | Persephone | 904,764 | 9 | greek |
| 36 | Hercules | Heracles | 900,600 | 9 | greek |
| 37 | Scylla S | Scylla | 860,080 | 8 | greek |
| 38 | Ragnar Lothbrok | Ragnar Lodbrok | 845,844 | 2 | pit-only |
| 39 | Hades | Hades | 797,448 | 10 | greek |
| 40 | Sasquatch | Bigfoot | 793,466 | 5 | cryptids |
| 41 | The Loch Ness Monster | Loch Ness Monster | 789,785 | 6 | cryptids |
| 42 | Poseidon | Poseidon | 786,513 | 10 | greek |
| 43 | Edward the Black Prince | Edward the Black Prince | 739,574 | 7 | historical |
| 44 | Frankenstein's Creature S | Frankenstein's monster | 725,469 | 9 | gothic-lit |
| 45 | Odin | Odin | 712,447 | 10 | norse |
| 46 | Cain S | Cain and Abel | 709,595 | 7 | fallen-watchers |
| 47 | Dr Jekyll* | Strange Case of Dr Jekyll and Mr Hyde | 699,307 | 2 | gothic-lit |
| 48 | Hera | Hera | 693,109 | 10 | greek |
| 49 | Ares | Ares | 673,225 | 10 | greek |
| 50 | Francis Drake | Francis Drake | 636,935 | 5 | historical |

Read: 35 of the top 50 sit at rank 7 or above; only 6 are rank 1-4 (Blackbeard, Spartacus, Beowulf, Ragnar Lothbrok, Dorian Gray, Jekyll are the cheap ones to move up). The top 50 is Greek gods and heroes, Roman and medieval commanders, plus Arthur, Robin Hood, Wallace and Bruce. Circe, Odysseus, Agamemnon, Achilles are Odyssey-film inflated.

## 5. Where the old guess disagrees most

**Old 'household' but measured under 100k:** none. Old 'known' but measured under 100k: Mulciber (3,940), Camilla (21,143), The Huli Jing (34,353), Louhi (35,009), The Bull Demon King (35,084), Ankou (38,290), Alberich (38,625), Queen Tera (40,806), Arawn (44,300), Zmey Gorynych (46,451), Sir Francis Varney (50,651), Mother Shipton (52,108)...


Old 'household' with a measured count of 100k-500k (guess too high at the 1M scale):

Puck (103k), Lagertha (132k), Hel (157k), The Reaper (205k), Macbeth (207k), Grendel (212k), Hattori Hanzo (221k), Charon (283k), The Lernaean Hydra (297k), Sweeney Todd (312k), Hua Mulan (312k), Fenrir (317k), Pegasus (321k), Lancelot (341k), Janus (345k), Abraham Van Helsing (351k), The Sphinx of Thebes (356k), The Flying Dutchman (366k), Mephistopheles (371k), The Headless Horseman (376k), Jason (381k), Cerberus (386k), The Valkyries (386k), The Banshee (399k), The Yeti (436k), Carmilla (439k), The Pied Piper of Hamelin (445k), Medea (484k), Nyx (485k), Victor Frankenstein (485k), Morgan le Fay (485k), Thor (487k), Leonidas (489k), The Kraken (495k)

**Old 'obscure' but measured household or high-known (hidden brands the guess missed), top 25 by views:**

| Name | Old | Views/yr | Rank | Note |
|---|---|---|---|---|
| The Bavarian Illuminati | obscure | 2,256,063 | 1 | article is dominated by modern conspiracy interest; inflated, excluded from mark |
| The Knights Templar | obscure | 1,096,106 | 8 |  |
| Edward the Black Prince | obscure | 739,574 | 7 |  |
| Homunculus | obscure | 601,252 | 1 | concept page (alchemy and fiction); inflated, excluded from marketing list |
| Helios | obscure | 594,705 | 10 |  |
| Atlas of Atlantis | obscure | 571,939 | 8 | shares the Atlas (mythology) article with the Titan row; likely overstated |
| The Gilded Chief | obscure | 477,015 | 3 | invented name; mapped to the El Dorado legend article |
| The Hanseatic League | obscure | 464,866 | 1 |  |
| Paimon | obscure | 454,550 | 8 |  |
| Hatshepsut | obscure | 424,118 | 6 |  |
| Patroclus | obscure | 407,429 | 5 |  |
| Amun | obscure | 385,634 | 10 |  |
| The Hyperboreans | obscure | 382,105 | 2 |  |
| Selene | obscure | 362,751 | 9 |  |
| The Amazons of the River | obscure | 350,239 | 3 |  |
| Belisarius | obscure | 346,267 | 7 |  |
| Pyrrhus of Epirus | obscure | 343,679 | 7 |  |
| Moctezuma II | obscure | 343,138 | 7 |  |
| Hathor | obscure | 341,155 | 9 |  |
| Skanderbeg | obscure | 338,158 | 9 |  |
| El Coco | obscure | 321,408 | 1 |  |
| The Praetorian Guard | obscure | 304,179 | 5 |  |
| Pazuzu | obscure | 289,175 | 7 |  |
| The Berserkers | obscure | 279,586 | 3 |  |
| Enki | obscure | 274,642 | 10 |  |

Altogether 90 old-'obscure' rows measure 100k+ (several are the Ars Goetia, Watcher and creature rows whose names are searched widely), and 29 old-'known' rows measure under 100k.

Biggest sources of disagreement: Ars Goetia names (Paimon 455k), generic creature pages (Chupacabra, Mothman, Kappa, Banshee), the Frankenstein/Jekyll/Dorian novel group, historical bodies and orders (Knights Templar, Hanseatic League, Praetorian Guard), and the Egyptian and Greek deities that the guesser rated obscure (Helios, Amun, Hathor, Selene).

## 6. PARK list

**Rule:** park (recommend moving to the open world as a creature or unnamed encounter, not deleted) any non-generic row under 10,000 views/yr, then check every rank keeps at least 50 kept legends. The 9 generic rung-1 mobs are never parked (they are filler, not brands). Result: **64 parked, 605 kept**. No rank needed its floor protected: kept per rank after parking = r1: 53, r2: 51, r3: 55, r4: 56, r5: 60, r6: 64, r7: 63, r8: 66, r9: 69, r10: 68.

Recommendation for all parked rows: a world creature or nameless variant that keeps the folklore flavour and the body family, so the work already done is not wasted; the name is not worth a Pit slot as a headline. Where an original Frankendom or invented name is parked (Cinderwing, The Hollow Herald, Vesperel, The Counter-Signer, The Ledger, Lodge of the Compass, Order of the Thorned Rose) the recommendation is the same, and they are the strongest candidates because they have no outside brand value at all.

| Name | Rank | Group | Views/yr | Reason |
|---|---|---|---|---|
| Alphonse the Werewolf | 1 | werewolf-folklore | 0 | no en.wikipedia article |
| Ananel | 2 | fallen-watchers | 0 | no en.wikipedia article |
| Arakiba | 4 | fallen-watchers | 0 | no en.wikipedia article |
| Batarel | 2 | fallen-watchers | 0 | no en.wikipedia article |
| Bida, the Serpent of Wagadu | 6 | african | 0 | no en.wikipedia article |
| Christina, the White Wolf of the Hartz | 1 | werewolf-folklore | 0 | no en.wikipedia article |
| Cinderwing | 1 | fallen-watchers | 0 | no en.wikipedia article |
| Fernand Wagner | 2 | werewolf-folklore | 0 | no en.wikipedia article |
| Hugues the Wer-Wolf | 1 | werewolf-folklore | 0 | no en.wikipedia article |
| Jeqon | 3 | fallen-watchers | 0 | no en.wikipedia article |
| Jomjael | 1 | fallen-watchers | 0 | no en.wikipedia article |
| Lodge of the Compass | 1 | dead-order | 0 | no en.wikipedia article |
| Order of the Thorned Rose | 1 | dead-order | 0 | no en.wikipedia article |
| Satarel | 2 | fallen-watchers | 0 | no en.wikipedia article |
| The Counter-Signer | 3 | faustian-pact | 0 | no en.wikipedia article |
| The Hollow Herald | 5 | fallen-watchers | 0 | no en.wikipedia article |
| The Ledger | 2 | faustian-pact | 0 | no en.wikipedia article |
| The Werewolves of Ossory | 2 | werewolf-folklore | 0 | no en.wikipedia article |
| Vesperel | 4 | fallen-watchers | 0 | no en.wikipedia article |
| La Luz Mala | 1 | latam-folklore | 143 | 143 views/yr (<10,000) |
| The Ulfhednar | 4 | werewolf-folklore | 213 | 213 views/yr (<10,000) |
| Ezeqeel | 3 | fallen-watchers | 248 | 248 views/yr (<10,000) |
| El Familiar | 2 | latam-folklore | 384 | 384 views/yr (<10,000) |
| Kasdeja | 2 | fallen-watchers | 530 | 530 views/yr (<10,000) |
| Turel | 1 | fallen-watchers | 654 | 654 views/yr (<10,000) |
| Cundrie | 1 | arthurian | 1,083 | 1,083 views/yr (<10,000) |
| Myrina | 5 | lost-civilisations | 1,974 | 1,974 views/yr (<10,000) |
| Gassire | 3 | african | 2,255 | 2,255 views/yr (<10,000) |
| Andras | 6 | goetia | 2,470 | 2,470 views/yr (<10,000) |
| Hunahpu | 7 | lost-civilisations | 2,508 | 2,508 views/yr (<10,000) |
| Xbalanque | 7 | lost-civilisations | 2,508 | 2,508 views/yr (<10,000) |
| Liongo Fumo | 4 | african | 3,141 | 3,141 views/yr (<10,000) |
| Klingsor | 5 | arthurian | 3,168 | 3,168 views/yr (<10,000) |
| Asael | 3 | fallen-watchers | 3,325 | 3,325 views/yr (<10,000) |
| Mulciber | 6 | fallen-watchers | 3,940 | 3,940 views/yr (<10,000) |
| Zaqiel | 2 | fallen-watchers | 4,374 | 4,374 views/yr (<10,000) |
| Naneferkaptah | 4 | egyptian | 4,620 | 4,620 views/yr (<10,000) |
| Setne Khamwas | 3 | egyptian | 4,620 | 4,620 views/yr (<10,000) |
| Damarchus | 1 | werewolf-folklore | 4,831 | 4,831 views/yr (<10,000) |
| Jacques de Lalaing | 4 | historical | 5,133 | 5,133 views/yr (<10,000) |
| White Fell | 2 | werewolf-folklore | 5,311 | 5,311 views/yr (<10,000) |
| Sabnock | 4 | goetia | 6,051 | 6,051 views/yr (<10,000) |
| Angantyr | 5 | norse | 6,175 | 6,175 views/yr (<10,000) |
| Alvis | 2 | pit-only | 6,592 | 6,592 views/yr (<10,000) |
| The Loup-garou | 3 | werewolf-folklore | 6,830 | 6,830 views/yr (<10,000) |
| Gordafarid | 3 | persian | 7,044 | 7,044 views/yr (<10,000) |
| Thalestris | 3 | lost-civilisations | 7,448 | 7,448 views/yr (<10,000) |
| The Laidly Worm of Spindleston Heugh | 4 | european-folklore | 7,498 | 7,498 views/yr (<10,000) |
| Sinfjotli | 5 | werewolf-folklore | 7,707 | 7,707 views/yr (<10,000) |
| Grimhild | 3 | pit-only | 7,990 | 7,990 views/yr (<10,000) |
| Rakhsh | 5 | persian | 8,034 | 8,034 views/yr (<10,000) |
| The Lobisomem | 3 | werewolf-folklore | 8,042 | 8,042 views/yr (<10,000) |
| King Gradlon | 2 | lost-civilisations | 8,288 | 8,288 views/yr (<10,000) |
| Asbeel | 4 | fallen-watchers | 8,451 | 8,451 views/yr (<10,000) |
| Zipacna | 7 | lost-civilisations | 8,630 | 8,630 views/yr (<10,000) |
| Melion | 2 | werewolf-folklore | 8,744 | 8,744 views/yr (<10,000) |
| Dahut | 2 | lost-civilisations | 9,023 | 9,023 views/yr (<10,000) |
| Cloelia | 2 | roman | 9,055 | 9,055 views/yr (<10,000) |
| The White Div | 8 | persian | 9,060 | 9,060 views/yr (<10,000) |
| El Imbunche | 2 | latam-folklore | 9,366 | 9,366 views/yr (<10,000) |
| Peter Schlemihl | 1 | faustian-pact | 9,375 | 9,375 views/yr (<10,000) |
| The Man in the Grey Coat | 4 | faustian-pact | 9,375 | 9,375 views/yr (<10,000) |
| Focalor | 7 | goetia | 9,393 | 9,393 views/yr (<10,000) |
| Tlacaelel | 5 | lost-civilisations | 9,763 | 9,763 views/yr (<10,000) |

Parked per rank: r1: 12, r2: 16, r3: 11, r4: 10, r5: 7, r6: 3, r7: 4, r8: 1, r9: 0, r10: 0. Most of the park list is rank 1-4, which is the obscure mass the owner is happy to keep anyway; parking is optional, not forced.

Rows between 10k and 25k views (87 rows) are a soft second tier. They stay `keep` but are the next to park if the owner wants a tighter list.

## 7. Ladder-level check: >= 2 household/known names for every level L2-50

Levels are 5 per rank: rank k covers L(5k-4) to L(5k); L1 is excluded, so rank 1 has 4 levels (L2-5) and ranks 2-10 have 5. Each level needs >= 2 distinct household/known names, so a rank needs at least 8 (rank 1) or 10 (ranks 2-10) such names in its kept pool if a name is only used on one level. 'Challengeable' counts exclude the 10 blocked rows.

| Rank | Levels | Kept HH+known | of which household | Kept & challengeable HH+known | Needed | Per-level average | Pass | Pass on steady measure |
|---|---|---|---|---|---|---|---|---|
| 1 | 4 | 17 | 1 | 16 | 8 | 4.0 | yes | 16 (yes) |
| 2 | 5 | 23 | 0 | 21 | 10 | 4.2 | yes | 20 (yes) |
| 3 | 5 | 20 | 0 | 20 | 10 | 4.0 | yes | 18 (yes) |
| 4 | 5 | 22 | 2 | 22 | 10 | 4.4 | yes | 21 (yes) |
| 5 | 5 | 24 | 3 | 23 | 10 | 4.6 | yes | 23 (yes) |
| 6 | 5 | 31 | 2 | 31 | 10 | 6.2 | yes | 29 (yes) |
| 7 | 5 | 41 | 3 | 41 | 10 | 8.2 | yes | 38 (yes) |
| 8 | 5 | 47 | 5 | 47 | 10 | 9.4 | yes | 45 (yes) |
| 9 | 5 | 43 | 7 | 43 | 10 | 8.6 | yes | 42 (yes) |
| 10 | 5 | 60 | 6 | 60 | 10 | 12.0 | yes | 60 (yes) |

**All ranks pass: True** (on the steady, spike-free measure: True). With 4 levels at rank 1 and 5 elsewhere the tightest rank is the one with the lowest per-level average in the table; every rank has well over twice the required names, so each level can be given its own pair with spare names left to rotate. Parking does not affect the check: every parked row measures under 10k, so none was household or known.

Household-only (1M+) kept names per rank: r1: 1, r2: 0, r3: 0, r4: 2, r5: 3, r6: 2, r7: 3, r8: 5, r9: 7, r10: 6. If every level must show a 1M+ name, ranks 1-3 (and several others) cannot meet it from the current list; rank 1's only household row is the inflated Illuminati page. The new candidates below fill that gap.

## 8. New famous names

`docs/research/legends-new-candidates.csv`: 150 candidates not in the ladder, all >= 100,000 views/yr on the steady measure as well as the plain sum (464 titles screened, top 150 by views kept; 10 more were dropped because their summed figure came from a spike and their steady rate is under 100k). 24 are at 1M+ summed (17 on the steady measure). The CSV adds a `steady_12m` column; spike rows say so in `source_note`.

Excluded by content rule even though they scored high: Lilith, Samson, Leviathan, Zoroaster, Hanuman, Joan of Arc, Ashoka (scripture or living-religion figures), Jack the Ripper, Elizabeth Bathory, Gilles de Rais (real-victim crimes), Sherlock Holmes, Zorro, Tarzan, Peter Pan (live trademarks), Dagon (scripture rival god), Brigid (also a saint), Pachamama (living practice), Maui (group outside the allowed list), Constantine (venerated as a saint), and generic classes or objects (Dragon, Vampire, Werewolf, Viking, Samurai, Excalibur, Camelot, Atlantis, Valhalla). Roman twin names already merged in the ladder (Neptune, Juno, Mars, Venus, Minerva, Diana, Vulcan, Saturn, Jupiter) and aliases (Bacchus, Ishtar, Tamerlane) were skipped.

Flags: the Japanese kami rows (Amaterasu, Susanoo, Izanagi, Raijin, Tsukuyomi) are Shinto, a living religion, so they sit under the same logic as the Hindu rule: marked OWNER CALL in `source_note`, drop them if the rule applies. Sitting Bull, Crazy Horse and Tecumseh are historical warriors but warrant a cultural-sensitivity read. Aladdin, Scheherazade and Hansel and Gretel were left out as poor fits or brand-risky.

Groups: historical 56, greek 36, east-asian-folklore 19, european-folklore 10, egyptian 6, literary 6, norse 6, persian 3, mesopotamian 3, celtic 3, roman 1, lost-civilisations 1. Kinds: 139 legends, 11 patrons (gods). Suggested ranks: r1: 0, r2: 6, r3: 15, r4: 18, r5: 25, r6: 36, r7: 22, r8: 14, r9: 10, r10: 4.

Where they help: ranks 4-8 gain the most (generals, emperors and kings fit the knight body), and the Odyssey-cast names (Helen, Calypso, Telemachus, Menelaus) give ranks 2-4 a household brand, but their July-2026 spike will fade, so treat them as a short marketing window. None of the new list sits at rank 1 (rank 1 still has to be filled from existing folklore). The steadiest big brands in the new list are Napoleon, Genghis Khan, Augustus, Charlemagne, Marcus Aurelius, Cromwell, Henry V, Nero, Richard III and Saladin.

## 2026-10-07 18:xx: Dom's three rulings applied
Dom answered yes to all three (via Strategy):
- **The 150 new candidates are added**, less the five below: 145 rows appended to `legends-600-ladder.csv` (now 814 rows). Each has `body_family=tbd` for Characters to set; `status` in `legends-new-candidates.csv` records the outcome per name.
- **Shinto kami out** (a living religion, like the Hindu rule): Amaterasu and Susanoo. Japanese yokai and folklore monsters (oni, kappa, tengu, Yamata no Orochi, Kitsune) stay.
- **Native American leaders out:** Sitting Bull, Crazy Horse and Tecumseh.
- The ladder CSV's fame block (10 columns) had been appended twice with identical values; the duplicate copy is removed.

## 2026-10-07 18:4x: gap scan (demons, orders, ghosts, witches, fae, ancient), Dom yes
Dom asked whether every theme is covered and said yes to the safe gaps. 48 new names were checked against Wikipedia 12-month pageviews (Oct 2025–Sep 2026); 46 are added as keep and 2 as park (Bean Nighe 3k, White Lady unmeasured). Apep and Nidhogg were already on the ladder. New groups: `slavic`, `arabian-nights`, `ghosts`, `horror`, `witches`, `fae`. Tartarus's pageview call failed, so it is kept with fame assumed `known` and flagged in notes. Ladder: 862 rows, 788 fightable.
Left out on purpose, by the existing rules: Bible-named demons (Lucifer, Beelzebub, Asmodeus, Lilith, Leviathan, Behemoth, Witch of Endor); living religions (Hindu, Shinto, Polynesian, Native American incl. Wendigo, Quranic jinn); real murderers and real persecuted people (Jack the Ripper, Elizabeth Báthory, Gilles de Rais, the Pendle witches, Tituba, Agnes Sampson, Isobel Gowdie); copyrighted modern characters (Slender Man, Sadako). Anne Boleyn's ghost (2.4M views) is IN as "The Headless Queen of the Tower" (Dom): the ghost legend, never her name in game.
- 2026-10-07: "Wicked Witch of the West" renamed **The West Witches**, an original coven with no Oz or Wicked name, look or story (Dom: trademark and film-look risk). Rule: no names that echo a protected modern franchise, even when the source book is public domain.
