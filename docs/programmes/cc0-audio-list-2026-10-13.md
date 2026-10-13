# CC0 audio list (top-30 item 30) — for Lead's ruling, 2026-10-13

Nothing is downloaded or committed here. This maps CC0 sources to the sound rows we have (cue names from `src/audio/manifest.ts` and `src/audio/arena-manifest.ts`). Licence for every row: CC0 1.0, https://creativecommons.org/publicdomain/zero/1.0/ (no credit required; we record the source anyway). Before any file lands, its entry goes in `src/assets/audio/SOURCES.json` in the existing shape (page, url, sha256, title, author, license, licenseUrl, retrieved), the same record the shipped freesound cues already have.

## Verified licence sources (pages read for this list, 2026-10-13)
| Source | Evidence |
|---|---|
| Kenney Impact Sounds (130 files, tags impact, foley) | https://kenney.nl/assets/impact-sounds : licence "Creative Commons CC0" |
| Kenney RPG Audio (50 files, tags foley, RPG, footstep, weapon) | https://kenney.nl/assets/rpg-audio : "Creative Commons CC0" |
| Kenney Interface Sounds (100 files, interface, click, button) | https://kenney.nl/assets/interface-sounds : "Creative Commons CC0" |
| Kenney Voiceover Pack (Fighter) (45 files, male voice) | https://kenney.nl/assets/voiceover-pack-fighter : "Creative Commons CC0" |
| Kenney, the rest of the category (UI Audio, Digital Audio, Music Jingles, Voiceover Pack, Casino, Sci-fi) | listed at https://kenney.nl/assets/category:Audio ; the category page shows no licence, so each pack page is read before it is used |
| Freesound | https://freesound.org/help/faq/ : the "zero" licence is use-as-you-like with no attribution. The licence is set per sound, so each sound's own page must say CC0 (not CC-BY); the page URL is what we record |
| OpenGameArt | https://opengameart.org/content/faq : CC0 "may be copied, modified, distributed, performed or otherwise used in anyway without asking, crediting or notifying". The licence is set per item, and much audio there is CC-BY or GPL, so CC0 is checked on each item page |

## Sound rows to fill or replace
| Our cue | Today | Candidate source (kind of sound to pick) |
|---|---|---|
| `whoosh_light`, `whoosh_heavy`, `whip`, `whip_raise`, `draw` | sprite | Kenney RPG Audio (weapon / draw sounds); freesound CC0 search "sword swing", "whoosh" |
| `hit_flesh`, `hit_heavy`, `hit_kick`, `flesh_cut`, `flesh_stab`, `flesh_tear`, `bone_crack` | sprite (freesound CC0: swordhit, fleshslice, messystab, meatysplosh, tear) | Kenney Impact Sounds (hit bodies and foley); freesound CC0 "stab", "slice", "bone" |
| `block`, `block_perfect`, `parry`, `guard_break` | sprite | Kenney Impact Sounds (metal / wood impacts) |
| `death_voice`, `effort_voice`, `grunt` | freesound CC0 (grunt, grunt2) | Kenney Voiceover Pack (Fighter) for grunts and efforts; freesound CC0 "grunt", "death" |
| `crowd_gasp`, `crowd_cheer`, `reaction`, `jeer`, `jeer_wall`, `chant`, `bed` | freesound CC0 (crowd, gasp, murmur, jeer, boohall) | freesound CC0 "crowd cheer", "crowd murmur", "boo"; OpenGameArt CC0 crowd loops after the item check |
| `bell` | generated (`src/audio/bell.ts`) | none needed |
| `charge`, `charge_foe`, `kill`, `roll`, `backstep` | sprite | Kenney RPG Audio (footstep and foley) |
| UI clicks and the menu (no cue rows yet) | none | Kenney Interface Sounds |
| Special-move cues (`docs/state/audio.md`: 37 cues, built, not CC0 sources) | built in-house | none; they stay ours |

## Not in this list (and why)
- Anything under CC-BY, CC-BY-SA, GPL or "non-commercial": out, even though credit would be cheap.
- Music: Kenney Music Jingles is CC0-tagged on the category listing but not read here; held until Lead wants a rank-up jingle.
- Freesound previews are low-bitrate; the original file is what we would take and encode.

## Open questions for Lead
1. Replace the whole sprite with CC0 packs, or fill only the gaps (voices, UI)?
2. Kenney Voiceover Pack (Fighter) is a male voice only; fine for `effort_voice` and `death_voice` on every body, or a per-body pick later?
3. Who licences-checks each freesound sound: this lane on pick, with the page URL in `SOURCES.json`?

Donor: none for sound sourcing; the donor games ship their own audio (not CC0), so nothing is taken from them. Checked: the `reuse-first` rule is for code and data, not recordings.
