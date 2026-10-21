// Preload for the RV86 A/B runs: node --import ./scripts/lib/er86-era.mjs <script>. ER86=0 fights the old light and thrust timings (the era OFF), anything else the Elden Ring ones (the live default).
import { setRows86 } from '../../src/fight/sandbox-era.ts';

if (process.env.ER86 === '0') setRows86(false);
