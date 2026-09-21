# Web design — project state

Entries moved verbatim from the root PROJECT_STATE.md on 2026-09-21 (state split). Append new entries at the TOP. Keep evidence and remaining validation in every entry (AGENTS.md).

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
