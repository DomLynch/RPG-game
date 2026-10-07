// RECORD_VERSION 29 refuses every older version (REACH[29]), and a headless recorder stamps an older ERA (play-radius.ts: no small circle, no late notice, no stab).
// A test that records a fight and then decodes or replays it records it as a live fight is fought: this build's circle for that opponent, late notice and the stab.
import { playScaleFor, setLateNotice, setPlayScale } from '../../src/play-radius.ts';
import { setStab } from '../../src/stab-rule.ts';
import { createRecorder, RECORD_VERSION } from '../../src/record.ts';

export const liveRecorder: typeof createRecorder = (meta) => { setPlayScale(playScaleFor(meta.opponent, RECORD_VERSION)); setLateNotice(true); setStab(true); return createRecorder(meta); };
