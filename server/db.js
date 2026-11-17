import Database from "better-sqlite3";

export function createDatabase(databasePath = ":memory:") {
  const db = new Database(databasePath);
  db.pragma("foreign_keys = ON");
  if (databasePath !== ":memory:") {
    db.pragma("journal_mode = WAL");
    db.pragma("busy_timeout = 5000");
  }

  db.exec(`
    CREATE TABLE IF NOT EXISTS projects (
      id INTEGER PRIMARY KEY,
      name TEXT NOT NULL CHECK (length(trim(name)) BETWEEN 1 AND 50),
      is_builtin INTEGER NOT NULL DEFAULT 0 CHECK (is_builtin IN (0, 1))
    );

    CREATE TABLE IF NOT EXISTS tasks (
      id INTEGER PRIMARY KEY,
      name TEXT NOT NULL CHECK (length(trim(name)) BETWEEN 1 AND 50)
    );

    CREATE TABLE IF NOT EXISTS task_projects (
      task_id INTEGER NOT NULL REFERENCES tasks(id) ON DELETE RESTRICT,
      project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE RESTRICT,
      PRIMARY KEY (task_id, project_id)
    );

    CREATE TABLE IF NOT EXISTS time_entries (
      id INTEGER PRIMARY KEY,
      task_id INTEGER NOT NULL REFERENCES tasks(id) ON DELETE RESTRICT,
      project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE RESTRICT,
      start_minute INTEGER NOT NULL,
      end_minute INTEGER,
      CHECK (end_minute IS NULL OR end_minute >= start_minute)
    );

    CREATE UNIQUE INDEX IF NOT EXISTS one_open_time_entry
      ON time_entries ((1)) WHERE end_minute IS NULL;

    CREATE TABLE IF NOT EXISTS timer_state (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      status TEXT NOT NULL CHECK (status IN ('idle', 'running', 'paused')),
      task_id INTEGER REFERENCES tasks(id) ON DELETE RESTRICT,
      project_id INTEGER REFERENCES projects(id) ON DELETE RESTRICT,
      elapsed_minutes INTEGER NOT NULL DEFAULT 0
    );
  `);

  const timerStateColumns = db.pragma("table_info(timer_state)");
  if (!timerStateColumns.some((column) => column.name === "elapsed_minutes")) {
    db.exec(`
      ALTER TABLE timer_state
      ADD COLUMN elapsed_minutes INTEGER NOT NULL DEFAULT 0
    `);
  }

  db.prepare(`
    INSERT OR IGNORE INTO projects (id, name, is_builtin)
    VALUES (1, 'No Project', 1)
  `).run();
  db.prepare(`
    INSERT OR IGNORE INTO timer_state (id, status, task_id, project_id)
    VALUES (1, 'idle', NULL, NULL)
  `).run();

  return db;
}
