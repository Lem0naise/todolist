# AGENTS.md

Guidance for AI agents (and humans) working on this repository. Keep changes
small, verify with `tsc` + `lint`, and follow the conventions below.

## 1. What this is

A single-page study companion ("unitrack") built with **React 19 + Vite +
TypeScript**, backed by **Convex** (serverless DB + functions) and
**Convex Auth** (password). Features:

- **To-do list** — tasks, projects with sub-tasks/progress, categories, due
  dates, drag reordering.
- **Timetable** — import university iCal feeds, per-day occurrence tracking,
  and auto-generated "catch-up" todos for missed lectures.
- **Pomodoro** — timer + stopwatch with persisted/restored state and cross-tab
  synchronisation.

Hosted as static content on **GitHub Pages** at `todo.indigo.spot` (`CNAME`).
Guest mode stores everything in `localStorage` with no auth/backend.

## 2. Commands

```bash
npm run dev:all      # convex dev + vite (preferred during development)
npm run dev          # vite only (frontend)
npm run dev:backend  # convex dev only
npm run build        # tsc -b && vite build  → dist/
npm run lint         # eslint .
npm run preview      # preview the production build
```

- There is **no test suite**. The verification gate is `npx tsc -b`,
  `npm run lint`, and `npm run build`.
- `convex/` has its own `tsconfig.json`; run `npx tsc -b` from the repo root to
  typecheck both projects.
- **Pre-existing lint errors** exist in `convex/moduleMatcher.ts`
  (`no-explicit-any`, 2 errors). These are expected; do not treat the lint
  command's non-zero exit as your change failing unless new errors point at
  files you touched.

### Backend deployment (critical)

Convex function signatures/argument validators are compiled into the running
deployment. If you change `convex/` and only run the frontend, the client can
send args the server rejects with `ArgumentValidationError: Object contains
extra field ...`. After any `convex/` edit, push the functions:

```bash
npx convex dev --once   # one-shot push, then exits
# or keep `npm run dev:all` running so edits hot-push
```

The dev deployment is configured in `.env.local` (git-ignored via `*.local`):

```
CONVEX_DEPLOYMENT=dev:...
VITE_CONVEX_URL=https://<deployment>.convex.cloud
VITE_CONVEX_SITE_URL=https://<deployment>.convex.site
```

Never commit secrets. CI (`.github/workflows/deploy.yml`) builds with
`VITE_CONVEX_URL` from a GitHub secret and deploys `dist/` to Pages.

## 3. Repository map

```
convex/                     Backend (deployed separately)
  schema.ts                 Data model — READ THIS FIRST
  todos.ts                  Todo CRUD, complete, reorder, sub-tasks, progress
  timetable.ts              Events: list, getForDate, getPreemptiveTodos, feeds
  occurrences.ts            Per-day occurrence state, convertToTodo, processMissedEvents
  icsImport.ts              "use node" action: fetch + parse iCal (timezone-aware)
  icsImportInternal.ts      Internal mutation that stores parsed ICS events
  modules.ts / moduleMatcher.ts  User modules + title→module pattern matching
  ignored.ts                Titles to hide and never generate todos for
  pomo.ts                   Pomodoro session CRUD + fixRounding
  auth.ts / auth.config.ts / http.ts  Convex Auth (Password provider)
  _generated/               Codegen — never edit by hand

src/
  main.tsx / App.tsx        Entry; App owns tab routing + the global pomo tick
  components/
    Auth.tsx, Nav.tsx, SettingsView.tsx
    home/                   CombinedView + SchedulePanel / TasksPanel / PanelCard
    todos/                  TodosView, TodoModal, TaskFocusModal, GroupSection,
                            TodoItem, SortableTodoItem, FilterBar,
                            CompletedSection, utils.tsx
    schedule/               TodayView, DayColumn, WeekNav, EventCard
    pomo/                   PomoView, PomoTimer, timerState, timerLeader,
                            SplashScreen, FloatingPomo, usePomoData
  hooks/                    useGuestMode, useGuestTodos, useGuestPomoSessions,
                            useLocalCache, useGroupCollapse
  lib/date.ts               Local-timezone date helpers (USE THESE)
  index.css                 Tailwind v4 theme tokens
```

## 4. Data model (`convex/schema.ts`)

All tables are scoped by `userId`.

- `timetableEvents` — `startTime`/`endTime` are wall-clock `"HH:MM"` strings;
  `dayOfWeek` 0=Sun..6=Sat; recurring uses `recurrenceStart`/`recurrenceEnd`,
  one-off uses `specificDate`; dates are `"YYYY-MM-DD"` strings.
- `occurrences` — per-day event state (`date`, `status` pending|done|todo,
  `todoId`).
- `todos` — `category` is `lecture_catchup` | `project` | `other` (undefined ⇒
  treated as `other`); `sourceOccurrenceId` marks an auto-generated catch-up.
- `pomoSessions` — `date`, `time`, `minutes`, `topic`.
- `icalFeeds`, `modules`, `ignoredEventTitles` — supporting tables.

## 5. Conventions

### Styling
- **Tailwind CSS v4**, configured in-code via `@theme` in `src/index.css`.
  Custom tokens: `cream`, `rose`, `lavender`, `mint`, plus base `--color-*`.
