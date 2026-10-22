// CI entry for Origins slice 1 (?region=1, origins/preview/frontier-plan.ts and bounty.ts): the Ash Frontier laid out from the Region 1
// data, walkable from the Exchange to the Bounty giver and back, the Bounty in the journal, each zone's ambience preset.
import './lib/era-off.ts';   // RV78: the legacy suite runs on trunk's rules; sandbox-era.ts is the one switch (tests/lib/era-off.ts)
import '../origins/preview/frontier.test.ts';
import '../origins/preview/frontier-dress.test.ts';
import '../origins/preview/frontier-kit.test.ts';
import '../origins/preview/daynight.test.ts';
import '../origins/preview/frontier-cinder.test.ts';
import '../origins/preview/camp-kit.test.ts';
import '../origins/preview/frontier-camp.test.ts';
import '../origins/preview/kit-lod.test.ts';   // the kit's far bodies: near/far by eye distance, the far body casts the shadow (Web)
import '../origins/preview/kit-view.test.ts';   // the kit's view rules as rows: castShadow per kind, shadow and draw radius, defaults pinned (Web)
import '../origins/preview/prop-kit.test.ts';   // the zone prop kit (the goblin camp), World's Test Zone slice B3b
import '../origins/preview/frontier-relief.test.ts';   // Zone 1 quality step 1 in the preview: hills only in the open ground
