import assert from "node:assert/strict";
import test, { type TestContext } from "node:test";
import { createDatabase } from "../../server/db.js";
import { createStore } from "../../server/store.js";
import { trackingDayKey } from "../../server/time.js";

function localMinute(hour: number, minute: number, day = 17): number {
  return Math.floor(new Date(2026, 10, day, hour, minute, 0, 0).getTime() / 60_000);
}

function setup(t: TestContext, startMinute = localMinute(9, 0)) {
  const db = createDatabase();
  let now = startMinute;
  const store = createStore(db, { now: () => now });
  t.after(() => db.close());
  return {
    db,
    store,
    setNow(value: number) { now = value; },
  };
}

function rowCount(db: ReturnType<typeof createDatabase>, sql: string): number {
  return db.prepare<[], { count: number }>(sql).get()?.count ?? 0;
}

test("seeds protected No Project and keeps task definitions independent", (t: TestContext) => {
  const { db, store } = setup(t);
  const task = store.createTask("Inbox");
  const bootstrap = store.getBootstrap();

  assert.equal(bootstrap.projects.length, 1);
  assert.equal(bootstrap.projects[0].name, "No Project");
  assert.equal(bootstrap.projects[0].isBuiltin, true);
  assert.deepEqual(bootstrap.tasks, [{ id: task.id, name: "Inbox" }]);
  assert.equal(rowCount(db, "SELECT count(*) AS count FROM task_projects"), 0);
  assert.throws(() => store.updateProject(store.noProjectId, "Renamed"), /cannot be renamed/);
  assert.throws(() => store.deleteProject(store.noProjectId), /cannot be deleted/);
  assert.equal(rowCount(db, "SELECT count(*) AS count FROM projects"), 1);
});

test("validates names and supports editing and deleting unreferenced items", (t: TestContext) => {
  const { db, store } = setup(t);
  const project = store.createProject("P".repeat(50));
  assert.equal(project.name.length, 50);
  assert.throws(() => store.createProject("P".repeat(51)), /50 characters or fewer/);

  const task = store.createTask("T".repeat(50));
  assert.equal(task.name.length, 50);
  assert.throws(
    () => store.updateTask(task.id, "T".repeat(51)),
    /50 characters or fewer/,
  );
  store.updateProject(project.id, "Renamed");
  store.updateTask(task.id, "Updated");
  store.deleteTask(task.id);
  store.deleteProject(project.id);

  assert.equal(rowCount(db, "SELECT count(*) AS count FROM tasks"), 0);
  assert.equal(rowCount(db, "SELECT count(*) AS count FROM projects"), 1);
});

test("records reusable task time against each selected project and returns all three totals", (t: TestContext) => {
  const { db, store, setNow } = setup(t);
  const firstProject = store.createProject("Studio");
  const secondProject = store.createProject("Home");
  const sharedTask = store.createTask("Planning");
  const secondTask = store.createTask("Email");
  assert.equal(store.getBootstrap().tasks.length, 2);

  const start = localMinute(9, 0);
  store.timerAction("start", sharedTask.id, firstProject.id);
  setNow(start + 3);
  store.timerAction("switch", secondTask.id, firstProject.id);
  setNow(start + 5);
  store.timerAction("switch", sharedTask.id, secondProject.id);
  setNow(start + 8);
  store.timerAction("end");

  const totals = store.getTotals(trackingDayKey(start));
  assert.equal(totals.byTask.find((row) => row.name === "Planning")?.minutes, 6);
  assert.equal(totals.byTask.find((row) => row.name === "Email")?.minutes, 2);
  assert.equal(totals.byProject.find((row) => row.name === "Studio")?.minutes, 5);
  assert.equal(totals.byProject.find((row) => row.name === "Home")?.minutes, 3);
  assert.equal(
    totals.byTaskProject.find((row) => row.taskName === "Planning" && row.projectName === "Studio")?.minutes,
    3,
  );
  assert.equal(
    totals.byTaskProject.find((row) => row.taskName === "Planning" && row.projectName === "Home")?.minutes,
    3,
  );
  assert.equal(rowCount(db, "SELECT count(*) AS count FROM task_projects"), 3);
  assert.equal(rowCount(db, "SELECT count(*) AS count FROM time_entries WHERE end_minute IS NULL"), 0);
});

