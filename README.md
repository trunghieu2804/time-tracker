# Time Tracker

Time Tracker is a local web application for keeping a clear record of how you spend your working day. Start a timer when you begin a task, switch or pause it as your work changes, and review the day's totals by task and project. Your data stays in a SQLite database on your computer.

## Features

- Create, rename, and delete projects and tasks. Names can be up to 50 characters.
- Reuse any task with any project; tasks are not tied to a single project.
- Start tracking with a click. Starting another task stops the current segment and begins the next one.
- Pause, resume, or end a timer. Only one task can run at a time.
- See today's time by task, by project, and by task/project combination.
- Download a PDF timesheet with those totals and a chronological list of tracked segments.
- Choose the Bootstrap 5 or Tailwind 4 interface style and toggle dark mode. Both preferences are saved in the browser.

## Use the application

### Start it on your computer

Requirements: Node.js 22.12 or later and npm.

1. Open a terminal in the project folder and install dependencies:

   ```powershell
   npm install
   ```

2. Start the local application:

   ```powershell
   npm run dev
   ```

3. Open the local address printed in the terminal (usually `http://127.0.0.1:5173`).

### Track your day

1. Select **Add project** to create a project, or use the built-in **No Project** option.
2. Select **Add task** to create a task. Tasks are available under every project.
3. Select a project, then click a task to start its timer.
4. Click another task to switch directly to it. While tracking, use **Pause**, **Resume**, or **End task** as needed. Selecting a different project while a timer is running switches the current task to that project.
5. Review the daily summary for totals by task, project, and task per project. Choose **Generate PDF timesheet** to download a report for the current tracking day.

You can edit an item using its **Edit** control. Deleting an item requires confirmation and is blocked when it is associated with tracked time or a paused timer. The built-in **No Project** item cannot be edited or deleted.

## Time and data behavior

- The tracking day runs from 4:00 AM to 3:59 AM in your computer's local time zone.
- Start and stop times are recorded to the minute. Completed segments lasting one minute or less are discarded; longer durations are displayed as `HH:MM`.
- A segment crossing 4:00 AM is attributed to the tracking day on which it started.
- Time is recorded for a specific task and project. The project is saved with each segment, so later project/task edits do not reassign the recorded time.
- The database retains earlier tracking data, but this version only displays today's totals and does not provide history browsing or statistics.
- A running segment is included in totals and in the PDF once it exceeds one minute.

The database is stored at:

| Operating system | Default database location |
| --- | --- |
| Windows | `%APPDATA%\time-tracker\time-tracker.sqlite` |
| macOS | `~/Library/Application Support/time-tracker/time-tracker.sqlite` |
| Linux | `~/.local/share/time-tracker/time-tracker.sqlite` |

Set `APP_DATA_DIR` to use a different directory. To back up or restore your data, stop the application first, then copy `time-tracker.sqlite` to or from a safe location.

## Admin: production deployment on a local computer

The production server serves the built web app and API from `http://127.0.0.1:3001`. It binds to the loopback interface, so it is intended for use on the same computer, not as a shared or public website. The application does not include user accounts or authentication; do not expose it directly to a network or the internet.

From a project checkout, run:

```powershell
npm ci
npm run build
npm start
```

Open `http://127.0.0.1:3001` in your browser. The production server requires the build output in `dist`; rebuild after changing the frontend.

You can select a different local port or database directory with environment variables. For example, in PowerShell:

```powershell
$env:PORT = "3010"
$env:APP_DATA_DIR = "$env:LOCALAPPDATA\TimeTrackerData"
npm start
```

On macOS or Linux, the equivalent is:

```sh
PORT=3010 APP_DATA_DIR="$HOME/.local/share/time-tracker" npm start
```

For an update, stop the running application, update the checkout, run `npm ci` and `npm run build`, then start it again. Database initialization runs when the server starts. Back up the database before upgrades; keep the app stopped while copying or restoring it.

If you need remote access, multiple users, or public hosting, this local-only configuration is not sufficient. Authentication, network binding, HTTPS, and an appropriate shared data design would need to be planned before deployment.

## Technology overview

- **Frontend:** React 19 and TypeScript, bundled and served during development by Vite.
- **Interface styling:** Bootstrap 5 and Tailwind CSS 4.
- **Backend:** Node.js with a TypeScript Express JSON API, compiled for production.
- **Persistence:** SQLite through `better-sqlite3`.
- **PDF export:** jsPDF with jsPDF-AutoTable.
- **Tests:** Node's built-in test runner, run through `tsx`; jsdom for component tests and Playwright with Chromium for end-to-end testing.

## Developer guide

### Work locally

```powershell
npm install
npm run dev
```

Vite serves the frontend and proxies `/api` requests to the local Express server. The development API listens on port `3001`.

### Build and test

```powershell
npm run typecheck
npm run build
npx playwright install chromium
npm test
```

Install the Playwright browser once per development environment. The test suite uses in-memory or temporary databases and does not touch the normal tracking database. `npm run typecheck` checks the TypeScript app, server, and tests. `npm run build` compiles the server to `build/` and bundles the frontend to `dist/`; `npm start` runs the compiled server.

Tests are organized by responsibility:

- `tests/unit/`: tracking-day rules, store behavior, database behavior, and PDF generation.
- `tests/integration/`: API endpoints and downloadable PDF responses.
- `tests/components/`: React modal and totals components.
- `tests/e2e/`: browser workflow from creating items through tracking time and downloading a timesheet.

### Code map and extension points

- `shared/types.ts` contains the data contracts shared between the browser and server.
- `server/db.ts` defines and initializes the SQLite schema.
- `server/store.ts` contains validation, CRUD operations, timer transitions, and daily totals.
- `server/time.ts` defines minute precision and the local 4:00 AM tracking-day boundary.
- `server/app.ts` maps HTTP routes to store operations and serves the production frontend.
- `server/index.ts` configures the local database directory and starts the server.
- `src/main.tsx` contains the React application and its interface components; `src/styles.css` and `src/frameworks.css` contain styles.
- `src/timesheet.ts` builds the PDF report.
- `vite.config.ts` configures the Vite development server and plugins.
- `tsconfig.json` enables strict type checking; `tsconfig.server.json` configures the production server build.

When extending a feature, keep its behavior consistent across the schema, store, API, and UI. Add or update focused tests in the matching `tests/` area, then run `npm test` and `npm run build`.
