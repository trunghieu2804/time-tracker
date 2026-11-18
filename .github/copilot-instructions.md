# Time Tracker project instructions

## Architecture
- This is a local-only React 19 and TypeScript application. Express 5 exposes the JSON API and better-sqlite3 owns persistence.
- Keep the stack local and loopback-only: the API binds to `127.0.0.1`, and the development Vite server proxies `/api` to port `3001`.
- Put shared API/UI types in `shared/types.ts`. Keep browser/server shapes synchronized when changing an endpoint or response.
- Put SQLite schema and initialization in `server/db.ts`, business rules and timer transitions in `server/store.ts`, route/error handling and static serving in `server/app.ts`, and process/database startup in `server/index.ts`.
- Put React components and API calls in `src/main.tsx`, PDF generation in `src/timesheet.ts`, and tracking-day and minute rules in `server/time.ts`.

## Time-tracking invariants
- Preserve the local 4:00 AM to 3:59 AM tracking day. A segment belongs to the tracking day in which it starts.
- Store time in integer minutes. Completed segments of one minute or less are discarded.
- Maintain at most one open `time_entries` row and one active timer state.
- Preserve start, switch, pause, resume, and end behavior transactionally. Pause closes the open entry and resume opens a new, non-overlapping entry.
- Preserve project/task independence: task definitions are reusable across projects, while each tracked entry stores its task and project IDs.
- The built-in `No Project` project has ID `1` and must remain protected from rename and delete.
- Names must be trimmed, non-empty, and at most 50 characters.
- Block deletion of projects or tasks that have tracked time or participate in a paused/active timer.

## Coding conventions
- Use strict TypeScript and ESM/NodeNext module resolution. Relative TypeScript imports use `.js` suffixes (for example `./store.js`) even though the source file is `.ts`.
- Store methods should accept untrusted values as `unknown`, validate them, and throw `AppError` for expected client errors. Do not put validation or business rules only in route handlers or React.
- Keep the Express error response shape `{ error: "..." }`. Preserve appropriate 4xx statuses and return a generic 500 message for unexpected failures.
- Use existing database transaction and prepared-statement patterns in `server/store.ts`. Keep foreign-key and partial-index behavior intact.
- Preserve both UI variants. Use `frameworkClass` in `src/main.tsx` and maintain the `tw:` Tailwind 4 prefix plus Bootstrap classes for the same controls.
- Persist the interface preference under `time-tracker-framework`.
- Do not edit generated `build/` or `dist/` output; change source and rebuild.
- Do not read or write the user's normal SQLite database in tests.

## Change workflow
- Update the schema, store, API contract, UI, and focused tests together when behavior crosses those boundaries.
- For focused changes, run `npm run typecheck` and the smallest relevant test command. Use `npm test` for the full suite before completion.
- Tests belong in `tests/unit/`, `tests/integration/`, `tests/components/`, and `tests/e2e/`. Use in-memory/temporary databases and injected clocks for deterministic behavior.
- Run `npm run build` after source changes that affect build output or when validating the production bundle.
- Start the app with `npm run dev`; use `npm run dev:api` or `npm run dev:web` only for isolated frontend/API work.
- Update `README.md` when user-facing behavior, setup, database behavior, or deployment instructions change.

## Running tests

Always run the complete test suite after completing a batch of code changes, to ensure the changes do not break or adversely affect any part of the application. Fix any test failures and then run the tests again to verify the fix.
