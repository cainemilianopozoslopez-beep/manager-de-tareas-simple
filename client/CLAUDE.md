# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project overview

This is the React frontend for **Gmail Task Manager**, a task manager UI styled after Gmail. It is one half of a two-part app: this `client/` directory (Vite + React) and a sibling `../server/` directory (Express + JSON file storage) that must run simultaneously in development. There is no monorepo tooling (no workspaces) — the two apps are just adjacent folders, coordinated by scripts in `../package.json`. The client is also an installable **PWA** (see the PWA section).

## Commands

Run from `client/`:

```
npm run dev       # start Vite dev server (default port 5173)
npm run build     # production build
npm run preview   # preview the production build (port 4173) — needed to exercise the PWA/service worker
npm run lint      # oxlint
npm run test      # node --test on the pure-logic modules (no framework)
```

To run the full stack, from the repo root (`../`):

```
npm run server    # node server/index.js, listens on :5000
npm run client    # equivalent to `npm --prefix client run dev`
npm test          # runs both server and client test suites
```

Both the client and server must be running for the app to work — the client is hardcoded to call the backend at `http://localhost:5000`, not a proxied or relative path.

**Testing** uses Node's built-in runner (`node --test`), not Jest/Vitest — there is no test framework dependency. Tests cover the pure modules: `server/auth.test.js`, `server/taskFilters.test.js`, and `client/src/taskUtils.test.js`. UI components are not unit-tested.

## Architecture

**Single-component state, no router, no state library.** `src/App.jsx` owns essentially all application state (auth, tasks, settings, selection, modals, theme, toasts) via `useState`/`useEffect` and passes callbacks down as props to presentational components in `src/components/`. There is no Redux/Zustand/Context — if you need shared state, it goes in `App.jsx` and gets threaded through props. Several handlers (`fetchTasks`, `fetchSettings`, `showToast`, the notification callbacks) are wrapped in `useCallback` so they are stable dependencies for the effects that use them.

**Two parallel data paths for tasks — registered vs. guest.** Every task-mutating handler in `App.jsx` branches on `user?.isGuest`:
- **Registered users**: state is server-backed. Handlers `fetch()` the Express API (`API_BASE = 'http://localhost:5000/api'`), then call `fetchTasks()` to re-pull. No optimistic updates (except bulk selection, which clears eagerly).
- **Guests**: state lives entirely in the `guestTasks` array (seeded from `DEFAULT_GUEST_TASKS`), mutated in-memory and mirrored to `sessionStorage`. Nothing touches the network. Guest data is wiped on logout/tab close by design.

**Filtering / recurrence / priority logic is centralized per runtime, and mirrored across the two.** Rather than inlining these at each call site, they live in one module per side:
- Client: `src/taskUtils.js` — `filterByTab`/`filterByCategory`/`filterBySearch`/`filterTasks`, `advanceDueDate`/`advanceRecurringTasks`, `getEffectivePriority`/`compareTasksByUrgency`, `getTodayStr`/`dateStrDaysFromToday`.
- Server: `server/taskFilters.js` (filtering) and `server/db.js` (recurrence) and `server/mailer.js` (effective priority).

The client (ESM) and server (CommonJS) can't share one file, so the two copies are kept identical **by convention** — if you change filter/recurrence/priority semantics on one side, change the other. The client uses these helpers in the guest `fetchTasks` branch *and* in the sidebar `counts`, so a badge can never disagree with the list.

**Tab filters include smart views.** `filterByTab` handles `inbox`/`pending`, `starred`, `scheduled` (future-dated), `completed`, `trash`, plus **`today`** (due today), **`week`** (due within the next 7 days), and **`overdue`** (past-due, not done). Date-oriented tabs keep chronological order; other tabs sort most-urgent-first (`compareTasksByUrgency`).

**The main area is a view switch, not always the task list.** `currentTab` also selects two tool views that replace `TaskList`: `'stats'` → `StatsDashboard` (completion ring, category/priority bars, next-7-days — all computed client-side from `visibleAllTasks`, with every bar directly labeled so color is never the sole identity channel) and `'calendar'` → `CalendarView` (month grid; clicking a day opens the composer prefilled with that date via TaskModal's `initialDate` prop, clicking a task opens the editor). These two sidebar items carry no count badge.

**Tasks carry subtasks.** Each task may have `subtasks: [{ id, text, done }]`. The server sanitizes them (`sanitizeSubtasks` in `index.js`) on create/update. `TaskModal` edits them; `TaskItem` shows a `done/total` progress badge.

**Bulk selection + batch endpoint.** `App.jsx` holds `selectedIds` (a `Set`), cleared whenever the visible set changes. `PATCH /api/tasks/batch` applies one action (`done`/`pending`/`trash`/`restore`/`delete`/`category`) to many ids in a single atomic write; the guest path mutates in memory. `TaskList` renders a contextual bulk-action bar.

**Keyboard shortcuts.** A global `keydown` listener in `App.jsx`: `c` compose, `/` focus search (the Header search input has `id="task-search-input"`), and a `g`-then-initial chord to jump views (i/h/v/s/d/p/c/b). Ignored while typing in a field or when any modal is open.

**Auth is not token-based, but the login password is hashed.** There's no JWT/session cookie; every "authenticated" API call is unauthenticated at the HTTP level. However, the single login password is stored **scrypt-hashed** (`server/auth.js`, using Node's built-in `crypto` — no dependency). `verifyPassword` falls back to a plaintext compare for legacy records, and `runMaintenance` upgrades a legacy plaintext password to a hash on startup. **`settings.senderPass` (the Gmail app password) is deliberately NOT hashed** — nodemailer needs the real value for SMTP. **CORS is restricted** to the local dev/preview origins (`5173`/`5174`/`4173`/`4174`) in `index.js`; there's no request-level auth, so don't widen it.

