export const EVENT_TYPES = ["Trip", "Visit", "Fasting", "Feast", "Mass", "Meeting", "Other"];
const EDITABLE_FIELDS = new Set(["title", "description", "eventType", "startDate", "endDate", "allDay", "location", "years"]);
const invalid = (message) => ({ success: false, message });

// Accept browser date/date-time inputs and ISO timestamps, never objects that
// Mongoose would need to interpret. Check calendar components before Date can
// silently roll an impossible day into the following month.
const parseEventDate = (value) => {
  if (typeof value !== "string" || value.length > 35) return null;
  const match = /^(\d{4})-(\d{2})-(\d{2})(?:T(\d{2}):(\d{2})(?::(\d{2})(?:\.(\d{1,3}))?)?(?:Z|[+-]\d{2}:\d{2})?)?$/.exec(value);
  if (!match) return null;
  const [, yearText, monthText, dayText, hourText = "0", minuteText = "0", secondText = "0"] = match;
  const [year, month, day, hour, minute, second] = [yearText, monthText, dayText, hourText, minuteText, secondText].map(Number);
  const leapYear = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
  const monthDays = [31, leapYear ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  if (year < 1 || month < 1 || month > 12 || day < 1 || day > monthDays[month - 1] || hour > 23 || minute > 59 || second > 59) return null;
  const date = new Date(value);
  return Number.isFinite(date.getTime()) ? date : null;
};

export const validateEventUpdate = (body) => {
  if (!body || typeof body !== "object" || Array.isArray(body) ||
      ![Object.prototype, null].includes(Object.getPrototypeOf(body))) {
    return invalid("Event updates must be a plain object");
  }
  const keys = Reflect.ownKeys(body);
  if (!keys.length) return invalid("Provide at least one editable event field");
  // Exact names exclude protected metadata, MongoDB operators, dotted paths,
  // and prototype keys. Reject the whole request, including mixed safe fields.
  if (keys.some((key) => !EDITABLE_FIELDS.has(key))) return invalid("Only editable event fields are allowed");

  const changes = {};
  for (const key of keys) {
    const value = body[key];
    if (["title", "description", "location"].includes(key)) {
      const maxLength = key === "title" ? 200 : key === "location" ? 500 : 10_000;
      if (typeof value !== "string" || value.length > maxLength) {
        return invalid(`Event ${key} must be a string of at most ${maxLength} characters`);
      }
      if (key === "title" && !value.trim()) return invalid("Event title is required");
      changes[key] = key === "title" ? value.trim() : value;
    } else if (key === "eventType") {
      if (typeof value !== "string" || !EVENT_TYPES.includes(value)) return invalid("Invalid event type");
      changes.eventType = value;
    } else if (key === "allDay") {
      if (typeof value !== "boolean") return invalid("Event allDay must be a boolean");
      changes.allDay = value;
    } else if (key === "years") {
      if (!Array.isArray(value) || value.length > 12 ||
          [...value].some((year) => !Number.isInteger(year) || year < 1 || year > 12) ||
          new Set(value).size !== value.length) return invalid("Event years must be unique integers from 1 to 12");
      changes.years = [...value];
    } else {
      if (key === "endDate" && (value === null || value === "")) {
        changes.endDate = null;
      } else {
        const date = parseEventDate(value);
        if (!date) return invalid(`Invalid event ${key}`);
        changes[key] = date;
      }
    }
  }
  return { success: true, changes };
};

export const validEventDateRange = (changes, event) => {
  const start = changes.startDate ?? event.startDate;
  const end = Object.hasOwn(changes, "endDate") ? changes.endDate : event.endDate;
  return !end || end >= start;
};
