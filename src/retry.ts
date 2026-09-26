// Transient-failure retry, shared by the art loaders (characters.ts, lorarii.ts) and the daily post (daily.ts).
// A dropped connection is not a broken rig. Safari reports a failed fetch as `TypeError: Load failed` (Chrome: `Failed to fetch`),
// and a 5 MB fighter on a phone drops now and then (Sentry FRANKENDOM-6: nine sessions in five days, every release). Such a
// failure is retried with a short back-off before the game gives up on the art; a rig that parses but is wrong is not retried.
export const transientLoadError = (error: unknown): boolean => error instanceof TypeError || /Load failed|Failed to fetch|NetworkError|network error|ERR_(NETWORK|CONNECTION|INTERNET)/i.test(String((error as { message?: string })?.message ?? error));
export async function retryTransient<T>(attempt: () => Promise<T>, attempts = 3, delayMs = 800, sleep: (ms: number) => Promise<void> = ms => new Promise(r => setTimeout(r, ms))): Promise<T> {
  for (let i = 1; ; i++) {
    try { return await attempt(); }
    catch (error) { if (i >= attempts || !transientLoadError(error)) throw error; await sleep(delayMs * i); }
  }
}
