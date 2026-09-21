# Web design — project state

Entries moved verbatim from the root PROJECT_STATE.md on 2026-09-21 (state split). Append new entries at the TOP. Keep evidence and remaining validation in every entry (AGENTS.md).

## Brief 9 — provenance under the inventory — web/design lane, 2026-09-21 (CSS only, on top of #335)
Data lands with #330 (`profile.loot.taken[id] = { opponent, attempt, healthLeft, recordId|null, day }`). The line is far too
long for a 63 px inventory tile, so it reads beneath the grid, one caption at a time: the worn piece's by default, any tile's
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
