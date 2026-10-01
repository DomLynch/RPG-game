// The boss specials' own presentation timing (Multi Chars; special-fx-boss.ts draws them, the scene reads the two body moves). Pure and three-free like
// special-timing.ts beside it: ticks at the sim's 60 Hz from the SpecialStarted tick, the strike landing at LAND_AT (the one 120 of RULES.special.windup).
import { LAND_AT } from './special-timing.ts';

export const BUILD = 30;   // the visible build-up: the last half second before the landing (Dom: a 1-2 s build-up was too slow on Red Wind)
export const BUILD_AT = LAND_AT - BUILD;
// The Knight's Sling (rank 8): he turns one full circle in the build-up, slow into fast, and steps out of it into the blow (the scene turns his heading by this).
export const slingAngle = (age: number) => { const k = Math.min(1, Math.max(0, (age - BUILD_AT) / BUILD)); return Math.PI * 2 * k * k * (3 - 2 * k); };
// The Knight's Wrath (rank 9): his body trembles, harder through the build-up, until the blow (metres of sway on his x).
export const wrathTremor = (age: number) => Math.min(1, Math.max(0, (age - BUILD_AT) / BUILD)) * 0.018 * Math.sin(age * 2.3);
