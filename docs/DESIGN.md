# Frankendom UI design rules

One page. Tokens live in `src/tokens.css`; every screen reads them and adds no fill, radius or font size of its own. Origin of the rules: Strategy's all-genre study (2026-10-08); naming and the one-gold-button rule follow World of ClaudeCraft (MIT, `~/Developer/donors/world-of-claudecraft`, `DESIGN.md` + `src/styles/tokens.css`).

1. **Grid.** 4 px steps only: `--s1..--s6` = 4, 8, 12, 16, 24. Radius `--r-btn` 8 (buttons), `--r-panel` 12 (panels).
2. **Type.** 12, 14, 16, 20, 28 px. Serif titles only at 20 and up; nothing under 12.
3. **Colour.** `--ink`, `--parchment`, `--gold` (today's sand `#b7a276`), `--panel` (dark glass), `--danger`, `--ok`. No other button fills.
4. **Three button styles.** `.btn-primary` (gold, **one per screen**), `.btn-secondary` (dark panel, gold edge), icon button (44 px square minimum). Touch floor 44 px, primary 48 px.
5. **Thumb zones.** The bottom-left 176 x 176 px (plus `env(safe-area-inset-*)`) belongs to the joystick: nothing enters it. The right 40% is the action column. Position with grid/flex, never as an offset from another button.
6. **End screen (phone portrait).** One column, bottom right: Next (gold) at the bottom, Enter the Pit (secondary) above it, then the share icon row (DUEL, LINK, CLIP).
7. **Take screen.** Panel header, item grid, footer: only the grid scrolls. Take (gold) and Leave (secondary) side by side at 48 px, pinned; Next steps down to a secondary while the offer is up (one gold per screen).

Pinned-footer popups follow the idea in Unciv's `Popup` (MPL-2.0): rewritten here, nothing copied.

## Window and docking rules (Strategy, study part 2, 2026-10-08)

Every Zone 1 screen (town, bank, gear, rankings, book) follows these. Ideas from classic clients; code is ours (openmw is GPL: rewritten, not copied; World of ClaudeCraft is MIT).

8. **One window skeleton.** Header (auto) | body (`1fr`, the only scroller) | footer (pinned, `padding-bottom: max(12px, env(safe-area-inset-bottom))`). Footer row = `[main] <spacer> [secondary] [cancel]` (openmw `trade_window.layout`, rewrite).
9. **Dock 50/50 on a phone.** Gear, vendor and bank: paperdoll / vendor / vault on the left, the bag grid on the right (World of ClaudeCraft `char-bags-paired`, `hud.mobile.css`). The 176 px joystick band below stays reserved. The bank and the menu use the SAME gear screen.
10. **Loot window.** Solid `--panel-base` (nothing shows through), 40 px rows, rarity as coloured names, one gold "Take all".
11. **Gold is structural.** Three-layer edge (keyline, border, 16% inset glint). Gold FILL only for the one primary; a selected tab or slot is a gold-tinted state, not a fill.
12. **Chat and toasts.** Chat 0.74 alpha, 0.95 on focus; toasts 8 px apart, 3-5 s. Quantity at the bank or a vendor: a long-press sheet with 1 / 5 / 10 / All / X.
13. **Ancient-Rome skin as named tokens only.** Basalt/stone surfaces, a 1 px bronze edge, a parchment inner highlight, cream text, orange-gold titles, a Cinzel-like display face for titles and buttons only, sans at 14 px or more for body, 12 px minimum, 16 px inputs; no blur and no ornament in the phone tier.
14. **One design size + one `--ui-scale` scalar.** Author at one size; never add a second scaling system.
