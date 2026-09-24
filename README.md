# Paperdoll with a shield equipped — PR #714 @ 6079cd5d, 375x812

Local build of 6079cd5d (vite build + preview), headless Chromium, mobile 375x812 @2x. A guest profile seeded with the full Centurion
kit plus `off: veteran.Shield`, then Journal → Profile.
`paperdoll-shield-fix.png`: the shield draws on the figure's left forearm; OFF HAND reads "the Centurion's shield"; the slot cards
sit above the figure (the FEET card's text stays clear). DOM: `#slot-off[data-loot=veteran.Shield]`, off layer background =
`/game/img/loot/veteran.Shield.webp`, rows = head, hands, chest, legs, arms, feet, main, off (one each), no page errors.
On trunk the rule keyed `#slot-undefined`, so no shield was drawn.