test("timesheet contains grouped totals and chronological completed and active entries", (t: TestContext) => {
  const start = localMinute(9, 0);
  const { store, setNow } = setup(t, start);
  const project = store.createProject("Operations");
  const firstTask = store.createTask("Planning");
  const secondTask = store.createTask("Review");

  store.timerAction("start", firstTask.id, project.id);
  setNow(start + 3);
  store.timerAction("switch", secondTask.id, project.id);
  setNow(start + 6);

  const report = store.getTimesheet();
  assert.equal(report.dayKey, trackingDayKey(start));
  assert.equal(report.byProject[0].name, "Operations");
  assert.equal(report.byProject[0].minutes, 6);
  assert.deepEqual(report.byTask.map((row) => row.name), ["Planning", "Review"]);
  assert.deepEqual(report.byTaskProject.map((row) => row.taskName), ["Planning", "Review"]);
  assert.deepEqual(report.entries.map((entry) => ({
    taskName: entry.taskName,
    startMinute: entry.startMinute,
    endMinute: entry.endMinute,
    durationMinutes: entry.durationMinutes,
    isRunning: entry.isRunning,
  })), [
    {
      taskName: "Planning",
      startMinute: start,
      endMinute: start + 3,
      durationMinutes: 3,
      isRunning: false,
    },
    {
      taskName: "Review",
      startMinute: start + 3,
      endMinute: null,
      durationMinutes: 3,
      isRunning: true,
    },
  ]);
});

test("discards entries of one minute or less and keeps longer entries", (t: TestContext) => {
  const start = localMinute(10, 0);
  const { db, store, setNow } = setup(t, start);
  const task = store.createTask("Quick check");

  store.timerAction("start", task.id, store.noProjectId);
  store.timerAction("end");
  assert.equal(rowCount(db, "SELECT count(*) AS count FROM time_entries"), 0);
  assert.equal(rowCount(db, "SELECT count(*) AS count FROM task_projects"), 0);

  store.timerAction("start", task.id, store.noProjectId);
  setNow(start + 1);
  store.timerAction("end");
  assert.equal(rowCount(db, "SELECT count(*) AS count FROM time_entries"), 0);
  assert.equal(rowCount(db, "SELECT count(*) AS count FROM task_projects"), 0);

  setNow(start + 5);
  store.timerAction("start", task.id, store.noProjectId);
  setNow(start + 7);
  store.timerAction("end");
  const entry = db.prepare<[], { start_minute: number; end_minute: number | null }>(
    "SELECT start_minute, end_minute FROM time_entries",
  ).get();
  assert.deepEqual(entry, { start_minute: start + 5, end_minute: start + 7 });
  assert.equal(rowCount(db, "SELECT count(*) AS count FROM task_projects"), 1);
});

test("pause and resume persist separate non-overlapping segments", (t: TestContext) => {
  const start = localMinute(11, 0);
  const { db, store, setNow } = setup(t, start);
  const project = store.createProject("Writing");
  const task = store.createTask("Draft");

  store.timerAction("start", task.id, project.id);
  setNow(start + 3);
  assert.equal(store.timerAction("pause").status, "paused");
  assert.equal(rowCount(db, "SELECT count(*) AS count FROM time_entries WHERE end_minute IS NULL"), 0);
  assert.equal(store.getBootstrap().timer.elapsedMinutes, 3);
  setNow(start + 8);
  assert.equal(store.getBootstrap().timer.status, "paused");
  store.timerAction("resume");
  assert.equal(store.getBootstrap().timer.elapsedMinutes, 3);
  setNow(start + 11);
  store.timerAction("end");

  const entries = db.prepare<[], { start_minute: number; end_minute: number | null }>(`
    SELECT start_minute, end_minute FROM time_entries ORDER BY start_minute
  `).all();
  assert.deepEqual(entries, [
    { start_minute: start, end_minute: start + 3 },
    { start_minute: start + 8, end_minute: start + 11 },
  ]);
  assert.equal(store.getTotals(trackingDayKey(start)).byTask[0].minutes, 6);
});

