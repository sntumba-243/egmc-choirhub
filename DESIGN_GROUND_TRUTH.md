# ChoirHub — Design Ground Truth

**Code-accurate UI feature inventory for the design team.** Every screen, section, control, state, and role gate below is transcribed literally from the source at commit on `main`. Strings in `backticks` are copied verbatim from the code.

> **How to use this document**
> - A designer should be able to reconstruct every screen from this text alone.
> - **"DOES NOT EXIST" lines are load-bearing.** Where a common feature is absent, it is stated explicitly — do not invent buttons, tabs, or states that aren't listed.
> - **Role gates** (what an Admin sees vs a Super Admin) are called out per element, with `file:line`. Several components are literally the same file serving two roles.
> - Method: every routed page file was read in full, imports followed to the modals/menus/forms they render, and `App.tsx` read for the real route map. Role conditionals were independently grep-verified.

---

## 1. App shell & route map

**Login redirect** (`App.tsx:159`): after login, `user.is_super_admin` → `/super-admin`, else `role === 'admin'` → `/admin`, else → `/member`. All role areas are wrapped in `<ProtectedRoute requiredRole=…>` — **role gating is done at the router + layout level**, and only two page components add in-component role gates (Repertoire, Members — see §2).

### Routes by role

**Member** (`/member`, `MemberLayout`):
`/member` Dashboard · `/member/repertoire` Repertoire · `/member/repertoire/:id` SongDetail · `/member/calendar` Calendar · `/member/calendar/:eventId` & `/member/events/:eventId` EventDetail · `/member/messages` Messages · `/member/messages/compose` MessageCompose · `/member/practice` Practice · `/member/profile` Profile · `/member/vocal-coach` VocalCoach (+ `/vocal-coach/practice/:id`, `/vocal-coach/progress`)

**Admin** (`/admin`, `AdminLayout`):
`/admin` Dashboard · `/admin/repertoire` Repertoire · `/admin/repertoire/new` & `/:id/edit` SongForm · `/admin/members` Members · `/admin/members/new` & `/:id/edit` MemberForm · `/admin/events` Events · `/admin/events/new` & `/:id/edit` EventForm · `/admin/events/:id` EventDetail · `/admin/attendance` AttendanceLanding · `/admin/attendance/stats` AttendanceStats · `/admin/attendance/take[/:eventId]` TakeAttendance · `/admin/submissions` Submissions · `/admin/messages` Messages · `/admin/messages/new` MessageForm · `/admin/settings` Settings · `/admin/theme` ChurchThemeSettings · `/admin/bulk-edit` BulkSongEditor · `/admin/vocal-coach` (redirect) → `/admin/vocal-coach/assignments` VocalCoachAssignments

**Super Admin** (`/super-admin`, `SuperAdminLayout`):
`/super-admin` Dashboard · `/super-admin/churches` Churches · `/super-admin/churches/new` & `/:id/edit` ChurchForm · `/super-admin/churches/:id` ChurchDetail · `/super-admin/events` GlobalEvents · `/super-admin/events/:id` EventDetail · `/super-admin/settings` Settings · `/super-admin/theme` ChurchThemeSettings

**Shared route (both member & non-member):** `/pdf-viewer` → `PDFViewerPage` (legacy Google-Drive iframe viewer; see §3.2).

### ⚠️ Components shared across roles (document BOTH faces)
| Route(s) | Renders component | Notes |
|---|---|---|
| `/admin/repertoire` **and** `/super-admin/repertoire` | `AdminRepertoire` (`admin/Repertoire.tsx`) | **Role-gated** — see §2 |
| `/admin/members` **and** `/super-admin/members` | `AdminMembers` (`admin/Members.tsx`) | **Role-gated** — see §2 |
| `/admin/favorites` **and** `/super-admin/favorites` | `AdminFavorites` (`admin/Favorites.tsx`) | **No gate — identical UI** |
| `/admin/settings` **and** `/super-admin/settings` | `AdminSettings` (`admin/Settings.tsx`) | Only the theme-link target differs (path-based) |
| `SongForm`, `MemberForm`, `ChurchThemeSettings` | used by both `/admin` & `/super-admin` | No element-level role gates |

---

## 2. Roles & the critical shared-component gates (SUMMARY)

There are exactly **two** page components with in-JSX `isSuperAdmin` show/hide gates, plus one path-based gate and one `is_global` gate. All other admin/super-admin differences are data-scoping or routing only.

### `AdminRepertoire` (`admin/Repertoire.tsx`) — `isSuperAdmin = user?.is_super_admin === true` (line 76)
- **`+ Add` header button** (line 375, `{isSuperAdmin && …}`): **EXISTS for super-admin; DOES NOT EXIST for admin.**
- **Kebab menu `Edit song`** (line 649 block): **super-admin only; DOES NOT EXIST for admin.**
- **Kebab menu `Delete`** (line 649 block, red): **super-admin only.** Also guarded in code: `if (!isSuperAdmin || !confirm('Delete this song?')) return;` (line 325) — admin cannot delete even if reached.
- Everything else (search, stat filters, favorites, status cycle, multi-select, bulk bar, add-to-event, load-all, pagination, PDF viewer) is **identical for both roles.**

### `AdminMembers` (`admin/Members.tsx`) — `isSuperAdmin` (line 29)
- **Heading** (line 141): `Church Admins` (super) vs `Members` (admin).
- **Subtitle** (line 142-144): `{n} admins across all churches` (super) vs `{n} total · {a} admin · {m} member · {g} guest` (admin).
- **Data scope** (line 65-69): super-admin lists `role = 'admin'` across ALL churches; admin lists all members of their own `church_id`.
- **Church-name line `🏛 {name}`** (line 278-280): **super-admin only; DOES NOT EXIST for admin.**
- **`Add New` button + card/Edit destinations**: EXIST for both; targets differ (`/super-admin/…` vs `/admin/…`).
- Voice-part stats, search, filters, Delete button — identical for both.

### `AdminSettings` (`admin/Settings.tsx`) — **path-based** `isSuperAdmin = location.pathname.startsWith('/super-admin')` (line 10)
- Only effect: `Church Theme` card links to `/super-admin/theme` vs `/admin/theme`. Both cards exist for both.

### `AdminEvents` (`admin/Events.tsx`) — per-event `is_global` gate (no `isSuperAdmin`)
- **Edit/Delete controls** (cards line 282, list line 332, `{!event.is_global && …}`): **EXIST for church-owned events; DO NOT EXIST for global events.** Delete guard toast: `Global events can only be deleted by super admin`.

