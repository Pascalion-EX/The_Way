export const ACTIVITY_SCHEDULE_TIME_ZONE = "Africa/Cairo";

export function currentScheduleMonth(now = new Date()) {
  const parts = new Intl.DateTimeFormat("en", {
    timeZone: ACTIVITY_SCHEDULE_TIME_ZONE, year: "numeric", month: "2-digit",
  }).formatToParts(now);
  return `${parts.find((part) => part.type === "year").value}-${parts.find((part) => part.type === "month").value}`;
}

export function isScheduleMonth(value) {
  return typeof value === "string" && /^(?:19\d{2}|[2-9]\d{3})-(?:0[1-9]|1[0-2])$/.test(value);
}

export function wednesdaysForMonth(month) {
  if (!isScheduleMonth(month)) throw new Error("Choose a valid month");
  const [year, monthNumber] = month.split("-").map(Number);
  const firstDay = new Date(Date.UTC(year, monthNumber - 1, 1));
  const lastDay = new Date(Date.UTC(year, monthNumber, 0)).getUTCDate();
  const firstWednesday = 1 + (3 - firstDay.getUTCDay() + 7) % 7;
  const dates = [];
  for (let day = firstWednesday; day <= lastDay; day += 7) {
    dates.push(`${month}-${String(day).padStart(2, "0")}`);
  }
  return dates;
}

export function isScheduleWednesday(value) {
  return typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value) &&
    isScheduleMonth(value.slice(0, 7)) && wednesdaysForMonth(value.slice(0, 7)).includes(value);
}

export function scheduleMonthDetails(month) {
  const [year, monthNumber] = month.split("-").map(Number);
  const adjacentMonth = (offset) => new Date(Date.UTC(year, monthNumber - 1 + offset, 1)).toISOString().slice(0, 7);
  return {
    month,
    monthLabel: new Intl.DateTimeFormat("en", { month: "long", year: "numeric", timeZone: "UTC" })
      .format(new Date(Date.UTC(year, monthNumber - 1, 1))),
    previousMonth: month === "1900-01" ? null : adjacentMonth(-1),
    nextMonth: month === "9999-12" ? null : adjacentMonth(1),
    timeZone: ACTIVITY_SCHEDULE_TIME_ZONE,
  };
}

export function scheduleDateLabel(date) {
  return new Intl.DateTimeFormat("en", {
    weekday: "long", day: "numeric", month: "long", timeZone: "UTC",
  }).format(new Date(`${date}T00:00:00Z`));
}
