# Web design — project state

Entries moved verbatim from the root PROJECT_STATE.md on 2026-09-21 (state split). Append new entries at the TOP. Keep evidence and remaining validation in every entry (AGENTS.md).

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
