ChoirHub

A production choir-management platform serving 6 churches and ~90 active members — repertoire, attendance, events, messaging, and vocal coaching, built mobile-first with full offline support.

Live: egmc.vercel.app · React · TypeScript · Vite · Tailwind · Supabase · PDF.js · Capacitor


Real users, real Sundays: directors take attendance from the podium on a phone, and members read sheet music in venues with no cell signal. Reliability on Sunday morning is the design constraint behind every decision below.




Engineering Highlights

Offline-first sheet music (482 PDFs). Custom service worker with CacheFirst PDF caching plus a prioritized background pre-downloader (upcoming setlist → favorites → library, WiFi-aware). Members' devices keep working through venue dead zones and provider outages — the failover strategy is the client.

Custom PDF.js viewer. Replaced third-party embedded viewers (non-responsive, uncontrollable UI) with a canvas renderer: device-pixel-ratio-aware scaling, pinch/zoom, page navigation, safe-area handling for notched iPhones, and ?v={updated_at} cache-busting so edited scores propagate instantly through CDN, service worker, and browser caches.

Zero-downtime storage migration. Moved 485 PDFs from Google Drive to Supabase Storage with a four-tier matching pipeline (deterministic filename sanitization → strict fallback → fuzzy → source-of-truth filename resolution), reaching a verified 482/482 mapping. Every step ran dry-run first, wrote timestamped rollback backups before mutating, and byte-verified uploads (%PDF magic-number checks) — which caught a silent corruption bug that had written 4-byte placeholder files.

Multi-tenant RBAC. Three dashboards (super admin / church admin / member) over Supabase RLS, church-scoped theming via CSS variables, soft-delete with guarded purge flows and confirmation modals for destructive operations.

Mobile audited to a commercial bar. Systematic WCAG 2.2 passes across all three dashboards: 44px touch targets everywhere, no horizontal overflow, hamburger navigation with backdrop and route-change close, adaptive layouts (tabbed carousels on phone, tables on desktop).

Operational discipline. Layered backups (nightly-capable JSON exports with row-count verification, off-provider Neon Postgres mirror, PDF archive in Drive, tagged git rollback branches). Scripts are idempotent and re-runnable; destructive modes sit behind explicit --commit / --confirm-delete flags.


Features

AreaHighlightsRepertoire482-song searchable library, per-song learning status, favorites, voice-part tags, full-screen offline sheet viewerAttendance"Podium mode" — distraction-free one-tap flow, RSVP pre-fill, section progress dots, choir-health analytics by member/voice part/periodEventsRehearsals & services with RSVP tracking and remindersMessagingAnnouncements and member communicationVocal CoachAssignments with member practice-recording submissionsSuper AdminCross-church management, repertoire CRUD, member administration, guarded danger-zone operations

Architecture

React/Vite PWA ── Capacitor (iOS/Android)
      │
      ├─ Supabase Auth (role-based sessions)
      ├─ Supabase Postgres + RLS (multi-tenant data)
      ├─ Supabase Storage + CDN (sheet music)
      └─ Service worker (app shell + data + PDF caches, background pre-fetch)

Ops: Vercel CI/CD from main · JSON export backups · Neon Postgres mirror · rollback branches

Repository Guide

PathContentssrc/pages/{admin,member,super-admin}The three role dashboardssrc/components/SheetMusicViewer.tsxCanvas PDF viewersrc/lib/backgroundCache.tsPrioritized offline pre-downloaderscripts/Migration, bulk-upload, backup, and DB-sync tooling (dry-run by default)supabase/migrations/Schema migrations

Running Locally

bashnpm install
cp .env.example .env.local   # Supabase URL + anon key
npm run dev


Built and operated end-to-end by Seth Ntumba — product, design, engineering, and ops.
