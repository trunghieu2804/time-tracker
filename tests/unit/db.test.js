import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import Database from "better-sqlite3";
import test from "node:test";
import { createDatabase } from "../../server/db.js";

function temporaryDirectory() {
  return mkdtempSync(path.join(os.tmpdir(), "time-tracker-db-"));
}

test("creates required tables, seeds defaults, and enforces database constraints", (t) => {
  const db = createDatabase();
  t.after(() => db.close());

  assert.equal(db.pragma("foreign_keys", { simple: true }), 1);
  assert.deepEqual(
    db.prepare("SELECT id, name, is_builtin FROM projects").all(),
    [{ id: 1, name: "No Project", is_builtin: 1 }],
  );
  assert.deepEqual(
    db.prepare("SELECT status, elapsed_minutes FROM timer_state WHERE id = 1").get(),
    { status: "idle", elapsed_minutes: 0 },
  );
  assert.throws(
    () => db.prepare("INSERT INTO tasks (name) VALUES (?)").run(" ".repeat(2)),
    /CHECK constraint failed/,
  );
  assert.throws(
    () => db.prepare("INSERT INTO tasks (name) VALUES (?)").run("x".repeat(51)),
    /CHECK constraint failed/,
  );
  assert.throws(
    () => db.prepare("INSERT INTO time_entries (task_id, project_id, start_minute) VALUES (99, 1, 10)").run(),
    /FOREIGN KEY constraint failed/,
  );
});

test("database files preserve projects, tasks, entries, and timer state across reopen", (t) => {
  const directory = temporaryDirectory();
  const databasePath = path.join(directory, "persistent.sqlite");
  const first = createDatabase(databasePath);
  const project = first.prepare("INSERT INTO projects (name) VALUES ('Work')").run();
  const task = first.prepare("INSERT INTO tasks (name) VALUES ('Planning')").run();
  first.prepare("INSERT INTO task_projects (task_id, project_id) VALUES (?, ?)")
    .run(task.lastInsertRowid, project.lastInsertRowid);
  first.prepare("INSERT INTO time_entries (task_id, project_id, start_minute, end_minute) VALUES (?, ?, 10, 25)")
    .run(task.lastInsertRowid, project.lastInsertRowid);
  first.prepare("UPDATE timer_state SET status = 'paused', task_id = ?, project_id = ?, elapsed_minutes = 15 WHERE id = 1")
    .run(task.lastInsertRowid, project.lastInsertRowid);
  first.close();

  const reopened = createDatabase(databasePath);
  t.after(() => {
    reopened.close();
    rmSync(directory, { recursive: true, force: true });
  });
  assert.equal(reopened.prepare("SELECT name FROM projects WHERE id = ?").get(project.lastInsertRowid).name, "Work");
  assert.equal(reopened.prepare("SELECT name FROM tasks WHERE id = ?").get(task.lastInsertRowid).name, "Planning");
  assert.deepEqual(
    reopened.prepare("SELECT start_minute, end_minute FROM time_entries").get(),
    { start_minute: 10, end_minute: 25 },
  );
  assert.deepEqual(
    reopened.prepare("SELECT status, elapsed_minutes FROM timer_state WHERE id = 1").get(),
    { status: "paused", elapsed_minutes: 15 },
  );
});

test("allows only one open time entry and rejects deleting referenced records", (t) => {
  const db = createDatabase();
  t.after(() => db.close());
  const task = db.prepare("INSERT INTO tasks (name) VALUES ('Research')").run();
  const project = db.prepare("INSERT INTO projects (name) VALUES ('Office')").run();
  const insertOpenEntry = db.prepare(
    "INSERT INTO time_entries (task_id, project_id, start_minute) VALUES (?, ?, ?)",
  );
  insertOpenEntry.run(task.lastInsertRowid, project.lastInsertRowid, 100);

  assert.throws(
    () => insertOpenEntry.run(task.lastInsertRowid, project.lastInsertRowid, 101),
    /UNIQUE constraint failed/,
  );
  assert.throws(
    () => db.prepare("DELETE FROM projects WHERE id = ?").run(project.lastInsertRowid),
    /FOREIGN KEY constraint failed/,
  );
  assert.throws(
    () => db.prepare("DELETE FROM tasks WHERE id = ?").run(task.lastInsertRowid),
    /FOREIGN KEY constraint failed/,
  );
});

test("adds elapsed_minutes when opening a database from the previous schema", (t) => {
  const directory = temporaryDirectory();
  const databasePath = path.join(directory, "legacy.sqlite");
  const legacyDb = new Database(databasePath);
  legacyDb.exec(`
    CREATE TABLE timer_state (
      id INTEGER PRIMARY KEY,
      status TEXT NOT NULL,
      task_id INTEGER,
      project_id INTEGER
    );
    INSERT INTO timer_state (id, status, task_id, project_id)
    VALUES (1, 'idle', NULL, NULL);
  `);
  legacyDb.close();

  const migrated = createDatabase(databasePath);
  t.after(() => {
    migrated.close();
    rmSync(directory, { recursive: true, force: true });
  });
  assert.deepEqual(
    migrated.prepare("SELECT status, elapsed_minutes FROM timer_state WHERE id = 1").get(),
    { status: "idle", elapsed_minutes: 0 },
  );
});
