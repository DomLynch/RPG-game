// CI entry for the scene-space HUD tag (origins/preview/hud-tag.ts: name tags, "!", notice and ground rings carry userData.hud so a look pass can skip them); the tests live beside it.
import './lib/era-off.ts';   // RV78: the legacy suite runs on trunk's rules; sandbox-era.ts is the one switch (tests/lib/era-off.ts)
import '../origins/preview/hud-tag.test.ts';
