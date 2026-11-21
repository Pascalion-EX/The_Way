import assert from "node:assert/strict";
import { test } from "node:test";
import {
  calendarDays, clampPickerValue, formatPickerValue, isPickerValue,
  moveCalendarDate, parsePickerText,
} from "../src/utils/datePicker.js";

test("typed dates and months keep ISO API values and reject nonexistent calendar days", () => {
  for (const [input, type, expected] of [
    ["07/13/2010", "date", "2010-07-13"],
    ["7/3/2010", "date", "2010-07-03"],
    ["2010-07-13", "date", "2010-07-13"],
    ["02/29/2028", "date", "2028-02-29"],
    ["01/01/0001", "date", "0001-01-01"],
    ["07/2010", "month", "2010-07"],
    ["7/2010", "month", "2010-07"],
    ["2010-07", "month", "2010-07"],
    ["07/13/2010 09:45", "datetime-local", "2010-07-13T09:45"],
    ["2010-07-13T09:45", "datetime-local", "2010-07-13T09:45"],
    ["07/13/2010", "datetime-local", "2010-07-13T00:00"],
  ]) {
    assert.equal(parsePickerText(input, type), expected);
    assert.equal(parsePickerText(formatPickerValue(expected, type), type), expected);
  }
  for (const input of ["02/29/2027", "02/30/2028", "04/31/2010", "00/13/2010", "13/01/2010", "07/00/2010", "01/01/0000", "nonsense"]) {
    assert.equal(parsePickerText(input), null, input);
  }
  assert.equal(parsePickerText("07/13/2010 25:00", "datetime-local"), null);
  assert.equal(parsePickerText("07/13/2010 09:60", "datetime-local"), null);
  assert.equal(parsePickerText("07/13/2010 09:00", "date"), null);
  assert.equal(parsePickerText("13/2010", "month"), null);
  assert.equal(parsePickerText("  "), "");
});

test("calendar rows start on Sunday and include adjacent months and leap days", () => {
  const july = calendarDays(2010, 6);
  assert.equal(july.length, 35);
  assert.deepEqual(july[0], { value: "2010-06-27", day: 27, outside: true });
  assert.deepEqual(july[34], { value: "2010-07-31", day: 31, outside: false });
  assert.equal(calendarDays(2028, 1).filter((day) => !day.outside).length, 29);
  assert.equal(calendarDays(2027, 1).filter((day) => !day.outside).length, 28);
  assert.ok(calendarDays(2026, 0).some((day) => day.value === "2025-12-31"));
});

test("keyboard navigation crosses month and year boundaries and clamps short months", () => {
  assert.equal(moveCalendarDate("2010-07-31", { days: 1 }), "2010-08-01");
  assert.equal(moveCalendarDate("2010-01-01", { days: -1 }), "2009-12-31");
  assert.equal(moveCalendarDate("2028-01-31", { months: 1 }), "2028-02-29");
  assert.equal(moveCalendarDate("2028-02-29", { months: 12 }), "2029-02-28");
  assert.equal(moveCalendarDate("0001-01-01", { days: -1 }), "0001-01-01");
  assert.equal(moveCalendarDate("9999-12-31", { days: 1 }), "9999-12-31");
});

test("date limits compare canonical values without shifting time zones", () => {
  assert.equal(formatPickerValue("2010-07-13"), "07/13/2010");
  assert.equal(formatPickerValue("2010-07-13T09:45", "datetime-local"), "07/13/2010 09:45");
  assert.equal(clampPickerValue("2010-01-01", "2010-07-01", "2010-07-31"), "2010-07-01");
  assert.equal(clampPickerValue("2010-08-01", "2010-07-01", "2010-07-31"), "2010-07-31");
  assert.equal(clampPickerValue("2010-07-14T08:00", "2010-07-14T09:30"), "2010-07-14T09:30");
  assert.equal(isPickerValue("2010-07-13T09:45", "datetime-local"), true);
  assert.equal(isPickerValue("2010-07-13T24:00", "datetime-local"), false);
});
