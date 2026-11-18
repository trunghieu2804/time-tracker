import assert from "node:assert/strict";
import test from "node:test";
import { createTimesheetPdf } from "../../src/timesheet.js";

test("generates a PDF with all timesheet sections and activity rows", async () => {
  const doc = await createTimesheetPdf({
    dayKey: "2026-11-17",
    byTaskProject: [
      { taskId: 1, projectId: 1, projectName: "Operations", taskName: "Planning", minutes: 45 },
    ],
    byProject: [{ id: 1, name: "Operations", minutes: 45 }],
    byTask: [{ id: 1, name: "Planning", minutes: 45 }],
    entries: [{
      taskId: 1,
      projectId: 1,
      startMinute: Math.floor(new Date(2026, 10, 17, 9, 0).getTime() / 60_000),
      endMinute: Math.floor(new Date(2026, 10, 17, 9, 45).getTime() / 60_000),
      durationMinutes: 45,
      projectName: "Operations",
      taskName: "Planning",
      isRunning: false,
    }],
  });

  const pdf = doc.output();
  assert.ok(pdf.startsWith("%PDF-"));
  assert.match(pdf, /Task totals by project/);
  assert.match(pdf, /Total time by project/);
  assert.match(pdf, /Total time by task/);
  assert.match(pdf, /Chronological activity/);
  assert.match(pdf, /Operations/);
  assert.match(pdf, /Planning/);
});

test("generates a valid empty-day PDF with a page number", async () => {
  const doc = await createTimesheetPdf({
    dayKey: "2026-11-17",
    byTaskProject: [],
    byProject: [],
    byTask: [],
    entries: [],
  });

  const pdf = doc.output();
  assert.ok(pdf.startsWith("%PDF-"));
  assert.match(pdf, /No tracked time/);
  assert.match(pdf, /1 \/ 1/);
});
