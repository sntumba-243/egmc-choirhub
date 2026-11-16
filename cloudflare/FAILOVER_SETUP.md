# choirhub.us Failover Worker — Setup

This worker keeps **choirhub.us** online when Vercel is down by transparently
serving from the certified static mirror. Vercel is always primary; the mirror is
only used when Vercel fails (network error, timeout, 5xx, or a Cloudflare
origin error 520–526 / 530).

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

> The CONFIG constants at the top of the file (`PRIMARY`, `MIRROR`,
> `TIMEOUT_MS`, `FAILOVER_STATUS`) are the only things you'd ever edit. Keep the
> deployed worker and `failover-worker.js` identical — if you edit one, paste
> the same change into the other.

---

## 2. Add the routes (so it fronts choirhub.us)

Workers → **`choirhub-failover`** → **Settings** → **Domains & Routes** → **Add** →
**Route**, and add BOTH (zone = `choirhub.us`):

| Route pattern         | Zone          | Failure mode  |
|-----------------------|---------------|---------------|
| `choirhub.us/*`       | `choirhub.us` | **Fail open** |
| `www.choirhub.us/*`   | `choirhub.us` | **Fail open** |

Set **both** routes to **Fail open** (the "Request limit failure mode" option on
the route). If the worker itself can't run — e.g. the Workers free daily request
limit is used up — Cloudflare then skips the worker and sends the request
straight to Vercel, instead of returning an error page. Failover is lost for
that time, but the site stays up.

Once the routes are live, every request to those hostnames runs through this
worker instead of going straight to Vercel.

---

## 3. The mirror's build variables (required for sign-in)

The mirror (`egmc-choirhub` worker) is a build of the same app. The app talks to
Supabase directly from the browser, and Vite bakes the Supabase settings into
the bundle **at build time** — so they must be **build** variables, not runtime
variables or secrets:

Workers → **`egmc-choirhub`** → **Settings** → **Build** → build variables
(**not** the runtime "Variables and Secrets" section) → add:

| Name                     | Value                                              |
|--------------------------|----------------------------------------------------|
| `VITE_SUPABASE_URL`      | production Supabase URL (`https://lpcepycxqfqzwwszmpks.supabase.co`) |
| `VITE_SUPABASE_ANON_KEY` | production publishable key (`sb_publishable_…`, same as Vercel's)    |

Then **rebuild/redeploy the mirror** — changing build variables does nothing
until the next build.

> These were missing until 2026-11-16. The mirror was built with empty values
> (`createClient("", "")`, console: "Missing Supabase credentials!"), so during
> a failover the page loaded but **nobody could sign in or load data**.
>
> Check after every mirror build: open the mirror, DevTools → Console — there
> must be no "Missing Supabase credentials!" — and sign in once.

---

## 4. DNS — leave it exactly as it is

**Do not change the DNS records.** `choirhub.us` / `www` stay as the existing
**proxied (orange-cloud) CNAME → Vercel**. The Workers Route intercepts matching
requests *in front of* the proxied origin — the worker chooses Vercel vs. mirror
per request. DNS is not involved in the failover decision.

---

## 5. Test failover safely

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
   - Also **sign in** on the mirror-served page — this proves the mirror's build
     variables (section 3) are set.
5. **Restore** `PRIMARY` back to `https://egmc.vercel.app` and **Deploy**.
6. Reload choirhub.us and confirm `x-served-by` is **gone** (back on Vercel).

> Note: a drill with a dead host only exercises the "fetch threw" path. The
> failover drill showed an origin outage can also come back from Cloudflare as a
> **52x / 530** status code; before 520–526 and 530 were added to
> `FAILOVER_STATUS` (2026-11-16) the worker passed those errors through instead
> of failing over.
>
> The mirror serves static files only. Sign-in, songs and data still work
> because the app calls Supabase directly (as long as section 3 is done);
> anything that depends on Vercel itself won't.

---

## 6. Emergency removal (roll back to Vercel-only)

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
  ├─ 520–526, 530     → serve mirror  (Cloudflare couldn't reach/talk to Vercel)
  └─ threw / timed out → serve mirror  (+ x-served-by: failover-mirror)
        └─ mirror also down → return Vercel's error, else 502
```

4xx are deliberately **not** failed over — a 404/401 is an app-level answer and
the static mirror would give the same (or worse) result.
