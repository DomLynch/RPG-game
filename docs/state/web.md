## 2026-09-22 — Paperdoll shows the worn gear (owner 12:4x; lead: route A, per-piece layers)

Owner: "the player image should dynamically update with the gear... the helmet, it should show it wearing it? also the arms?" Lead (12:44): pre-rendered overlay layers, CSS-toggled, built by a script over the loot file, not hand-made; Strategy prefers a live rig render (route B) for loot v2 and accepts this as the per-piece interim. `scripts/loot-layers.mjs`: renders the player rig (warrior.glb, Idle, front) once bare and once per loot id in loot.glb with the body as a depth-only occluder, worn the way characters.ts wears it (replace hides the slot + Hair, palette materials swapped by name), crops all to one union frame (272×720), writes `public/game/img/fighter.webp` + `public/game/img/loot/<id>.webp` (13 layers, 1.2–7.4 KB each, 51 KB total), sets the img's width/height and rewrites the `loot-layers` block in style.css (one `.doll:has(#slot-<key>[data-loot='<id>']) .doll-layer[data-layer=<key>]` rule per id). Markup: `.doll-figure` is now a wrapper (img + six `i.doll-layer`, body→legs→feet→arms→hands→head); a live render replaces that element when route B lands. One loader line (main.ts renderLoot): `#slot-<key>` gets `data-loot=<id>` (the CSS needs the id, not just `.on`). Test `tests/loot-layers.test.ts`: every LOOT id has a layer file + rule; the figure carries one layer per wearable key. Receipts: quality:ci 482 tests / 480 pass / 0 fail, Budget PASS (dist gz 24,018,815 of 32,000,000); previews `scratchpad/previews/out/doll-{bare,helmet-arms,nightborn,goblin}.html`. Rerun the script after every loot.glb change (Multi Chars' armour draws, Weapons' trident — weapons need a Main/Off-hand layer key, not in PAPERDOLL yet).

## 2026-09-22 — Site buttons wear the game's sand (owner, phone screenshots 12:32)

Owner: "keep the golden colour as game buttons... elevated while classic gladiator; the text where it is red can stay for now." Every red-FILLED control on the site now wears the fight cluster's sand: journal tokens `--js #b7a276` / `--jsh #d9c69a` pressed / `--jse #e9d9b3` rim; `dialog .daily-go` (Today's warden), `.rack li[data-worn] button` (Worn), `.rack li small a:hover` (Watch), and the /game page's `.pill.red` (Play now ×3, ink text, rim + inset ring like the cluster). Red text (rank, worn-piece border, Watch outline, eyebrows on /game) untouched. Receipts: quality:ci 478 tests / 476 pass / 0 fail, budget PASS; previews `scratchpad/previews/out/sand-options.html`, `sand-game.html`, `loot-journal.html`. Open (owner 12:4x, routed to lead + Strategy): the Profile figure should show equipped pieces (helmet, arms) — owner of the rendered figure/loot attach is to be confirmed.

# Web design — project state

Entries moved verbatim from the root PROJECT_STATE.md on 2026-09-21 (state split). Append new entries at the TOP. Keep evidence and remaining validation in every entry (AGENTS.md).

## Brief 9 — provenance under the inventory — web/design lane, 2026-09-21 (CSS only, on top of #335)
Data lands with #330 (`profile.loot.taken[id] = { opponent, attempt, healthLeft, recordId|null, day }`). The line is far too
long for a 63 px inventory tile, so it reads beneath the grid, one caption at a time: the first worn piece's by default (a second worn caption stays hidden), any tile's
while it is hovered or focused (a tap focuses it: the li carries `tabindex="0"`; `:has()` hides the worn one meanwhile). Row
shape for the builder: `<li data-loot data-worn tabindex="0"><span>name</span><small data-taken><b>Name</b> · your 5th
attempt, 12 health left <a data-watch href="/?r=…">Watch</a></small><button data-wear>…</button></li>`, the link only when
`recordId` is set (guest wins have none). The tile's number moves into flow (was absolute) so the caption can anchor to the
grid; the grid reserves 44 px beneath for two caption lines. Evidence: static preview at 375×812 — caption 339×36 under the
grid, Watch pill 51×20, focusing tile 2 swaps the caption (worn → none, focused → block), `scrollWidth` 375. Remaining: the
lead builds the rows; ordinal wording ("5th") is the lead's helper.

