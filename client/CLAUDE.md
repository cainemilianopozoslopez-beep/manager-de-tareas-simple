# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project overview

This is **Gmail Task Manager** ("Pulse Matrix" in the UI — same project, cosmetic rebrand), a React + Vite PWA task manager. It is a **standalone frontend**: there is no backend server in the request path. Authentication and data live entirely in **Firebase** (Auth + Firestore). The app is live at **https://manager-de-tareas.web.app**, published via Firebase Hosting.

A sibling `../server/` directory (Express + SQLite) still exists in the repo but is **dead code** — nothing in `client/` calls it, it predates the Firebase migration, and it can be deleted without affecting the app. Don't extend it; if email sending (see below) ever gets built, it'll be a serverless function, not this Express server.

Three legacy component files (`src/components/Header.jsx`, `Sidebar.jsx`, `UserMenu.jsx`) are also unused leftovers from before the `Pulse*` rename — the active header/sidebar are `PulseHeader.jsx`/`PulseSidebar.jsx`. Don't edit the `Header`/`Sidebar`/`UserMenu` trio expecting it to affect the running app.

## Commands

Run from `client/`:

```
npm run dev       # start Vite dev server (default port 5173)
npm run build     # production build
npm run preview   # preview the production build (port 4173) — needed to exercise the PWA/service worker
npm run lint      # oxlint
npm run test      # node --test on src/taskUtils.test.js (the only client test file)
```

**Testing** uses Node's built-in runner (`node --test`), not Jest/Vitest. Only `taskUtils.js` (pure filter/recurrence/priority logic) is covered. UI components and the Firebase data-access layer (`firebase.js`) are not unit-tested — verify Firestore-touching changes by hand in the browser (or Claude-in-Chrome) against the real project, since there's no emulator wired up.

### Deploying

Run from the **repo root** (`../`), not `client/`:

```
firebase deploy --only hosting          # publish client/dist to manager-de-tareas.web.app
firebase deploy --only firestore:rules  # publish firestore.rules
```

Deploys are **manual** — there is no CI/CD. A GitHub Actions auto-deploy config exists locally (`firebase init hosting:github` output) but is deliberately gitignored and not wired to a GitHub secret; don't re-enable it without asking. `npm run build` must be run in `client/` before `firebase deploy --only hosting` picks up fresh output (`firebase.json`'s `hosting.public` points at `client/dist`).

**Cache headers matter here.** `firebase.json` sets `Cache-Control: no-cache` on `index.html`, `sw.js`, and `manifest.webmanifest`, and `public, max-age=31536000, immutable` on `/assets/**`. This is load-bearing: Vite content-hashes filenames under `/assets/`, so those can be cached forever, but `index.html` (which references the current hashed filenames) and the service worker must always be revalidated — otherwise a deploy can take up to an hour to reach returning visitors who cached the old `index.html` under a looser policy. If you ever touch `firebase.json`, keep this split.

## Architecture

**Single-component state, no router, no state library.** `src/App.jsx` owns essentially all application state (auth, tasks, settings, selection, modals, theme, view, toasts) via `useState`/`useEffect` and passes callbacks down as props to presentational components in `src/components/`. There is no Redux/Zustand/Context — if you need shared state, it goes in `App.jsx` and gets threaded through props.

**Two parallel data paths for tasks — registered vs. guest.** Every task-mutating handler in `App.jsx` branches on `user?.isGuest`:
- **Registered users**: state is Firestore-backed, real-time. A `subscribeUserTasks(user.uid, ...)` `onSnapshot` listener (wired in a `useEffect` keyed on `user`) keeps `allTasks` in sync automatically — mutation handlers just call the Firestore write and let the listener update the UI; they do **not** also update local state by hand (that used to be a bug — see the note on task paths below).
- **Guests**: state lives entirely in the `guestTasks` array (seeded from `DEFAULT_GUEST_TASKS`), mutated in-memory. Nothing touches Firebase. The guest *identity* (`gmail_task_guest_user`) is `sessionStorage`-only and is cleared on logout/tab close, as intended — but `guestTasks` itself is mirrored to **`localStorage`** (`gmail_task_local_tasks`) and that key is never cleared on logout. In practice guest task data quietly survives across guest sessions and browser restarts, even though the guest login screen implies a fresh start each time. Don't assume guest data is ephemeral when debugging.

