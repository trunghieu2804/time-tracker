import assert from "node:assert/strict";
import test from "node:test";
import { createApp } from "../../server/app.js";
import { createDatabase } from "../../server/db.js";
import { createStore } from "../../server/store.js";
import { closeServer, listen } from "../helpers/server.js";

function localMinute(hour, minute, day = 17) {
  return Math.floor(new Date(2026, 10, day, hour, minute).getTime() / 60_000);
}

test("API supports project/task CRUD and the complete timer workflow", async (t) => {
  let now = localMinute(9, 0);
  const db = createDatabase();
  const store = createStore(db, { now: () => now });
  const { server, url } = await listen(createApp(store));
  t.after(async () => {
    await closeServer(server);
    db.close();
  });

  const bootstrap = await fetch(`${url}/api/bootstrap`).then((response) => response.json());
  assert.equal(bootstrap.projects[0].name, "No Project");
  assert.equal(bootstrap.timer.status, "idle");

  const missingName = await fetch(`${url}/api/projects`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name: "   " }),
  });
  assert.equal(missingName.status, 400);
  assert.deepEqual(await missingName.json(), { error: "Project name is required." });

  const projectResponse = await fetch(`${url}/api/projects`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name: "  Consulting  " }),
  });
  assert.equal(projectResponse.status, 201);
  const project = await projectResponse.json();
  assert.equal(project.name, "Consulting");

  const updateProject = await fetch(`${url}/api/projects/${project.id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name: "Client work" }),
  });
  assert.equal((await updateProject.json()).name, "Client work");

  const taskResponse = await fetch(`${url}/api/tasks`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name: "Planning" }),
  });
  assert.equal(taskResponse.status, 201);
  const task = await taskResponse.json();
  assert.equal(task.name, "Planning");
  assert.equal((await fetch(`${url}/api/bootstrap`).then((response) => response.json())).tasks.length, 1);

  const start = await fetch(`${url}/api/timer/start`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ taskId: task.id, projectId: project.id }),
  });
  assert.equal((await start.json()).status, "running");

  now += 3;
  const pause = await fetch(`${url}/api/timer/pause`, { method: "POST" });
  const pausedTimer = await pause.json();
  assert.equal(pausedTimer.status, "paused");
  assert.equal(pausedTimer.elapsedMinutes, 3);

  now += 2;
  const resume = await fetch(`${url}/api/timer/resume`, { method: "POST" });
  assert.equal((await resume.json()).status, "running");
  now += 2;

  const end = await fetch(`${url}/api/timer/end`, { method: "POST" });
  assert.equal((await end.json()).status, "idle");

  const totals = await fetch(`${url}/api/bootstrap`).then((response) => response.json());
  assert.equal(totals.totals.byTask[0].minutes, 5);
  assert.equal(totals.totals.byProject.find((row) => row.name === "Client work").minutes, 5);
  assert.equal(totals.totals.byTaskProject[0].minutes, 5);

  const blockedDelete = await fetch(`${url}/api/projects/${project.id}`, { method: "DELETE" });
  assert.equal(blockedDelete.status, 409);

  const renamedTask = await fetch(`${url}/api/tasks/${task.id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name: "Project plan" }),
  });
  assert.equal((await renamedTask.json()).name, "Project plan");
  assert.equal((await fetch(`${url}/api/bootstrap`).then((response) => response.json())).tasks[0].name, "Project plan");

  const missingTask = await fetch(`${url}/api/tasks/99999`, { method: "DELETE" });
  assert.equal(missingTask.status, 404);
  assert.deepEqual(await missingTask.json(), { error: "Task not found." });
});

test("malformed JSON receives a client error without creating a record", async (t) => {
  const db = createDatabase();
  const { server, url } = await listen(createApp(createStore(db)));
  t.after(async () => {
    await closeServer(server);
    db.close();
  });

  const response = await fetch(`${url}/api/tasks`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: "{invalid",
  });
  assert.equal(response.status, 400);
  assert.deepEqual(await response.json(), { error: "Request body must contain valid JSON." });
  assert.equal(db.prepare("SELECT count(*) AS count FROM tasks").get().count, 0);
});
