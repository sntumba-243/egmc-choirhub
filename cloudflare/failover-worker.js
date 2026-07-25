/**
 * choirhub.us — automatic failover worker
 * ────────────────────────────────────────────────────────────────────────────
 * Sits in front of choirhub.us (bound via a Workers Route). Every request goes
 * to Vercel (the live app) first. If Vercel is DOWN — network error, timeout, or
 * a 5xx server error — the same path is served from the certified static mirror
 * on Workers instead, so the site stays up.
 *
 * This is a SEPARATE worker from the mirror itself. It does not need any code
 * from the mirror; it just proxies to two URLs.
 *
 * Design goals: zero dependencies, small, obvious. Edit the three CONFIG
 * constants below if the origins ever change.
 */

// ── CONFIG ──────────────────────────────────────────────────────────────────
const PRIMARY = 'https://egmc.vercel.app';                          // live app (Vercel)
const MIRROR  = 'https://egmc-choirhub.sethntumba1430.workers.dev'; // static fallback
const TIMEOUT_MS = 5000;                          // give Vercel this long before failing over
const FAILOVER_STATUS = new Set([500, 502, 503, 504]); // server outages only — NOT 4xx (app-level)

export default {
  async fetch(request) {
    const { pathname, search } = new URL(request.url);

    // Rebuild the request against each origin, preserving method + headers + body.
    // A request body can only be read once, so clone the incoming request for
    // each target (the mirror needs its own copy in case we fail over on a POST).
    const primaryReq = new Request(PRIMARY + pathname + search, request.clone());
    const mirrorReq  = new Request(MIRROR  + pathname + search, request.clone());

    // Abort the primary fetch if it hangs — a hung origin counts as an outage.
    const ac = new AbortController();
    const timer = setTimeout(() => ac.abort(), TIMEOUT_MS);

    try {
      const resp = await fetch(primaryReq, { signal: ac.signal, redirect: 'manual' });
      clearTimeout(timer);

      // 5xx → Vercel is broken server-side; serve the mirror. 4xx are app-level
      // (404, 401, …) and would be identical on the mirror, so pass them through.
      if (FAILOVER_STATUS.has(resp.status)) return failover(mirrorReq, resp);

      // Healthy (2xx/3xx/4xx) → stream Vercel's response straight back.
      return resp;
    } catch (err) {
      clearTimeout(timer);
      // fetch threw (network error) or the timeout aborted it → fail over.
      return failover(mirrorReq, null);
    }
  },
};

/**
 * Serve the same path from the static mirror, tagged with `x-served-by` so a
 * failover is visible in DevTools. If the mirror is ALSO down, fall back to the
 * original Vercel error response (or a generic 502 if we never got one).
 */
async function failover(mirrorReq, primaryResp) {
  try {
    const resp = await fetch(mirrorReq, { redirect: 'manual' });
    const out = new Response(resp.body, resp); // re-wrap so headers are mutable
    out.headers.set('x-served-by', 'failover-mirror');
    return out;
  } catch (err) {
    return primaryResp || new Response('Origin and mirror both unavailable', { status: 502 });
  }
}
