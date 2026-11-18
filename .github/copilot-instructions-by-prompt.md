# Copilot instructions

## Architecture and data flow
- This is a local-only time tracker: React 19 + TypeScript UI, Express 5 JSON API, SQLite persistence, and jsPDF export.
- `src/main.tsx` contains the UI and its API client. On load it fetches `GET /api/bootstrap`; mutations call `/api/projects`, `/api/tasks`, or `/api/timer/:action`, then refresh bootstrap data.
- `server/app.ts` maps API routes to the store and serves `dist/` only in production. `server/index.ts` selects the local data directory, opens SQLite, and binds to `127.0.0.1`; do not change this into a public service without adding an appropriate security design.
- `server/store.ts` owns validation, CRUD, timer transitions, and daily totals. Keep business rules here rather than in route handlers or React.
- `server/db.ts` defines/initializes the SQLite schema. Projects and tasks are independent; `task_projects` links task/project pairs when time is recorded, and each `time_entries` row stores the selected task/project IDs so later edits do not reassign time.
- SQLite enforces one open time entry with a partial unique index. `timer_state` represents idle/running/paused status; pause closes a segment and resume opens a new one.
- `server/time.ts` uses local time and a 4:00 AM tracking-day boundary. Entries belong to the day they started; completed segments of one minute or less are discarded.
- `shared/types.ts` is the browser/server contract. Update it alongside changes to API/store response shapes.
- `GET /api/timesheet.pdf` uses the store’s report data and `src/timesheet.ts` to produce the downloadable PDF.
- Vite serves the UI on `127.0.0.1:5173` and proxies `/api` to the development API on port `3001` (`vite.config.ts`).

## Project conventions
- TypeScript is strict and ESM (`package.json`, `tsconfig.json`). Use `.js` extensions in relative TS imports to match NodeNext output (for example `server/app.ts` imports `./store.js`).
- Store methods accept untrusted values as `unknown` and raise `AppError` for expected client errors. `server/app.ts` maps these to JSON `{ error }` responses; unexpected server errors are logged and returned as generic 500s.
- Timer operations are transactional. Preserve a single active timer, validate IDs before opening entries, and keep start/switch/pause/resume/end transitions consistent with `tests/unit/store.test.ts`.
- The built-in “No Project” has ID `1` and cannot be renamed or deleted. Names are trimmed, required, and limited to 50 characters.
- The UI supports Bootstrap and Tailwind variants in the same components. `src/main.tsx` selects paired classes via `frameworkClass`; Tailwind utilities use the `tw:` prefix configured in `src/frameworks.css`. Persist the preference under `time-tracker-framework`.
- The frontend is currently organized in `src/main.tsx`; shared visual rules live in `src/styles.css`. Follow these patterns when making focused UI changes.

## Developer workflows and tests
- Use Node.js `>=22.12`. Install dependencies with `npm install` (or `npm ci` for a clean install).
- `npm run dev` starts the API and Vite together; `npm run dev:api` and `npm run dev:web` can be run separately.
- `npm run typecheck` checks app, server, shared code, and tests. `npm run build` compiles the server to `build/` and bundles the UI to `dist/`; `npm start` runs the built local app.
- `npm test` runs the Node test suite through `tsx`. Install the Playwright browser once with `npx playwright install chromium` for end-to-end tests.
- Tests use in-memory SQLite, temporary directories, injected clocks, and loopback ephemeral ports; they should not access the user’s normal database. Store rules belong in `tests/unit/`, HTTP behavior in `tests/integration/`, components in `tests/components/`, and full browser flows in `tests/e2e/`.
- For timer/date behavior, inject `now` into `createStore` and use local-time fixtures as in `tests/unit/store.test.ts`; avoid tests that depend on the wall clock.
- The README documents database locations, data behavior, deployment, and additional workflows; update it when user-facing behavior or operational instructions change.
