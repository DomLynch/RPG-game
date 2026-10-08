# Frankendom UI design rules

One page. Tokens live in `src/tokens.css`; every screen reads them and adds no fill, radius or font size of its own. Origin of the rules: Strategy's all-genre study (2026-10-08); naming and the one-gold-button rule follow World of ClaudeCraft (MIT, `~/Developer/donors/world-of-claudecraft`, `DESIGN.md` + `src/styles/tokens.css`).

1. **Grid.** 4 px steps only: `--s1..--s6` = 4, 8, 12, 16, 24. Shapes are Blade Cut, not radii: sheets `--cut-sheet` (18 px cut corners, 2 px `--edge` top line), tiles and wells `--cut-tile` (10 px), text buttons `--cut-btn` (12 px slant), icon buttons `--cut-icon` (6 px slant). A clip-path clips outer shadows and borders: draw edges with `inset` box-shadow.
2. **Type (Dom's pick: Roman).** Titles and buttons Cinzel (`--tf`, 700, tracked .08em, uppercase on buttons); body Alegreya Sans (`--bf`). 12, 14, 16, 20, 28 px; titles at 20 and up; nothing under 12. Both are self-hosted in `public/game/fonts/` (OFL, LICENSES.txt), `font-display: swap`, fetched only when a screen using them first renders.
3. **Colour (Dom's pick: Frost Iron).** `--bg` gradient #1b2228 to #0d1114; `--panel` #20272c; `--panel2` #14191d; `--edge` #9fd6ff; `--edge2` #3a4650; `--text` #e9eef2; `--soft` #a9b6bf; `--acc` (the primary fill, light-to-frost gradient) with `--acci` ink; `--accs` #9fd6ff for rings; `--hp`, `--st`, `--danger`, `--ok`. No other button fills. The old sand gold (#b7a276) is retired.
4. **Button styles.** `.btn-primary` (`--acc` fill, **one per screen**), `.btn-secondary` (`--panel2` with an inset 1 px `--edge2` line), icon button (44 px minimum). Touch floor 44 px, primary 48 px. A selected tile or slot carries an inset 2 px `--accs` ring, never a fill.
5. **Thumb zones.** The bottom-left 176 x 176 px (plus `env(safe-area-inset-*)`) belongs to the joystick: nothing enters it. The right 40% is the action column. Position with grid/flex, never as an offset from another button.
6. **End screen (phone portrait).** One column, bottom right: Next fight (primary) at the bottom, then the share icon row (DUEL, LINK, CLIP) above it; there is no Pit door (the Pit room was removed, #1835).
7. **Take screen.** Panel header, item grid, footer: only the grid scrolls. Take (primary) and Leave (secondary) side by side at 48 px, pinned; Next steps down to a secondary while the offer is up (one gold per screen).

Pinned-footer popups follow the idea in Unciv's `Popup` (MPL-2.0): rewritten here, nothing copied.

## Window and docking rules (Strategy, study part 2, 2026-10-08)

Every Zone 1 screen (town, bank, gear, rankings, book) follows these. Ideas from classic clients; code is ours (openmw is GPL: rewritten, not copied; World of ClaudeCraft is MIT).

8. **One window skeleton.** Header (auto) | body (`1fr`, the only scroller) | footer (pinned, `padding-bottom: max(12px, env(safe-area-inset-bottom))`). Footer row = `[main] <spacer> [secondary] [cancel]` (openmw `trade_window.layout`, rewrite).
9. **Dock 50/50 on a phone.** Gear, vendor and bank: paperdoll / vendor / vault on the left, the bag grid on the right (World of ClaudeCraft `char-bags-paired`, `hud.mobile.css`). The 176 px joystick band below stays reserved. The bank and the menu use the SAME gear screen.
10. **Loot window.** Solid `--panel-base` (nothing shows through), 40 px rows, rarity as coloured names, one primary "Take all".
11. **The primary is structural.** `--acc` fill only for the one primary per screen; a selected tab or slot is an `--accs` ring, not a fill. (Frost Iron replaced the sand-gold rule, Dom 2026-10-08.)
12. **Chat and toasts.** Chat 0.74 alpha, 0.95 on focus; toasts 8 px apart, 3-5 s. Quantity at the bank or a vendor: a long-press sheet with 1 / 5 / 10 / All / X.
13. **Roman lettering is the skin.** Cinzel for titles and buttons, Alegreya Sans for body (rule 2); the earlier basalt/bronze/parchment token idea is superseded by Frost Iron (rule 3).
14. **One design size + one `--ui-scale` scalar.** Author at one size; never add a second scaling system.
