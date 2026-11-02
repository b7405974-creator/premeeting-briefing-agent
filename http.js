// fetch with timeout + exponential backoff on network errors, 429 and 5xx
export async function fetchRetry(url, opts, { tries = 3, timeout = 25000 } = {}) {
  let last;
  for (let i = 0; i < tries; i++) {
    try {
      const r = await fetch(url, { ...opts, signal: AbortSignal.timeout(timeout) });
      if ((r.status === 429 || r.status >= 500) && i < tries - 1) { await new Promise(s => setTimeout(s, 400 * 2 ** i)); continue; }
      return r;
    } catch (e) { last = e; if (i < tries - 1) await new Promise(s => setTimeout(s, 400 * 2 ** i)); }
  }
  throw last;
}
