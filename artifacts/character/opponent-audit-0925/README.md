# Opponent audit — live cc27cce5, 375x812, 2026-09-25 (Character Main for Lead; SCOPE #729 item 4)

Revision `cc27cce57d8d` from https://frankendom.com/release.json (curled 19:19 +04, no deploy lock). Headless Chromium, 375x812 @2x,
touch, guest profile, easy difficulty, `?opponent=<id>&debug=1`. Per rung: `<id>-front.jpg` (fight camera, touch HUD + debug hidden),
`<id>-behind.jpg` (camera unlocked, orbited ~180° by a canvas drag, same fight), `<id>-take.jpg` (kill screen after a real duel won through
the UI with loot-smoke-check's bot). All ten killed in duel 1; 0 page errors. `receipt.json` holds every tile id. Stills are judged by eye
at phone size; "by design" means the look matches that fighter's shipped brief, not a defect.

The six armour slots are Helmet, Body, Arms, Gloves, Greaves and Boots. Every panel offered all six plus the opponent's weapon; the Veteran
and Executioner also offer Crest, and the Veteran a Shield.

| Opponent | Seams / gaps | Bare skin where armour should be | Read at 375 | Takeable vs the six | Defect → owner |
|---|---|---|---|---|---|
| Veteran (Centurion) | none seen | bare back and right shoulder — his one-shoulder tunic, by design | clear | 6/6 + Crest, Shield, Trident | weapon tile has no thumbnail (all rungs, row "all") |
| Pitborn | loose skin-coloured flap on the lower back (behind still) | bare torso, by design | clear | 6/6 + Cleaver | back flap → Pitborn lane (#680 is his open PR) |
| Goblin | none seen (dark arena) | none | dim: the red arena at dusk hides him from behind | 6/6 + Knife | readability of the dark arena → World (not a fighter defect) |
| Nightborn | white patches: the sword-hand glove and left elbow render flat white (front + behind) | none | clear | 6/6 + Estoc | white glove/elbow → Nightborn lane, or Multi Chars if it's brief 14's shared `~kit.Gloves` material — none in the chain |
| Executioner | none seen | none | dark but reads (hood + scythe) | 6/6 + Crest, Scythe | none |
| Dwarf | none seen | bare back apart from the strap; front shows bare chest | clear | 6/6 + Warhammer | **Body and Arms tiles offer pieces he visibly doesn't wear** (Body tile = belt/kilt leather, Arms = two tiny bits) → none in the chain; Veteran lane (#614 lineage) or Multi Chars |
| Plague Doctor | none seen | none | **reads as a Plague Doctor** (beak, hat-less hood, long coat) | 6/6 + Longsword | the coat catches shiny highlights from behind → **#736** (matte, not foil) |
| Knight | none at the plates; the backplate reads crumpled/smeared under light | **heels and toes skin-coloured under the sabatons** (behind still) | **reads as a Knight** (great helm, plate, maul) | 6/6 + Maul | sabaton skin → **#734** (Knight sabatons + greave) |
| Witch | the robe's torn hem shows dark holes from behind | none | **does NOT read as a Witch** — a hooded reaper; the hood is round from behind (#716's own open condition); dark on the dark arena; she carries the Veteran's trident | 6/6 + Trident | silhouette/hood → **#716**; the trident as a Witch weapon → Weapons / Strategy (a taste call, not a seam) |
| Shieldmaiden | the body piece stops at the shoulder blades: front-only | **whole back bare from behind**; no helm, no shield on live | reads as a woman warrior from the front; not a shieldmaiden (no shield) | 6/6 + Gladius | bare back + helm → **#717** (lamellar Body + spangenhelm); shield → **#706** then **#728**; hem/boots → **#734** |
| all | — | — | — | — | **every weapon tile in the take panel is text-only (no thumbnail)**, all ten rungs (`thumb:false` in receipt) → Web (panel) or Weapons (thumbs) — none in the chain |

Not judged here (outside the brief): attack styles (item 4's "own attack style") — the bot's duels don't show them. Several front stills
have the hero partly covering the opponent at gap 2.3–2.6 (a capture limit, not a defect); the behind stills are the clean read.
Reproduce: `node artifacts/character/opponent-audit-0925/opponent-audit.mjs` from ~/Developer/frankendom-char (AUDIT_ONLY=a,b narrows; QA_URL overrides the site).
