// Safari < 17.4 has no AbortSignal.any (and < 16 no AbortSignal.timeout): calling it threw on the account's first fetch, shown as "Account unavailable".
export function timedSignal(caller?: AbortSignal | null, ms = 10000): AbortSignal {
  if (typeof AbortSignal.any === 'function' && typeof AbortSignal.timeout === 'function') return AbortSignal.any([...(caller ? [caller] : []), AbortSignal.timeout(ms)]);
  const ctl = new AbortController(), stop = () => { clearTimeout(timer); ctl.abort(); }, timer = setTimeout(stop, ms);
  if (caller?.aborted) stop(); else caller?.addEventListener('abort', stop, { once: true });
  return ctl.signal;
}
