# Contact grit — presentation lane, 2026-09-20

Branch `presentation/impact-grit` on trunk 63f4cd9. Owner's ask: small, gritty, realistic contact feedback — sparks on a clash, a felt
big hit — nothing cheesy. Four steps, each measured with `scripts/impact-preview.mjs` (real sim scripted to a block, a parry, a landed
heavy and a kill; real `createScene` at 393×852; the frame loop's hit-stop reproduced; camera settled; origin the frame before contact).

| step | what | evidence (`artifacts/presentation/`) |
|---|---|---|
| 1 sparks | `src/clash-sparks.ts`: 4–8 hot streaks from the defender's guard along the blow, gravity, one bounce off the sand, out ≤ 0.45 s; steel on steel only (`clashStrength`, tested) | `before/block.png` (a pale smudge) → `sparks-v1/block.png`, `parry.png` |
| 2 shudder | `src/camera-kick.ts` `shoveFor` (tested): heavy drops the camera 6 cm + holds 2 frames, light 1.2 cm, heavy block 2.8 cm, block 1 cm, parry flicks 2 cm sideways; applied **after** `lookAt`, for the draw only; heavy block deepens the body recoil ×1.5 | camera trace: heavy 0 → **11 px**, heavy block 0 → **6 px**, parry 0.7 → **4 px**, settled ≤ 13 frames |
| 3 dust | `foot-dust.ts` `puff`: 5–9 grains off the defender's rear foot on a heavy that lands or is caught (tested) | `dust-v1/block.png` (hero's rear foot from 83 ms) |
| 4 kill dip | exposure −6 % for 2 frames, eased over 2, kill only | crop brightness: kill contact −2.4 % vs +8 frames; heavy flat |

Findings on trunk, fixed here: the existing camera kick was applied before `camera.lookAt`, which re-aimed it away for everything at the
aim point, and it pushed along the view axis — the harness measured 0 px on the contact frame for a heavy. The additive block sparks
washed out on the sand (invisible at phone scale).

Gate: `npm run quality:ci` 314/314, audit 0, budget 9.73 MB of 12; `npm run test:browser` passed once on cbec4cd. No sim change
(effects consume events); no new dependencies; no new lights; reduced-motion still disables the camera kick.
Not measured: the owner's iPhone. The four amplitudes are tuned for 393×852 at 1.5×; if a shudder reads as shake on the phone, halve
`drop` in `shoveFor` — one table.
