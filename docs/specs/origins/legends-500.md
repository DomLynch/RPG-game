# Origins patrons and legends: the 500 list

Data: [legends-500.csv](legends-500.csv), 532 rows, one per figure. This is the canonical candidate list that
[living-world.md](living-world.md) §10 (PR #1491) points to as `expansion/legends-500`. It is a **candidate list**: content
data for clans, patrons, town patrons, Bounty targets and bosses. Nothing in `src/` reads it yet, and no row is shipped until a
lane builds it under the usual legends rule (`.claude/skills/legends-rule`).

Status: draft, 2026-10-07 (rulings below applied). Values in `perk_template` are provisional, like living-world §10.2.

## Columns

| Column | Meaning |
|---|---|
| `id` | kebab-case, ASCII, unique; a leading "the" is dropped. A content id is `patron:<id>` or `legend:<id>`. |
| `name` | display name as the source spells it, ASCII-folded (Cu Chulainn, Gotz). |
| `kind` | `patron` (a dead pantheon's god, or a literary dark lord that can head a clan and give a town strike) or `legend` (fought, or heads a clan without worship). |
| `group` | one of the 18 groups below. |
| `source` | the named primary or literary source; translation named where the ruling asks for one (1 Enoch: R. H. Charles, 1917). |
| `era_or_date` | the source's date, or the person's death date for `historical`. |
| `alignment` | `light` (Arthurian and Grail only), `dark` or `neutral`. |
| `clan_theme` | one line, our own words. |
| `perk_template` | added column: one of the 11 templates in living-world §10.2. The spec asks for the list "with its perk templates", and a clan may only name a template id, so the column carries the id a parser would read. |
| `sidegrade_hint` | the template's gain / cost in words, plus an optional flavour note (flavour never changes a number). |
| `pronouns` | from the source; `they` where the source gives none. |
| `notes` | overlaps, rulings applied, sources to confirm. |

## Rules applied

1. **Lore rule (Strategy, 2026-10-06):** any lore, but living faiths' gods and holy figures are not for players to worship or fight.
2. **Patrons** come only from dead pantheons (Greek, Roman, Norse, Egyptian, Mesopotamian, Celtic; Imhotep as the deified
   Egyptian sage) and literature (King Arthur, Count Dracula, Frankenstein's Creature), one provisional werewolf head (Lycaon),
   and three national heroes by Dom's override (William Wallace, Skanderbeg, William Tell). Every other row is a `legend`.
3. **Asia and Latin America** come in through folklore and literature only, never as gods: Sun Wukong, jiangshi, oni, yokai,
   ronin, La Llorona, the Chupacabra. No row in those groups is a patron.
4. **Gothic literature** is used by the book: Count Dracula is Stoker's character, never Vlad III, never "the Impaler"; art cites
   the novel, never a film. Literature must be by an author dead 70+ years or published before 1929 (legends rule).
5. **Fallen:** the Watchers of 1 Enoch are in as legend, not worship (Dom's override), cited to R. H. Charles, 1917.
   **Azazel is in** by a second Dom override (2026-10-06): he also appears in Leviticus 16, so he is the one deliberate
   exception to the Bible/Quran/Apocrypha line; his row cites 1 Enoch 8.1, where he teaches the making of swords, shields and
   breastplates, which suits a war and smithing figure. Ramiel, Sariel, Danel, Ezeqeel and Asael are in by a third Dom override
   (2026-10-07), each cited to 1 Enoch only as a fallen Watcher, never as an archangel or prophet; Asael is a separate Watcher,
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
13. **National and folk heroes (Dom override, 2026-10-07):** the earlier "no living peoples' folk heroes" rule is lifted.
    National heroes are allowed as **honourable figures only**: never villains or monsters, a heroic backstory, and a respectful
    win line ("You stood against X", never "You beat X"). Each such row says so in `notes`. Patron is preferred where it fits.
9. **Organisations:** a dead order is a legend (the Bavarian Illuminati 1776-85, with no New World Order tropes and no named
   founder; the Templars as a medieval order). A living organisation gets a fictional stand-in with an original emblem:
   the Freemasons become the **Lodge of the Compass**, Rosicrucian bodies the **Order of the Thorned Rose**.
10. **Ladder overlap:** no `legend` row reuses a name from `src/legends.ts` (the 100 Pit legends) or the Region 1 named
    figures (Grendel's Mother, Hrungnir, Peg Powler, Varney). Thirteen `patron` rows share a name with a Pit legend, as
    living-world §10.1 rules ("the Pit fights the legend; a clan serves the patron"): Hades, Mars, Odin, Thor, Hel, Loki, Set,
    Anubis, Sekhmet, Ptah, Ereshkigal, Nergal, the Morrigan. Each says so in `notes`.
11. **Flavour limits from living-world §10.2:** no silver or wolfsbane for werewolves, no peach-wood for jiangshi, no beans or
    holly for oni. Dracula's flavour uses the novel's own garlic, wild rose and running water.
12. **No copyrighted text.** Every theme is a one-line summary in our own words; no source is quoted.

## Rulings, 2026-10-07

Strategy ruled on the names #1498 held as unsure; Dom then overrode two points. All are applied in the CSV.

| Ruling | Effect |
|---|---|
| **Dom override:** Ramiel, Sariel, Danel, Ezeqeel, Asael IN (replaces Strategy's OUT) | Five rows added to `fallen-watchers`, cited to 1 Enoch (Charles, 1917) only, as fallen Watchers, never archangels or prophets. Asael's note keeps him distinct from Azazel. |
| Strategy: Robin Hood IN | `european-folklore`, as a ballad figure (*A Gest of Robyn Hode*, Child 117-154) and an honourable outlaw, never a monster. |
| **Dom override:** William Wallace IN, as a PATRON | `historical` patron, the Scottish freedom-fighters; template `underdog` (flavour: stronger when outnumbered, weaker in single combat). Never a villain or monster. Source: Blind Harry, *The Wallace* (c. 1477), and the historical record; d. 1305. Never cite *Braveheart*. Not listed as a fightable legend. |
| **Dom override:** the "no living peoples' folk heroes" rule is LIFTED (replaces Strategy's OUT for Tell and Skanderbeg) | National heroes in as honourable figures only (rule 13). **William Tell** (patron, `european-folklore`; White Book of Sarnen, c. 1470; Schiller, 1804) and **Skanderbeg** (patron, `historical`; d. 1468; Barleti, c. 1508). The excluded list was re-checked: every name cut only as a folk hero is back in on the same terms: Anansi, Rostam (new `world-folklore` group), Ilya Muromets (`european-folklore`), Hua Mulan, Benkei, Momotaro, Kintaro (`east-asian-folklore`), all as legends with the respectful win line. No reserve name had been cut for that reason. |
| Strategy: Mulciber IN | Sourced to Milton, *Paradise Lost* (1667), as the rebel builder; never as Vulcan. |
| Strategy: Cthulhu, Nyarlathotep IN | Cited only to the original texts (*The Call of Cthulhu*, Weird Tales 1928; *Nyarlathotep*, 1920), never games or films. |
| Strategy: Tomoe Gozen IN | Sourced to the *Heike Monogatari*; a warrior, never monstered. |
| Strategy: Imhotep IN as a PATRON | Moved from `historical` to `egyptian` as a patron: the deified sage, never the Mummy-film villain. |
| Strategy: Richard the Lionheart IN; Templars stay IN | Rows kept; notes record the ruling. |
| Strategy: The Beetle OUT | Row removed; reserve Renfield fills the slot. |
| Strategy (d): El Silbon, La Sayona, El Cadejo, Gumiho HELD pending a pre-1929 source | **El Cadejo kept**: E. A. P. de Guerrero, "Games and Popular Superstitions of Nicaragua", *Journal of American Folk-Lore* 4 (1891), p. 38 (page from a secondary listing; check against the journal). **El Silbon, La Sayona and the Gumiho** are held: no pre-1929 printed source was found. Their slots went to reserves (Likho, Melion, the Raiju). |

Swaps (out to in): The Beetle to Renfield; El Silbon to Likho; La Sayona to Melion; the Gumiho to the Raiju. Added with no
swap: the five Watchers, Robin Hood, William Wallace, William Tell, Skanderbeg, Anansi, Rostam, Ilya Muromets, Hua Mulan,
Benkei, Momotaro and Kintaro (532 rows, up from 516). Imhotep moved from `historical` (legend) to `egyptian` (patron).

## Counts

| Group | Rows | Patrons | Legends |
|---|---:|---:|---:|
| greek | 66 | 21 | 45 |
| roman | 26 | 16 | 10 |
| norse | 42 | 14 | 28 |
| egyptian | 27 | 20 | 7 |
| mesopotamian | 26 | 12 | 14 |
| celtic | 44 | 20 | 24 |
| arthurian | 40 | 1 | 39 |
| gothic-lit | 30 | 2 | 28 |
| werewolf-folklore | 16 | 1 | 15 |
| european-folklore | 31 | 1 | 30 |
| east-asian-folklore | 34 | 0 | 34 |
| latam-folklore | 9 | 0 | 9 |
| world-folklore | 2 | 0 | 2 |
| fallen-watchers | 29 | 0 | 29 |
| goetia | 36 | 0 | 36 |
| faustian-pact | 18 | 0 | 18 |
| historical | 43 | 2 | 41 |
| dead-order | 13 | 0 | 13 |
| **Total** | **532** | **110** | **422** |

Alignment: 268 neutral, 246 dark, 18 light (all Arthurian). Pronouns: 319 he, 122 she, 91 they.

Perk templates: night-half 66, opener 66, tireless 61, iron-hide 59, closer 58, underdog 53, finisher 47, glass 47,
last-stand 45, waxing 17, day-half 13. Every template is equal power by construction (§10.2), so the spread is flavour, not
balance; Stats' win-rate-by-patron check is the balance gate.

`european-folklore` is a group the brief's examples did not name; it holds Slavic, German, English and Scandinavian folk tales
that are not Norse myth. `world-folklore` (added 2026-10-07) holds heroes from traditions with no group of their own
(Anansi, Rostam).

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
| Aztec and Maya gods and their monsters (Quetzalcoatl, Huitzilopochtli, Tezcatlipoca, Mictlantecuhtli, Ahuizotl, Camazotz, Popol Vuh figures) | Out by ruling, monsters included for now. |
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
| Wendigo | Algonquian living belief. |
| Maui | A demigod of Polynesian religion, still practised: the living-faith rule, not the folk-hero rule. |
| Hiawatha | Co-founder of the Haudenosaunee Confederacy: the founders rule. |
| The Beetle (Marsh, 1897) | OUT (Strategy, 2026-10-07); the novel's villain carries an ethnic caricature. |
| El Silbon, La Sayona, the Gumiho | Held, awaiting a pre-1929 source (Strategy (d), 2026-10-07): none found in this pass. They return as monsters once a citation is found. |
| Vlad III, "the Impaler" | Ruled out for this list; Dracula is the novel's character. (The ladder's `Vlad` is Dom's separate exception.) |
| Elizabeth Bathory, Gilles de Rais, Peter Stumpp, Gilles Garnier, Arnold Paole | Historical people whose legend monsterises them. |
| Joan of Arc, Albertus Magnus, Theophilus of Adana | Saints. |
| Charlemagne, Genghis Khan, Cyrus the Great, Sargon of Akkad, Rollo, Adam Weishaupt | Founders (and Charlemagne is beatified, Cyrus is in scripture). |
| Akhenaten | Founder of a religion. |
| Saladin | Founder of the Ayyubid dynasty: the founders rule (the folk-hero reason no longer applies). |
| Romulus and Remus | Founders of Rome; held out under the founders rule, though mythic. |
| Brigid | Conflated with a living saint. |
| The Tarasque, Krampus | Paired in their legends with a saint (Martha, Nicholas). |
| Black Shuck | Dropped in region1-ash-frontier.md §8; kept out for the same reason. |
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

These passed every rule and were cut only to keep the list near 500 (88 left after the 2026-10-07 swaps). They can replace any row that a later ruling removes.

- greek: Aello, Aeolus, Argus Panoptes, Brontes, Eos, Erebus, Euryale, Hestia, Hyperion, Icarus, Megaera, Menelaus, Morpheus,
  Orthrus, Paris, Rhea, Sinis, Stheno, the Erymanthian Boar, the Stymphalian Birds, Themis, Tisiphone, Triton, Tyche
- roman: Faunus, Mezentius, Orcus
- norse: Garm, Geirrod, Idunn, Ullr, Vidar
- egyptian: Khnum, Wadjet
- mesopotamian: Adad, Etana, Lahmu
- celtic: Dian Cecht, Midir, Pwyll, Teutates, the Afanc, the Cait Sith, the Each-uisge, the Fear Dearg
- arthurian: Breuse sans Pitie, King Lot, Lionel, Lunete, Sir Ector
- gothic-lit: Manfred of Otranto, Olimpia
- werewolf-folklore: the Varcolac
- european-folklore: Jenny Greenteeth, the Boggart, the Nix of the Mill-Pond
- east-asian-folklore: Bulgasari, the Baku
- goetia: Andrealphus, Bathin, Botis, Buer, Crocell, Decarabia, Gaap, Gusion, Naberius, Ronove, Samigina, Zepar
- historical: Achille Marozzo, Artemisia of Caria, Bartholomew Roberts, Epaminondas, Gaius Marius, Gonzalo de Cordoba,
  Hamilcar Barca, Han Xin, Henry Morgan, Honda Tadakatsu, Jeanne de Clisson, Kamiizumi Nobutsuna, Mithridates VI,
  Pompey the Great, Ridolfo Capo Ferro, Thutmose III
- dead-order: the Landsknechte, the Order of the Swan

## Open items

- The honourable-figure win line ("You stood against X") is a copy rule for the rows that carry it in `notes`; the lane that
  builds legend text applies it.

- Strike types, defender rosters and friend/foe relations for the 110 patrons are not in this list; living-world §10.1 holds
  the sample, and they are a follow-up once the patron set is accepted.
- Sources marked "to confirm" in `notes` need a first printed source before the row ships.
- El Silbon, La Sayona and the Gumiho: held, awaiting a pre-1929 source; not blocking.
- El Cadejo's 1891 page number comes from a secondary listing; check it against the journal before the row ships.
