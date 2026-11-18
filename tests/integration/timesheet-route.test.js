import assert from "node:assert/strict";
import { once } from "node:events";
import test from "node:test";
import { createApp } from "../../server/app.js";
import { createDatabase } from "../../server/db.js";
import { createStore } from "../../server/store.js";

test("timesheet endpoint returns a downloadable PDF attachment", async (t) => {
  const startMinute = Math.floor(new Date(2026, 10, 17, 9, 0).getTime() / 60_000);
  let now = startMinute;
  const db = createDatabase();
  const store = createStore(db, { now: () => now });
  const task = store.createTask("Planning");
  store.timerAction("start", task.id, store.noProjectId);
  now += 3;

  const server = createApp(store).listen(0, "127.0.0.1");
  await once(server, "listening");
  t.after(() => {
    server.close();
    db.close();
  });

  const address = server.address();
  const response = await fetch(`http://127.0.0.1:${address.port}/api/timesheet.pdf`);
  const pdf = Buffer.from(await response.arrayBuffer());

  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type"), /application\/pdf/);
  assert.match(response.headers.get("content-disposition"), /attachment; filename="?timesheet-2026-11-17\.pdf"?/);
  assert.equal(pdf.subarray(0, 5).toString(), "%PDF-");
});
