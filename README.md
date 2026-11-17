# Time Tracker

A desktop-oriented, local web app for tracking time by task and project. The app runs on this computer and stores its database in the current user's application-data folder.

## Run locally

Requirements: Node.js 22.12 or later and npm.

```powershell
npm install
npm run dev
```

Open the local address printed by Vite (normally `http://127.0.0.1:5173`). To run the production build locally:

```powershell
npm run build
npm start
```

The production server listens on `http://127.0.0.1:3001`.

## Data and tracking rules

- The SQLite database is stored at `%APPDATA%\time-tracker\time-tracker.sqlite` on Windows, `~/Library/Application Support/time-tracker/time-tracker.sqlite` on macOS, or `~/.local/share/time-tracker/time-tracker.sqlite` on Linux.
- Set `APP_DATA_DIR` to use a different local data directory.
- Back up the database while the app is stopped by copying `time-tracker.sqlite` to another location.
- The tracking day runs from 4:00 AM to 3:59 AM in the computer's local time zone.
- Start and stop times are recorded to the minute. Segments lasting one minute or less are discarded; longer segments are shown as `HH:MM`.
- There can be only one running task. Switching tasks closes one segment and starts another; pause/resume also creates separate segments.
- Tasks are independent definitions: every task is available under every project. The app records the many-to-many task/project relationship as soon as a task is tracked with that project.
- Time entries record their task and selected project when tracking starts. An entry crossing 4:00 AM remains attributed to the tracking day it started in.
- The database retains earlier entries, but this initial version only displays the current tracking day's totals and does not include history browsing.
- Use **Generate PDF timesheet** in the daily summary to download today's task totals grouped by project, project totals, task totals across projects, and a chronological list of entries with start/end times and durations. The report includes a currently running entry when it has exceeded one minute.

Run the focused persistence and timer tests with:

```powershell
npm test
```