**Firestore data model — everything lives under `users/{uid}/…`.** `firestore.rules` (repo root) only grants access to `match /users/{userId}/{document=**}` for `request.auth.uid == userId`, and denies everything else by default. `src/firebase.js` mirrors this exactly:
- Tasks: `users/{uid}/tasks/{taskId}` (`subscribeUserTasks`, `addFirebaseTask`, `updateFirebaseTask`, `deleteFirebaseTask`, `batchApplyFirebaseAction`, `exportUserBackup`/`importUserBackup`).
- Settings: `users/{uid}/settings/main` (`getUserSettings`, `updateUserSettings`).

**Do not add a top-level/flat collection for tasks (e.g. a bare `tareas` collection).** An earlier version did exactly that — it bypassed the per-user rule structure entirely, so every read/write was silently permission-denied (infinite "loading" state, no console error) and, had the rules ever been loosened to allow it, would have leaked every user's tasks to every other user. Always write task/setting paths through `users/{uid}/...`, and pass `user.uid` (never `user.username` or `user.email`) as the id segment.

**Filtering / recurrence / priority logic lives in `src/taskUtils.js`.** `filterByTab`/`filterByCategory`/`filterBySearch`/`filterTasks`, `advanceDueDate`/`advanceRecurringTasks`, `getEffectivePriority`/`compareTasksByUrgency`, `getTodayStr`/`dateStrDaysFromToday`. Used for both the guest in-memory path and the registered/Firestore path (post-snapshot), so a sidebar badge count can never disagree with the visible list. There is no server-side copy anymore — `taskUtils.js` is the single source of truth.

**Two independent view concerns — don't conflate them.** `currentTab` (sidebar selection: `inbox`/`pending`, `starred`, `scheduled`, `today`, `week`, `overdue`, `completed`, `trash`) drives **which tasks are visible**, via `filterByTab`. `activeView` (`'matrix' | 'list' | 'calendar' | 'stats'`, also settable from the sidebar and from the mobile bottom nav) drives **which top-level screen renders**: `MatrixView` (Eisenhower 2×2 quadrant board, the default/primary view — this is the "Pulse Matrix" branding), `TaskList`, `CalendarView` (month grid; clicking a day opens the composer prefilled via `TaskModal`'s `initialDate`), or `StatsDashboard` (completion ring, category/priority bars, next-7-days, all computed client-side from `visibleAllTasks`). These two states are orthogonal — e.g. you can be on the `starred` tab while viewing `calendar`.

**Tasks carry subtasks.** Each task may have `subtasks: [{ id, text, done }]`, edited in `TaskModal`, shown as a `done/total` progress badge in `TaskItem`/`MatrixView` cards.

**Bulk selection + batch action.** `App.jsx` holds `selectedIds` (a `Set`), cleared whenever the visible set changes (tab/category/search). `batchApplyFirebaseAction(uid, ids, action, value)` applies one action (`done`/`pending`/`trash`/`restore`/`category`/`delete`) to many ids in a single Firestore batch write; the guest path mutates `guestTasks` in memory the same way. `TaskList`/`MatrixView` render a contextual bulk-action bar.

**Keyboard shortcuts.** A global `keydown` listener in `App.jsx`: `c` compose, `/` focus search (`id="task-search-input"`), and a `g`-then-initial chord to jump views. Ignored while typing in a field or when any modal is open.

**Mobile layout is a separate nav surface, not a responsive reflow of the desktop sidebar.** Below the `860px` breakpoint (`src/index.css`), a Gmail-style bottom nav bar (`.mobile-bottom-nav`, 4 buttons wired to `setActiveView`) and a floating compose button (`.mobile-fab-btn`, opens `TaskModal`) appear; `PulseSidebar` becomes an off-canvas drawer (`isSidebarOpen`/`onToggleSidebar` from `PulseHeader`) instead of disappearing. If you add a new `activeView`, wire it into both `PulseSidebar`'s desktop switcher and the `.mobile-nav-item` buttons in `App.jsx`, or mobile users will have no way to reach it.

