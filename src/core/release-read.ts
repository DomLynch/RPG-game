// The one read of the live release id the page makes: the same-origin /release.json deploy.sh writes ({"revision":"<40 hex>"}). A static file, not the save server; it lives in the core door because the page modules
// call no fetch of their own (tests/core-boundary.test.ts C5). The page asks it through readReleaseId (origins/preview/warm-plan.ts), which bounds the wait and refuses anything but a 40-hex revision.
export const fetchReleaseJson = (signal: AbortSignal): Promise<unknown> => fetch('/release.json', { cache: 'no-store', signal }).then((response) => response.json());
