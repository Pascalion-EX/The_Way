export const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

const pad = (value, length = 2) => String(value).padStart(length, "0");

// Calendar dates stay in UTC so selecting a day never changes it with the timezone.
export function calendarDate(year, month, day = 1) {
  const date = new Date(0);
  date.setUTCFullYear(year, month, day);
  return date;
}

export function dateKey(date) {
  return `${pad(date.getUTCFullYear(), 4)}-${pad(date.getUTCMonth() + 1)}-${pad(date.getUTCDate())}`;
}

export function isPickerValue(value, type = "date") {
  if (typeof value !== "string") return false;
  const pattern = type === "month" ? /^\d{4}-\d{2}$/
    : type === "datetime-local" ? /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/
      : /^\d{4}-\d{2}-\d{2}$/;
  if (!pattern.test(value)) return false;
  const [year, month, day = 1] = value.slice(0, 10).split("-").map(Number);
  if (year < 1 || year > 9999 || month < 1 || month > 12) return false;
  if (dateKey(calendarDate(year, month - 1, day)) !== (type === "month" ? `${value}-01` : value.slice(0, 10))) return false;
  if (type === "datetime-local") {
    const [hours, minutes] = value.slice(11).split(":").map(Number);
    return hours <= 23 && minutes <= 59;
  }
  return true;
}

export function formatPickerValue(value, type = "date") {
  if (!value || !isPickerValue(value, type)) return "";
  const [year, month, day] = value.slice(0, 10).split("-");
  if (type === "month") return `${month}/${year}`;
  return `${month}/${day}/${year}${type === "datetime-local" ? ` ${value.slice(11)}` : ""}`;
}

// Accept the displayed US date format and ISO values when typing or pasting.
export function parsePickerText(text, type = "date") {
  const trimmed = text.trim();
  if (!trimmed) return "";
  if (isPickerValue(trimmed, type)) return trimmed;
  const match = type === "month" ? /^(\d{1,2})\/(\d{4})$/.exec(trimmed)
    : /^(\d{1,2})\/(\d{1,2})\/(\d{4})(?:[ ,]+(\d{1,2}):(\d{2}))?$/.exec(trimmed);
  if (!match) return null;
  const candidate = type === "month" ? `${match[2]}-${pad(match[1])}`
    : `${match[3]}-${pad(match[1])}-${pad(match[2])}${type === "datetime-local" ? `T${pad(match[4] ?? "00")}:${match[5] ?? "00"}` : ""}`;
  if (type === "date" && match[4] !== undefined) return null;
  return isPickerValue(candidate, type) ? candidate : null;
}

export function calendarDays(year, month) {
  const first = calendarDate(year, month);
  const dayCount = calendarDate(year, month + 1, 0).getUTCDate();
  const count = Math.ceil((first.getUTCDay() + dayCount) / 7) * 7;
  return Array.from({ length: count }, (_, index) => {
    const date = calendarDate(year, month, index - first.getUTCDay() + 1);
    return { value: dateKey(date), day: date.getUTCDate(), outside: date.getUTCMonth() !== month };
  });
}

export function moveCalendarDate(value, { days = 0, months = 0 }) {
  const [year, month, day] = value.split("-").map(Number);
  const target = calendarDate(year, month - 1 + months);
  const lastDay = calendarDate(target.getUTCFullYear(), target.getUTCMonth() + 1, 0).getUTCDate();
  target.setUTCDate(Math.min(day, lastDay) + days);
  if (target.getUTCFullYear() < 1) return "0001-01-01";
  if (target.getUTCFullYear() > 9999) return "9999-12-31";
  return dateKey(target);
}

export function clampPickerValue(value, min, max) {
  return min && value < min ? min : max && value > max ? max : value;
}
