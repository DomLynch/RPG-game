# Zone 1 phone readability, with Dota 2 as the donor

World lane, 2026-10-21. Dom's study list item 2 (Strategy-confirmed). **A note only: no game code changes here.** The measuring script is `scripts/readability-stills.mjs` (+ `scripts/gpu-run/readability-stills.sh`, and a read-only `originsPreview.project()` hook in `origins/preview/main.ts` that tells a still where a world point lands on the screen).

## 1. How Dota 2 keeps units readable

Dota 2 is closed source and is not in the donor library (55 repos on the VPS; nearest are OpenRA and Warcraft-Arena-Unity), so this part rests on Valve's public art guide and on commentary about it. **I found principles, not pixel numbers**; where a number is missing I say so rather than invent one.

What is public:

| Topic | What the sources say | Source |
|---|---|---|
| Silhouette | A hero must be readable at a glance from the game camera, and the outline should show which way it faces. | Valve, "Dota 2 Workshop - Character Art Guide" (Steam Support article 0688-7692-4D5A-1935; the 2012 guide is 18 pages with before/after examples per CG Channel) |
| Value over colour | Lightness and darkness matter more than hue for a character's success; the guide teaches value patterning and a coherent palette, "rest and detail". | same; CG Channel 2012 write-up |
| Detail size | Small patches of detail that look fine in a profile view get hard to read in normal play; matching brightness at head and feet makes a figure hard to parse. | Polycount thread quoting the guide (page blocked for me, secondhand) |
| Unit against ground | In a desaturated screenshot the heroes and units are the brightest, highest-contrast areas; the ground uses darker greys and has a small light-dark range, so it recedes. | Game Developer, "How to reduce visual confusion in your game" |
| Camera | Default camera distance 1134 (console variable), community maximum about 1400 to 1700 (unverified). | Valve Developer Community (Dota 2 Workshop Tools, Set/GetCameraDistanceOverride) |
| Team colour, rim light, selection and threat rings, outline pixel widths | **Not found in any public source I could read.** The guide's page text did not load for me (the Steam page is navigation only; the PDF copy is a one-page stub). | n/a |

So the donor rule I can state with a source is: **units are the brightest and most contrasty things on screen; ground and props are darker and low in contrast range ("rest"); the silhouette carries identity; detail is kept big enough to survive the camera distance.** The ring/outline numbers would have to come from the game files or a screenshot study; I did not do either (no Dota install on any box here), and I am not guessing them.

## 2. Our Zone 1 at 375x812 and 844x390 (T4, jobs 6ad83c4c0a35baab53a194c5 first try, 6ad83e0e5275124786e20c9c second)

Method: the page's own projection places a sample disc on each thing (radius 0.17 of its projected height) and a ring of ground round it (0.5 to 0.75 of that height); medians of relative luminance; reported as the CIE L* difference (thing minus ground, so negative = thing is DARKER than the ground) and the WCAG contrast ratio. Creatures are 12 m from the hero so no fight starts; props and the loot drop stand off the hero's line. Overlays with the discs drawn: `~/ipadcam/readability/<size>/overlay-<name>.jpg` on the dev Mac.