**Auth is real Firebase Auth**, email/password only (no Google sign-in — it was deliberately removed). `loginWithEmail`/`registerWithEmail`/`resetUserPassword` (`src/firebase.js`) wrap `signInWithEmailAndPassword`/`createUserWithEmailAndPassword`/`sendPasswordResetEmail`; `Login.jsx` has a "¿Olvidaste tu contraseña?" link that calls `resetUserPassword` and shows Firebase's own password-reset email flow (no custom email template involved). `translateFirebaseError` maps Firebase's `err.code` values to Spanish messages — add new codes there rather than showing raw Firebase error text. Session restore on reload goes through `subscribeAuth` (`onAuthStateChanged`), not just the `localStorage` cache, so login survives across devices, not only reloads. A registered-user record cached from before the Firebase migration (no `uid` field) is treated as invalid and discarded on load.

**Notifications are browser-only right now.** The `Notification` API path (client-side, gated on permission, polled every 10s against `settings.scheduledTime`) works normally. **Automatic email sending is intentionally deferred** — `EmailPreviewModal`/`emailTemplate.js` still generate a full HTML preview of the daily summary client-side, but the "Enviar por Gmail Ahora" action just tells the user it isn't available yet. Shipping it needs a serverless function (Vercel/Firebase Cloud Function) to hold the Gmail app-password server-side; `server/mailer.js` (legacy) has reusable HTML-generation logic if that gets picked back up.

**Theming** is CSS-variable-based light/dark: `App.jsx` sets `data-theme` on `<html>` and persists the choice (`localStorage`, and to `users/{uid}/settings/main` for registered users); variables are in `src/index.css` under `:root` (light) and `[data-theme="dark"]` (dark). Avoid hardcoded hex colors — use `var(--gmail-*)`.

**Styling is inline `style={{}}` objects throughout components** (aside from `lucide-react` icons, badge/pill classes, and the mobile-nav/FAB classes in `index.css`). Follow this pattern rather than introducing CSS modules or a component library. Keyboard focus is restored via a global `:focus-visible` rule.

**Modals share an accessibility hook.** `src/useModalA11y.js` gives every dialog (`TaskModal`, `SettingsModal`, `EmailPreviewModal`, `ProfileModal`) Escape-to-close, a focus trap, focus-on-open, and focus-restore-on-close. Wire it with `role="dialog"`, `aria-modal`, an `aria-label`, and `tabIndex={-1}` on the dialog container.

**Not installable, but still a service-worker-cached app.** The app deliberately has **no `<link rel="manifest">`** in `index.html` (and no `apple-mobile-web-app-*` meta tags) — installability/"Add to Home Screen" was intentionally removed. `client/public/manifest.webmanifest` and the icon files are still present on disk but unlinked/orphaned; don't re-add the manifest `<link>` without checking this is still wanted. The service worker (`sw.js`) stays regardless — it registers only in production (`main.jsx`, guarded by `import.meta.env.PROD`), so offline/fast-load behavior is exercised with `npm run build && npm run preview`, not the dev server. `sw.js` is network-first for navigations, stale-while-revalidate for other same-origin GETs, and ignores cross-origin requests (Firebase's own domains) entirely. See the cache-headers note under Deploying — the SW's network-first strategy only works if `index.html` itself isn't being served stale by Hosting/the browser HTTP cache.

**Dates are local, not UTC.** Use `getTodayStr`/date helpers in `taskUtils.js`, which derive `YYYY-MM-DD` from local date components. Do **not** use `new Date().toISOString().slice(0,10)` for "today" — that's UTC and flips the day at a non-midnight local hour, breaking due-today, recurrence, and the scheduled filter.

**Search is debounced.** `searchQuery` updates instantly (UI + in-memory counts), but `debouncedSearch` (300ms) is what the guest-path filter and any future server-style fetch would key off of.

## Language

UI strings, toast messages, and comments in existing code are in Spanish. Match this when adding user-facing text.