test("attributes a segment crossing 4 AM to the tracking day it started in", (t: TestContext) => {
  const start = localMinute(3, 59);
  const { store, setNow } = setup(t, start);
  const task = store.createTask("Early work");

  store.timerAction("start", task.id, store.noProjectId);
  setNow(localMinute(4, 2));
  store.timerAction("end");

  const startDay = trackingDayKey(start);
  assert.equal(store.getTotals(startDay).byTask[0].minutes, 3);
  assert.equal(store.getTotals(trackingDayKey(localMinute(4, 2))).byTask.length, 0);
});

test("blocks deletion of referenced tasks and projects", (t: TestContext) => {
  const { store } = setup(t);
  const project = store.createProject("Client");
  const task = store.createTask("Design");

  store.timerAction("start", task.id, project.id);
  assert.throws(() => store.deleteProject(project.id), /tracked time or a paused timer/);
  assert.throws(() => store.deleteTask(task.id), /cannot be deleted/);
  assert.equal(store.updateTask(task.id, "Updated design").name, "Updated design");
});

test("keeps starting the same running task idempotent and rejects invalid timer transitions", (t: TestContext) => {
  const start = localMinute(12, 0);
  const { db, store, setNow } = setup(t, start);
  const task = store.createTask("Focus");
  const project = store.createProject("Studio");

  assert.throws(() => store.timerAction("pause"), /no running timer/);
  assert.throws(() => store.timerAction("resume"), /no paused timer/);
  assert.throws(() => store.timerAction("switch", task.id, 999), /Project not found/);
  assert.throws(() => store.timerAction("start", 999, project.id), /Task not found/);
  assert.throws(() => store.timerAction("start"), /Select a task and project/);

  store.timerAction("start", task.id, project.id);
  setNow(start + 4);
  const timer = store.timerAction("start", task.id, project.id);

  assert.equal(timer.startMinute, start);
  assert.equal(rowCount(db, "SELECT count(*) AS count FROM time_entries"), 1);
  assert.equal(rowCount(db, "SELECT count(*) AS count FROM time_entries WHERE end_minute IS NULL"), 1);
  assert.throws(() => store.createTask("  "), /name is required/);
  assert.throws(() => store.updateProject(project.id, "x".repeat(51)), /50 characters or fewer/);
});

test("blocks deletion of an item retained by a paused timer", (t: TestContext) => {
  const { store, setNow } = setup(t);
  const project = store.createProject("Client");
  const task = store.createTask("Review");
  store.timerAction("start", task.id, project.id);
  setNow(localMinute(9, 3));
  store.timerAction("pause");

  assert.throws(() => store.deleteTask(task.id), /cannot be deleted/);
  assert.throws(() => store.deleteProject(project.id), /paused timer/);
  assert.equal(store.getBootstrap().timer.status, "paused");
});

test("includes an active segment in today's totals and excludes completed short segments", (t: TestContext) => {
  const start = localMinute(14, 0);
  const { store, setNow } = setup(t, start);
  const task = store.createTask("Research");

  store.timerAction("start", task.id, store.noProjectId);
  setNow(start + 2);
  assert.equal(store.getTotals(trackingDayKey(start)).byTask[0].minutes, 2);
  store.timerAction("end");

  setNow(start + 5);
  store.timerAction("start", task.id, store.noProjectId);
  store.timerAction("end");
  assert.equal(store.getTotals(trackingDayKey(start)).byTask[0].minutes, 2);
});