### No role gates at all
Member pages (only a cosmetic Profile role badge), `AdminFavorites`, `SongForm`, `MemberForm`, `EventForm`, `AdminEventDetail`, `AdminMessages`, `MessageForm`, the Attendance suite, `BulkSongEditor`, `ChurchRepertoire`, `ChurchThemeSettings`, `SongSubmissions`, `Submissions`, `VocalCoachAssignments`, and all super-admin pages (already super-admin-only).

---

## 3. Shared components & layouts

### 3.1 The three layout sidebars
Common pattern: fixed mobile header (`lg:hidden`), mobile overlay, slide-in `<aside>` (`w-64`, `-translate-x-full lg:translate-x-0`), hamburger (`Menu`/`X`), `Sign Out` at bottom. Sidebar auto-closes on route change and on resize ≥1024px. Logout → `logout()` → `/login`, toast `Logged out successfully` / `Failed to logout`.

**MemberLayout** (`layouts/MemberLayout.tsx`) — nav in order: `Dashboard` (Home) → `/member`; `Repertoire` (Music); `Events` (Calendar) → `/member/calendar`; `Messages` (MessageSquare); `Vocal Coach` (Mic); `Profile` (User).
- Logo: `logoUrl` image, else gradient square (`#FF8C42→#E85D26`) + Music icon. Church name = `church?.short_name || church?.name || 'ChoirHub'`. Subtitle `Member Portal` (color `#c47a30`).
- User block: name, role pill — mobile `Guest`(blue)/`Member`(green) with `👤`; desktop `Guest Access`/`Choir Member`.
- Active nav uses hardcoded orange gradient (NOT church theme). Page bg `#FFFBF5`. Logout `Sign Out`.
- Side effects: `useActivityTracker()`, `startBackgroundCache()` (pre-caches Sunday-ready tier once/session).

**AdminLayout** (`layouts/AdminLayout.tsx`) — nav in order: `Dashboard` (LayoutDashboard); `Repertoire` (Music); `Members` (Users); `Events` (Calendar); `Attendance` (BarChart3); `Messages` (MessageSquare); `Vocal Coach` (Mic) → `/admin/vocal-coach/assignments`; `Settings` (Settings).
- Uses church theme classes `theme-gradient`, `theme-text`, `theme-active`. Subtitle `Admin Panel` (mobile header only). **No user-info/role block.** Page bg `bg-gray-50`. Logout `Sign Out`.

**SuperAdminLayout** (`layouts/SuperAdminLayout.tsx`) — nav in order: `Dashboard`; `Churches` (Church); `Repertoire` (Music); `All Members` (Users); `Global Events` (Calendar); `Settings`.
- Hardcoded branding: title `ChoirHub` (`#1a2744`), subtitle `Super Admin` + Shield (`#378ADD`). User block: name + slate `Super Admin` pill (Shield). Active nav bg `#1a2744`. Logout `Sign Out`.
- Does NOT inject the body safe-area `<style>` block and omits left/right safe-area insets (Member/Admin include them).

**Safe area (all):** mobile header `paddingTop: max(env(safe-area-inset-top), 12px)`; main `paddingTop: max(calc(env(safe-area-inset-top)+64px),64px)`, `paddingBottom: env(safe-area-inset-bottom)`.

### 3.2 SheetMusicViewer (modern canvas viewer) — `components/SheetMusicViewer.tsx`
Full-screen `createPortal` into `document.body`, `z-[10050]`, canvas-rendered PDF (pdfjs-dist). Props `url`, `title?`, `onClose?`, `version?`. Used by **Repertoire** (as an overlay). **White** canvas area (`bg-white`); outer `bg-gray-950`.
- **Top chrome** (`bg-gray-900`): back chevron (`onClose`), centered `{title || 'Sheet Music'}`, zoom `−` (min 0.5, step 0.25) & `+` (max 3).
- **Bottom chrome** (only if `numPages > 1`): prev chevron (disabled page 1), `{currentPage} / {numPages}`, next chevron (disabled last).
- **Loading:** spinner + `Loading sheet music...`. **Error:** dark title bar + centered `Sheet unavailable` + `Retry` button (re-fetches).
- **Auto-hide chrome:** shows on open, hides after 3s; hidden via translate+opacity+`pointer-events-none`.
- **Gestures:** single-tap toggles chrome (300ms delay, cancelled by 2nd tap); double-tap (<300ms, <30px) zoom toggle `scale → (s>1 ? 1 : 1.75)`; swipe (`|dx|>60 && |dx|>2|dy|`, no h-overflow) → prev/next page; pinch (≥2 touches) live CSS-transform preview then one sharp re-render, clamped 0.5–3, focal-preserving; desktop click toggles chrome (ignores synthesized clicks within 700ms of touch). Page change resets scroll to top-left. Re-fits on resize/orientation.

### 3.3 PDFViewer (legacy Drive iframe) — `components/PDFViewer.tsx`, route `/pdf-viewer`
Full-screen `z-[9999]`. Embeds Google Drive `…/preview?rm=minimal`; scales iframe `width:110%; scale(0.909)` to crop Drive UI. Always-visible circular back button; **controls auto-hide after 2.5s**; thin top-edge tap zone re-shows. If `songId` in nav state, a floating red Mic record button (`bottom-4 right-4`, `title="Record your practice"`) opens `SongRecorder`.
- States: `Loading PDF...`; native (Capacitor) opens in in-app Browser + `Opening PDF...` + `Go Back`; error red `⚠️` `Invalid Google Drive URL` / `Could not extract file ID from the URL` + `Go Back`; no-state orange `No PDF URL Provided` + `Go Back`.
- **Reached by:** SongDetail, member EventDetail, admin EventDetail, super-admin EventDetail, VocalCoach song assignments, Favorites `View PDF`. (Repertoire uses the modern `SheetMusicViewer` instead.)