## Brief 5 — silhouette paperdoll, 1–5 inventory, and the Wear / Store choice — web/design lane, 2026-09-21 (markup + CSS only)
On the lead's `lead/loot-data` (#330). Owner direction (screenshots of Ultima/EverQuest-style sheets): a player-figure silhouette
with the slots around it, minimal and gritty, fewer slots, a 1–5 inventory. Profile tab: `.doll` is a three-column grid — the
figure (`public/game/img/doll.webp`, 3 KB flat silhouette of the player model rendered front-on from the portrait rig, Idle clip)
in the middle column spanning four rows; Head / Chest / Arms / Main hand down the left, Hands / Legs / Feet / Off hand down the
right. Each `.slot[data-slot]` has an `<i>` for the piece and a hidden `.slot-off[data-unwear]` Store button; `.on` marks a worn
slot. Under it `#loot-rack` is a five-tile numbered inventory grid (`li[data-loot][data-worn]` with `<span>name</span><button
data-wear>`; the builder pads to five with `li.rack-empty`). The six-locker row is gone. Win screen: `#loot-drop` loses the
`autopsy` class (fixed above the autopsy in the house bold sans) and gains a sibling `#loot-choice` row, Wear + Store (Store
pressed, already done — nothing is lost); Leave dropped as a third verb that does what Store does. The row follows
`#loot-drop[hidden]` in CSS, so `showLootDrop()` needs no change. Buttons inside `#actions` need the id selector plus !important
padding/min-height to escape the thumb-cluster pads. Evidence: static previews at 375×812 — doll 339×272, figure 94×250, side
slots 112 wide, inventory tiles 63×92, `scrollWidth` 375; choice row 148×40 at y 432 above the drop (y 480) and the autopsy
(y 514, with #328's CSS). Remaining: the lead wires `wearLoot`/`unwearLoot` and pads the inventory to five; the share/versus card
view of the doll is brief 3's renderer, not in this PR.

## Profile tab trim — owner direction from phone screenshots, 2026-09-22 (markup + CSS + one image)
Dom: "remove stats for now", "remove the inventory line for now also, as we will change the game features a bit, so you can
replace 1 item at a time only", "the black silhouette — put our real character there". Done: the Stats grid, its note and
its CSS are gone; the Inventory heading and note are gone and `#loot-rack` stays in the DOM with `hidden` (the loader still
writes its rows — src/main.ts — and tests/graphics.test.ts reads them), so the provenance captions inside it are hidden
with it; the figure is now a lit front-on render of the player model (`public/game/img/fighter.webp`, 271×720, 21 KB, from
the design scratchpad's portrait rig, Idle clip, az 0) at full opacity, max-height 320. Evidence: static preview at 390×844
— figure 120×320, doll 354×390, the whole tab fits one screen, `scrollWidth` 390. Routed to the lead, not done here: the
signed-in status line "Saved to your account as <name>." (src/account.ts:36/74) — Dom wants it gone as repetitive, but
scripts/account-browser-check.mjs waits on that exact text four times, so copy and gate move together; and the one-piece-
at-a-time loot rule that makes the hidden rack redundant.

## Brief 8 — three first-fight cues — web/design lane, 2026-09-21 (markup + CSS; the lead wires the triggers)
Copy approved by the lead: "Block it." (the warden's first telegraphed cut, before contact), "Other side." (the first block on
the wrong side that lets a hit land), "Now." (the first time the warden is open after a parry or a whiffed heavy). Each once,
on a new fighter's first fight only, never two at once, no tooltip. Element `<p id="cue" class="cue" role="status" hidden>`
in the footer actions; the lead sets textContent, hidden and data-on="1" (the fade needs the attribute: [hidden] is display:none !important) and keeps the seen list in localStorage `frankendom.cues` (comma
list of block,side,now). Placement: the drop line's slot above the thumb cluster, 22 px bold sans (20 px on phones) in cream
with the text shadow; fade in 120 ms / hold 1.4 s (lead's timer) / fade out 300 ms, keyed on data-on; reduced motion drops
the fades. Evidence: static preview at 375×812 with the cue shown. Remaining: the lead's three triggers from the fight log
after the loader lands.

## Field Journal tabs — web/design lane draft, 2026-09-20 (owner direction; markup + CSS only)
Owner's read of the live journal: still messy. New layout (approved from a clickable mock): the fighter card and the sign-in
prompt stay pinned; under them a browser-style strip with three tabs — Fighter (record table), Arena (opponent, warden,
hit-stop, blood until the lead removes it) and Settings (controls chips, "How to fight", then the quiet Test tools). The
duplicate cloud-save sentence under the Google button is gone. Tabs are CSS radio inputs: every bound id is unchanged and
unique, no `main.ts` change. The journal opens on Fighter, so a browser check that reaches `#opponent-select`,
`#finisher-select` (or `#controls-mode`, retired 2026-09-20) must click that tab's label first — the lead wires that into the gate scripts with
the queued blood/hit-stop changes. The record table is restyled in the light journal's ink (its first rules were for the dark
sheet). Gate: node tests 333/333, build, audit, budget PASS. Not pushed until the lead calls the window (#218 ahead in the queue).

## /game marketing page + Field Journal redesign — web/design lane, 2026-09-20 (owner picked direction E of nine)
`public/game/` is a static, one-page mobile-first site at frankendom.com/game (Vite copies `public/` verbatim; nginx `try_files $uri/`
serves the folder index). Direction "Pocket Arena": light ground, the live game inside a phone frame, bento tiles, Bricolage Grotesque +
Instrument Sans (SIL OFL, `public/game/fonts/LICENSES.txt`). Images are the shipped GLBs rendered offline (transparent WebP portraits)
plus two HUD-less captures of the live arena; total folder 644 KB, no inline script (site CSP is `script-src 'self'`; `game.js` is the
only script). frankendom.com itself is untouched: the game still loads on `/`.
The Field Journal (`<dialog id="journal">`) is restyled in the same brand as a light bottom sheet: fighter card (name · rank pips · save
state, mirrored from `persist()` into `#journal-name/-sigil/-rank/-save`), account, Controls chips + "How to fight" folded, record ledger,
Arena (opponent, warden, blood), Test tools (finisher, hit-stop, tempo, debug). Every bound element id, aria label and button text is
unchanged, and everything the browser gates tap stays visible when the journal opens; the milestones copy and the retired ESO/Black Desert
reference links are gone (`/game/` is linked instead). Evidence and remaining validation: see the PR.
