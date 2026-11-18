import assert from "node:assert/strict";
import test from "node:test";
import {
  currentTrackingDayKey,
  formatDate,
  minuteNow,
  trackingDayKey,
  trackingDayWindow,
} from "../../server/time.js";

function localMinute(year, month, day, hour, minute) {
  return Math.floor(new Date(year, month - 1, day, hour, minute).getTime() / 60_000);
}

test("tracking-day key changes at 4 AM local time", () => {
  assert.equal(trackingDayKey(localMinute(2026, 11, 17, 3, 59)), "2026-11-16");
  assert.equal(trackingDayKey(localMinute(2026, 11, 17, 4, 0)), "2026-11-17");
  assert.equal(trackingDayKey(localMinute(2026, 11, 17, 23, 59)), "2026-11-17");
});

test("tracking-day window includes both 4 AM boundaries in local time", () => {
  const { startMinute, endMinute } = trackingDayWindow("2026-11-17");

  assert.equal(trackingDayKey(startMinute), "2026-11-17");
  assert.equal(trackingDayKey(endMinute - 1), "2026-11-17");
  assert.equal(trackingDayKey(endMinute), "2026-11-18");
  assert.equal(
    new Date(startMinute * 60_000).getHours(),
    4,
  );
  assert.equal(endMinute - startMinute, 24 * 60);
});

test("minute clock and date formatting use the local clock", () => {
  const before = Date.now();
  const minute = minuteNow();
  const after = Date.now();

  assert.ok(minute >= Math.floor(before / 60_000));
  assert.ok(minute <= Math.floor(after / 60_000));
  assert.equal(formatDate(new Date(2026, 0, 5)), "2026-01-05");
  assert.equal(currentTrackingDayKey(), trackingDayKey(minuteNow()));
});
