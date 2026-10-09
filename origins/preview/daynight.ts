// The Frontier's day/night clock (World lane, Dom: a 100-minute game day = dayNightSpeed 14.4 in origins/world/schema.ts). Pure: real milliseconds in, the game hour and the look out.
// Nothing here touches a scene or a save; main.ts reads it each frame behind a flag. `night` is the one definition the spawn flag shares with the sky (mobs tagged night appear when it is true).
import { blendLook, type Look } from './look.ts';

export const GAME_DAY_MINUTES = 100;
export const DAY_NIGHT_SPEED = (24 * 60) / GAME_DAY_MINUTES;   // 14.4 game minutes per real minute
export const DUSK = 19, DAWN = 5, DUSK_SPAN = 1.5;             // dusk blends 19 to 20.5 h, night holds to 3.5 h, dawn blends 3.5 to 5 h

// The game hour (0 to 24) after `realMs` of play, starting at `startHour`; speed 0 freezes it at the start.
export const gameHour = (realMs: number, speed = DAY_NIGHT_SPEED, startHour = 12): number => (((startHour + (realMs / 3_600_000) * speed) % 24) + 24) % 24;

const smooth = (t: number) => { const k = Math.min(1, Math.max(0, t)); return k * k * (3 - 2 * k); };
// 0 = full day, 1 = full night: rises across dusk (DUSK to DUSK+span), holds, falls across dawn (DAWN-span to DAWN).
export function nightness(hour: number): number {
  const h = ((hour % 24) + 24) % 24;
  if (h >= DUSK) return smooth((h - DUSK) / DUSK_SPAN);
  if (h <= DAWN) return 1 - smooth((h - (DAWN - DUSK_SPAN)) / DUSK_SPAN);
  return 0;
}
export const isNight = (hour: number): boolean => nightness(hour) >= 0.5;
export const skyLook = (day: Look, night: Look, hour: number): Look => blendLook(day, night, nightness(hour));
