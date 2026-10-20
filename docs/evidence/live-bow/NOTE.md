Live bow volley check, release 00f5e2d97, signed-out guest, Chromium 375x812 @2x.
Result: BLOCKED at wield. No volley could be tested for any of the four specials.
- Pickup worked via the game's own prompt ("Take the Hunter's bow", ground:zone1.bow-1) -> "You take the Hunter's bow. This session only."
- Guest take goes to an in-memory guest bag only; Menu > Gear shows "Nothing stored", MAIN HAND stays Longsword. No guest wield path.
- originsPreview.forceWeapon('bow') changes the rig only; the duel trace weapon becomes "longsword" once a creature engages.
- Stills: step2a/2b (prompt, pickup line), step3 (Gear panel, bow not listed), try-*.png (special press, melee, longsword).