**Backend is a single-user SQLite database** (`server/data.db`), via Node's built-in **`node:sqlite`** (`DatabaseSync`) — no external dependency, no native build. WAL mode is on. `server/db.js` exposes **granular, per-row operations** (`getAllTasks`, `getTaskById`, `createTask`, `updateTask`, `deleteTaskById`, `emptyTrash`, `batchAction`, `getUser`/`updateUser`, `getSettings`/`updateSettings`, `getBackup`/`restoreBackup`, `runMaintenance`) — there is no whole-object read/write, so concurrent mutations can't lost-update each other. Multi-row operations (`batchAction`, `restoreBackup`) run in a transaction.
- **Storage shape**: booleans are `INTEGER` 0/1, `subtasks` is a JSON string column — the row↔object mappers in `db.js` convert both. `updateTask`/`updateUser`/`updateSettings` merge only the *defined* fields of their argument (so a partial PUT/PATCH touches nothing else).
- **First-run migration**: on a fresh DB, `db.js` imports a legacy `server/data.json` if present (preserving the hashed password and all tasks), else seeds defaults. `data.json` is no longer written to — it's kept only as the migration source / fallback.
- **Upkeep** — recurring-task roll-forward and password-hash migration — happens in **`runMaintenance()`**, called at startup and once per cron minute (never on a plain read).
- **Testing** points `db.js` at a throwaway DB via the `GTM_DB_PATH` env var (see `server/db.test.js`).
- The experimental-SQLite startup warning is silenced with `--disable-warning=ExperimentalWarning` in the `server`/`start`/`test` scripts.

**Dates are local, not UTC.** Use `getLocalDateStr` (`server/dateUtils.js`) and `getTodayStr` (`client/src/taskUtils.js`), which derive `YYYY-MM-DD` from local date components. Do **not** use `new Date().toISOString().slice(0,10)` for "today" — that's UTC and makes the day flip at a non-midnight local hour in any offset zone (e.g. 18:00 at UTC-6), breaking due-today, recurrence, the scheduled filter, and the daily-summary dedupe.

**Search is debounced.** The search input updates `searchQuery` (instant UI + instant in-memory counts), but the task fetch runs off `debouncedSearch` (300 ms), so registered users don't fire a request per keystroke.

**Theming** is CSS-variable-based light/dark mode: `App.jsx` sets `data-theme` on `<html>` and persists the choice; variables are in `src/index.css` under `:root` (light) and `[data-theme="dark"]` (dark). Registered users also persist theme via `PUT /api/user/profile`. **Avoid hardcoded hex colors** — use `var(--gmail-*)` so both themes work (native date/time/select controls get `color-scheme: dark` under the dark theme).

**Styling is inline `style={{}}` objects throughout components** (aside from `lucide-react` icons and the badge/pill classes in `index.css`). Follow this pattern rather than introducing CSS modules or a component library. Keyboard focus is restored via a global `:focus-visible` rule (the default outline is removed app-wide).

**Modals share an accessibility hook.** `src/useModalA11y.js` gives every dialog (`TaskModal`, `SettingsModal`, `EmailPreviewModal`, `ProfileModal`) Escape-to-close, a focus trap, focus-on-open, and focus-restore-on-close. Wire it with `role="dialog"`, `aria-modal`, an `aria-label`, and `tabIndex={-1}` on the dialog container.

**Notifications are dual-channel**: browser `Notification` API (client-side, gated on permission, polled every 10s against `settings.scheduledTime`) and email summaries (server-side, `server/mailer.js` + nodemailer, on-demand via `POST /api/send-summary` or by a `node-cron` job in `index.js` firing every minute). The client interval and the cron deliberately mirror the scheduled-time comparison for the two notification modes ('browser' vs 'gmail'/'both').

**PWA.** `client/public/` holds `manifest.webmanifest`, a dependency-free `sw.js`, and generated icons (`icon-192.png`, `icon-512.png`, `apple-touch-icon.png`). The service worker is **registered only in production** (`main.jsx`, guarded by `import.meta.env.PROD`) to avoid fighting Vite HMR — so PWA/offline behavior is exercised with `npm run build && npm run preview`, not the dev server. The SW is network-first for navigations/assets, precaches the app shell for offline load, and **ignores the API origin** (`:5000`) so backend calls always hit the network.

## Language

UI strings, toast messages, and comments in existing code are in Spanish. Match this when adding user-facing text.
