// The `?gfx=1` look flag (gfx-lift.ts). Its own tiny file so the page can ask without pulling the post-processing code in: off = the page is exactly as before and that chunk is never fetched.
export const gfxOn = (search: string): boolean => /[?&;]gfx=1\b/.test(search);