- **Gotcha:** a class naming a token that does not exist (e.g. `bg-mint-400`
  when only `mint-300/500` are defined) is silently dropped by Tailwind and the
  element renders unstyled — not an error. If a colour "doesn't work", check
  `src/index.css` first and add the missing token rather than guessing.
- Design language is soft/warm (cream backgrounds, rounded-xl/2xl, `font-hand`
  Caveat headings, `font-pomo` DynaPuff). Match surrounding markup.

### TypeScript
- `strict`, `noUnusedLocals`, `noUnusedParameters`, `verbatimModuleSyntax`.
  Use `import type { ... }` for type-only imports.
- Avoid `any` (lint error via `typescript-eslint`). Prefer precise types or
  `unknown` with narrowing.

### React
- Function components + hooks only. `react-hooks` recommended rules are on;
  avoid setting state directly in effects unless necessary (existing code
  occasionally uses `// eslint-disable-next-line react-hooks/set-state-in-effect`).
- Convex client hooks: `useQuery(api.<module>.<fn>, args)` /
  `useMutation(...)` / `useAction(...)`. `_generated/api` provides types.

### Comments
Comments are used sparingly, only to explain non-obvious *why* (e.g. timezone
anchors, cross-tab sync). Do not add narration-only comments.

## 6. Cross-cutting concerns (read before touching)

### Dates & timezones — `src/lib/date.ts`
- Data uses local calendar dates (`YYYY-MM-DD`). **Never** derive "today" with
  `new Date().toISOString().split("T")[0]` — that is UTC and shifts by a day for
  positive offsets (e.g. BST around midnight). Use `getTodayLocal()`,
  `formatLocalYmd()`, `addDaysLocal()`, `startOfWeekLocal()`.
- When parsing a date string to a `Date` for weekday/month maths, anchor at
  noon: `new Date(dateStr + "T12:00:00")` to avoid DST/midnight shifts.
- **ICS import (`convex/icsImport.ts`)** is timezone-aware: it honours `Z`
  (UTC) and `TZID` params and converts instants into the importing user's
  browser IANA timezone (passed as the `timezone` arg from `SettingsView`).
  Floating/date-only values are kept literal. If you change parsing, update the
  `importIcsUrl` validator **and** push the backend.

### Pomodoro cross-tab model
- `timerState.ts` holds the single in-memory `PomoTimer` instance and persists
  it to `localStorage["unitrack:pomo:timer"]` (exported as `PERSIST_KEY`).
  Persist happens **only on explicit transitions** (start, pause/resume, skip,
  break, phase edits, splash). Do **not** re-add a per-tick `persist()` — that
  causes one tab to resurrect a timer another tab has ended.
- `timerLeader.ts` uses the **Web Locks API** for single-writer election: one
  tab owns `"unitrack:pomo-owner"` for its lifetime and is the only tab that
  runs automatic phase completion + session saves (prevents duplicate saves).
  The lock auto-releases on tab close, promoting a waiting tab.
- `App.tsx` subscribes to `storage` events via `subscribeToTimerChanges()`:
  `null` ⇒ `clearTimer()` (ended elsewhere), otherwise `restoreTimer()` (adopt).
  This is what makes ending in one tab end it in all tabs.
- The global interval in `App.tsx` drives rendering everywhere but only the
  owner performs completion. The splash countdown/sound is owner-only.

### Guest mode
- `useGuestMode` provides `GuestContext` (`isGuest`). When guest, Convex is not
  used; `useGuestTodos` / `useGuestPomoSessions` persist to `localStorage`.
  Keep both paths working when changing todo/pomo features.
- `useLocalCache(key, liveData)` returns live Convex data when present and falls
  back to a previously cached localStorage copy otherwise (offline-ish UX).
- `useGroupCollapse` persists todo group collapse state to
  `localStorage["unitrack:group-prefs"]` for both guest and authenticated users
  (device-local, like the filter).

### Lecture → todo flow
- Clicking **Todo** on an event calls `occurrences.convertToTodo`, which creates
  a todo with `category: "lecture_catchup"`.
- `timetable.getForDate` returns a `linkedTodo` for todo'd occurrences. It must
  include **all** fields the edit modal needs (`category`, `subTasks`,
  `manualProgress`, `linkedEventId`, `moduleId`) — omitting `category` made the
  modal default to "other" and silently downgrade catch-ups. Keep this in sync
  with `LinkedTodo` types in `schedule/TodayView.tsx`,
  `schedule/EventCard.tsx`, and `home/SchedulePanel.tsx`.
- `processMissedEvents` (called from `App.tsx` once per local day) auto-creates
  catch-up todos for past unresolved occurrences.

## 7. Verification checklist

Before declaring a task done:

1. `npx tsc -b` — no errors (frontend + `convex/`).
2. `npm run lint` — no **new** errors (see pre-existing `moduleMatcher.ts` ones).
3. `npm run build` — succeeds.
4. If `convex/` changed: `npx convex dev --once` to push the backend.
5. Manually reason through guest vs authenticated and single- vs multi-tab for
   pomo changes.

## 8. Git workflow

- Only create commits when explicitly asked. Never commit secrets (`.env.local`).
- Do not touch `convex/_generated/` — it is regenerated by the Convex CLI.
- Keep diffs focused; follow the existing component/styling patterns rather than
  introducing new libraries (the only date-related dep is `date-fns`, currently
  unused; prefer `src/lib/date.ts`).
