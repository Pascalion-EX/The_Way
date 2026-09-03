import { createNameDescriptors, createStringTagDescriptors, mapProps, noop, throwTypeError, invalidCallingContext, forbiddenValueOf as forbiddenValueOf$1, computeCalendarEraFields, computeCalendarDateFields, computeCalendarMonthCode, computeCalendarDaysInMonth, computeCalendarDaysInYear, computeCalendarMonthsInYear, computeCalendarInLeapYear, computeIsoDayOfWeek, computeCalendarDayOfYear, computeCalendarWeekOfYear, computeCalendarYearOfWeek, createPropGetters, durationGetters as durationGetters$1, timeGetters as timeGetters$1 } from "./internal.js";

const PlainYearMonthBranding = "PlainYearMonth";

const PlainMonthDayBranding = "PlainMonthDay";

const PlainDateBranding = "PlainDate";

const PlainDateTimeBranding = "PlainDateTime";

const PlainTimeBranding = "PlainTime";

const ZonedDateTimeBranding = "ZonedDateTime";

const InstantBranding = "Instant";

const DurationBranding = "Duration";

const CalendarBranding = "Calendar";

function defineTemporalClass(branding, cls, getSlots, ...getterMaps) {
  return Object.defineProperties(cls, createNameDescriptors(branding)), Object.defineProperties(cls.prototype, createStringTagDescriptors("Temporal." + branding)), 
  Object.defineProperties(cls.prototype, mapProps(getter => ({
    get() {
      return getter(getSlots(this));
    },
    configurable: 1
  }), Object.assign({}, ...getterMaps))), cls;
}

const attachDebugString = "noop" === noop.name ? instance => {
  Object.defineProperty(instance, "_str_", {
    value: instance.toJSON()
  });
} : noop;

function invalidRecordType() {
  throwTypeError(invalidCallingContext);
}

function forbiddenValueOf() {
  throwTypeError(forbiddenValueOf$1);
}

const yearMonthFieldGetters$1 = {
  era(slots) {
    return computeCalendarEraFields(slots.calendar, slots).era;
  },
  eraYear(slots) {
    return computeCalendarEraFields(slots.calendar, slots).eraYear;
  },
  year(slots) {
    return computeCalendarDateFields(slots.calendar, slots).year;
  },
  month(slots) {
    return computeCalendarDateFields(slots.calendar, slots).month;
  },
  monthCode(slots) {
    return computeCalendarMonthCode(slots.calendar, slots);
  }
};

const dateFieldGetters$1 = {
  era(slots) {
    return computeCalendarEraFields(slots.calendar, slots).era;
  },
  eraYear(slots) {
    return computeCalendarEraFields(slots.calendar, slots).eraYear;
  },
  year(slots) {
    return computeCalendarDateFields(slots.calendar, slots).year;
  },
  month(slots) {
    return computeCalendarDateFields(slots.calendar, slots).month;
  },
  monthCode(slots) {
    return computeCalendarMonthCode(slots.calendar, slots);
  },
  day(slots) {
    return computeCalendarDateFields(slots.calendar, slots).day;
  }
};

const monthDayFieldGetters$1 = {
  monthCode(slots) {
    return computeCalendarMonthCode(slots.calendar, slots);
  },
  day(slots) {
    return computeCalendarDateFields(slots.calendar, slots).day;
  }
};

const yearMonthDerivedGetters = {
  daysInMonth(slots) {
    return computeCalendarDaysInMonth(slots.calendar, slots);
  },
  daysInYear(slots) {
    return computeCalendarDaysInYear(slots.calendar, slots);
  },
  monthsInYear(slots) {
    return computeCalendarMonthsInYear(slots.calendar, slots);
  },
  inLeapYear(slots) {
    return computeCalendarInLeapYear(slots.calendar, slots);
  }
};

const dateDerivedGetters = {
  dayOfWeek(slots) {
    return computeIsoDayOfWeek(slots);
  },
  dayOfYear(slots) {
    return computeCalendarDayOfYear(slots.calendar, slots);
  },
  weekOfYear(slots) {
    return computeCalendarWeekOfYear(slots.calendar, slots);
  },
  yearOfWeek(slots) {
    return computeCalendarYearOfWeek(slots.calendar, slots);
  },
  daysInWeek() {
    return 7;
  },
  daysInMonth(slots) {
    return computeCalendarDaysInMonth(slots.calendar, slots);
  },
  daysInYear(slots) {
    return computeCalendarDaysInYear(slots.calendar, slots);
  },
  monthsInYear(slots) {
    return computeCalendarMonthsInYear(slots.calendar, slots);
  },
  inLeapYear(slots) {
    return computeCalendarInLeapYear(slots.calendar, slots);
  }
};

function createNativeGetters(shimGetters) {
  return createPropGetters(Object.keys(shimGetters));
}

const durationGetters = /*@__PURE__*/ createNativeGetters(durationGetters$1);

const timeGetters = /*@__PURE__*/ createNativeGetters(timeGetters$1);

const yearMonthFieldGetters = /*@__PURE__*/ createNativeGetters(yearMonthFieldGetters$1);

const dateFieldGetters = /*@__PURE__*/ createNativeGetters(dateFieldGetters$1);

const monthDayFieldGetters = /*@__PURE__*/ createNativeGetters(monthDayFieldGetters$1);

createNativeGetters(yearMonthDerivedGetters), createNativeGetters(dateDerivedGetters);

export { CalendarBranding, DurationBranding, InstantBranding, PlainDateBranding, PlainDateTimeBranding, PlainMonthDayBranding, PlainTimeBranding, PlainYearMonthBranding, ZonedDateTimeBranding, attachDebugString, dateDerivedGetters, dateFieldGetters$1 as dateFieldGetters, dateFieldGetters as dateFieldGetters$1, defineTemporalClass, durationGetters, forbiddenValueOf, invalidRecordType, monthDayFieldGetters$1 as monthDayFieldGetters, monthDayFieldGetters as monthDayFieldGetters$1, timeGetters, yearMonthDerivedGetters, yearMonthFieldGetters$1 as yearMonthFieldGetters, yearMonthFieldGetters as yearMonthFieldGetters$1 };