### 3.4 Church theming — `contexts/ChurchContext.tsx`
`Church` fields: `id, name, short_name, logo_url, primary_color, secondary_color, accent_color, address, city, country, pastor_name, contact_email, contact_phone, is_active, timezone`.
`applyTheme` sets CSS vars on `:root` — `--church-primary`, `--church-secondary`, `--church-accent`; sets favicon to `logo_url`; sets `<meta name="theme-color">` to `primary_color || '#185FA5'`; sets document title `(short_name||name) + ' · ChoirHub'`. Cached theme applied from `localStorage['choirhub_church_theme']` before first render (no flash).
Consuming CSS classes (defaults `#3b82f6 / #1e40af / #f59e0b`): `.theme-gradient`, `.theme-text`, `.theme-active`, `.theme-btn`. **Only AdminLayout consumes these**; Member & SuperAdmin layouts use hardcoded colors.

### 3.5 Other shared components
- **GlobalSearch** (`GlobalSearch.tsx`): debounced dropdown, placeholder `Search songs, events, messages...`, triggers at ≥2 chars; states `Searching...` / `No results found for "{query}"` / grouped `{type}s ({count})`; song/event/message icons; closes on outside click.
- **PasswordModal** (`PasswordModal.tsx`): header green Check + `Member Created!` + name; blue `Login Credentials` box (`Email`, `Password` mono + copy icon `title="Copy password"`); amber `⚠️ Make sure to save this password! Share it securely with the member.`; buttons `Copy Password`(→`Copied!`) + `Done`.
- **EventDetailModal** (`components/EventModal/`): bottom-sheet mobile / centered desktop; purple→blue gradient header `{title}` + type pill + `X`; date/time/location; optional description; RSVP section (`RSVP`, buttons `Attending` / `Can't Make It`); songs section `Songs for this Event ({n})`; footer `Close`.
- **SongRecorder** — TWO variants: **(A)** `components/SongRecorder.tsx` (used by PDFViewer): compact fixed bottom bar `z-[10004]`, mic→square record, timer `M:SS`, play/retry/send, toasts `Could not access microphone` / `Recording sent!` / `Failed to send`; uploads to `recordings` bucket. **(B)** `components/SongRecorder/SongRecorder.tsx`: larger bottom-sheet variant, header `Record Performance`, copy `Tap the microphone to start recording` etc.; uploads to `song-recordings` bucket. Variant B appears older/unused.
- **Banners/indicators:** `OfflineBanner` (top amber `You're offline — viewing cached data` + `(last synced: …)`, only when offline); `EnhancedOfflineIndicator` (`Back online! Syncing latest data...` / `You're offline. Using cached content.` + persistent `🔴 Offline` pill); `OnlineIndicator` (pill `Online`/`Offline`); `NativeUpdateBanner` (native-only blue `New version available — tap to update`, `z-[10010]`); `PWAUpdateNotification` (white card `Update Available!` / `A new version of ChoirHub is ready…` + `Update Now`/`Later`); `IOSInstallPrompt` (`Install ChoirHub` + 3 steps `Tap the Share button` → `Add to Home Screen` → `Add`, buttons `✕`/`Got It!`).
- **Legacy/unused:** `SongCard` (`📄 View Score` / `No score available`) and `SongList` (`Loading repertoire...` / `Failed to load songs. Please try again.` / `No songs found`) use `SongComponents.css`; not wired into the themed portals.

---

## 4. MEMBER DASHBOARD