| thing | 375x812: height px, thing L*, ground L*, dL*, WCAG | 844x390: height px, thing L*, ground L*, dL*, WCAG |
|---|---|---|
| hero | 186, 22.5, 30.1, **-7.6**, 1.30 | 90, 23.0, 30.3, **-7.3**, 1.29 |
| named creature (Hrungnir, 12 m) | 31, 9.2, 12.1, -2.9, 1.07 | 15, 13.8, 26.8, -13.0, 1.50 |
| boulder (tinted, #3471) | 77, 13.0, 21.1, -8.0, 1.26 | 37, 14.1, 21.8, -7.8, 1.26 |
| loot drop (goblin scrap cap) | 41, 15.1, 11.5, +3.7, 1.10 | 20, 20.2, 12.4, +7.7, 1.24 |
| scrub bush | sample off screen | 16, 17.4, 17.4, 0.0, 1.00 |
| foe (Cinder scavenger) | sample failed (the creature wandered out of frame) | sample failed |

Limits, plainly: one frame per cell, dusk lighting, HUD and the tutorial card cover part of the 375 frames, the 375 hero ring contains a boulder shadow (so the hero's ground figure is a little low there; the 844 figure, with a clean ground, agrees: -7.3), and the foe sample failed. Treat every number as plus or minus a few L*. A first run of the script was wrong (the hero stood in front of the target, a fight started at 5 m, one disc sampled bare ground) and is discarded.

Reading it:
- **The hero is darker than the ground he stands on, by about 7 L* at both sizes (WCAG about 1.3).** That is the opposite of the Dota rule (units brightest). He reads today by his pale tunic and his motion, not by value.
- **Props are dark on dark and quiet** (boulder -8, scrub 0). By the Dota logic that is correct for props ("rest"); it is the units that have no lead.
- **The named creature is lost at 12 m**: 31 px tall at 375 (15 px at 844x390) and at -3 to -13 L* against the ground. It has no value or ring advantage over a plain wolf.
- **The loot drop is the one thing with positive value contrast** (+4 to +8 L*), and the pickup ring in the frames is conspicuous; the item itself is small (41 and 20 px).
- Can the four be told apart at a glance? Hero vs a calm foe: by silhouette and tunic only. Named vs ordinary: no, not at range. Loot: yes (the ring). Props: they do not compete, which is right.

## 3. The three cheapest fixes, each a data row

Expected gains are arithmetic and my reading of the frames, **not yet measured**; each is one T4 A/B (about $0.04) before a PR.

1. **Lower the ground, not the units.** `looks.frontier-haze.ground` in `origins/zone-rows/zone1.row.json` is `[0.50, 0.47, 0.45]` (a multiplier on the ground colour, next to `hemiGround` and `exposure`). Taking it to about `[0.40, 0.38, 0.36]` (about 0.7 in linear value) should lower the ground by roughly 4 L* and bring the hero from -7.6 to about -3.5; going to 0.55 of today's would roughly equal the hero's value. It costs the dusk mood, so I would stop at the first step and compare stills. Applies to every unit at once, no rim shader needed.
2. **Give the named creature the ring the loot has.** The loot drop's additive ring and beam are rows (`origins/preview/ground-looks.json`: ring colour, radius, bands, opacity). The creatures' own ground ring is `mobs-view.ts:213` and its opacity (0.1 calm, 0.34 aggro) and colours are literals in code, so this one is "move 4 literals to rows (a 3-line change), then a named-creature ring row" (the as-data gate wants the literals moved anyway). Expected: the named creature gets a ring about as visible as the loot's (the loot ring reads at 20 to 41 px), which is the step from "lost at 12 m" to "findable".
3. **Keep props quiet, and only fix their hue.** The boulder tint I shipped (#3471) makes boulders dark and quiet (-8 L*, which is what the Dota rule asks of props). The scrub bushes are 0 L* against the ground: perfectly quiet in value but olive in hue (the colour Dom likely complained about, if he meant them). A `kit.tint` row for `bush_scrub_a/b` that moves the hue toward the ground (for example `[0.85, 0.80, 0.70]`) changes the olive without making them louder. Expected: no change to value contrast (they stay at about 0), olive gone. Do this only after Dom answers whether he meant the scrub.

Not a row today (listed so it is not forgotten): a **rim light or outline on units**, the Dota-style identity aid, has no data row and is a shader or post change; and the hero has no team-colour equivalent. If fix 1 alone is not enough, that is the next step and it is code.

## What I need from you

- A yes to run the T4 A/B for fix 1 (ground multiplier 0.70, and 0.55 for comparison) and, if you want the numbers, a repeat of the measurement with the foe in frame (the foe sample failed).
- A decision on whether Dota ring/outline numbers matter enough to look for a Dota 2 screenshot study (I would need a source; none is public that I could read).
