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
