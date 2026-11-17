export function minuteNow() {
  return Math.floor(Date.now() / 60_000);
}

export function trackingDayKey(minute) {
  const date = new Date(minute * 60_000);
  if (date.getHours() < 4) {
    date.setDate(date.getDate() - 1);
  }
  return formatDate(date);
}

export function currentTrackingDayKey() {
  return trackingDayKey(minuteNow());
}

export function trackingDayWindow(dayKey) {
  const [year, month, day] = dayKey.split("-").map(Number);
  const start = new Date(year, month - 1, day, 4, 0, 0, 0);
  const end = new Date(year, month - 1, day + 1, 4, 0, 0, 0);
  return {
    startMinute: Math.floor(start.getTime() / 60_000),
    endMinute: Math.floor(end.getTime() / 60_000),
  };
}

export function formatDate(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}
