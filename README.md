# Receipt: fight opening on PR #694 (Revert #670 Arena Draw) @ 5015ce25, 375x812

Local `npm run build` (from quality:ci) of 5015ce25, served by `vite preview`, headless Chromium, mobile 375x812 @2x, no deploy lock.
- `opening-0-welcome.png`: load → the plain versus still "YOU vs CENTURION" under the welcome card. No roster board.
- `opening-150.png` … `opening-3000.png`: +150/700/1600/3000 ms after "Enter the arena". Straight into the arena, with the Centurion
  facing the player and "Draw your sword. The Centurion will counterattack." No board run and no draw to the ladder's pick.
- `opening-strip.png`: all five side by side.
DOM: 0 nodes with "draw" in their class or id, `#versus-foe` = "Centurion", no page errors.
