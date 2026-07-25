# choirhub.us Failover Worker — Setup

This worker keeps **choirhub.us** online when Vercel is down by transparently
serving from the certified static mirror. Vercel is always primary; the mirror is
only used when Vercel fails (network error, timeout, or 5xx).

- **Primary:** `https://egmc.vercel.app` (the live app on Vercel)
- **Mirror:** `https://egmc-choirhub.sethntumba1430.workers.dev` (static fallback)
- **Worker code:** [`failover-worker.js`](./failover-worker.js)

All steps below are Cloudflare **dashboard** steps (no CLI needed).

---

## 1. Create the worker (paste-the-code path)

1. Cloudflare dashboard → **Workers & Pages** → **Create** → **Create Worker**.
2. Name it **`choirhub-failover`** (must be DIFFERENT from the mirror worker
   `egmc-choirhub` — this is a separate worker that sits in front of it).
3. Click **Deploy** (accept the starter code), then **Edit code**.
4. Delete the starter code and **paste the entire contents of
   `failover-worker.js`**.
5. Click **Deploy**.

> The three CONFIG constants at the top of the file (`PRIMARY`, `MIRROR`,
> `TIMEOUT_MS`) are the only things you'd ever edit.

---

## 2. Add the routes (so it fronts choirhub.us)

Workers → **`choirhub-failover`** → **Settings** → **Domains & Routes** → **Add** →
**Route**, and add BOTH (zone = `choirhub.us`):

| Route pattern         | Zone          |
|-----------------------|---------------|
| `choirhub.us/*`       | `choirhub.us` |
| `www.choirhub.us/*`   | `choirhub.us` |

Once the routes are live, every request to those hostnames runs through this
worker instead of going straight to Vercel.

---

## 3. DNS — leave it exactly as it is

**Do not change the DNS records.** `choirhub.us` / `www` stay as the existing
**proxied (orange-cloud) CNAME → Vercel**. The Workers Route intercepts matching
requests *in front of* the proxied origin — the worker chooses Vercel vs. mirror
per request. DNS is not involved in the failover decision.

---

## 4. Test failover safely

You want to prove the mirror kicks in **without** actually taking Vercel down.

1. Workers → `choirhub-failover` → **Edit code**.
2. Temporarily point the primary at a domain that will fail. Change:
   ```js
   const PRIMARY = 'https://egmc.vercel.app';
   ```
   to a guaranteed-dead host, e.g.:
   ```js
   const PRIMARY = 'https://this-host-does-not-exist.choirhub-failover-test';
   ```
3. **Deploy.**
4. Open **https://choirhub.us** in a browser. It should load normally **from the
   mirror**. Confirm in **DevTools → Network → the document request → Response
   Headers**: you should see **`x-served-by: failover-mirror`**.
   - (Fast CLI check: `curl -sI https://choirhub.us | grep -i x-served-by`)
5. **Restore** `PRIMARY` back to `https://egmc.vercel.app` and **Deploy**.
6. Reload choirhub.us and confirm `x-served-by` is **gone** (back on Vercel).

> Note: the mirror is static, so during a real failover, dynamic/API calls and
> POSTs won't function — the mirror serves the last-certified static site so
> people can still read content. This is expected.

---

## 5. Emergency removal (roll back to Vercel-only)

If the worker ever misbehaves, get traffic flowing straight to Vercel again by
**deleting the routes** (not the worker):

1. Workers → `choirhub-failover` → **Settings** → **Domains & Routes**.
2. **Delete** `choirhub.us/*` and `www.choirhub.us/*`.

With the routes gone, the proxied CNAME sends requests directly to Vercel again —
instantly, no DNS propagation wait. (You can leave the worker itself deployed;
without routes it receives no traffic. Re-add the routes to turn failover back
on.)

---

## How it decides (quick reference)

```
request → fetch Vercel (egmc.vercel.app), 5s timeout
  ├─ 2xx / 3xx / 4xx  → return Vercel's response as-is
  ├─ 500/502/503/504  → serve mirror  (+ x-served-by: failover-mirror)
  └─ threw / timed out → serve mirror  (+ x-served-by: failover-mirror)
        └─ mirror also down → return Vercel's error, else 502
```

4xx are deliberately **not** failed over — a 404/401 is an app-level answer and
the static mirror would give the same (or worse) result.