_All member pages render in `MemberLayout`. No member page has a role gate (only Profile's cosmetic role badge)._

### 4.1 Dashboard — `/member`
Dynamic greeting eyebrow `Good morning`/`Good afternoon`/`Good evening`/`Good night`; H1 `{firstName} 👋`.
Sections: (1) greeting; (2) alert pills if any — `{n} unread message(s)` → messages, `{n} vocal assignment(s)` → vocal-coach; (3) **Next Event** hero card (if any) → `/member/events/{id}`, shows `Today`/`Tomorrow`/`Mon, Feb 3` · time · location; (4) **Attendance** card — big count (`–` while loading) + `event(s) attended` or `No attendance recorded yet`; (5) **Stats row** 3 buttons `Songs`/`Events`/`Favorites`; (6) **Quick Access** eyebrow + 2-col bento of 6: `Repertoire` `{n} songs`, `Calendar` `{n} upcoming`, `Messages` `{n} unread`/`All read`, `Vocal Coach` `{n} pending`/`No assignments`, `Favorites` `{n} saved`, `Profile` `Settings`.
No search/tabs/menu/pagination/modals. Loading = counters show `–`. Empty states as above. **No `hidden`/`md:` splits** (single mobile-first layout).

### 4.2 Repertoire — `/member/repertoire`
H1 `Repertoire` + pill `{count} songs`.
Sections: (1) header; (2) stats row = 5 buttons `Total` / `✅` / `📚` / `⏳` (status filters, active = `ring-2 ring-orange-500`) + static `{masteryRate}%` `Rate` card; (3) search input `Search...` (fuzzy) + star (favorites) toggle + sliders (filters) toggle; (4) filters panel (when open): `Sort` = `A → Z`/`Z → A`/`Recent`, `Language` = `All`/`English`/`French`/`Portuguese`/`Lingala`/`Tshiluba`/`Kikongo`/`Swahili`; (5) active-filter chips (`✅ Learned`/etc + `Clear`; `⭐ {n} favorites` + `Clear`); (6) song list rows (`★`/`☆` favorite aria `Add/Remove favorite`, title+composer opens PDF, language circle, status emoji); (7) pagination (if paginated & >1 page) `Showing {a}–{b} of {n} songs`, `Previous`/`Page {n} of {m}`/`Next`; (8) **Your Church Songs** (if any) with `View Sheet Music` (opens `partition_url` new tab); (9) PDF overlay = **SheetMusicViewer** (§3.2).
Empty: `No favorites yet` (`Tap ★ to add favorites`) / `No songs found` (`Try adjusting your filters`). Loading: orange spinner + list `Loader2`. Toasts `Failed to load songs`, `Added to favorites`, `Removed from favorites`. `?tab=favorites` auto-enables favorites. Pagination bar `flex-col sm:flex-row`.

### 4.3 SongDetail — `/member/repertoire/:id`
H2 `{song.title}`. Sections: header (`Back to Repertoire`, composer/arranger, `Download for Offline`/`Downloading...`/`Available Offline` badge, tag pills, offline warning `You're offline` / `This song is not available offline. Connect to the internet to download it.`, download progress bar); **Resources** (`Sheet Music` → `/pdf-viewer`; `YouTube Video` → new tab; offline alerts `This resource is not available offline` / `YouTube requires an internet connection`); **Part Recordings** (`Start Practice Session` / live `HH:MM:SS` + `End Practice Session`; `Playback Speed:` `0.5x`–`1.5x`; up to 4 players `Soprano`/`Alto`/`Tenor`/`Bass` or `Not available offline`). **Practice Notes modal** (`Practice Notes`, `Great session! You practiced for {n} minutes.`, textarea `Add any notes about your practice session (optional)...`, `Skip`/`Save Log`, alert `{n} minute(s) logged!`). Loading `Loading song...`; not-found `Song not found`. Only `md:grid-cols-2` on players.

### 4.4 Calendar — `/member/calendar`
H1 `Events` + `{n} upcoming event(s)`. View toggle `Cards`/`List` (**`hidden sm:flex`** — hidden on mobile). Timeline filters `Upcoming ({n})`/`Past ({n})`/`All ({n})`. **Cards view** grid `grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4`, each card → detail, RSVP status `You're attending!`/`Not attending`/`Maybe attending`/`No RSVP yet` + buttons `Yes`/`Maybe`/`No`. **List view** sortable table (`Event`/`Date`/`Time`/`Location`/`Type` + `Your RSVP`), `min-w-[600px]` overflow-x, mobile hint `← Scroll horizontally to see more →` (`sm:hidden`). Empty `No upcoming events` / `Check back later for new events`. Loading `Loading events...`. Toasts `Failed to load events`, `RSVP updated to "{status}"`.

### 4.5 Messages — `/member/messages` (`Messages-MOBILE.tsx`)
Two internal views. **List:** H1 `Messages`; filters `All`/`Unread`; message cards (icon, subject, relative date `Today`/`Yesterday`/`{n} days ago`, 2-line preview, `Important` badge); empty `No messages yet` / `You'll see messages from your choir here`. **Detail:** `Back to Messages` (X), subject/date/body, **Reply** (`Reply`, textarea `Type your reply...`, `Cancel`/`Send Reply`→`Sending...`, toast `Reply sent!`). No search/pagination/compose link here. Toasts `Failed to load messages`/`Failed to send reply`. No `hidden`/`md:` splits despite filename.

### 4.6 MessageCompose — `/member/messages/compose`
`Messages` back link + H1 `Message Admin`. Form: `To` = static `Admin Team`; `Subject *` `What is this about?`; `Message *` `Type your message...`. Buttons `Cancel` / `Send`(→`Sending...`, disabled until both filled), toast `Message sent to admin`. **No in-app link to this route found — reachable only by direct URL.**

### 4.7 Practice — `/member/practice`
H1 `Practice Studio`. **AI Practice Assistant** card (`Start Practice Session`); **Quick Practice** = `Vocal Warm-ups` `15 min guided exercises`, `Pitch Training` `Interactive ear training`. Modals: **Vocal Warm-ups** (5 numbered items e.g. `1. Lip Trills (2 min)`); **Pitch Training** (`Match the Pitch`/`Interval Training`/`Slow Practice` + `💡 Tip:…`); **AI Chat** (seed `👋 Hi! I'm your AI Practice Assistant…`, `Thinking...`, quick-question chips, input `Ask me anything about singing...`) — **responses are hardcoded/keyword-matched, not a real LLM call.**

### 4.8 Profile — `/member/profile`
Header card: avatar + camera menu (`Take Photo`/`Choose from Gallery`); H1 `{user.name}`, email, role badge `Guest`/`Admin`/`Member` (cosmetic, `Profile.tsx:166-170`) + voice-part badge; `Phone Number` field + `Save`(→`...`). **Practice Stats** (`Week`/`Month`/`Top Song`/`Streak`, grid `grid-cols-2 sm:grid-cols-4`). **Offline songs** card: `Sunday-ready: {cached}/{total} · Full library: {cached}/{total}`; button `Download all now` / `Downloading… {cached}/{total}` (spinner) / `All saved`. **Offline Downloads** collapsible (`{n} songs · {MB} MB`; storage bar `{pct}% used`; per-song trash `confirm('Remove this song from offline storage?')`; `Clear all downloads` `confirm('Clear all offline downloads?')`; empty `No offline songs`). Toasts incl. `Songs saved for offline use` / `Could not download all songs`.
> Offline model: the layout auto-caches only **Sunday-ready** (upcoming-event setlist + favorites); **the full library downloads only via this button.**

### 4.9 Vocal Coach — `/member/vocal-coach`
H1 `Vocal Coach` + `Practice assignments & vocal exercises`. **Assignments (`Assignments ({n})`)**: expandable cards (type pill `Song`/`Exercise`, `Due {date}`, status `✅ Approved`/`💬 Reviewed`/`⏳ Submitted`; expanded shows `📝 Director's notes:`, melody-reference play, `📋 How to do this exercise:`, `🎧 Director feedback`, `🤖 AI Evaluation`, buttons `📄 View & Record`/`🎤 Record`/`✅ Done`). **Exercise Library ({n})** with tabs `All`/`Breathing`/`Tone`/`Rhythm`/`Range` (empty `No exercises in this category`). **Completed ({n})** `<details>`. No-content empty `No assignments or exercises yet`. Opens **SongRecorder** variant A. Loading blue spinner.

### 4.10 EventDetail — `/member/events/:eventId` & `/member/calendar/:eventId`
`← Back` → `/member/calendar`; gradient header `{title}` + type; details grid `grid-cols-1 sm:grid-cols-3` (`Date`/`Time`/`Location`); description; **Setlist ({n})** (rows `#{i}` + song, Eye → `/pdf-viewer` if `sheet_music_url`); **RSVP** (`Will you attend?`, `{n} attending`, `Yes`/`Maybe`/`No`, toast `RSVP: {status}`). Loading orange spinner; not-found `Event not found` + `Back to Calendar`.

---

## 5. ADMIN DASHBOARD

### 5.1 Dashboard — `/admin`
H1 `Dashboard` + `Welcome, {adminName}`. **Quick Stats** grid `grid-cols-2 … lg:grid-cols-4`: `Members`/`Songs`/`Events`/`Messages` (each a nav button; optional trend chip `+{n}`/`{n}` — Events trend hard-coded 0). **Quick Actions** pills: `New event`, `Message`, `New member`. `Send RSVP Reminders` button (Bell) → confirm `Send RSVP reminders to members who haven't responded?`, toasts `No upcoming events to send reminders for` / `All members have already been reminded or RSVP'd!` / `Sent {n} reminders for {n} event(s)`. **Upcoming Events** (≤3) → detail; empty `No upcoming events`. _Note: an `alerts` array is computed but never rendered — no alerts banner exists._ No role gate.

### 5.2 Repertoire — `/admin/repertoire` & `/super-admin/repertoire` (SHARED, see §2)
H1 `Repertoire` + count. Stats filters `Total`/`✅`/`📚`/`⏳` + `{masteryRate}%` `Rate`. Search `Search...` (fuzzy, 300ms). Star + `⚙` toggles. Filters: `Sort` (`A → Z`/`Z → A`/`Recent`), `Language` (`All`/`English`/`French`/`Portuguese`/`Lingala`/`Tshiluba`/`Kikongo`/`Swahili`). **Bulk bar** (≥1 selected): `{n} selected`, `Event` button, `Mark as...` select (`✅ Learned`/`📚 Learning`/`✅ Not Started`), `✕`. Load-all row: `Load all songs` / `Back to pages` / `Select All`/`Deselect ({n})`. Rows: checkbox, `★`/`☆`, title+composer (opens SheetMusicViewer), language badge, status emoji (`Tap to change status`, cycles, toast `→ Learned`), kebab (`Song options`). **Kebab items:** `Add to favorites`/`Remove favorite`, `Cycle status`, **and (super-admin only) `Edit song` + `Delete`** (`Delete this song?`). Pagination `Showing {a}–{b} of {n} songs`. **Event Modal** `Add to Event ({n})` (empty `No upcoming events` + `Create Event`). Empty list `No songs found` / `Try adjusting your filters`. **`+ Add` = super-admin only** (§2).

### 5.3 Members — `/admin/members` & `/super-admin/members` (SHARED, see §2)
Heading `Members` (admin) / `Church Admins` (super). `Add New` button (Plus). Voice stats `Soprano`/`Alto`/`Tenor`/`Bass` (grid `grid-cols-2 sm:grid-cols-4`). Search `Search by name or email...`; `All Status`/`Active`/`Inactive`; `All Roles`/`Admin`/`Member`/`Guest`. Cards → edit; avatar + online dot, name, status badge, role emoji `👑`/`👤`, email, voice chip, member_id, last-active (`Online now`/`{n}m/h/d ago`/`Never`); **`🏛 {church}` line = super-admin only**; Edit + Delete (`Delete {name}?`). Loading spinner; empty `No members found` / `Try a different search term` / `Add your first member to get started`.

### 5.4 MemberForm — `/admin/members/new|/:id/edit` (+ super-admin)
Heading `Edit Member`/`Add New Member`. Fields: `First Name *`, `Last Name *`, member-ID preview `Member ID will be: {ID}`, `Email *`, `Phone` `(555) 123-4567`, `Voice Part *` (`Select Voice Part`/`Soprano`/`Alto`/`Tenor`/`Bass`), `Role` (`Member`/`Guest`/`Section Leader`/`Admin` + helper `👑 Full access…` etc.), `Status` (`Active`/`Inactive`). **Edit-only Password** section (`Send reset email`→`Sending...` toast `Reset email sent to {email}`; `Generate new password`→`Generating...`; reveal box `••••••••••••` + eye + copy `Password copied`). **New-only** `Create login account for this member` checkbox + yellow `Default Password Information` box. Buttons `Cancel` / `Update Member`/`Add Member` (`Saving...`). Opens **PasswordModal** on create. Role affects only data-scope + routes (§2). Toasts incl. `Member not found or access denied`, `No church selected`.

### 5.5 Events — `/admin/events`
H1 `Events` + `{n} total event(s)`. View toggle `Cards`/`List`; `Add Event`. Timeline `Upcoming ({n})`/`Past ({n})`/`All ({n})`. **Cards** → detail; type pill; `{n} RSVPs` + `Reset` (confirm `Reset all RSVPs for "{title}"? (Data will be archived for attendance tracking)`); `Take Attendance →` (non-past); **Edit/Delete footer only when `!is_global`** (§2). **List** sortable table (`Event`/`Date`/`Time`/`Location`/`Type` + `RSVPs`/`Actions`), `min-w-[600px]`, hint `← Scroll horizontally to see more →` (`sm:hidden`). Delete confirm `Delete "{title}"?`; toast `Global events can only be deleted by super admin`. Loading `Loading events...`; empty `No upcoming events`/`No past events`/`No events yet` + `Get started by creating your first event` + `Add Event`.

### 5.6 EventForm — `/admin/events/new|/:id/edit`
Heading `Edit Event`/`New Event`. Basic info: `Event Title *`, `Date`, `Time`, `Type` (`Service`/`Practice`/`Performance`/`Meeting`/`Social`/`Other`), date-change warning `⚠️ Changing the date will archive current RSVPs as attendance for {date} before updating.`, `Location *`, `Description (optional)`. `Require RSVP` checkbox. **Visibility** collapsible: `All Members` / `By Voice Part` (`Soprano`/`Alto`/`Tenor`/`Bass`/`Instrumentalist`) / `By Role` (`admin`/`member`/`guest`) / `Specific Users` (search `Search members...`). **Setlist** collapsible (search `Search songs to add...`, `No songs found`, `#{i+1}` ordered). Buttons `Cancel` / `Update`/`Create` (`Saving...`). No role gate.

### 5.7 EventDetail — `/admin/events/:id`
Top bar `← Back` / `Edit`. Details card (`Date`/`Time`/`Location` + description). **Setlist ({n})** + `+ Add` (Song Picker modal `Add Songs to Setlist`, search `Search songs...`, `No matching songs found`/`All songs already in setlist`, `Done`); rows `#{i+1}`, `View PDF` (→ `/pdf-viewer`), Trash `Remove "{title}"?`. **RSVPs** tiles `Attending`/`Maybe`/`Not Attending` + name groups. Church-scope guard toast `Access denied` (global events bypass). Loading spinner; not-found `Event not found` + `Back to Events`; empty setlist `No songs added` + `+ Add Songs`; `No RSVPs yet`. No role gate.

### 5.8 Messages — `/admin/messages`
List: H1 `Messages` + `{n} total messages` + `New Message`. Rows (unread `bg-blue-50` + left border; `Important` badge; `To: {recipient}` via `All Members`/`📩 From: {name}`/`Multiple Recipients`; Trash). Detail view: `Back to Messages`, `Delete` (`Delete this message?`), subject/body. Loading spinner; empty `No messages yet` + `Send your first message to the choir` + `Send Message`. No role gate (church-scoped).

### 5.9 MessageForm — `/admin/messages/new`
`Messages` back + H1 `New Message`. `To *` (`All Members`/`Soprano Section`/`Alto Section`/`Tenor Section`/`Bass Section`); `Subject *` `What is this about?`; `Message *` `Type your message...`; `Mark as Important` toggle + `Shows a red badge to recipients`. `Cancel` / `Send`(→`Sending...`). Toasts `Message sent successfully`/`Failed to send message`.

### 5.10 Settings — `/admin/settings` & `/super-admin/settings`
H1 `Settings`. **Google Drive Sync** card (`Google Drive Sync`/`Syncing...` + `Sync sheet music from Drive`; result `{n} added` / `{n} skipped` / `{n} errors`; toasts `No files found in Google Drive folder`, `Successfully synced {n} songs!`, `All {n} songs already exist`, `Failed to sync: {msg}`). **Church Theme** card (`Colors, logo & branding`) → `/admin/theme` or `/super-admin/theme` (**path-based**, §2).

### 5.11 SongForm — `/admin/repertoire/new|/:id/edit` (+ super-admin)
Heading `Add New Song`/`Edit Song`. Fields: `Song Title *` `e.g. Amazing Grace`; `Composer` `e.g. John Newton`; `Language` `e.g. English, French, Latin`; `Sheet Music URL` `https://drive.google.com/...` + helper `Link to Google Drive PDF or other sheet music file` + **PDF Preview** (`Open in new tab` + iframe); `Learning Status` radios `✅ Learned`/`📚 Learning`/`⏳ Not Yet` (default `not_yet`). Buttons `Cancel` / `Create Song`/`Update Song` (`Saving...`). No modal, **no delete/danger zone**, no role gate.
> _Note: the URL placeholder + Drive-iframe preview here are Drive-era holdovers; songs now serve from Supabase Storage._

### 5.12 Submissions — `/admin/submissions`
H1 `Member Submissions` + `Click on a member to view and respond to their recordings`. Accordion by member (avatar, name, voice/`Member`, `{n} recording(s)`, `{n} pending review`). Expanded: `Member's Recording` play, `Your Feedback (sent)` (if any), inline recording UI (`Record Feedback`/`Recording... Click to stop`/`Cancel`/`Preview & Send`), `Approve` (if not approved). No modal/confirm. Loading purple spinner; empty `No submissions yet`. No role gate.

### 5.13 SongSubmissions — `SongSubmissions.tsx` (route unconfirmed in file)
H1 `Song Submissions` + `Review member recordings`. Stat cards `Pending Review`/`Reviewed`/`Approved` (`md:grid-cols-3`). `Pending Review (N)` rows (play/pause, `Add Feedback`, `Approve`, delete). `Reviewed & Approved (N)` `<details>`. **Feedback Modal** (`Add Feedback`, textarea `Enter your feedback...`, `Cancel`/`Submit Feedback`). Delete confirm `` Delete ${name}'s recording of "${title}"? ``. Skeleton loading; **no global empty-state copy**. No role gate.

### 5.14 Favorites — `/admin/favorites` & `/super-admin/favorites` (identical, no gate)
H1 `Favorite Songs`. Header `Add {n} to Event` (when selected). Empty `No Favorites Yet` / `Star songs in the repertoire to add them to your favorites` + `Browse Repertoire`. Rows: checkbox, title + language pill, `View PDF` (→ `/pdf-viewer`), Trash `Remove from favorites` (**no confirm — immediate**). **Event Selection Modal** `Add to Event` (empty `No upcoming events` + `Create Event`; else event list; `Cancel`). Loading `Loading favorites...`. Toasts incl. `Added {n} songs to event`, `Event songs table not set up yet. Check setup instructions.`

### 5.15 AttendanceLanding — `/admin/attendance`
Church-themed header (`{church}` / `Attendance` / `Monday, 4 July`). Layout `md:grid-cols-2`; **right snapshot card `hidden md:block`**. Left: **Today** card `Take attendance →` or `No rehearsal today` + `Take attendance for a past event →`; `Recent events` (≤7, badge `{present} / {total}` or `Take →`; empty `No past events yet.`); `Choir health` `Statistics · {n} member(s)`. Right (desktop/tablet): `This month` big `{present}/{possible}`, `{rate}% attendance · {n} rehearsal(s)`, section bars, `View full choir health →` (empty `No events recorded yet this month.`). No modals/role gate.

### 5.16 AttendanceStats — `/admin/attendance/stats`
Header `Attendance` back / `Choir health` / `Take attendance →`. Subtitle `Based on archived attendance · {n} past event(s) in period` + refresh. Period `Week`/`Month`/`Year`/`All` (default `All`). Stat cards `Members`/`Events`/`Regulars`/`Follow-up` (`grid-cols-2 md:grid-cols-4`). Sort `Name`/`Attendance` (↑↓); status `All`/`Regulars`/`Follow-up`; voice `All Voices`+parts. Empty `No attendance recorded yet` / `Take attendance at your first rehearsal to see stats here.` + `Take attendance →`. **Desktop table `hidden md:block`** (`Member`/`Voice`/`Attendance`/`Status`, statuses `Not seen yet`/`Always here`/`Often here`/`Sometimes`/`Rarely`); **mobile cards `md:hidden`**; filter-empty `No members match this filter`. No search box (selects only). No role gate.

### 5.17 TakeAttendance — `/admin/attendance/take[/:eventId]`
Adds `attendance-focus-mode` (hides sidebar/header). Phases: **selector** (`Take attendance`/`Choose the event you're running`; empty `No events in the last 14 days or next 7 days.` + `+ Add Event`); **prompt** (`Is everyone here today?` / `Your answer sets the starting point`; `Yes, everyone is here` / `I will mark individually`); **sheet** (RSVP banner `Pre-filled from RSVPs — tap to correct` + `Dismiss`; count bar `{present} of {total}` + `{absent} absent · {checkLater} to check later`; search `Search members`; grouped sections Soprano/Alto/Tenor/Bass/Instrumentalist/Unassigned; per-row `Present`/`Absent`/`Check later`; footer `Mark remaining {n} as present` + `Save attendance`; **Save sheet** `Save attendance?` / `Save`/`Keep marking`); **saved** (`{present} of {total} members were here` + `Excellent turnout today 🎉`/`Great rehearsal attendance 👏`/`Good session today`/`Attendance recorded for today` + section summary + `Back to events`/`View attendance history`). Mobile-first, no `hidden md:` splits. No role gate.

### 5.18 VocalCoach (redirect) — `/admin/vocal-coach`
**Renders nothing** — redirects to `/admin/vocal-coach/assignments`. _(Latent bug: calls `useChurch()` without importing it.)_

### 5.19 VocalCoachAssignments — `/admin/vocal-coach/assignments`
H1 `Vocal Coach` + `Assign songs & exercises · Review submissions` + `Assign`. Stats `Assignments`/`To Review`/`Completed`. Tabs `All Members`/`To Review`/`Completed`. Member accordion → expanded assignments (type pill `🎵 Song`/`🏋️ Exercise`, status `Pending`/`Approved`/`Reviewed`/`Done`/`Waiting`, `Due:`, delete). Submission block: `Member's recording`, `Your feedback (sent)`, recording UI (`Recording...`/`Tap to record`/`Cancel`/`Send feedback`), buttons `🎤 Feedback`/`🤖 AI Evaluate`/`✅ Approve`. **AI Evaluation panel** (inline): `🤖 AI Vocal Analysis`, `🔊 Auto-Analyze Recording`, RatingBars `Key 🎹`/`Tone 🎵`/`Notes 🎼`/`Breathing 💨`/`Rhythm 🥁` (1-5, `Poor`–`Great`), `🤖 Generate Coaching Feedback`; results `🤖 AI Analysis Results`, score circle, 5-metric grid, `▶ Show detailed feedback`, `💡 Suggestions:`, `💾 Save & Send to Member`. **Assignment Modal** (bottom-sheet mobile): `New Assignment`, type `🎵 Song`/`🏋️ Exercise`, `Assign to` `Single`/`By Voice`/`All`, song/exercise selects, `Melody Reference` (`Tap to Record Melody`), `Due Date`, `Notes` `Add instructions...`. Delete confirm `Delete this assignment?`. Empty `No assignments yet`. No role gate.

### 5.20 BulkSongEditor — `/admin/bulk-edit`
Header `Bulk Edit Songs` + `Export CSV` / `Import CSV`. Search `Search by title or composer...`. Language filter buttons `all`/`English`/`French`/`Lingala`/`Tshiluba`/`Swahili`/`Kikongo`/`Portuguese`/`Other` (`{lang} ({count})`). Selection bar `{n} of {n} selected` + `Select All`/`Select None`; `Set Language:` (8 langs); `Mark as:` `✅ Learned`/`📚 Learning`/`⏳ Not Yet`. Table (`Title`/`Composer`/`Language`/`Status`), row-click select, footer `Showing {n} of {total} songs`, empty `No songs found`. CSV help box `💡 Bulk Edit with CSV:` (6 steps). **No confirmation before bulk update/import.** Loading `Loading songs...`. Songs query is **global (not church-scoped)**. No role gate.

### 5.21 ChurchRepertoire — `ChurchRepertoire.tsx` (route unconfirmed in file)
H1 `Repertoire` + `{filtered} of {total} songs`. Stats `Total`/`✅`/`📚`/`⏳` + `{masteryRate}%` `Rate` (`grid-cols-3 sm:grid-cols-5`). Search `Search songs...`; Sort (`A → Z`/`Z → A`/`Recent`); Language (`All ({n})`+); Grid/List toggle (default `list`); `Favorites` toggle. List/grid rows with favorite star, status emoji, three status buttons (`Learned`/`Learning`/`Not Started`), PDF on click. Empty `No songs found` + `Try adjusting your filters`. No confirm/pagination. No role gate.

### 5.22 ChurchThemeSettings — `/admin/theme` & `/super-admin/theme`
H1 `Church Theme` + `Customize the look and feel for your church. Changes apply to all members.` Sections: **Church Logo** (drop-zone + `Upload Logo`/`Uploading...` + `PNG or JPG, max 2MB. Square works best.`); **Choose a Theme** (4 presets `Royal Blue`/`Classic & trustworthy`, `Warm Earth`/`Earthy & grounded`, `Deep Indigo`/`Rich & elegant`, `Rose Gold`/`Warm & refined`); **Custom Colors** (`Primary`/`Secondary`/`Accent` color+hex, live preview); **Preview** (mock sidebar with `Dashboard`/`Repertoire`/`Members` + `Save Changes`). Footer `Save Theme`(`Saving...`)/`Reset`. Toasts `Theme saved successfully!`, `Reset to saved theme`. No role gate.

---

## 6. SUPER ADMIN DASHBOARD

### 6.1 Dashboard — `/super-admin`
Shield + `Super Admin Dashboard` + `Manage all churches and repertoire`. Stat cards (`grid-cols-2 md:grid-cols-4`): `Churches` → churches, `Total Members` → members, `Songs` → repertoire, `Upcoming Events` → events. **Churches** section (`Add Church` → new; church rows logo/`short_name` + name + `{n} members` → detail). Loading spinner (no text); empty `No churches yet`; errors console-only.

### 6.2 Churches — `/super-admin/churches`
`Church` + `Churches` + `{n} registered`. `Add Church`. Search `Search churches...`. Rows (logo, name, `{n} members`, city, `Active`/`Inactive` pill) → detail. **No per-row edit/delete/menu.** Loading spinner; empty `No churches match your search` / `No churches yet`. Toast `Failed to load churches`. Header `flex-col sm:flex-row`. (List queries `is_active = true` only.)

### 6.3 ChurchForm — `/super-admin/churches/new|/:id/edit`
`Back to Churches` + `Add New Church`/`Edit Church`. Fields: `Church Name *`, `Short Name *` (max 10), `Pastor / Leader Name`, `Contact Email`, `Contact Phone`, `Address`, `City`, `Country`, `Timezone` (`UTC`…`Australia / Sydney`, incl. `Africa / Kinshasa`, `Africa / Lubumbashi`), **Assign Admin** (`admin@example.com` + `Email of the person who will manage this church. They must have an account.`), **Church Logo** (`Upload Logo`/`Uploading...` + `PNG or JPG, max 2MB`), **Theme Colors** (`Primary`/`Secondary`/`Accent` + gradient swatch). Buttons `Create Church`/`Update Church` (`Saving...`) / `Cancel`. **Generated Password Modal** `Admin Account Created` / `Share these credentials with the admin` (`Email`, `Temporary Password` + `Copy` → `Password copied!`, `⚠️ This password will not be shown again. Please save it now.`, `Done — Go to Churches`). Toasts `Church created!`/`Church updated!`, `Name and short name are required`, `Logo must be under 2MB`, admin-assign variants. Field rows `grid-cols-1 sm:grid-cols-2`.

### 6.4 ChurchDetail — `/super-admin/churches/:id` (mobile tabbed carousel)
`Back to Churches`. Church header (logo gradient, name, meta `hidden sm:block`, short city `sm:hidden`; **desktop `Edit`/`Delete` `hidden md:flex`; mobile 3-dot `md:hidden`** menu `Edit church`/`Delete church`). Clickable stat cards (`grid-cols-3`) `Members`/`Events`/`Songs Learned` (scroll to sections). **Mobile tab bar `md:hidden`** `Events`/`Members`/`Songs`/`Settings`; each section toggles `hidden md:block` off-tab (desktop shows all stacked). **Events** (`Church Events`, `Upcoming`/`Past` (≤5), `Global` pill; empty `No events for this church yet`). **Song Progress** (placeholder `Song status tracking will be available here — {n} songs learned so far.`). **Members** (`Members ({n})` + `Add Admin`; rows with `Super Admin` pill; desktop inline `Remove SA`/`Make SA`, `Reset PW`, `Remove`; mobile 3-dot `Make/Remove Super Admin`, `Reset Password`, `Remove`; pagination `Page {n} of {m}`, size 10). **Danger Zone** (`Reset attendance data` → modal). Mobile tab arrows `{Label} · {n} of 4`.
- **confirm() dialogs:** deactivate `Are you sure you want to deactivate this church? This will hide it from the app.`; `Remove ${email} from this church? This will delete their member record.`; `Reset password for ${email}?`; `Are you sure you want to {make super admin|remove super admin from} this member?`.
- **Add Admin Modal** (`Add Admin`, `Full Name` `John Doe`, `Email *` `admin@example.com`, helper about promote/create, `Cancel`/`Add Admin`→`Adding...`). **Password Modal** (`Admin Account Created`, `Done`). **Reset Attendance Modal** (`Reset attendance data?` / `This will permanently delete all attendance records for {church}. This cannot be undone.` / `Cancel`/`Yes, reset all`→`Resetting...`). Loading spinner; not-found `Church not found`.

### 6.5 GlobalEvents — `/super-admin/events`
`Globe` + `Global Events` + `Visible to all churches`. `New Global Event` (inline form `Create Global Event`/`Edit Event`: `Event Title *`, `Date *`/`Time *`/`Location *`, `Type` (`Concert`/`Rehearsal`/`Social / Gathering`/`Other`), `Description`, **song selector** `Songs for this event ({n} selected)` search `Search songs...`, chips + list; `Update Event`/`Create Event`/`Cancel`). **Upcoming ({n})** rows → detail, `Global` pill, `Edit`/Delete; **Past Events ({n})** rows (delete only, no edit, not clickable). Delete confirm `Delete this global event? All churches will no longer see it.` Loading spinner; empty `No global events yet` + `Create events that all churches can see`.

### 6.6 EventDetail — `/super-admin/events/:id` (indigo-themed)
`← Back` / `Edit`. Details card (title, `Date`/`Time`/`Location` + description). **Setlist ({n})** + `+ Add` (**Song Picker Modal** `Add Songs to Setlist`, `Search songs...` autofocus, `No matching songs found`/`All songs already in setlist`, `Done`); rows `#{i+1}`, Eye `View PDF` (→ `/pdf-viewer`), Trash `Remove "{title}"?`. **RSVPs ({n})** count boxes `Yes`/`Maybe`/`No` + grouped member cards (`No RSVPs yet`). Loading indigo spinner; not-found `Event not found` + `Back to Events`; empty setlist `No songs added` + `+ Add Songs`.

### 6.7 Settings — `/super-admin/settings`
H1 `Settings`. **Data Management** (`Manage inactive and soft-deleted records.`; `Purge inactive churches` / `Permanently delete all churches marked as inactive. Soft-deleted churches are kept for 30 days before auto-purge.`; button `Purge inactive`). **Confirmation Modal** `Purge inactive churches?` / `This will permanently delete {N} inactive church(es). This cannot be undone.` (+ list, or `No inactive churches found.`) / `Cancel`/`Yes, purge all`→`Purging...` (disabled when none). Purge failure is **console-only (no toast/UI error)**.

---

## 7. Dead / unrouted / legacy files (do NOT design for these)
- `member/SmartVocalCoach.tsx` — comment stub, **no component**, unrouted.
- `member/MessageDetail.tsx` — renders mock hardcoded data, **unrouted** (live detail is inside `Messages-MOBILE.tsx`).
- `member/Events.tsx` / `Events.jsx` — `/calendar` uses `Calendar.tsx`; these appear superseded.
- `admin/VocalCoach.tsx` — redirect-only stub (renders `null`).
- `admin/SongSubmissions.tsx`, `admin/ChurchRepertoire.tsx` — no route in `App.tsx` (routing declared elsewhere / possibly unused).
- `components/SongCard.tsx`, `components/SongList.tsx` — legacy CSS-based, not wired into themed portals.
- `components/SongRecorder/SongRecorder.tsx` (variant B) — older/unused; variant A (`components/SongRecorder.tsx`) is the live one.
- `components/PDFViewer.tsx` — legacy Drive-iframe viewer, still live at `/pdf-viewer`; the modern `SheetMusicViewer` is used by Repertoire.
- Two PDF viewers and two SongRecorders coexist.

---

## 8. Counts
- **Dashboards:** 3 (Member, Admin, Super Admin).
- **Routed page components documented:** 39 — Member 10, Admin 22, Super Admin 7.
- **Layouts:** 3 (each with its exact sidebar nav documented).
- **Shared components documented:** ~16 (SheetMusicViewer, PDFViewer, GlobalSearch, PasswordModal, EventDetailModal, 2× SongRecorder, ChurchContext theming, 6 banners/indicators, 2 legacy list/card).
- **In-JSX role gates:** 2 components (`AdminRepertoire`, `AdminMembers`) + 1 path-based (`AdminSettings`) + 1 `is_global` (`AdminEvents`).
- **Dead/unrouted/legacy files flagged:** 9.
