# MyTerm

A study companion for tasks, timetable and focus sessions, built with React 19,
Vite, TypeScript, Convex and Convex Auth.

## Features

- **Tasks** — projects, sub-tasks, categories, due dates and drag reordering.
- **Timetable** — import university iCal feeds and generate catch-up tasks for
  missed lectures.
- **Pomodoro** — timer and stopwatch with persisted, cross-tab state.

Hosted as static content on GitHub Pages. Guest mode stores everything in the
browser with no account required.

## Development

```bash
npm install
npm run dev:all      # convex dev + vite
npm run build        # typecheck + production build
npm run lint
```

See `AGENTS.md` for the architecture, conventions and verification checklist.
