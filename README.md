# Share buttons: 3 mockups for Dom's pick (SCOPE #729 rank 5)

This is only about where the two kill-screen buttons go and how they look: **Share fight** (the existing /s/<id> replay link, relabelled) and **Export clip** (a new vertical 10–15 s video ending on the kill). Everything is 375x812.
The background is a real kill frame from a trunk 52953b51 build (Nightborn, after "Leave it"): `kill-after-loot.png`. Next is drawn where trunk puts it (175,637, 176x56).
The buttons are mocked in HTML over that frame; nothing is built.

- `mockup-A.png`: two pills stacked above Next, same look as Next but smaller (176x44 each), sand text with a small glyph.
- `mockup-B.png`: one split pill above Next (176x48), "Share fight | Export clip".
- `mockup-C.png`: two round 60 px buttons in the fight cluster's family (SHARE, CLIP), left of Next, above the joystick.
- `mockup-sheet.png`: A | B | C side by side.

Rules kept in all three: nothing in the top band (the first touch after a kill stops the arena-cam tour), nothing over the fallen body, bottom thumb row only.
Recording state (Lead's condition): it will be the Export button's own state in the same place ("Recording · 12 s" + Cancel), with nothing drawn over the fight view. It's drawn after the pick.
