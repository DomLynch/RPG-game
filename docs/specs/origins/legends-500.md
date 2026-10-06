# Origins patrons and legends: the 500 list

Data: [legends-500.csv](legends-500.csv), **600 rows**, one per figure: a **base of 500** plus four marked additions (45 world expansion, 41 lost civilisations, 13 cryptids, and Cain by Dom's ruling). The file keeps its `-500` name because other docs link to it. This is the canonical candidate list that
[living-world.md](living-world.md) §10 (PR #1491) points to as `expansion/legends-500`. It is a **candidate list**: content
data for clans, patrons, town patrons, Bounty targets and bosses. Nothing in `src/` reads it yet, and no row is shipped until a
lane builds it under the usual legends rule (`.claude/skills/legends-rule`).

Status: draft, 2026-10-06 (rulings below applied). Values in `perk_template` are provisional, like living-world §10.2.

## Columns

| Column | Meaning |
|---|---|
| `id` | kebab-case, ASCII, unique; a leading "the" is dropped. A content id is `patron:<id>` or `legend:<id>`. |
| `name` | display name as the source spells it, ASCII-folded (Cu Chulainn, Gotz). |
| `kind` | `patron` (a dead pantheon's god, or a literary dark lord that can head a clan and give a town strike) or `legend` (fought, or heads a clan without worship). |
| `group` | one of the 24 groups below. |
| `source` | the named primary or literary source; translation named where the ruling asks for one (1 Enoch: R. H. Charles, 1917). |
| `era_or_date` | the source's date, or the person's death date for `historical`. |
| `alignment` | `light` (Arthurian and Grail only), `dark` or `neutral`. |
| `clan_theme` | one line, our own words. |
| `perk_template` | added column: one of the 11 templates in living-world §10.2. The spec asks for the list "with its perk templates", and a clan may only name a template id, so the column carries the id a parser would read. |
| `sidegrade_hint` | the template's gain / cost in words, plus an optional flavour note (flavour never changes a number). |
| `pronouns` | from the source; `they` where the source gives none. |
| `notes` | overlaps, rulings applied, sources to confirm. An addition row starts with its marker: `+50 world expansion`, `+lost civilisations`, `+cryptids` or `+Dom ruling`. A row with no marker is base. |

## Rules applied

1. **Lore rule (Strategy, 2026-10-06):** any lore, but living faiths' gods and holy figures are not for players to worship or fight.
2. **Patrons** come only from dead pantheons (Greek, Roman, Norse, Egyptian, Mesopotamian, Celtic; Imhotep as the deified
   Egyptian sage) and literature (King Arthur, Count Dracula, Frankenstein's Creature), one provisional werewolf head (Lycaon),
   three national heroes by Dom's override (William Wallace, Skanderbeg, William Tell), Robert the Bruce and the Cailleach
   (Scottish group), the public-domain vampires Carmilla, Lord Ruthven and Sir Francis Varney (gothic-lit), and Aztec and Maya
   gods by Dom's override (lost-civilisations). Every other row is a `legend`.
3. **Asia and Latin America** come in through folklore, literature and history, never as gods of a living faith: Sun Wukong,
   jiangshi, oni, yokai, ronin, La Llorona, the Chupacabra. No row in those groups is a patron. The Aztec and Maya gods are the one
   exception, by Dom's override (rule 14), and sit in `lost-civilisations`.
4. **Gothic literature** is used by the book: Count Dracula is Stoker's character, never Vlad III, never "the Impaler"; art cites
   the novel, never a film. Literature must be by an author dead 70+ years or published before 1929 (legends rule).
5. **Fallen:** the Watchers of 1 Enoch are in as legend, not worship (Dom's override), cited to R. H. Charles, 1917.
   **Azazel is in** by a second Dom override (2026-10-06): he also appears in Leviticus 16, so he is the one deliberate
   exception to the Bible/Quran/Apocrypha line; his row cites 1 Enoch 8.1, where he teaches the making of swords, shields and
   breastplates, which suits a war and smithing figure. Ramiel, Sariel, Danel, Ezeqeel and Asael are in by a third Dom override
   (2026-10-06), each cited to 1 Enoch only as a fallen Watcher, never as an archangel or prophet; Asael is a separate Watcher,
   kept distinct from Azazel. Original rebel-angel names (three, marked "original") are allowed.
   There is no angel clan and no holy angel anywhere in the list.
6. **Goetia:** spirits from the *Ars Goetia* (Mathers ed., 1904) are in, minus every name that also appears in the Bible, the
   Quran or the Apocrypha (see Excluded). Pronouns follow the Mathers text, which uses "he" throughout.
7. **Faustian Pact:** Mephistopheles is in as a literary character and kept as `legend`, not `patron`, so nothing reads as
   worship of a devil. Other Pact figures come from Marlowe, Goethe, Chamisso, Maturin, Irving and Kind, or are original.
8. **Historical people:** dead 200+ years, no founders, prophets or saints, and never monsterised: every `historical` row is
   `neutral` and its theme is a deed, never a horror. No historical person appears in a dark group. Imhotep is the one
   historical figure listed as a patron (deified in Egyptian religion, a dead pantheon), in the `egyptian` group. William Wallace
   and Skanderbeg are `historical` patrons by Dom's override (rule 13).
13. **National and folk heroes (Dom override, 2026-10-06):** the earlier "no living peoples' folk heroes" rule is lifted.
    National heroes are allowed as **honourable figures only**: never villains or monsters, a heroic backstory, and a respectful
    win line ("You stood against X", never "You beat X"). Each such row says so in `notes`. Patron is preferred where it fits.
14. **Aztec and Maya gods and monsters (Dom override, 2026-10-06):** IN, replacing the earlier exclusion. Gods are mostly
    patrons, monsters and the lords of Xibalba are legends. Sources are pre-1929 only (Sahagun's Florentine Codex, Duran, Landa,
    the Popol Vuh in the Ximenez manuscript and Brasseur de Bourbourg's 1861 translation). No human-sacrifice gore in any text or art.
15. **Cain (Dom override, 2026-10-06):** a legend only, never a patron, in `fallen-watchers`: an override of the scripture line
    for him alone, because all three Abrahamic faiths condemn rather than revere him. Sources: Genesis 4, the Beowulf lineage
    of Grendel, and the medieval legend of the marked wanderer who cannot die. Nothing from any comic, film or TV version.
    Adam, Eve and Abel are not added.
16. **Cryptids (Dom, 2026-10-06):** folklore with no author, so the pre-1929 book test does not apply; each row cites its
    earliest known account. Beings sacred to living Indigenous cultures are excluded (see Excluded). Sasquatch is written as a
    wild giant, never a joke.
9. **Organisations:** a dead order is a legend (the Bavarian Illuminati 1776-85, with no New World Order tropes and no named
   founder; the Templars as a medieval order). A living organisation gets a fictional stand-in with an original emblem:
   the Freemasons become the **Lodge of the Compass**, Rosicrucian bodies the **Order of the Thorned Rose**.
10. **Ladder overlap:** no `legend` row reuses a name from `src/legends.ts` (the 100 Pit legends) or the Region 1 named
    figures (Grendel's Mother, Hrungnir, Peg Powler, Varney). Sixteen `patron` rows share a name with a Pit legend, as
    living-world §10.1 rules ("the Pit fights the legend; a clan serves the patron"): Hades, Mars, Odin, Thor, Hel, Loki, Set,
    Anubis, Sekhmet, Ptah, Ereshkigal, Nergal, the Morrigan, Carmilla, Lord Ruthven and Sir Francis Varney. Each says so in `notes`.
11. **Flavour limits from living-world §10.2:** no silver or wolfsbane for werewolves, no peach-wood for jiangshi, no beans or
    holly for oni. Dracula's flavour uses the novel's own garlic, wild rose and running water.
12. **No copyrighted text.** Every theme is a one-line summary in our own words; no source is quoted.

## Rulings, 2026-10-06

Strategy ruled on the names the first draft of #1498 held as unsure, and Dom overrode some of those rulings. All are applied in
the CSV. Where each ruling comes from:

- **Strategy's ledger, 2026-10-06:** national and folk heroes IN as honourable figures only (Dom's override of the 2026-09-27
  legends rule); William Tell, Skanderbeg and William Wallace IN; The Beetle OUT. The `legends-rule` skill has not been updated
  yet (it waits on Dom's OK); until it is, this ledger line governs.
- **Dom's own ruling, relayed by the Expansion lane:** Azazel IN. Strategy noted it and confirmed it in its OK on the evening's
  five rulings.
- **Dom's own override of Strategy's OUT, relayed by the Expansion lane:** the five Watchers (Ramiel, Sariel, Danel, Ezeqeel,
  Asael) IN. Strategy has been told but has not confirmed logging it, so it is not attributed to Strategy's ledger.
- **Strategy, via the Expansion lane:** the remaining rows in the table (Robin Hood, Mulciber, Cthulhu, Nyarlathotep, Tomoe
  Gozen, Imhotep as patron, Richard the Lionheart, the Templars, and the held LatAm and Korean names).

| Ruling | Effect |
|---|---|
| **Dom override:** Ramiel, Sariel, Danel, Ezeqeel, Asael IN (replaces Strategy's OUT) | Five rows added to `fallen-watchers`, cited to 1 Enoch (Charles, 1917) only, as fallen Watchers, never archangels or prophets. Asael's note keeps him distinct from Azazel. |
| Strategy: Robin Hood IN | `european-folklore`, as a ballad figure (*A Gest of Robyn Hode*, Child 117-154) and an honourable outlaw, never a monster. |
| **Dom override:** William Wallace IN, as a PATRON | `historical` patron, the Scottish freedom-fighters; template `underdog` (flavour: stronger when outnumbered, weaker in single combat). Never a villain or monster. Source: Blind Harry, *The Wallace* (c. 1477), and the historical record; d. 1305. Never cite *Braveheart*. Not listed as a fightable legend. |
| **Dom override:** the "no living peoples' folk heroes" rule is LIFTED (replaces Strategy's OUT for Tell and Skanderbeg) | National heroes in as honourable figures only (rule 13). **William Tell** (patron, `european-folklore`; White Book of Sarnen, c. 1470; Schiller, 1804) and **Skanderbeg** (patron, `historical`; d. 1468; Barleti, c. 1508). The excluded list was re-checked: every name cut only as a folk hero is back in on the same terms: Anansi, Rostam (since moved to `african` and `persian`), Ilya Muromets (`european-folklore`), Hua Mulan, Benkei, Momotaro, Kintaro (`east-asian-folklore`), all as legends with the respectful win line. No reserve name had been cut for that reason. |
| Strategy: Mulciber IN | Sourced to Milton, *Paradise Lost* (1667), as the rebel builder; never as Vulcan. |
| Strategy: Cthulhu, Nyarlathotep IN | Cited only to the original texts (*The Call of Cthulhu*, Weird Tales 1928; *Nyarlathotep*, 1920), never games or films. |
| Strategy: Tomoe Gozen IN | Sourced to the *Heike Monogatari*; a warrior, never monstered. |
| Strategy: Imhotep IN as a PATRON | Moved from `historical` to `egyptian` as a patron: the deified sage, never the Mummy-film villain. |
| Strategy: Richard the Lionheart IN; Templars stay IN | Rows kept; notes record the ruling. |
| Strategy: The Beetle OUT | Row removed; reserve Renfield fills the slot. |
| Strategy (d): El Silbon, La Sayona, El Cadejo, Gumiho HELD pending a pre-1929 source | **El Cadejo kept**: E. A. P. de Guerrero, "Games and Popular Superstitions of Nicaragua", *Journal of American Folk-Lore* 4 (1891), p. 38 (page from a secondary listing; check against the journal). **El Silbon, La Sayona and the Gumiho** are held: no pre-1929 printed source was found. Their slots went to reserves (Likho, Melion, the Raiju). |

| **Dom:** rebalance, 2026-10-06 | Celtic trimmed to 30 (9 cut to reserve, 5 moved). New `scottish` group (17): the Kelpie, Selkie, Nuckelavee, Sluagh, Cu-sith, Each-uisge, Tam Lin and William Wallace moved in; the Cailleach (patron), the Wulver, the Blue Men of the Minch, the Baobhan Sith, Thomas the Rhymer, Robert the Bruce (patron), Macbeth (the real king, never Shakespeare's villain), Rob Roy MacGregor and Black Agnes of Dunbar added. Redcap is not added: it is ladder pitborn 3. The base was trimmed to exactly 500 by moving the weakest names of Greek (16), Goetia (11) and Arthurian (6) to the reserve. |
| **Dom:** public-domain vampires | Carmilla (Le Fanu, 1872), Lord Ruthven (Polidori, 1819) and Sir Francis Varney (the 1845-47 serial) added to `gothic-lit` as **patrons**, because all three are already Pit legends (nightborn 2-4, and Varney is the Region 1 boss) and the overlap rule allows only patrons to share a ladder name. Gorcha, Coppelius and Bellingham's Mummy went to the reserve to keep the base at 500. Lestat is not added (Anne Rice, 1976, in copyright). |
| **Dom:** +50 world expansion | 45 strong, cited names (Dom: fill only with strong names, 600 is a ceiling, not a quota): African 11 (plus Anansi, moved from the base), Persian 11 (plus Rostam, moved), Latin American 11, Asian 12 (Japan, China and Korea in `east-asian-folklore`, plus the new `southeast-asian` and `central-asian` groups). |
| **Dom:** lost civilisations | 41 names in `lost-civilisations`: Atlantis (Plato), the Amazons, Hyperborea, Ys, Lyonesse, El Dorado, Carvajal's river Amazons, Great Zimbabwe, Aztec and Maya history as honourable figures, the Eagle and Jaguar orders as a dead order, and the Aztec and Maya gods and monsters (rule 14). |
| **Dom:** cryptids | 14 names in `cryptids`, including the Beast of Gevaudan moved from `werewolf-folklore` (a base row, still counted in the base). |
| **Dom:** Cain | One legend, rule 15. To stay inside the 600 ceiling the Dover Demon was dropped from the cryptids. |

Swaps (out to in): The Beetle to Renfield; El Silbon to Likho; La Sayona to Melion; the Gumiho to the Raiju. Added with no
swap: the five Watchers, Robin Hood, William Wallace, William Tell, Skanderbeg, Anansi, Rostam, Ilya Muromets, Hua Mulan,
Benkei, Momotaro and Kintaro (the 532-row stage, before the rebalance below). Imhotep moved from `historical` (legend) to `egyptian` (patron).

## Counts

| Group | Rows | Patrons | Legends |
|---|---:|---:|---:|
| greek | 50 | 20 | 30 |
| roman | 26 | 16 | 10 |
| norse | 42 | 14 | 28 |
| egyptian | 27 | 20 | 7 |
| mesopotamian | 26 | 12 | 14 |
| celtic | 30 | 17 | 13 |
| scottish | 17 | 3 | 14 |
| arthurian | 34 | 1 | 33 |
| gothic-lit | 30 | 5 | 25 |
| werewolf-folklore | 15 | 1 | 14 |
| european-folklore | 30 | 1 | 29 |
| east-asian-folklore | 42 | 0 | 42 |
| southeast-asian | 2 | 0 | 2 |
| central-asian | 2 | 0 | 2 |
| african | 12 | 0 | 12 |
| persian | 12 | 0 | 12 |
| latam-folklore | 20 | 0 | 20 |
| lost-civilisations | 41 | 13 | 28 |
| cryptids | 14 | 0 | 14 |
| fallen-watchers | 30 | 0 | 30 |
| goetia | 25 | 0 | 25 |
| faustian-pact | 18 | 0 | 18 |
| historical | 42 | 1 | 41 |
| dead-order | 13 | 0 | 13 |
| **Total** | **600** | **124** | **476** |

**Split:** base 500, +50 world expansion 45, lost civilisations 41, cryptids 13 (the Beast of Gevaudan is a base row), Cain 1.

| Addition by group | Rows |
|---|---:|
| world: african | 11 |
| world: persian | 11 |
| world: latam-folklore | 11 |
| world: east-asian-folklore | 8 |
| world: southeast-asian | 2 |
| world: central-asian | 2 |
| lost-civilisations | 41 |
| cryptids | 13 |
| Cain (fallen-watchers) | 1 |

Alignment: 322 neutral, 262 dark, 16 light (all Arthurian). Pronouns: 354 he, 129 she, 117 they.

Perk templates: opener 76, iron-hide 72, tireless 71, night-half 70, closer 65, underdog 62, glass 52, last-stand 53,
finisher 47, waxing 18, day-half 14. Every template is equal power by construction (§10.2), so the spread is flavour, not
balance; Stats' win-rate-by-patron check is the balance gate.

`european-folklore` is a group the brief's examples did not name; it holds Slavic, German, English and Scandinavian folk tales
that are not Norse myth. Anansi and Rostam, briefly in a `world-folklore` group, now sit in `african` and `persian`.

## Excluded, with the reason

| Name | Reason |
|---|---|
| Satan, Lucifer, Beelzebub, Belial, Mammon, Moloch | Abrahamic figures; Satan/Lucifer worship is out. Milton's rebels are used only where the name is not scriptural (Mulciber). |
| Gabriel, Michael, Raphael, Uriel, any archangel | Abrahamic holy figures; there is no angel clan. |
| Samael / Samiel (Der Freischutz's tempter) | A name from Jewish tradition for an angel of death. Kaspar is used instead. |
| Nephilim, Leviathan, Behemoth, Abaddon / Apollyon | Scripture figures. |
| Lilith / Lilitu | Scripture (Isaiah 34.14) and living Jewish tradition. |
| Iblis / Eblis (also in Beckford's Vathek) | Quranic figure. Vathek itself is left out: a caliph protagonist is too close to a living faith's office. |
| Goetia: Bael, Amon, Berith, Astaroth, Asmoday, Balam, Belial | Each name also appears in the Bible or the Apocrypha (Baal, Amon of Judah, Baal-berith, Ashtaroth, Asmodeus in Tobit, Balaam, Belial). |
| Dagon (Lovecraft's story too) | Philistine god in the Bible. |
| Azathoth | Lovecraft's first published use is after 1928; fails both literature tests. |
| Hindu gods and scripture figures (Kali, Shiva, Ravana, rakshasas of the epics) | Living religion. |
| Shinto kami and Kojiki / Nihon Shoki figures (Amaterasu, Susanoo, Raijin, Fujin, Inari, Yamata no Orochi) | Scripture of a living faith. |
| Tsuchigumo | In the Nihon Shoki the word names indigenous peoples; too close to a slur. |
| Chinese deities of living worship (Guan Yu, Yue Fei, Zhang Fei, Zhong Kui, Nezha, Erlang Shen, the Jade Emperor, Guanyin) | Worshipped today in temples. |
| Tang Sanzang (Xuanzang) | Buddhist monk, a holy figure; the Journey to the West rows use his disciples only. |
| Daji (Fengshen Yanyi) | The novel makes a historical queen into a fox demon: monsterising a historical person. |
| Nian | Tied to a living festival rite; printed source unclear. |
| Michael, Raphael, Uriel and the other archangels as holy figures | Abrahamic holy figures. (Ramiel and Sariel are listed only as fallen Watchers of 1 Enoch, by Dom's override.) |
| Gashadokuro, Kuchisake-onna | Modern inventions with no pre-1929 source. |
| Named tengu (Sojobo) | Venerated at a living shrine; generic tengu kept. |
| The Forty-seven Ronin by name | Venerated at Sengaku-ji; the generic Ronin clan is kept. |
| Wendigo, Thunderbird, Skinwalker, Ogopogo / N'ha-a-itk, Bunyip, Yowie | Beings sacred to living Indigenous cultures (Dom, cryptids ruling). |
| Redcap | Already ladder pitborn 3; a legend row may not reuse a ladder name. |
| Lestat | Anne Rice, 1976, in copyright. |
| Adam, Eve, Abel | Not added (Dom's Cain ruling covers Cain alone). |
| Kitezh | The legend is a religious one of a living community (Old Believers). |
| Shambhala, Iram of the Pillars | Living religions. |
| Mu, Lemuria | No pre-1929 source free of the theosophists' racist framing. |
| The Olmec | Known only from archaeology: no named figure or contemporary text to cite. |
| Kibuka, Ogbanje | Held: Kibuka is a lubaale of a Ganda religion with living practice; ogbanje belief is still living and has been used against real children. Dom named both; they wait on a ruling. |
| Mami Wata, the Orisha (Shango, Ogun and others) | Gods and spirits of practised religions. |
| Trung Sisters, Lady Trieu, Tran Hung Dao, Thanh Giong, Kusunoki Masashige, Taira no Masakado, Sugawara no Michizane | Worshipped today at shrines and temples. |
| Gesar | Worshipped in Tibetan Buddhism. |
| Garuda, Rangda, Barong | Living Hindu and Balinese religion. |
| Ahriman, Zoroaster | Living Zoroastrian faith (the Shahnameh rows cite the epic, never the Avesta). |
| Chiyou | Venerated as ancestor by the Miao people. |
| Maui | A demigod of Polynesian religion, still practised: the living-faith rule, not the folk-hero rule. |
| Hiawatha | Co-founder of the Haudenosaunee Confederacy: the founders rule. |
| The Beetle (Marsh, 1897) | OUT (Strategy, 2026-10-06); the novel's villain carries an ethnic caricature. |
| El Silbon, La Sayona, the Gumiho | Held, awaiting a pre-1929 source (Strategy (d), 2026-10-06): none found in this pass. They return as monsters once a citation is found. |
| Vlad III, "the Impaler" | Ruled out for this list; Dracula is the novel's character. (The ladder's `Vlad` is Dom's separate exception.) |
| Elizabeth Bathory, Gilles de Rais, Peter Stumpp, Gilles Garnier, Arnold Paole | Historical people whose legend monsterises them. |
| Joan of Arc, Albertus Magnus, Theophilus of Adana | Saints. |
| Charlemagne, Genghis Khan, Cyrus the Great, Sargon of Akkad, Rollo, Adam Weishaupt | Founders (and Charlemagne is beatified, Cyrus is in scripture). |
| Akhenaten | Founder of a religion. |
| Saladin | Founder of the Ayyubid dynasty: the founders rule (the folk-hero reason no longer applies). |
| Romulus and Remus | Founders of Rome; held out under the founders rule, though mythic. |
| Brigid | Conflated with a living saint. |
| The Tarasque, Krampus | Paired in their legends with a saint (Martha, Nicholas). |
| The Golem, the Wandering Jew | Living Jewish tradition; the second carries an antisemitic history. |
| Erra | Syncretised with Nergal (legends-rule skill); Nergal is listed. |
| Teutonic Order, Knights Hospitaller, Order of the Garter, Golden Fleece | Living organisations, no stand-in written yet. |
| Hashashin, Thuggee | Tied to living religious communities. |
| Hermetic Order of the Golden Dawn | Living successor bodies. |
| Thule Society | Nazi organisation. |
| Ching Shih | Died 1844, under 200 years. |
| Lechery (Marlowe's pageant) | Left out for tone; the other six Sins are in. |
| Werewolf of Paris (Endore) | 1933, author d. 1970; fails both literature tests. |
| Ambrosio (Lewis, The Monk) | Fictional monk whose story turns on a real faith's devil. |

## Unsure, for Strategy or Dom

- **Lycaon as patron** of the Wolf-kin (a dark-lord head); the spec sample names werewolf folklore itself as the head.
- **Chupacabra** (ruled in, no pre-1929 source) and the LatAm oral legends whose first printed source is still to confirm
  (El Sombreron, La Patasola, La Siguanaba, El Familiar, La Luz Mala); Strategy's ruling (d) named only four, so these stay.
- **Kara** (a valkyrie in a late saga) and **Palamedes** (written as a knight, no faith framing).
- **Kiyohime** and **Okiku**: legends tied to a temple and a well that are still visited.
- **The Order of the Dragon**: a dead order, allowed by the ruling; the row must never link to Vlad III.

## Reserve (rule-clean, cut for length)

These passed every rule and were cut only to keep the base at 500 and the total inside the 600 ceiling. They can replace any
row that a later ruling removes.

- greek: Aello, Aeolus, Arachne, Argus Panoptes, Brontes, Celaeno, Daedalus, Empusa, Eos, Erebus, Euryale, Geryon, Hestia,
  Hyperion, Icarus, Ladon, Megaera, Menelaus, Midas, Morpheus, Nike, Orthrus, Paris, Phaethon, Procrustes, Python, Rhea, Sinis,
  Sisyphus, Stheno, Talos, Tantalus, the Erymanthian Boar, the Graeae, the Keres, the Stymphalian Birds, Themis, Tisiphone,
  Triton, Tyche
- roman: Faunus, Mezentius, Orcus
- norse: Garm, Geirrod, Idunn, Ullr, Vidar
- egyptian: Khnum, Wadjet
- mesopotamian: Adad, Etana, Lahmu
- celtic: Arianrhod, Blodeuwedd, Bres, Dian Cecht, Gwrach y Rhibyn, Midir, Pwyll, Taranis, Teutates, the Afanc, the Cait Sith,
  the Fear Dearg, the Gwyllgi, the Knockers, the Korrigans, the Leanan Sidhe
- arthurian: Balan, Breuse sans Pitie, Dagonet, Galehaut, King Lot, Lionel, Lunete, Sagramore, Sir Ector, Sir Tor, the Red and
  White Dragons
- gothic-lit: Bellingham's Mummy, Coppelius, Gorcha, Manfred of Otranto, Olimpia
- werewolf-folklore: the Varcolac
- european-folklore: Jenny Greenteeth, the Boggart, the Nix of the Mill-Pond
- east-asian-folklore: Bulgasari, the Baku
- goetia: Aim, Andrealphus, Bathin, Bifrons, Botis, Buer, Caim, Crocell, Decarabia, Furcas, Gaap, Gusion, Haagenti, Leraje,
  Marax, Naberius, Purson, Ronove, Samigina, Shax, Valefor, Vepar, Zepar
- historical: Achille Marozzo, Artemisia of Caria, Bartholomew Roberts, Epaminondas, Gaius Marius, Gonzalo de Cordoba,
  Hamilcar Barca, Han Xin, Henry Morgan, Honda Tadakatsu, Jeanne de Clisson, Kamiizumi Nobutsuna, Mithridates VI,
  Pompey the Great, Ridolfo Capo Ferro, Thutmose III
- dead-order: the Landsknechte, the Order of the Swan
- world and lost-civilisations candidates cut for the ceiling: Tahmineh, Akvan Div (persian); Galvarino (latam); Sonni Ali,
  Samba Gana (african); Gadeirus, Abaris the Hyperborean, Itzpapalotl, Xolotl, Cabrakan, Seven Death (lost-civilisations);
  the Dover Demon (cryptids)

## Open items

- **Founders rule:** Sundiata founded the Mali Empire. He is in because Dom named him; Strategy may want to confirm.
- **Mwindo:** the only printed source is the 1969 transcription (in copyright); the row is our own summary.
- **Sasquatch:** the name comes from the Halkomelem sasq'ets. The row uses only the 1929 Maclean's account and no sacred Sts'ailes lore.
- **Black Shuck** is in as a cryptid, cited to the 19th-century folklore. Region 1 dropped it because Fleming's 1577 pamphlet casts the dog as the Devil; this list never uses that pamphlet.

- The honourable-figure win line ("You stood against X") is a copy rule for the rows that carry it in `notes`; the lane that
  builds legend text applies it.

- Strike types, defender rosters and friend/foe relations for the 124 patrons are not in this list; living-world §10.1 holds
  the sample, and they are a follow-up once the patron set is accepted.
- Sources marked "to confirm" in `notes` need a first printed source before the row ships.
- El Silbon, La Sayona and the Gumiho: held, awaiting a pre-1929 source; not blocking.
- El Cadejo's 1891 page number comes from a secondary listing; check it against the journal before the row ships.
