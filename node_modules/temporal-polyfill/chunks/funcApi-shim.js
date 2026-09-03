import { defineTemporalClass, forbiddenValueOf, attachDebugString, dateFieldGetters, monthDayFieldGetters, yearMonthFieldGetters } from "./apiHelpers.js";

import "temporal-utils/protected-error-messages";

import { toIntegerWithTrunc } from "temporal-utils/protected";

import { createDateTimeFormatShell, RawDateTimeFormat, computeCalendarDateFields, isoDateToEpochNano, combineDateAndTime, timeFieldDefaults, computeCalendarIsoFieldsFromParts, isoDateTimeToEpochNano, roundWithMode, coerceRoundingIncInteger, coerceRoundingMode, validateRoundingInc, computeIsoDayOfWeek, moveByDays, addCalendarMonths, computeEpochNanoFrac, refineUnitDiffOptions, roundNumberToInc, roundBigNanoToInc, divideBigNanoToExactNumber, bindArgs, getCommonTimeZone, getCommonCalendar, createZonedRelativeOps, prepareZonedEpochDiff, getEpochNano, createDateRelativeOps, createDateTimeRelativeOps, diffCalendarDates, totalRelativeDuration, compareBigInts, nanoInUtcDay, timeFieldsToNano, durationGetters, formatDurationIsoAuto, validateDurationFields, mapProps, toStrictInteger, createDurationSlots, refineDurationObjectLike, parseDuration, mergeDurationFields, negateDuration, absDuration, addDurationsWithoutRelativeTo, roundDuration, totalDuration, compareDurations, formatDurationIso, throwTypeError, invalidRelativeTo, isoCalendarImpl, refineOverflowOptions, addDateMonths, computeCalendarDaysInYear, clampEntity, computeCalendarDayOfYear, computeCalendarDaysInMonth, computeIsoWeekFields, throwRangeError, unsupportedWeekNumbers, timeGetters, formatTimeIsoAuto, validateTimeFields, refinePlainTimeObjectLike, parsePlainTime, mergePlainTimeFields, moveTime, negateDurationFields, diffPlainTimes, plainTimesEqual, compareTimeFields, applyPlainFormatTimeZone, transformTimeOptions, timeFieldsToMilli, formatPlainTimeIso, nanoInHour, nanoInMinute, nanoInSec, nanoInMilli, nanoInMicro, nanoToTimeAndDay, roundTimeToNano, computeNanoInc, bigNanoInUtcDay, getCalendarSlotId, formatDateTimeIsoAuto, checkIsoDateTimeInBounds, validateIsoDateTimeFields, createDateTimeSlots, refinePlainDateTimeObjectLike, parsePlainDateTime, mergePlainDateTimeFields, createPlainDateTimeFromRefinedFields, computeCalendarWeekOfYear, computeCalendarYearOfWeek, computeCalendarMonthsInYear, computeCalendarInLeapYear, moveDateTime, diffPlainDateTimes, plainDateTimesEqual, compareIsoDateTimeFields, transformDateTimeOptions, checkResolvedCalendarCompatible, isoDateTimeToEpochMilli, formatPlainDateTimeIso, plainDateTimeToZonedDateTime, queryTimeZone, refineTimeZoneId, createDateSlots, createTimeSlots, epochNanoToIsoDateTime, computeDayFloor, roundDateTimeToNano, formatMonthDayIsoAuto, isoEpochFirstLeapYear, checkIsoDateInBounds, validateIsoDateFields, refinePlainMonthDayObjectLike, parsePlainMonthDay, mergePlainMonthDayFields, plainMonthDaysEqual, transformMonthDayOptions, isoDateToEpochMilli, formatPlainMonthDayIso, convertPlainMonthDayToDate, formatYearMonthIsoAuto, checkIsoYearMonthInBounds, refinePlainYearMonthObjectLike, parsePlainYearMonth, mergePlainYearMonthFields, moveYearMonth, diffPlainYearMonth, plainYearMonthsEqual, compareIsoDateFields, transformYearMonthOptions, formatPlainYearMonthIso, convertPlainYearMonthToDate, durationFieldDefaults, formatDateIsoAuto, refinePlainDateObjectLike, parsePlainDate, mergePlainDateFields, moveDate, diffPlainDates, plainDatesEqual, transformDateOptions, formatPlainDateIso, plainDateToZonedDateTime, createPlainYearMonthFromFields, computeCalendarMonthCode, createPlainMonthDayFromFields, isoDateToEpochDays, getEpochMilli, formatZonedDateTimeIsoAuto, zonedEpochSlotsToIso, checkEpochNanoInBounds, toBigInt, refineZonedDateTimeObjectLike, parseZonedDateTime, mergeZonedDateTimeFields, createZonedEpochNanoSlots, zonedDateTimeWithPlainTime, formatOffsetNano, computeZonedHoursInDay, formatZonedDateTimeIso, moveZonedEpochSlots, diffZonedDateTimes, computeZonedStartOfDay, getTimeZoneTransitionEpochNanoseconds, zonedDateTimesEqual, compareZonedEpochSlots, applyZonedFormatTimeZone, getZonedTimeZoneId, transformZonedOptions, zonedDateTimeToInstant, zonedDateTimeToPlainDateTime, zonedDateTimeToPlainDate, zonedDateTimeToPlainTime, alignZonedEpoch, getMatchingInstantFor, getSingleInstantFor, roundZonedEpochToInterval, roundZonedEpochSlotsToUnit, formatInstantIsoAuto, epochMilliToInstant, epochNanoToInstant, parseInstant, createEpochNanoSlots, moveEpochNano, diffInstants, instantsEqual, instantToZonedDateTime, transformInstantOptions, formatInstantIso, bigNanoInHour, bigNanoInMinute, bigNanoInSec, bigNanoInMilli, bigNanoInMicro, roundBigNanoToDayOriginInc, computeBigNanoInc, getCurrentTimeZoneId, getCurrentEpochNano, getCurrentIsoDateTime } from "./internal.js";

import { normalizeRoundToOptions, DurationRecordBranding, getDurationSlots, getZonedDateTimeSlotsIfPresent, getPlainDateTimeSlotsIfPresent, getPlainDateSlotsIfPresent, setDurationSlots, getCalendarRecordImplCreator, PlainTimeRecordBranding, getPlainTimeSlots, validateBag, setPlainTimeSlots, PlainDateTimeRecordBranding, getPlainDateTimeSlots, getPlainTimeSlotsIfPresent, setPlainDateTimeSlots, PlainMonthDayRecordBranding, getPlainMonthDaySlots, setPlainMonthDaySlots, PlainYearMonthRecordBranding, getPlainYearMonthSlots, setPlainYearMonthSlots, PlainDateRecordBranding, getPlainDateSlots, setPlainDateSlots, ZonedDateTimeRecordBranding, getZonedDateTimeSlots, setZonedDateTimeSlots, InstantRecordBranding, getInstantSlots, setInstantSlots } from "./funcApi.js";

function createDateTimeFormatFactory(createArgsProvider, transformOptions) {
  const ShimDateTimeFormat = createDateTimeFormatShell(createArgsProvider, transformOptions);
  return Object.setPrototypeOf(ShimDateTimeFormat.prototype, RawDateTimeFormat.prototype), 
  (locales, options) => new ShimDateTimeFormat(locales, options);
}

function computeYearFloor(calendar, slots) {
  const {year: year0} = computeCalendarDateFields(calendar, slots);
  return {
    ...computeCalendarDateTimeFromParts(calendar, year0),
    year: year0
  };
}

function computeMonthFloor(calendar, slots) {
  const {year: year0, month: month0} = computeCalendarDateFields(calendar, slots);
  return {
    ...computeCalendarDateTimeFromParts(calendar, year0, month0),
    year: year0,
    month: month0
  };
}

function computeIsoWeekFloor(_calendar, slots) {
  const dayOfWeek = computeIsoDayOfWeek(slots);
  return combineDateAndTime(moveByDays(slots, 1 - dayOfWeek), timeFieldDefaults);
}

function computeYearCeil(calendar, slots) {
  return computeYearInterval(calendar, slots)[1];
}

function computeMonthCeil(calendar, slots) {
  return computeMonthInterval(calendar, slots)[1];
}

function computeIsoWeekCeil(calendar, slots) {
  return combineDateAndTime(moveByDays(computeIsoWeekFloor(0, slots), 7), timeFieldDefaults);
}

function computeDayCeil(_calendar, slots) {
  return combineDateAndTime(moveByDays(slots, 1), timeFieldDefaults);
}

function computeYearInterval(calendar, slots) {
  const isoFields0 = computeYearFloor(calendar, slots);
  return [ isoFields0, computeCalendarDateTimeFromParts(calendar, isoFields0.year + 1) ];
}

function computeMonthInterval(calendar, slots) {
  const isoFields0 = computeMonthFloor(calendar, slots);
  const {year: year1, month: month1} = addCalendarMonths(calendar, isoFields0.year, isoFields0.month, 1);
  return [ isoFields0, computeCalendarDateTimeFromParts(calendar, year1, month1) ];
}

function computeIsoWeekInterval(calendar, slots) {
  const isoFields0 = computeIsoWeekFloor(0, slots);
  return [ isoFields0, combineDateAndTime(moveByDays(isoFields0, 7), timeFieldDefaults) ];
}

function roundDateToInterval(computeInterval, calendar, slots, roundingMode) {
  return roundEpochNanoToInterval(computeInterval, calendar, slots, isoDateToEpochNano(slots), roundingMode);
}

function computeCalendarDateTimeFromParts(calendar, year, month = 1) {
  return combineDateAndTime(computeCalendarIsoFieldsFromParts(calendar, year, month, 1), timeFieldDefaults);
}

function roundEpochNanoToInterval(computeInterval, calendar, slots, epochNano, roundingMode) {
  const [isoFields0, isoFields1] = computeInterval(calendar, slots);
  const epochNano0 = isoDateTimeToEpochNano(isoFields0);
  const epochNano1 = isoDateTimeToEpochNano(isoFields1);
  const frac = computeEpochNanoFrac(epochNano, epochNano0, epochNano1);
  return roundWithMode(frac, roundingMode) ? isoFields1 : isoFields0;
}

function refineRoundToOptions(smallestUnit, options, solarMode) {
  options = normalizeRoundToOptions(options);
  let roundingInc = coerceRoundingIncInteger(options);
  const roundingMode = coerceRoundingMode(options, 7);
  return roundingInc = validateRoundingInc(roundingInc, smallestUnit, void 0, solarMode), 
  [ roundingInc, roundingMode ];
}

const diffZonedYears = /*@__PURE__*/ bindArgs(diffZonedLargeUnits, 9);

const diffZonedMonths = /*@__PURE__*/ bindArgs(diffZonedLargeUnits, 8);

const diffZonedWeeks = /*@__PURE__*/ bindArgs(diffZonedDayLikeUnits, 7, 7);

const diffZonedDays = /*@__PURE__*/ bindArgs(diffZonedDayLikeUnits, 6, 1);

const diffZonedEpochNanoTimeUnit = /*@__PURE__*/ bindArgs(diffEpochNanoTimeUnit, getEpochNano);

const diffInstantEpochNanoTimeUnit = /*@__PURE__*/ bindArgs(diffEpochNanoTimeUnit, getEpochNano);

const diffPlainYears = /*@__PURE__*/ bindArgs(diffPlainDateLargeUnits, 9);

const diffPlainMonths = /*@__PURE__*/ bindArgs(diffPlainDateLargeUnits, 8);

const diffPlainDateTimeYears = /*@__PURE__*/ bindArgs(diffPlainDateTimeLargeUnits, 9);

const diffPlainDateTimeMonths = /*@__PURE__*/ bindArgs(diffPlainDateTimeLargeUnits, 8);

const diffPlainWeeks = /*@__PURE__*/ bindArgs(diffPlainDayLikeUnit, isoDateTimeToEpochNano, 7, 7);

const diffPlainDays = /*@__PURE__*/ bindArgs(diffPlainDayLikeUnit, isoDateTimeToEpochNano, 6, 1);

const diffPlainDateTimeEpochNanoTimeUnit = /*@__PURE__*/ bindArgs(diffEpochNanoTimeUnit, isoDateTimeToEpochNano);

function adaptRecordTimeUnitDiff(diffSlots, getSlots) {
  return (unit, nanoInUnit, record0, record1, options) => diffSlots(unit, nanoInUnit, getSlots(record0), getSlots(record1), options);
}

function diffZonedLargeUnits(unit, record0, record1, options) {
  const timeZone = getCommonTimeZone(record0.timeZone, record1.timeZone);
  const calendar = getCommonCalendar(record0.calendar, record1.calendar);
  return diffDateUnits(getEpochNano, bindArgs(prepareZonedEpochDiff, timeZone), createZonedRelativeOps(calendar, timeZone, record0), unit, record0, record1, options);
}

function diffPlainDateLargeUnits(unit, record0, record1, options) {
  const calendar = getCommonCalendar(record0.calendar, record1.calendar);
  return diffDateUnits(isoDateToEpochNano, identityMarkersToIsoFields, createDateRelativeOps(calendar, record0), unit, record0, record1, options);
}

function diffPlainDateTimeLargeUnits(unit, record0, record1, options) {
  const calendar = getCommonCalendar(record0.calendar, record1.calendar);
  return diffDateUnits(isoDateTimeToEpochNano, identityMarkersToIsoFields, createDateTimeRelativeOps(calendar, record0), unit, record0, record1, options);
}

function identityMarkersToIsoFields(m0, m1) {
  return [ m0, m1 ];
}

function diffDateUnits(markerToEpochNano, markersToIsoFields, relativeOps, unit, marker0, marker1, options) {
  const [roundingInc, roundingMode] = refineUnitDiffOptions(unit, options);
  const startEpochNano = markerToEpochNano(marker0);
  const endEpochNano = markerToEpochNano(marker1);
  const sign = compareBigInts(endEpochNano, startEpochNano);
  if (!sign) {
    return 0;
  }
  const [isoFields0, isoFields1] = markersToIsoFields(marker0, marker1, sign);
  const durationFields = diffCalendarDates(relativeOps.calendar, isoFields0, isoFields1, unit);
  let res = totalRelativeDuration(durationFields, endEpochNano, unit, relativeOps);
  return roundingInc && (res = roundNumberToInc(res, roundingInc, roundingMode)), 
  res;
}

function diffZonedDayLikeUnits(unit, daysInUnit, record0, record1, options) {
  const [roundingInc, roundingMode] = refineUnitDiffOptions(unit, options);
  const timeZone = getCommonTimeZone(record0.timeZone, record1.timeZone);
  const sign = compareBigInts(record1.epochNanoseconds, record0.epochNanoseconds);
  const [isoFields0, isoFields1, remainderNano] = prepareZonedEpochDiff(timeZone, record0, record1, sign);
  const nanoDiff = isoDateTimeToEpochNano(combineDateAndTime(isoFields1, isoFields0)) - isoDateTimeToEpochNano(isoFields0) + BigInt(remainderNano);
  let res = divideBigNanoToExactNumber(nanoDiff, nanoInUtcDay) / daysInUnit;
  return roundingInc && (res = roundNumberToInc(res, roundingInc, roundingMode)), 
  res;
}

function diffPlainDayLikeUnit(markerToEpochNano, unit, daysInUnit, record0, record1, options) {
  const [roundingInc, roundingMode] = refineUnitDiffOptions(unit, options);
  const nanoDiff = markerToEpochNano(record1) - markerToEpochNano(record0);
  let res = divideBigNanoToExactNumber(nanoDiff, nanoInUtcDay) / daysInUnit;
  return roundingInc && (res = roundNumberToInc(res, roundingInc, roundingMode)), 
  res;
}

function diffEpochNanoTimeUnit(markerToEpochNano, unit, nanoInUnit, record0, record1, options) {
  return ((unit, nanoInUnit, nanoAmount, options) => {
    const [roundingInc, roundingMode] = refineUnitDiffOptions(unit, options);
    return roundingInc && (nanoAmount = roundBigNanoToInc(nanoAmount, BigInt(nanoInUnit) * BigInt(roundingInc), roundingMode)), 
    roundingInc ? Number(nanoAmount / BigInt(nanoInUnit)) : divideBigNanoToExactNumber(nanoAmount, nanoInUnit);
  })(unit, nanoInUnit, markerToEpochNano(record1) - markerToEpochNano(record0), options);
}

function diffPlainTimeNanoOfDayTimeUnit(unit, nanoInUnit, slots0, slots1, options) {
  return ((unit, nanoInUnit, nanoAmount, options) => {
    const [roundingInc, roundingMode] = refineUnitDiffOptions(unit, options);
    return roundingInc && (nanoAmount = roundNumberToInc(nanoAmount, nanoInUnit * roundingInc, roundingMode)), 
    nanoAmount / nanoInUnit;
  })(unit, nanoInUnit, timeFieldsToNano(slots1) - timeFieldsToNano(slots0), options);
}

const getShimDurationSlots = getDurationSlots;

const ShimDurationRecord = /*@__PURE__*/ defineTemporalClass(DurationRecordBranding, class {
  toJSON() {
    return formatDurationIsoAuto(getShimDurationSlots(this));
  }
  valueOf() {
    return forbiddenValueOf();
  }
}, getShimDurationSlots, durationGetters);

function createShimDurationRecord(slots) {
  const instance = Object.create(ShimDurationRecord.prototype);
  return setDurationSlots(instance, slots), attachDebugString(instance), instance;
}

function create$7(years = 0, months = 0, weeks = 0, days = 0, hours = 0, minutes = 0, seconds = 0, milliseconds = 0, microseconds = 0, nanoseconds = 0) {
  const fields = validateDurationFields(mapProps(toStrictInteger, {
    years: years,
    months: months,
    weeks: weeks,
    days: days,
    hours: hours,
    minutes: minutes,
    seconds: seconds,
    milliseconds: milliseconds,
    microseconds: microseconds,
    nanoseconds: nanoseconds
  }));
  return createShimDurationRecord(createDurationSlots(fields));
}

function fromFields$6(fields) {
  return createShimDurationRecord(refineDurationObjectLike(fields));
}

function fromString$7(s) {
  return createShimDurationRecord(parseDuration(s));
}

function sign(duration) {
  return getShimDurationSlots(duration).sign;
}

function blank(duration) {
  return !getShimDurationSlots(duration).sign;
}

function withFields$6(duration, mod) {
  const slots = getShimDurationSlots(duration);
  return createShimDurationRecord(mergeDurationFields(slots, mod));
}

function negated(duration) {
  const slots = getShimDurationSlots(duration);
  return createShimDurationRecord(negateDuration(slots));
}

function abs(duration) {
  const slots = getShimDurationSlots(duration);
  return createShimDurationRecord(absDuration(slots));
}

function add$6(duration, otherDuration) {
  const slots = getShimDurationSlots(duration);
  const otherSlots = getShimDurationSlots(otherDuration);
  return createShimDurationRecord(addDurationsWithoutRelativeTo(0, slots, otherSlots));
}

function subtract$6(duration, otherDuration) {
  const slots = getShimDurationSlots(duration);
  const otherSlots = getShimDurationSlots(otherDuration);
  return createShimDurationRecord(addDurationsWithoutRelativeTo(1, slots, otherSlots));
}

function round(duration, options) {
  const slots = getShimDurationSlots(duration);
  return createShimDurationRecord(roundDuration(refineRelativeTo, slots, options));
}

function total(duration, options) {
  return totalDuration(refineRelativeTo, getShimDurationSlots(duration), options);
}

function compare$6(duration, otherDuration, options) {
  const slots = getShimDurationSlots(duration);
  const otherSlots = getShimDurationSlots(otherDuration);
  return compareDurations(refineRelativeTo, slots, otherSlots, options);
}

function toLocaleString$7(duration, locales, options) {
  const slots = getShimDurationSlots(duration);
  return Intl.DurationFormat ? new Intl.DurationFormat(locales, options).format(slots) : formatDurationIso(slots, options);
}

function toString$7(duration, options) {
  return formatDurationIso(getShimDurationSlots(duration), options);
}

function toBasicString$7(duration) {
  return formatDurationIsoAuto(getShimDurationSlots(duration));
}

function toTemporal$7(duration) {
  const slots = getShimDurationSlots(duration);
  return new Temporal.Duration(slots.years, slots.months, slots.weeks, slots.days, slots.hours, slots.minutes, slots.seconds, slots.milliseconds, slots.microseconds, slots.nanoseconds);
}

function refineRelativeTo(arg) {
  if (arg) {
    const slots = getZonedDateTimeSlotsIfPresent(arg) || getPlainDateTimeSlotsIfPresent(arg) || getPlainDateSlotsIfPresent(arg);
    if (slots) {
      return slots;
    }
    throwTypeError(invalidRelativeTo(arg));
  }
}

function refineShimCalendarArgMaybe(calendarRecord) {
  return void 0 === calendarRecord ? isoCalendarImpl : getCalendarRecordImpl(calendarRecord);
}

function createShimCalendarStringResolver(getCalendarRecord) {
  return calendarId => getCalendarRecordImpl(getCalendarRecord(calendarId.toLowerCase()));
}

function getCalendarRecordImpl(record) {
  return getCalendarRecordImplCreator(record)();
}

function reversedMove(f) {
  return (slots, units, options) => f(slots, -units, options);
}

function moveByYears(calendar, isoDate, years, options) {
  const overflow = refineOverflowOptions(options);
  return years ? addDateMonths(calendar, isoDate, toStrictInteger(years), 0, overflow) : isoDate;
}

function moveByMonths(calendar, isoDate, months, options) {
  const overflow = refineOverflowOptions(options);
  return months ? addDateMonths(calendar, isoDate, 0, toStrictInteger(months), overflow) : isoDate;
}

function moveByIsoWeeks(_calendar, isoDate, weeks) {
  return moveByDays(isoDate, 7 * toStrictInteger(weeks));
}

function moveByDaysStrict(_calendar, isoDate, days) {
  return moveByDays(isoDate, toStrictInteger(days));
}

function moveToDayOfYear(calendar, isoDate, dayOfYear, options) {
  const overflow = refineOverflowOptions(options);
  const daysInYear = computeCalendarDaysInYear(calendar, isoDate);
  const normDayOfYear = clampEntity("dayOfMonth", toIntegerWithTrunc(dayOfYear, "dayOfMonth"), 1, daysInYear, overflow);
  const currentDayOfYear = computeCalendarDayOfYear(calendar, isoDate);
  return moveByDays(isoDate, normDayOfYear - currentDayOfYear);
}

function moveToDayOfMonth(calendar, isoDate, day, options) {
  const overflow = refineOverflowOptions(options);
  const daysInMonth = computeCalendarDaysInMonth(calendar, isoDate);
  const normDayOfMonth = clampEntity("day", toIntegerWithTrunc(day, "day"), 1, daysInMonth, overflow);
  const currentDayOfMonth = computeCalendarDateFields(calendar, isoDate).day;
  return moveByDays(isoDate, normDayOfMonth - currentDayOfMonth);
}

function moveToDayOfWeek(_calendar, isoDate, dayOfWeek, options) {
  const overflow = refineOverflowOptions(options);
  const normDayOfWeek = clampEntity("dayOfWeek", toIntegerWithTrunc(dayOfWeek, "dayOfWeek"), 1, 7, overflow);
  return moveByDays(isoDate, normDayOfWeek - computeIsoDayOfWeek(isoDate));
}

function moveToWeekOfYear(calendar, isoDate, weekOfYear, options) {
  const overflow = refineOverflowOptions(options);
  const weekFields = calendar === isoCalendarImpl ? computeIsoWeekFields(isoDate) : {};
  const currentWeekOfYear = weekFields.weekOfYear;
  const weeksInYear = weekFields.Be;
  return void 0 === currentWeekOfYear && throwRangeError(unsupportedWeekNumbers), 
  moveByIsoWeeks(0, isoDate, clampEntity("weekOfYear", toIntegerWithTrunc(weekOfYear, "weekOfYear"), 1, weeksInYear, overflow) - currentWeekOfYear);
}

const getShimPlainTimeSlots = getPlainTimeSlots;

const ShimPlainTimeRecord = /*@__PURE__*/ defineTemporalClass(PlainTimeRecordBranding, class {
  toJSON() {
    return formatTimeIsoAuto(getShimPlainTimeSlots(this));
  }
  valueOf() {
    return forbiddenValueOf();
  }
}, getShimPlainTimeSlots, timeGetters);

function createShimPlainTimeRecord(slots) {
  const instance = Object.create(ShimPlainTimeRecord.prototype);
  return setPlainTimeSlots(instance, slots), attachDebugString(instance), instance;
}

function create$6(hour = 0, minute = 0, second = 0, millisecond = 0, microsecond = 0, nanosecond = 0) {
  return createShimPlainTimeRecord(validateTimeFields(mapProps(toIntegerWithTrunc, {
    hour: hour,
    minute: minute,
    second: second,
    millisecond: millisecond,
    microsecond: microsecond,
    nanosecond: nanosecond
  })));
}

function fromFields$5(fields, options) {
  return createShimPlainTimeRecord(refinePlainTimeObjectLike(fields, options));
}

function fromString$6(s) {
  return createShimPlainTimeRecord(parsePlainTime(s));
}

function withFields$5(record, mod, options) {
  const slots = getShimPlainTimeSlots(record);
  return createShimPlainTimeRecord(mergePlainTimeFields(slots, validateBag(mod), options));
}

function add$5(record, durationRecord) {
  const slots = getShimPlainTimeSlots(record);
  const durationSlots = getShimDurationSlots(durationRecord);
  return createShimPlainTimeRecord(moveTime(slots, durationSlots)[0]);
}

function subtract$5(record, durationRecord) {
  const slots = getShimPlainTimeSlots(record);
  const durationSlots = getShimDurationSlots(durationRecord);
  return createShimPlainTimeRecord(moveTime(slots, negateDurationFields(durationSlots))[0]);
}

function diff$5(record, otherRecord, options) {
  const slots = getShimPlainTimeSlots(record);
  const otherSlots = getShimPlainTimeSlots(otherRecord);
  return createShimDurationRecord(diffPlainTimes(0, slots, otherSlots, options));
}

function equals$6(record, otherRecord) {
  const slots = getShimPlainTimeSlots(record);
  const otherSlots = getShimPlainTimeSlots(otherRecord);
  return plainTimesEqual(slots, otherSlots);
}

function compare$5(record, otherRecord) {
  const slots = getShimPlainTimeSlots(record);
  const otherSlots = getShimPlainTimeSlots(otherRecord);
  return compareTimeFields(slots, otherSlots);
}

const createFormat$5 = /*@__PURE__*/ createDateTimeFormatFactory(internals => ({
  A(record) {
    const slots = getShimPlainTimeSlots(record);
    return [ internals.t, timeFieldsToMilli(slots) ];
  },
  v(record0, record1) {
    const slots0 = getShimPlainTimeSlots(record0);
    const slots1 = getShimPlainTimeSlots(record1);
    return [ internals.t, timeFieldsToMilli(slots0), timeFieldsToMilli(slots1) ];
  }
}), options => applyPlainFormatTimeZone(transformTimeOptions(options, 1)));

function toLocaleString$6(record, locales = void 0, options = {}) {
  const slots = getShimPlainTimeSlots(record);
  return new RawDateTimeFormat(locales, applyPlainFormatTimeZone(transformTimeOptions(options))).format(timeFieldsToMilli(slots));
}

function toString$6(record, options) {
  return formatPlainTimeIso(getShimPlainTimeSlots(record), options);
}

function toBasicString$6(record) {
  return formatTimeIsoAuto(getShimPlainTimeSlots(record));
}

function toTemporal$6(record) {
  const slots = getShimPlainTimeSlots(record);
  return new Temporal.PlainTime(slots.hour, slots.minute, slots.second, slots.millisecond, slots.microsecond, slots.nanosecond);
}

function moveByTimeUnit$2(nanoInUnit, record, units) {
  const slots = getShimPlainTimeSlots(record);
  const movedNano = BigInt(timeFieldsToNano(slots)) + BigInt(toStrictInteger(units)) * BigInt(nanoInUnit);
  return createShimPlainTimeRecord(nanoToTimeAndDay(Number((movedNano % bigNanoInUtcDay + bigNanoInUtcDay) % bigNanoInUtcDay))[0]);
}

const addHours$3 = /*@__PURE__*/ bindArgs(moveByTimeUnit$2, nanoInHour);

const addMinutes$3 = /*@__PURE__*/ bindArgs(moveByTimeUnit$2, nanoInMinute);

const addSeconds$3 = /*@__PURE__*/ bindArgs(moveByTimeUnit$2, nanoInSec);

const addMilliseconds$3 = /*@__PURE__*/ bindArgs(moveByTimeUnit$2, nanoInMilli);

const addMicroseconds$3 = /*@__PURE__*/ bindArgs(moveByTimeUnit$2, nanoInMicro);

const addNanoseconds$3 = /*@__PURE__*/ bindArgs(moveByTimeUnit$2, 1);

const subtractHours$3 = /*@__PURE__*/ reversedMove(addHours$3);

const subtractMinutes$3 = /*@__PURE__*/ reversedMove(addMinutes$3);

const subtractSeconds$3 = /*@__PURE__*/ reversedMove(addSeconds$3);

const subtractMilliseconds$3 = /*@__PURE__*/ reversedMove(addMilliseconds$3);

const subtractMicroseconds$3 = /*@__PURE__*/ reversedMove(addMicroseconds$3);

const subtractNanoseconds$3 = /*@__PURE__*/ reversedMove(addNanoseconds$3);

function roundToUnit$1(smallestUnit, record, options) {
  const slots = getShimPlainTimeSlots(record);
  const [roundingInc, roundingMode] = refineRoundToOptions(smallestUnit, options);
  return createShimPlainTimeRecord(roundTimeToNano(slots, computeNanoInc(smallestUnit, roundingInc), roundingMode)[0]);
}

const roundToHour$3 = /*@__PURE__*/ bindArgs(roundToUnit$1, 5);

const roundToMinute$3 = /*@__PURE__*/ bindArgs(roundToUnit$1, 4);

const roundToSecond$3 = /*@__PURE__*/ bindArgs(roundToUnit$1, 3);

const roundToMillisecond$3 = /*@__PURE__*/ bindArgs(roundToUnit$1, 2);

const roundToMicrosecond$3 = /*@__PURE__*/ bindArgs(roundToUnit$1, 1);

function startOfHour$2(record) {
  return createShimPlainTimeRecord({
    ...getShimPlainTimeSlots(record),
    minute: 0,
    second: 0,
    millisecond: 0,
    microsecond: 0,
    nanosecond: 0
  });
}

function startOfMinute$2(record) {
  return createShimPlainTimeRecord({
    ...getShimPlainTimeSlots(record),
    second: 0,
    millisecond: 0,
    microsecond: 0,
    nanosecond: 0
  });
}

function startOfSecond$2(record) {
  return createShimPlainTimeRecord({
    ...getShimPlainTimeSlots(record),
    millisecond: 0,
    microsecond: 0,
    nanosecond: 0
  });
}

function startOfMillisecond$2(record) {
  return createShimPlainTimeRecord({
    ...getShimPlainTimeSlots(record),
    microsecond: 0,
    nanosecond: 0
  });
}

function startOfMicrosecond$2(record) {
  return createShimPlainTimeRecord({
    ...getShimPlainTimeSlots(record),
    nanosecond: 0
  });
}

function endOfHour$2(record) {
  return createShimPlainTimeRecord({
    ...getShimPlainTimeSlots(record),
    minute: 59,
    second: 59,
    millisecond: 999,
    microsecond: 999,
    nanosecond: 999
  });
}

function endOfMinute$2(record) {
  return createShimPlainTimeRecord({
    ...getShimPlainTimeSlots(record),
    second: 59,
    millisecond: 999,
    microsecond: 999,
    nanosecond: 999
  });
}

function endOfSecond$2(record) {
  return createShimPlainTimeRecord({
    ...getShimPlainTimeSlots(record),
    millisecond: 999,
    microsecond: 999,
    nanosecond: 999
  });
}

function endOfMillisecond$2(record) {
  return createShimPlainTimeRecord({
    ...getShimPlainTimeSlots(record),
    microsecond: 999,
    nanosecond: 999
  });
}

function endOfMicrosecond$2(record) {
  return createShimPlainTimeRecord({
    ...getShimPlainTimeSlots(record),
    nanosecond: 999
  });
}

const diffRecordTimeUnit$3 = /*@__PURE__*/ adaptRecordTimeUnitDiff(diffPlainTimeNanoOfDayTimeUnit, getShimPlainTimeSlots);

const diffHours$3 = /*@__PURE__*/ bindArgs(diffRecordTimeUnit$3, 5, nanoInHour);

const diffMinutes$3 = /*@__PURE__*/ bindArgs(diffRecordTimeUnit$3, 4, nanoInMinute);

const diffSeconds$3 = /*@__PURE__*/ bindArgs(diffRecordTimeUnit$3, 3, nanoInSec);

const diffMilliseconds$3 = /*@__PURE__*/ bindArgs(diffRecordTimeUnit$3, 2, nanoInMilli);

const diffMicroseconds$3 = /*@__PURE__*/ bindArgs(diffRecordTimeUnit$3, 1, nanoInMicro);

const diffNanoseconds$3 = /*@__PURE__*/ bindArgs(diffRecordTimeUnit$3, 0, 1);

const getShimPlainDateTimeSlots = getPlainDateTimeSlots;

const ShimPlainDateTimeRecord = /*@__PURE__*/ defineTemporalClass(PlainDateTimeRecordBranding, class {
  get calendarId() {
    return getCalendarSlotId(getShimPlainDateTimeSlots(this).calendar);
  }
  toJSON() {
    return formatDateTimeIsoAuto(getShimPlainDateTimeSlots(this));
  }
  valueOf() {
    return forbiddenValueOf();
  }
}, getShimPlainDateTimeSlots, dateFieldGetters, timeGetters);

function createShimPlainDateTimeRecord(slots) {
  const instance = Object.create(ShimPlainDateTimeRecord.prototype);
  return setPlainDateTimeSlots(instance, slots), attachDebugString(instance), instance;
}

function create$5(isoYear, isoMonth, isoDay, hour = 0, minute = 0, second = 0, millisecond = 0, microsecond = 0, nanosecond = 0, calendar) {
  const fields = checkIsoDateTimeInBounds(validateIsoDateTimeFields(mapProps(toIntegerWithTrunc, {
    year: isoYear,
    month: isoMonth,
    day: isoDay,
    hour: hour,
    minute: minute,
    second: second,
    millisecond: millisecond,
    microsecond: microsecond,
    nanosecond: nanosecond
  })));
  const calendarImpl = refineShimCalendarArgMaybe(calendar);
  return createShimPlainDateTimeRecord(createDateTimeSlots(fields, calendarImpl));
}

function fromFields$4(fields, options) {
  const calendarImpl = refineShimCalendarArgMaybe(fields.calendar);
  return createShimPlainDateTimeRecord(refinePlainDateTimeObjectLike(calendarImpl, fields, options));
}

function fromString$5(s, getCalendarRecord) {
  return createShimPlainDateTimeRecord(parsePlainDateTime(s, createShimCalendarStringResolver(getCalendarRecord)));
}

function withCalendar$2(record, inputCalendar) {
  const slots = getShimPlainDateTimeSlots(record);
  const calendarImpl = getCalendarRecordImpl(inputCalendar);
  return createShimPlainDateTimeRecord(createDateTimeSlots(slots, calendarImpl));
}

function withFields$4(record, mod, options) {
  const slots = getShimPlainDateTimeSlots(record);
  return createShimPlainDateTimeRecord(mergePlainDateTimeFields(slots, validateBag(mod), options));
}

function withPlainTime$1(record, plainTimeRecord = timeFieldDefaults) {
  const slots = getShimPlainDateTimeSlots(record);
  const timeFields = getPlainTimeSlotsIfPresent(plainTimeRecord) || plainTimeRecord;
  return createShimPlainDateTimeRecord(createPlainDateTimeFromRefinedFields(slots, timeFields, slots.calendar));
}

function dayOfWeek$2(record) {
  return computeIsoDayOfWeek(getShimPlainDateTimeSlots(record));
}

function daysInWeek$2(record) {
  return getShimPlainDateTimeSlots(record), 7;
}

function weekOfYear$2(record) {
  const slots = getShimPlainDateTimeSlots(record);
  return computeCalendarWeekOfYear(slots.calendar, slots);
}

function yearOfWeek$2(record) {
  const slots = getShimPlainDateTimeSlots(record);
  return computeCalendarYearOfWeek(slots.calendar, slots);
}

function dayOfYear$2(record) {
  const slots = getShimPlainDateTimeSlots(record);
  return computeCalendarDayOfYear(slots.calendar, slots);
}

function daysInMonth$3(record) {
  const slots = getShimPlainDateTimeSlots(record);
  return computeCalendarDaysInMonth(slots.calendar, slots);
}

function daysInYear$3(record) {
  const slots = getShimPlainDateTimeSlots(record);
  return computeCalendarDaysInYear(slots.calendar, slots);
}

function monthsInYear$3(record) {
  const slots = getShimPlainDateTimeSlots(record);
  return computeCalendarMonthsInYear(slots.calendar, slots);
}

function inLeapYear$3(record) {
  const slots = getShimPlainDateTimeSlots(record);
  return computeCalendarInLeapYear(slots.calendar, slots);
}

function add$4(record, durationRecord, options) {
  const slots = getShimPlainDateTimeSlots(record);
  const durationSlots = getShimDurationSlots(durationRecord);
  return createShimPlainDateTimeRecord(createDateTimeSlots(moveDateTime(slots.calendar, slots, durationSlots, options), slots.calendar));
}

function subtract$4(record, durationRecord, options) {
  const slots = getShimPlainDateTimeSlots(record);
  const durationSlots = getShimDurationSlots(durationRecord);
  return createShimPlainDateTimeRecord(createDateTimeSlots(moveDateTime(slots.calendar, slots, negateDurationFields(durationSlots), options), slots.calendar));
}

function diff$4(record, otherRecord, options) {
  const slots = getShimPlainDateTimeSlots(record);
  const otherSlots = getShimPlainDateTimeSlots(otherRecord);
  const calendar = getCommonCalendar(slots.calendar, otherSlots.calendar);
  return createShimDurationRecord(diffPlainDateTimes(0, calendar, slots, otherSlots, options));
}

function equals$5(record, otherRecord) {
  const slots = getShimPlainDateTimeSlots(record);
  const otherSlots = getShimPlainDateTimeSlots(otherRecord);
  return plainDateTimesEqual(slots, otherSlots);
}

function compare$4(record, otherRecord) {
  const slots = getShimPlainDateTimeSlots(record);
  const otherSlots = getShimPlainDateTimeSlots(otherRecord);
  return compareIsoDateTimeFields(slots, otherSlots);
}

const createFormat$4 = /*@__PURE__*/ createDateTimeFormatFactory(internals => ({
  A(record) {
    const slots = getShimPlainDateTimeSlots(record);
    const format = internals.t;
    return checkResolvedCalendarCompatible(format, slots), [ format, isoDateTimeToEpochMilli(slots) ];
  },
  v(record0, record1) {
    const slots0 = getShimPlainDateTimeSlots(record0);
    const slots1 = getShimPlainDateTimeSlots(record1);
    const format = internals.t;
    return checkResolvedCalendarCompatible(format, slots0), checkResolvedCalendarCompatible(format, slots1), 
    [ format, isoDateTimeToEpochMilli(slots0), isoDateTimeToEpochMilli(slots1) ];
  }
}), options => applyPlainFormatTimeZone(transformDateTimeOptions(options, 1)));

function toLocaleString$5(record, locales = void 0, options = {}) {
  const slots = getShimPlainDateTimeSlots(record);
  const format = new RawDateTimeFormat(locales, applyPlainFormatTimeZone(transformDateTimeOptions(options)));
  return checkResolvedCalendarCompatible(format, slots), format.format(isoDateTimeToEpochMilli(slots));
}

function toString$5(record, options) {
  return formatPlainDateTimeIso(getShimPlainDateTimeSlots(record), options);
}

function toBasicString$5(record) {
  return formatDateTimeIsoAuto(getShimPlainDateTimeSlots(record));
}

function toZonedDateTime$1(record, timeZoneId, options) {
  return createShimZonedDateTimeRecord(plainDateTimeToZonedDateTime(getShimPlainDateTimeSlots(record), queryTimeZone(refineTimeZoneId(timeZoneId)), options));
}

function toPlainDate$3(record) {
  const slots = getShimPlainDateTimeSlots(record);
  return createShimPlainDateRecord(createDateSlots(slots, slots.calendar));
}

function toPlainTime$1(record) {
  return createShimPlainTimeRecord(createTimeSlots(getShimPlainDateTimeSlots(record)));
}

function toTemporal$5(record) {
  const slots = getShimPlainDateTimeSlots(record);
  return new Temporal.PlainDateTime(slots.year, slots.month, slots.day, slots.hour, slots.minute, slots.second, slots.millisecond, slots.microsecond, slots.nanosecond, getCalendarSlotId(slots.calendar));
}

function withDayOfYear$2(record, dayOfYear, options) {
  const slots = getShimPlainDateTimeSlots(record);
  return createShimPlainDateTimeRecord(createPlainDateTimeFromRefinedFields(moveToDayOfYear(slots.calendar, slots, dayOfYear, options), slots, slots.calendar));
}

function withDayOfMonth$2(record, dayOfMonth, options) {
  const slots = getShimPlainDateTimeSlots(record);
  return createShimPlainDateTimeRecord(createPlainDateTimeFromRefinedFields(moveToDayOfMonth(slots.calendar, slots, dayOfMonth, options), slots, slots.calendar));
}

function withDayOfWeek$2(record, dayOfWeek, options) {
  const slots = getShimPlainDateTimeSlots(record);
  return createShimPlainDateTimeRecord(createPlainDateTimeFromRefinedFields(moveToDayOfWeek(slots.calendar, slots, dayOfWeek, options), slots, slots.calendar));
}

function withWeekOfYear$2(record, weekOfYear, options) {
  const slots = getShimPlainDateTimeSlots(record);
  return createShimPlainDateTimeRecord(createPlainDateTimeFromRefinedFields(moveToWeekOfYear(slots.calendar, slots, weekOfYear, options), slots, slots.calendar));
}

function addYears$3(record, years, options) {
  const slots = getShimPlainDateTimeSlots(record);
  return createShimPlainDateTimeRecord(createPlainDateTimeFromRefinedFields(moveByYears(slots.calendar, slots, years, options), slots, slots.calendar));
}

function addMonths$3(record, months, options) {
  const slots = getShimPlainDateTimeSlots(record);
  return createShimPlainDateTimeRecord(createPlainDateTimeFromRefinedFields(moveByMonths(slots.calendar, slots, months, options), slots, slots.calendar));
}

function addWeeks$2(record, weeks) {
  const slots = getShimPlainDateTimeSlots(record);
  return createShimPlainDateTimeRecord(createPlainDateTimeFromRefinedFields(moveByIsoWeeks(slots.calendar, slots, weeks), slots, slots.calendar));
}

function addDays$2(record, days) {
  const slots = getShimPlainDateTimeSlots(record);
  return createShimPlainDateTimeRecord(createPlainDateTimeFromRefinedFields(moveByDaysStrict(slots.calendar, slots, days), slots, slots.calendar));
}

const addHours$2 = /*@__PURE__*/ bindArgs(moveByTimeUnit$1, nanoInHour);

const addMinutes$2 = /*@__PURE__*/ bindArgs(moveByTimeUnit$1, nanoInMinute);

const addSeconds$2 = /*@__PURE__*/ bindArgs(moveByTimeUnit$1, nanoInSec);

const addMilliseconds$2 = /*@__PURE__*/ bindArgs(moveByTimeUnit$1, nanoInMilli);

const addMicroseconds$2 = /*@__PURE__*/ bindArgs(moveByTimeUnit$1, nanoInMicro);

const addNanoseconds$2 = /*@__PURE__*/ bindArgs(moveByTimeUnit$1, 1);

const subtractYears$3 = /*@__PURE__*/ reversedMove(addYears$3);

const subtractMonths$3 = /*@__PURE__*/ reversedMove(addMonths$3);

const subtractWeeks$2 = /*@__PURE__*/ reversedMove(addWeeks$2);

const subtractDays$2 = /*@__PURE__*/ reversedMove(addDays$2);

const subtractHours$2 = /*@__PURE__*/ reversedMove(addHours$2);

const subtractMinutes$2 = /*@__PURE__*/ reversedMove(addMinutes$2);

const subtractSeconds$2 = /*@__PURE__*/ reversedMove(addSeconds$2);

const subtractMilliseconds$2 = /*@__PURE__*/ reversedMove(addMilliseconds$2);

const subtractMicroseconds$2 = /*@__PURE__*/ reversedMove(addMicroseconds$2);

const subtractNanoseconds$2 = /*@__PURE__*/ reversedMove(addNanoseconds$2);

const roundToYear$3 = /*@__PURE__*/ bindArgs(roundToInterval$2, 9, computeYearInterval);

const roundToMonth$2 = /*@__PURE__*/ bindArgs(roundToInterval$2, 8, computeMonthInterval);

const roundToWeek$2 = /*@__PURE__*/ bindArgs(roundToInterval$2, 7, computeIsoWeekInterval);

function roundToDayTimeUnit$1(smallestUnit, record, options) {
  const slots = getShimPlainDateTimeSlots(record);
  const [roundingInc, roundingMode] = refineRoundToOptions(smallestUnit, options);
  return createShimPlainDateTimeRecord(createDateTimeSlots(roundDateTimeToNano(slots, computeNanoInc(smallestUnit, roundingInc), roundingMode), slots.calendar));
}

const roundToDay$1 = /*@__PURE__*/ bindArgs(roundToDayTimeUnit$1, 6);

const roundToHour$2 = /*@__PURE__*/ bindArgs(roundToDayTimeUnit$1, 5);

const roundToMinute$2 = /*@__PURE__*/ bindArgs(roundToDayTimeUnit$1, 4);

const roundToSecond$2 = /*@__PURE__*/ bindArgs(roundToDayTimeUnit$1, 3);

const roundToMillisecond$2 = /*@__PURE__*/ bindArgs(roundToDayTimeUnit$1, 2);

const roundToMicrosecond$2 = /*@__PURE__*/ bindArgs(roundToDayTimeUnit$1, 1);

const startOfYear$3 = /*@__PURE__*/ aligned$2(computeYearFloor);

const startOfMonth$2 = /*@__PURE__*/ aligned$2(computeMonthFloor);

const startOfWeek$2 = /*@__PURE__*/ aligned$2(computeIsoWeekFloor);

const startOfDay$1 = /*@__PURE__*/ alignedDateTimeStart(computeDayFloor);

const startOfHour$1 = /*@__PURE__*/ alignedTimeStart(slots => ({
  hour: slots.hour,
  minute: 0,
  second: 0,
  millisecond: 0,
  microsecond: 0,
  nanosecond: 0
}));

const startOfMinute$1 = /*@__PURE__*/ alignedTimeStart(slots => ({
  hour: slots.hour,
  minute: slots.minute,
  second: 0,
  millisecond: 0,
  microsecond: 0,
  nanosecond: 0
}));

const startOfSecond$1 = /*@__PURE__*/ alignedTimeStart(slots => ({
  hour: slots.hour,
  minute: slots.minute,
  second: slots.second,
  millisecond: 0,
  microsecond: 0,
  nanosecond: 0
}));

const startOfMillisecond$1 = /*@__PURE__*/ alignedTimeStart(slots => ({
  hour: slots.hour,
  minute: slots.minute,
  second: slots.second,
  millisecond: slots.millisecond,
  microsecond: 0,
  nanosecond: 0
}));

const startOfMicrosecond$1 = /*@__PURE__*/ alignedTimeStart(slots => ({
  hour: slots.hour,
  minute: slots.minute,
  second: slots.second,
  millisecond: slots.millisecond,
  microsecond: slots.microsecond,
  nanosecond: 0
}));

const endOfYear$3 = /*@__PURE__*/ aligned$2(computeYearCeil, -1);

const endOfMonth$2 = /*@__PURE__*/ aligned$2(computeMonthCeil, -1);

const endOfWeek$2 = /*@__PURE__*/ aligned$2(computeIsoWeekCeil, -1);

const endOfDay$1 = /*@__PURE__*/ alignedTimeEnd(() => ({
  hour: 23,
  minute: 59,
  second: 59,
  millisecond: 999,
  microsecond: 999,
  nanosecond: 999
}));

const endOfHour$1 = /*@__PURE__*/ alignedTimeEnd(slots => ({
  hour: slots.hour,
  minute: 59,
  second: 59,
  millisecond: 999,
  microsecond: 999,
  nanosecond: 999
}));

const endOfMinute$1 = /*@__PURE__*/ alignedTimeEnd(slots => ({
  hour: slots.hour,
  minute: slots.minute,
  second: 59,
  millisecond: 999,
  microsecond: 999,
  nanosecond: 999
}));

const endOfSecond$1 = /*@__PURE__*/ alignedTimeEnd(slots => ({
  hour: slots.hour,
  minute: slots.minute,
  second: slots.second,
  millisecond: 999,
  microsecond: 999,
  nanosecond: 999
}));

const endOfMillisecond$1 = /*@__PURE__*/ alignedTimeEnd(slots => ({
  hour: slots.hour,
  minute: slots.minute,
  second: slots.second,
  millisecond: slots.millisecond,
  microsecond: 999,
  nanosecond: 999
}));

const endOfMicrosecond$1 = /*@__PURE__*/ alignedTimeEnd(slots => ({
  hour: slots.hour,
  minute: slots.minute,
  second: slots.second,
  millisecond: slots.millisecond,
  microsecond: slots.microsecond,
  nanosecond: 999
}));

function diffYears$3(record0, record1, options) {
  return diffPlainDateTimeYears(getShimPlainDateTimeSlots(record0), getShimPlainDateTimeSlots(record1), options);
}

function diffMonths$3(record0, record1, options) {
  return diffPlainDateTimeMonths(getShimPlainDateTimeSlots(record0), getShimPlainDateTimeSlots(record1), options);
}

function diffWeeks$2(record0, record1, options) {
  return diffPlainWeeks(getShimPlainDateTimeSlots(record0), getShimPlainDateTimeSlots(record1), options);
}

function diffDays$2(record0, record1, options) {
  return diffPlainDays(getShimPlainDateTimeSlots(record0), getShimPlainDateTimeSlots(record1), options);
}

const diffRecordTimeUnit$2 = /*@__PURE__*/ adaptRecordTimeUnitDiff(diffPlainDateTimeEpochNanoTimeUnit, getShimPlainDateTimeSlots);

const diffHours$2 = /*@__PURE__*/ bindArgs(diffRecordTimeUnit$2, 5, nanoInHour);

const diffMinutes$2 = /*@__PURE__*/ bindArgs(diffRecordTimeUnit$2, 4, nanoInMinute);

const diffSeconds$2 = /*@__PURE__*/ bindArgs(diffRecordTimeUnit$2, 3, nanoInSec);

const diffMilliseconds$2 = /*@__PURE__*/ bindArgs(diffRecordTimeUnit$2, 2, nanoInMilli);

const diffMicroseconds$2 = /*@__PURE__*/ bindArgs(diffRecordTimeUnit$2, 1, nanoInMicro);

const diffNanoseconds$2 = /*@__PURE__*/ bindArgs(diffRecordTimeUnit$2, 0, 1);

function moveByTimeUnit$1(nanoInUnit, record, units) {
  const slots = getShimPlainDateTimeSlots(record);
  const epochNano1 = isoDateTimeToEpochNano(slots) + BigInt(toStrictInteger(units)) * BigInt(nanoInUnit);
  const isoDateTime1 = epochNanoToIsoDateTime(epochNano1);
  return createShimPlainDateTimeRecord(createPlainDateTimeFromRefinedFields(isoDateTime1, isoDateTime1, slots.calendar));
}

function roundToInterval$2(unit, computeInterval, record, options) {
  const slots = getShimPlainDateTimeSlots(record);
  const [, roundingMode] = refineRoundToOptions(unit, options);
  const isoDateTime = ((computeInterval, calendar, slots, roundingMode) => roundEpochNanoToInterval(computeInterval, calendar, slots, isoDateTimeToEpochNano(slots), roundingMode))(computeInterval, slots.calendar, slots, roundingMode);
  return createShimPlainDateTimeRecord(createPlainDateTimeFromRefinedFields(isoDateTime, isoDateTime, slots.calendar));
}

function aligned$2(computeAlignment, nanoDelta = 0) {
  return record => {
    const slots = getShimPlainDateTimeSlots(record);
    let isoDateTime = computeAlignment(slots.calendar, slots);
    return nanoDelta && (isoDateTime = epochNanoToIsoDateTime(isoDateTimeToEpochNano(isoDateTime) + BigInt(nanoDelta))), 
    createShimPlainDateTimeRecord(createPlainDateTimeFromRefinedFields(isoDateTime, isoDateTime, slots.calendar));
  };
}

function alignedDateTimeStart(computeAlignment) {
  return record => {
    const slots = getShimPlainDateTimeSlots(record);
    return createShimPlainDateTimeRecord(createDateTimeSlots(computeAlignment(slots), slots.calendar));
  };
}

function alignedTimeStart(computeAlignment) {
  return record => {
    const slots = getShimPlainDateTimeSlots(record);
    return createShimPlainDateTimeRecord(createDateTimeSlots(combineDateAndTime(slots, computeAlignment(slots)), slots.calendar));
  };
}

function alignedTimeEnd(computeAlignment) {
  return record => {
    const slots = getShimPlainDateTimeSlots(record);
    return createShimPlainDateTimeRecord(createDateTimeSlots(combineDateAndTime(slots, computeAlignment(slots)), slots.calendar));
  };
}

const getShimPlainMonthDaySlots = getPlainMonthDaySlots;

const ShimPlainMonthDayRecord = /*@__PURE__*/ defineTemporalClass(PlainMonthDayRecordBranding, class {
  get calendarId() {
    return getCalendarSlotId(getShimPlainMonthDaySlots(this).calendar);
  }
  toJSON() {
    return formatMonthDayIsoAuto(getShimPlainMonthDaySlots(this));
  }
  valueOf() {
    return forbiddenValueOf();
  }
}, getShimPlainMonthDaySlots, monthDayFieldGetters);

function createShimPlainMonthDayRecord(slots) {
  const instance = Object.create(ShimPlainMonthDayRecord.prototype);
  return setPlainMonthDaySlots(instance, slots), attachDebugString(instance), instance;
}

function create$4(isoMonth, isoDay, calendar, referenceIsoYear) {
  const isoMonthInt = toIntegerWithTrunc(isoMonth);
  const isoDayInt = toIntegerWithTrunc(isoDay);
  const calendarImpl = refineShimCalendarArgMaybe(calendar);
  const isoYearInt = toIntegerWithTrunc(referenceIsoYear ?? isoEpochFirstLeapYear);
  const fields = checkIsoDateInBounds(validateIsoDateFields({
    year: isoYearInt,
    month: isoMonthInt,
    day: isoDayInt
  }));
  return createShimPlainMonthDayRecord(createDateSlots(fields, calendarImpl));
}

function fromFields$3(fields, options) {
  const inputCalendar = fields.calendar;
  const calendarImpl = refineShimCalendarArgMaybe(inputCalendar);
  return createShimPlainMonthDayRecord(refinePlainMonthDayObjectLike(calendarImpl, !inputCalendar, fields, options));
}

function fromString$4(s, getCalendarRecord) {
  return createShimPlainMonthDayRecord(parsePlainMonthDay(s, createShimCalendarStringResolver(getCalendarRecord)));
}

function withFields$3(record, mod, options) {
  const slots = getShimPlainMonthDaySlots(record);
  return createShimPlainMonthDayRecord(mergePlainMonthDayFields(slots, validateBag(mod), options));
}

function equals$4(record, otherRecord) {
  const slots = getShimPlainMonthDaySlots(record);
  const otherSlots = getShimPlainMonthDaySlots(otherRecord);
  return plainMonthDaysEqual(slots, otherSlots);
}

const createFormat$3 = /*@__PURE__*/ createDateTimeFormatFactory(internals => ({
  A(record) {
    const slots = getShimPlainMonthDaySlots(record);
    const format = internals.t;
    return checkResolvedCalendarCompatible(format, slots, 1), [ format, isoDateToEpochMilli(slots) ];
  },
  v(record0, record1) {
    const slots0 = getShimPlainMonthDaySlots(record0);
    const slots1 = getShimPlainMonthDaySlots(record1);
    const format = internals.t;
    return checkResolvedCalendarCompatible(format, slots0, 1), checkResolvedCalendarCompatible(format, slots1, 1), 
    [ format, isoDateToEpochMilli(slots0), isoDateToEpochMilli(slots1) ];
  }
}), options => applyPlainFormatTimeZone(transformMonthDayOptions(options, 1)));

function toLocaleString$4(record, locales = void 0, options = {}) {
  const slots = getShimPlainMonthDaySlots(record);
  const format = new RawDateTimeFormat(locales, applyPlainFormatTimeZone(transformMonthDayOptions(options)));
  return checkResolvedCalendarCompatible(format, slots, 1), format.format(isoDateToEpochMilli(slots));
}

function toString$4(record, options) {
  return formatPlainMonthDayIso(getShimPlainMonthDaySlots(record), options);
}

function toBasicString$4(record) {
  return formatMonthDayIsoAuto(getShimPlainMonthDaySlots(record));
}

function toPlainDate$2(record, fields) {
  const slots = getShimPlainMonthDaySlots(record);
  return createShimPlainDateRecord(convertPlainMonthDayToDate(slots.calendar, record, fields));
}

function toTemporal$4(record) {
  const slots = getShimPlainMonthDaySlots(record);
  return new Temporal.PlainMonthDay(slots.month, slots.day, getCalendarSlotId(slots.calendar), slots.year);
}

const getShimPlainYearMonthSlots = getPlainYearMonthSlots;

const ShimPlainYearMonthRecord = /*@__PURE__*/ defineTemporalClass(PlainYearMonthRecordBranding, class {
  get calendarId() {
    return getCalendarSlotId(getShimPlainYearMonthSlots(this).calendar);
  }
  toJSON() {
    return formatYearMonthIsoAuto(getShimPlainYearMonthSlots(this));
  }
  valueOf() {
    return forbiddenValueOf();
  }
}, getShimPlainYearMonthSlots, yearMonthFieldGetters);

function createShimPlainYearMonthRecord(slots) {
  const instance = Object.create(ShimPlainYearMonthRecord.prototype);
  return setPlainYearMonthSlots(instance, slots), attachDebugString(instance), instance;
}

function create$3(isoYear, isoMonth, calendar, referenceIsoDay) {
  const isoYearInt = toIntegerWithTrunc(isoYear);
  const isoMonthInt = toIntegerWithTrunc(isoMonth);
  const calendarImpl = refineShimCalendarArgMaybe(calendar);
  const isoDayInt = toIntegerWithTrunc(referenceIsoDay ?? 1);
  const fields = checkIsoYearMonthInBounds(validateIsoDateFields({
    year: isoYearInt,
    month: isoMonthInt,
    day: isoDayInt
  }));
  return createShimPlainYearMonthRecord(createDateSlots(fields, calendarImpl));
}

function fromFields$2(fields, options) {
  const calendarImpl = refineShimCalendarArgMaybe(fields.calendar);
  return createShimPlainYearMonthRecord(refinePlainYearMonthObjectLike(calendarImpl, fields, options));
}

function fromString$3(s, getCalendarRecord) {
  return createShimPlainYearMonthRecord(parsePlainYearMonth(s, createShimCalendarStringResolver(getCalendarRecord)));
}

function daysInMonth$2(record) {
  const slots = getShimPlainYearMonthSlots(record);
  return computeCalendarDaysInMonth(slots.calendar, slots);
}

function daysInYear$2(record) {
  const slots = getShimPlainYearMonthSlots(record);
  return computeCalendarDaysInYear(slots.calendar, slots);
}

function monthsInYear$2(record) {
  const slots = getShimPlainYearMonthSlots(record);
  return computeCalendarMonthsInYear(slots.calendar, slots);
}

function inLeapYear$2(record) {
  const slots = getShimPlainYearMonthSlots(record);
  return computeCalendarInLeapYear(slots.calendar, slots);
}

function withFields$2(record, mod, options) {
  const slots = getShimPlainYearMonthSlots(record);
  return createShimPlainYearMonthRecord(mergePlainYearMonthFields(slots, validateBag(mod), options));
}

function add$3(record, durationRecord, options) {
  const slots = getShimPlainYearMonthSlots(record);
  const durationSlots = getShimDurationSlots(durationRecord);
  return createShimPlainYearMonthRecord(createDateSlots(moveYearMonth(0, slots.calendar, slots, durationSlots, options), slots.calendar));
}

function subtract$3(record, durationRecord, options) {
  const slots = getShimPlainYearMonthSlots(record);
  const durationSlots = getShimDurationSlots(durationRecord);
  return createShimPlainYearMonthRecord(createDateSlots(moveYearMonth(1, slots.calendar, slots, durationSlots, options), slots.calendar));
}

function diff$3(record, otherRecord, options) {
  const slots = getShimPlainYearMonthSlots(record);
  const otherSlots = getShimPlainYearMonthSlots(otherRecord);
  const calendar = getCommonCalendar(slots.calendar, otherSlots.calendar);
  return createShimDurationRecord(diffPlainYearMonth(0, calendar, slots, otherSlots, options));
}

function equals$3(record, otherRecord) {
  const slots = getShimPlainYearMonthSlots(record);
  const otherSlots = getShimPlainYearMonthSlots(otherRecord);
  return plainYearMonthsEqual(slots, otherSlots);
}

function compare$3(record, otherRecord) {
  const slots = getShimPlainYearMonthSlots(record);
  const otherSlots = getShimPlainYearMonthSlots(otherRecord);
  return compareIsoDateFields(slots, otherSlots);
}

const createFormat$2 = /*@__PURE__*/ createDateTimeFormatFactory(internals => ({
  A(record) {
    const slots = getShimPlainYearMonthSlots(record);
    const format = internals.t;
    return checkResolvedCalendarCompatible(format, slots, 1), [ format, isoDateToEpochMilli(slots) ];
  },
  v(record0, record1) {
    const slots0 = getShimPlainYearMonthSlots(record0);
    const slots1 = getShimPlainYearMonthSlots(record1);
    const format = internals.t;
    return checkResolvedCalendarCompatible(format, slots0, 1), checkResolvedCalendarCompatible(format, slots1, 1), 
    [ format, isoDateToEpochMilli(slots0), isoDateToEpochMilli(slots1) ];
  }
}), options => applyPlainFormatTimeZone(transformYearMonthOptions(options, 1)));

function toLocaleString$3(record, locales = void 0, options = {}) {
  const slots = getShimPlainYearMonthSlots(record);
  const format = new RawDateTimeFormat(locales, applyPlainFormatTimeZone(transformYearMonthOptions(options)));
  return checkResolvedCalendarCompatible(format, slots, 1), format.format(isoDateToEpochMilli(slots));
}

function toString$3(record, options) {
  return formatPlainYearMonthIso(getShimPlainYearMonthSlots(record), options);
}

function toBasicString$3(record) {
  return formatYearMonthIsoAuto(getShimPlainYearMonthSlots(record));
}

function toPlainDate$1(record, fields) {
  const slots = getShimPlainYearMonthSlots(record);
  return createShimPlainDateRecord(convertPlainYearMonthToDate(slots.calendar, record, fields));
}

function toTemporal$3(record) {
  const slots = getShimPlainYearMonthSlots(record);
  return new Temporal.PlainYearMonth(slots.year, slots.month, getCalendarSlotId(slots.calendar), slots.day);
}

function addYears$2(record, years, options) {
  const slots = getShimPlainYearMonthSlots(record);
  return createShimPlainYearMonthRecord(createDateSlots(moveYearMonth(0, slots.calendar, slots, createDurationSlots(validateDurationFields({
    ...durationFieldDefaults,
    years: toStrictInteger(years)
  })), options), slots.calendar));
}

function addMonths$2(record, months, options) {
  const slots = getShimPlainYearMonthSlots(record);
  return createShimPlainYearMonthRecord(createDateSlots(moveYearMonth(0, slots.calendar, slots, createDurationSlots(validateDurationFields({
    ...durationFieldDefaults,
    months: toStrictInteger(months)
  })), options), slots.calendar));
}

const subtractYears$2 = /*@__PURE__*/ reversedMove(addYears$2);

const subtractMonths$2 = /*@__PURE__*/ reversedMove(addMonths$2);

function roundToYear$2(record, options) {
  const slots = getShimPlainYearMonthSlots(record);
  const [, roundingMode] = refineRoundToOptions(9, options);
  const roundedIsoDateTime = roundDateToInterval(computeYearInterval, slots.calendar, slots, roundingMode);
  return createShimPlainYearMonthRecord(createDateSlots(roundedIsoDateTime, slots.calendar));
}

function startOfYear$2(record) {
  const slots = getShimPlainYearMonthSlots(record);
  return createShimPlainYearMonthRecord(createDateSlots(computeYearFloor(slots.calendar, slots), slots.calendar));
}

function endOfYear$2(record) {
  const slots = getShimPlainYearMonthSlots(record);
  return createShimPlainYearMonthRecord(createDateSlots(moveYearMonth(1, slots.calendar, computeYearCeil(slots.calendar, slots), createDurationSlots({
    ...durationFieldDefaults,
    months: 1
  })), slots.calendar));
}

function diffYears$2(record0, record1, options) {
  return diffPlainYears(getShimPlainYearMonthSlots(record0), getShimPlainYearMonthSlots(record1), options);
}

function diffMonths$2(record0, record1, options) {
  return diffPlainMonths(getShimPlainYearMonthSlots(record0), getShimPlainYearMonthSlots(record1), options);
}

const getShimPlainDateSlots = getPlainDateSlots;

const ShimPlainDateRecord = /*@__PURE__*/ defineTemporalClass(PlainDateRecordBranding, class {
  get calendarId() {
    return getCalendarSlotId(getShimPlainDateSlots(this).calendar);
  }
  toJSON() {
    return formatDateIsoAuto(getShimPlainDateSlots(this));
  }
  valueOf() {
    return forbiddenValueOf();
  }
}, getShimPlainDateSlots, dateFieldGetters);

function createShimPlainDateRecord(slots) {
  const instance = Object.create(ShimPlainDateRecord.prototype);
  return setPlainDateSlots(instance, slots), attachDebugString(instance), instance;
}

function create$2(isoYear, isoMonth, isoDay, calendar) {
  const fields = checkIsoDateInBounds(validateIsoDateFields(mapProps(toIntegerWithTrunc, {
    year: isoYear,
    month: isoMonth,
    day: isoDay
  })));
  const calendarImpl = refineShimCalendarArgMaybe(calendar);
  return createShimPlainDateRecord(createDateSlots(fields, calendarImpl));
}

function fromFields$1(fields, options) {
  const calendarImpl = refineShimCalendarArgMaybe(fields.calendar);
  return createShimPlainDateRecord(refinePlainDateObjectLike(calendarImpl, fields, options));
}

function fromString$2(s, getCalendarRecord) {
  return createShimPlainDateRecord(parsePlainDate(s, createShimCalendarStringResolver(getCalendarRecord)));
}

function withFields$1(record, mod, options) {
  const slots = getShimPlainDateSlots(record);
  return createShimPlainDateRecord(mergePlainDateFields(slots, validateBag(mod), options));
}

function withCalendar$1(record, inputCalendar) {
  const slots = getShimPlainDateSlots(record);
  const calendarImpl = getCalendarRecordImpl(inputCalendar);
  return createShimPlainDateRecord(createDateSlots(slots, calendarImpl));
}

function dayOfWeek$1(record) {
  return computeIsoDayOfWeek(getShimPlainDateSlots(record));
}

function daysInWeek$1(record) {
  return getShimPlainDateSlots(record), 7;
}

function weekOfYear$1(record) {
  const slots = getShimPlainDateSlots(record);
  return computeCalendarWeekOfYear(slots.calendar, slots);
}

function yearOfWeek$1(record) {
  const slots = getShimPlainDateSlots(record);
  return computeCalendarYearOfWeek(slots.calendar, slots);
}

function dayOfYear$1(record) {
  const slots = getShimPlainDateSlots(record);
  return computeCalendarDayOfYear(slots.calendar, slots);
}

function daysInMonth$1(record) {
  const slots = getShimPlainDateSlots(record);
  return computeCalendarDaysInMonth(slots.calendar, slots);
}

function daysInYear$1(record) {
  const slots = getShimPlainDateSlots(record);
  return computeCalendarDaysInYear(slots.calendar, slots);
}

function monthsInYear$1(record) {
  const slots = getShimPlainDateSlots(record);
  return computeCalendarMonthsInYear(slots.calendar, slots);
}

function inLeapYear$1(record) {
  const slots = getShimPlainDateSlots(record);
  return computeCalendarInLeapYear(slots.calendar, slots);
}

function add$2(record, durationRecord, options) {
  const slots = getShimPlainDateSlots(record);
  const durationSlots = getShimDurationSlots(durationRecord);
  return createShimPlainDateRecord(createDateSlots(moveDate(slots.calendar, slots, durationSlots, options), slots.calendar));
}

function subtract$2(record, durationRecord, options) {
  const slots = getShimPlainDateSlots(record);
  const durationSlots = getShimDurationSlots(durationRecord);
  return createShimPlainDateRecord(createDateSlots(moveDate(slots.calendar, slots, negateDurationFields(durationSlots), options), slots.calendar));
}

function diff$2(record, otherRecord, options) {
  const slots = getShimPlainDateSlots(record);
  const otherSlots = getShimPlainDateSlots(otherRecord);
  const calendar = getCommonCalendar(slots.calendar, otherSlots.calendar);
  return createShimDurationRecord(diffPlainDates(0, calendar, slots, otherSlots, options));
}

function equals$2(record, otherRecord) {
  const slots = getShimPlainDateSlots(record);
  const otherSlots = getShimPlainDateSlots(otherRecord);
  return plainDatesEqual(slots, otherSlots);
}

function compare$2(record, otherRecord) {
  const slots = getShimPlainDateSlots(record);
  const otherSlots = getShimPlainDateSlots(otherRecord);
  return compareIsoDateFields(slots, otherSlots);
}

const createFormat$1 = /*@__PURE__*/ createDateTimeFormatFactory(internals => ({
  A(record) {
    const slots = getShimPlainDateSlots(record);
    const format = internals.t;
    return checkResolvedCalendarCompatible(format, slots), [ format, isoDateToEpochMilli(slots) ];
  },
  v(record0, record1) {
    const slots0 = getShimPlainDateSlots(record0);
    const slots1 = getShimPlainDateSlots(record1);
    const format = internals.t;
    return checkResolvedCalendarCompatible(format, slots0), checkResolvedCalendarCompatible(format, slots1), 
    [ format, isoDateToEpochMilli(slots0), isoDateToEpochMilli(slots1) ];
  }
}), options => applyPlainFormatTimeZone(transformDateOptions(options, 1)));

function toLocaleString$2(record, locales = void 0, options = {}) {
  const slots = getShimPlainDateSlots(record);
  const format = new RawDateTimeFormat(locales, applyPlainFormatTimeZone(transformDateOptions(options)));
  return checkResolvedCalendarCompatible(format, slots), format.format(isoDateToEpochMilli(slots));
}

function toString$2(record, options) {
  return formatPlainDateIso(getShimPlainDateSlots(record), options);
}

function toBasicString$2(record) {
  return formatDateIsoAuto(getShimPlainDateSlots(record));
}

function toZonedDateTime(record, options) {
  const optionsObj = "string" == typeof options ? {
    timeZone: options
  } : options;
  return createShimZonedDateTimeRecord(plainDateToZonedDateTime(refineTimeZoneId, getPlainTimeSlots, getShimPlainDateSlots(record), optionsObj));
}

function toPlainDateTime$1(record, plainTimeRecord = timeFieldDefaults) {
  const slots = getShimPlainDateSlots(record);
  const timeFields = getPlainTimeSlotsIfPresent(plainTimeRecord) || plainTimeRecord;
  return createShimPlainDateTimeRecord(createPlainDateTimeFromRefinedFields(slots, timeFields, slots.calendar));
}

function toPlainYearMonth(record) {
  const slots = getShimPlainDateSlots(record);
  const calendarDate = computeCalendarDateFields(slots.calendar, slots);
  return createShimPlainYearMonthRecord(createPlainYearMonthFromFields(slots.calendar, {
    year: calendarDate.year,
    monthCode: computeCalendarMonthCode(slots.calendar, slots)
  }));
}

function toPlainMonthDay(record) {
  const slots = getShimPlainDateSlots(record);
  const calendarDate = computeCalendarDateFields(slots.calendar, slots);
  return createShimPlainMonthDayRecord(createPlainMonthDayFromFields(slots.calendar, {
    monthCode: computeCalendarMonthCode(slots.calendar, slots),
    day: calendarDate.day
  }));
}

function toTemporal$2(record) {
  const slots = getShimPlainDateSlots(record);
  return new Temporal.PlainDate(slots.year, slots.month, slots.day, getCalendarSlotId(slots.calendar));
}

function withDayOfYear$1(record, dayOfYear, options) {
  const slots = getShimPlainDateSlots(record);
  return createRecordFromDateFields(createDateSlots(moveToDayOfYear(slots.calendar, slots, dayOfYear, options), slots.calendar));
}

function withDayOfMonth$1(record, dayOfMonth, options) {
  const slots = getShimPlainDateSlots(record);
  return createRecordFromDateFields(createDateSlots(moveToDayOfMonth(slots.calendar, slots, dayOfMonth, options), slots.calendar));
}

function withDayOfWeek$1(record, dayOfWeek, options) {
  const slots = getShimPlainDateSlots(record);
  return createRecordFromDateFields(createDateSlots(moveToDayOfWeek(slots.calendar, slots, dayOfWeek, options), slots.calendar));
}

function withWeekOfYear$1(record, weekOfYear, options) {
  const slots = getShimPlainDateSlots(record);
  return createRecordFromDateFields(createDateSlots(moveToWeekOfYear(slots.calendar, slots, weekOfYear, options), slots.calendar));
}

function addYears$1(record, years, options) {
  const slots = getShimPlainDateSlots(record);
  return createRecordFromDateFields(createDateSlots(moveByYears(slots.calendar, slots, years, options), slots.calendar));
}

function addMonths$1(record, months, options) {
  const slots = getShimPlainDateSlots(record);
  return createRecordFromDateFields(createDateSlots(moveByMonths(slots.calendar, slots, months, options), slots.calendar));
}

function addWeeks$1(record, weeks) {
  const slots = getShimPlainDateSlots(record);
  return createRecordFromDateFields(createDateSlots(moveByIsoWeeks(slots.calendar, slots, weeks), slots.calendar));
}

function addDays$1(record, days) {
  const slots = getShimPlainDateSlots(record);
  return createRecordFromDateFields(createDateSlots(moveByDaysStrict(slots.calendar, slots, days), slots.calendar));
}

const subtractYears$1 = (record, units, options) => addYears$1(record, -units, options);

const subtractMonths$1 = (record, units, options) => addMonths$1(record, -units, options);

const subtractWeeks$1 = (record, units) => addWeeks$1(record, -units);

const subtractDays$1 = (record, units) => addDays$1(record, -units);

const roundToYear$1 = /*@__PURE__*/ bindArgs(roundToInterval$1, 9, computeYearInterval);

const roundToMonth$1 = /*@__PURE__*/ bindArgs(roundToInterval$1, 8, computeMonthInterval);

const roundToWeek$1 = /*@__PURE__*/ bindArgs(roundToInterval$1, 7, computeIsoWeekInterval);

const startOfYear$1 = /*@__PURE__*/ aligned$1(computeYearFloor);

const startOfMonth$1 = /*@__PURE__*/ aligned$1(computeMonthFloor);

const startOfWeek$1 = /*@__PURE__*/ aligned$1(computeIsoWeekFloor);

const endOfYear$1 = /*@__PURE__*/ aligned$1(computeYearCeil, -1);

const endOfMonth$1 = /*@__PURE__*/ aligned$1(computeMonthCeil, -1);

const endOfWeek$1 = /*@__PURE__*/ aligned$1(computeIsoWeekCeil, -1);

function diffYears$1(record0, record1, options) {
  return diffPlainYears(getShimPlainDateSlots(record0), getShimPlainDateSlots(record1), options);
}

function diffMonths$1(record0, record1, options) {
  return diffPlainMonths(getShimPlainDateSlots(record0), getShimPlainDateSlots(record1), options);
}

function diffWeeks$1(record0, record1, options) {
  return diffPlainDateDayLikeUnit(7, 7, record0, record1, options);
}

function diffDays$1(record0, record1, options) {
  return diffPlainDateDayLikeUnit(6, 1, record0, record1, options);
}

function diffPlainDateDayLikeUnit(unit, daysInUnit, record0, record1, options) {
  const [roundingInc, roundingMode] = refineUnitDiffOptions(unit, options);
  const slots0 = getShimPlainDateSlots(record0);
  const slots1 = getShimPlainDateSlots(record1);
  let res = (isoDateToEpochDays(slots1) - isoDateToEpochDays(slots0)) / daysInUnit;
  return roundingInc && (res = roundNumberToInc(res, roundingInc, roundingMode)), 
  res;
}

function roundToInterval$1(unit, computeInterval, record, options) {
  const slots = getShimPlainDateSlots(record);
  const [, roundingMode] = refineRoundToOptions(unit, options);
  return createRecordFromDateFields({
    ...roundDateToInterval(computeInterval, slots.calendar, slots, roundingMode),
    calendar: slots.calendar
  });
}

function aligned$1(computeAlignment, dayDelta = 0) {
  return record => {
    const slots = getShimPlainDateSlots(record);
    return createRecordFromDateFields({
      ...moveByDays(computeAlignment(slots.calendar, slots), dayDelta),
      calendar: slots.calendar
    });
  };
}

function createRecordFromDateFields(isoDate) {
  return checkIsoDateInBounds(isoDate), createShimPlainDateRecord(createDateSlots(isoDate, isoDate.calendar));
}

const getShimZonedDateTimeSlots = getZonedDateTimeSlots;

const ShimZonedDateTimeRecord = /*@__PURE__*/ defineTemporalClass(ZonedDateTimeRecordBranding, class {
  get calendarId() {
    return getCalendarSlotId(getShimZonedDateTimeSlots(this).calendar);
  }
  get timeZoneId() {
    return getShimZonedDateTimeSlots(this).timeZone.id;
  }
  get epochMilliseconds() {
    return getEpochMilli(getShimZonedDateTimeSlots(this));
  }
  get epochNanoseconds() {
    return getEpochNano(getShimZonedDateTimeSlots(this));
  }
  toJSON() {
    return formatZonedDateTimeIsoAuto(getShimZonedDateTimeSlots(this));
  }
  valueOf() {
    return forbiddenValueOf();
  }
}, getShimZonedDateTimeIsoSlots, dateFieldGetters, timeGetters);

function createShimZonedDateTimeRecord(slots) {
  const instance = Object.create(ShimZonedDateTimeRecord.prototype);
  return setZonedDateTimeSlots(instance, slots), attachDebugString(instance), instance;
}

function getShimZonedDateTimeIsoSlots(record) {
  const slots = getShimZonedDateTimeSlots(record);
  return {
    ...zonedEpochSlotsToIso(slots),
    calendar: slots.calendar
  };
}

function create$1(epochNanoseconds, timeZoneId, calendar) {
  const epochNano = checkEpochNanoInBounds(toBigInt(epochNanoseconds));
  const timeZone = queryTimeZone(refineTimeZoneId(timeZoneId));
  const calendarImpl = refineShimCalendarArgMaybe(calendar);
  return createShimZonedDateTimeRecord(createZonedEpochNanoSlots(epochNano, timeZone, calendarImpl));
}

function fromFields(fields, options) {
  const calendarImpl = refineShimCalendarArgMaybe(fields.calendar);
  return createShimZonedDateTimeRecord(refineZonedDateTimeObjectLike(refineTimeZoneId, calendarImpl, fields, options));
}

function fromString$1(s, getCalendarRecord, options) {
  return createShimZonedDateTimeRecord(parseZonedDateTime(s, createShimCalendarStringResolver(getCalendarRecord), options));
}

function withFields(record, mod, options) {
  const slots = getShimZonedDateTimeSlots(record);
  return createShimZonedDateTimeRecord(mergeZonedDateTimeFields(slots, validateBag(mod), options));
}

function withCalendar(record, inputCalendar) {
  const slots = getShimZonedDateTimeSlots(record);
  const calendarImpl = getCalendarRecordImpl(inputCalendar);
  return createShimZonedDateTimeRecord(createZonedEpochNanoSlots(slots.epochNanoseconds, slots.timeZone, calendarImpl));
}

function withTimeZone(record, timeZoneId) {
  const slots = getShimZonedDateTimeSlots(record);
  return createShimZonedDateTimeRecord(createZonedEpochNanoSlots(slots.epochNanoseconds, queryTimeZone(refineTimeZoneId(timeZoneId)), slots.calendar));
}

function withPlainTime(record, plainTimeRecord) {
  const slots = getShimZonedDateTimeSlots(record);
  const plainTimeSlots = void 0 === plainTimeRecord ? void 0 : getShimPlainTimeSlots(plainTimeRecord);
  return createShimZonedDateTimeRecord(zonedDateTimeWithPlainTime(slots, plainTimeSlots));
}

function offsetNanoseconds(record) {
  return zonedEpochSlotsToIso(getShimZonedDateTimeSlots(record)).offsetNanoseconds;
}

function offset(record) {
  return formatOffsetNano(offsetNanoseconds(record));
}

function dayOfWeek(record) {
  return computeIsoDayOfWeek(zonedEpochSlotsToIso(getShimZonedDateTimeSlots(record)));
}

function daysInWeek(record) {
  return getShimZonedDateTimeSlots(record), 7;
}

function weekOfYear(record) {
  const slots = getShimZonedDateTimeIsoSlots(record);
  return computeCalendarWeekOfYear(slots.calendar, slots);
}

function yearOfWeek(record) {
  const slots = getShimZonedDateTimeIsoSlots(record);
  return computeCalendarYearOfWeek(slots.calendar, slots);
}

function dayOfYear(record) {
  const slots = getShimZonedDateTimeIsoSlots(record);
  return computeCalendarDayOfYear(slots.calendar, slots);
}

function daysInMonth(record) {
  const slots = getShimZonedDateTimeIsoSlots(record);
  return computeCalendarDaysInMonth(slots.calendar, slots);
}

function daysInYear(record) {
  const slots = getShimZonedDateTimeIsoSlots(record);
  return computeCalendarDaysInYear(slots.calendar, slots);
}

function monthsInYear(record) {
  const slots = getShimZonedDateTimeIsoSlots(record);
  return computeCalendarMonthsInYear(slots.calendar, slots);
}

function inLeapYear(record) {
  const slots = getShimZonedDateTimeIsoSlots(record);
  return computeCalendarInLeapYear(slots.calendar, slots);
}

function hoursInDay(record) {
  return computeZonedHoursInDay(getShimZonedDateTimeSlots(record));
}

function toString$1(record, options) {
  return formatZonedDateTimeIso(getShimZonedDateTimeSlots(record), options);
}

function toBasicString$1(record) {
  return formatZonedDateTimeIsoAuto(getShimZonedDateTimeSlots(record));
}

function add$1(record, durationRecord, options) {
  const slots = getShimZonedDateTimeSlots(record);
  const durationSlots = getShimDurationSlots(durationRecord);
  return createShimZonedDateTimeRecord(moveZonedEpochSlots(slots, durationSlots, options));
}

function subtract$1(record, durationRecord, options) {
  const slots = getShimZonedDateTimeSlots(record);
  const durationSlots = getShimDurationSlots(durationRecord);
  return createShimZonedDateTimeRecord(moveZonedEpochSlots(slots, negateDurationFields(durationSlots), options));
}

function diff$1(record, otherRecord, options) {
  const slots = getShimZonedDateTimeSlots(record);
  const otherSlots = getShimZonedDateTimeSlots(otherRecord);
  const calendar = getCommonCalendar(slots.calendar, otherSlots.calendar);
  return createShimDurationRecord(diffZonedDateTimes(0, calendar, slots, otherSlots, options));
}

function startOfDay(record) {
  return createShimZonedDateTimeRecord(computeZonedStartOfDay(getShimZonedDateTimeSlots(record)));
}

function getTimeZoneTransition(record, options) {
  const slots = getShimZonedDateTimeSlots(record);
  const epochNanoseconds = getTimeZoneTransitionEpochNanoseconds(slots, options);
  return epochNanoseconds ? createShimZonedDateTimeRecord({
    ...slots,
    epochNanoseconds: epochNanoseconds
  }) : null;
}

function equals$1(record, otherRecord) {
  const slots = getShimZonedDateTimeSlots(record);
  const otherSlots = getShimZonedDateTimeSlots(otherRecord);
  return zonedDateTimesEqual(slots, otherSlots);
}

function compare$1(record, otherRecord) {
  const slots = getShimZonedDateTimeSlots(record);
  const otherSlots = getShimZonedDateTimeSlots(otherRecord);
  return compareZonedEpochSlots(slots, otherSlots);
}

function toLocaleString$1(record, locales = void 0, options = {}) {
  const slots = getShimZonedDateTimeSlots(record);
  const format = new RawDateTimeFormat(locales, applyZonedFormatTimeZone(transformZonedOptions(options), getZonedTimeZoneId(slots)));
  return checkResolvedCalendarCompatible(format, slots), format.format(getEpochMilli(slots));
}

function toInstant(record) {
  return createShimInstantRecord(zonedDateTimeToInstant(getShimZonedDateTimeSlots(record)));
}

function toPlainDateTime(record) {
  return createShimPlainDateTimeRecord(zonedDateTimeToPlainDateTime(getShimZonedDateTimeSlots(record)));
}

function toPlainDate(record) {
  return createShimPlainDateRecord(zonedDateTimeToPlainDate(getShimZonedDateTimeSlots(record)));
}

function toPlainTime(record) {
  return createShimPlainTimeRecord(zonedDateTimeToPlainTime(getShimZonedDateTimeSlots(record)));
}

function toTemporal$1(record) {
  const slots = getShimZonedDateTimeSlots(record);
  return new Temporal.ZonedDateTime(slots.epochNanoseconds, slots.timeZone.id, getCalendarSlotId(slots.calendar));
}

const withDayOfYear = /*@__PURE__*/ zonedTransform(moveToDayOfYear);

const withDayOfMonth = /*@__PURE__*/ zonedTransform(moveToDayOfMonth);

const withDayOfWeek = /*@__PURE__*/ zonedTransform(moveToDayOfWeek);

const withWeekOfYear = /*@__PURE__*/ zonedTransform(moveToWeekOfYear);

const addYears = /*@__PURE__*/ zonedTransform(moveByYears);

const addMonths = /*@__PURE__*/ zonedTransform(moveByMonths);

const addWeeks = /*@__PURE__*/ zonedTransform(moveByIsoWeeks);

const addDays = /*@__PURE__*/ zonedTransform(moveByDaysStrict);

const addHours$1 = /*@__PURE__*/ bindArgs(moveByTimeUnit, nanoInHour);

const addMinutes$1 = /*@__PURE__*/ bindArgs(moveByTimeUnit, nanoInMinute);

const addSeconds$1 = /*@__PURE__*/ bindArgs(moveByTimeUnit, nanoInSec);

const addMilliseconds$1 = /*@__PURE__*/ bindArgs(moveByTimeUnit, nanoInMilli);

const addMicroseconds$1 = /*@__PURE__*/ bindArgs(moveByTimeUnit, nanoInMicro);

const addNanoseconds$1 = /*@__PURE__*/ bindArgs(moveByTimeUnit, 1);

const subtractYears = /*@__PURE__*/ reversedMove(addYears);

const subtractMonths = /*@__PURE__*/ reversedMove(addMonths);

const subtractWeeks = /*@__PURE__*/ reversedMove(addWeeks);

const subtractDays = /*@__PURE__*/ reversedMove(addDays);

const subtractHours$1 = /*@__PURE__*/ reversedMove(addHours$1);

const subtractMinutes$1 = /*@__PURE__*/ reversedMove(addMinutes$1);

const subtractSeconds$1 = /*@__PURE__*/ reversedMove(addSeconds$1);

const subtractMilliseconds$1 = /*@__PURE__*/ reversedMove(addMilliseconds$1);

const subtractMicroseconds$1 = /*@__PURE__*/ reversedMove(addMicroseconds$1);

const subtractNanoseconds$1 = /*@__PURE__*/ reversedMove(addNanoseconds$1);

const roundToYear = /*@__PURE__*/ bindArgs(roundToInterval, 9, computeYearInterval);

const roundToMonth = /*@__PURE__*/ bindArgs(roundToInterval, 8, computeMonthInterval);

const roundToWeek = /*@__PURE__*/ bindArgs(roundToInterval, 7, computeIsoWeekInterval);

function roundToDayTimeUnit(smallestUnit, record, options) {
  const slots = getShimZonedDateTimeSlots(record);
  const [roundingInc, roundingMode] = refineRoundToOptions(smallestUnit, options);
  return createShimZonedDateTimeRecord(roundZonedEpochSlotsToUnit(slots, smallestUnit, roundingInc, roundingMode));
}

const roundToDay = /*@__PURE__*/ bindArgs(roundToDayTimeUnit, 6);

const roundToHour$1 = /*@__PURE__*/ bindArgs(roundToDayTimeUnit, 5);

const roundToMinute$1 = /*@__PURE__*/ bindArgs(roundToDayTimeUnit, 4);

const roundToSecond$1 = /*@__PURE__*/ bindArgs(roundToDayTimeUnit, 3);

const roundToMillisecond$1 = /*@__PURE__*/ bindArgs(roundToDayTimeUnit, 2);

const roundToMicrosecond$1 = /*@__PURE__*/ bindArgs(roundToDayTimeUnit, 1);

const startOfYear = /*@__PURE__*/ aligned(computeYearFloor);

const startOfMonth = /*@__PURE__*/ aligned(computeMonthFloor);

const startOfWeek = /*@__PURE__*/ aligned(computeIsoWeekFloor);

const startOfHour = /*@__PURE__*/ alignedZonedTime(slots => ({
  hour: slots.hour,
  minute: 0,
  second: 0,
  millisecond: 0,
  microsecond: 0,
  nanosecond: 0
}));

const startOfMinute = /*@__PURE__*/ alignedZonedTime(slots => ({
  hour: slots.hour,
  minute: slots.minute,
  second: 0,
  millisecond: 0,
  microsecond: 0,
  nanosecond: 0
}));

const startOfSecond = /*@__PURE__*/ alignedZonedTime(slots => ({
  hour: slots.hour,
  minute: slots.minute,
  second: slots.second,
  millisecond: 0,
  microsecond: 0,
  nanosecond: 0
}));

const startOfMillisecond = /*@__PURE__*/ alignedZonedTime(slots => ({
  hour: slots.hour,
  minute: slots.minute,
  second: slots.second,
  millisecond: slots.millisecond,
  microsecond: 0,
  nanosecond: 0
}));

const startOfMicrosecond = /*@__PURE__*/ alignedZonedTime(slots => ({
  hour: slots.hour,
  minute: slots.minute,
  second: slots.second,
  millisecond: slots.millisecond,
  microsecond: slots.microsecond,
  nanosecond: 0
}));

const endOfYear = /*@__PURE__*/ aligned(computeYearCeil, -1);

const endOfMonth = /*@__PURE__*/ aligned(computeMonthCeil, -1);

const endOfWeek = /*@__PURE__*/ aligned(computeIsoWeekCeil, -1);

const endOfDay = /*@__PURE__*/ aligned(computeDayCeil, -1);

const endOfHour = /*@__PURE__*/ alignedZonedTime(slots => ({
  hour: slots.hour,
  minute: 0,
  second: 0,
  millisecond: 0,
  microsecond: 0,
  nanosecond: 0
}), nanoInHour - 1);

const endOfMinute = /*@__PURE__*/ alignedZonedTime(slots => ({
  hour: slots.hour,
  minute: slots.minute,
  second: 0,
  millisecond: 0,
  microsecond: 0,
  nanosecond: 0
}), nanoInMinute - 1);

const endOfSecond = /*@__PURE__*/ alignedZonedTime(slots => ({
  hour: slots.hour,
  minute: slots.minute,
  second: slots.second,
  millisecond: 0,
  microsecond: 0,
  nanosecond: 0
}), nanoInSec - 1);

const endOfMillisecond = /*@__PURE__*/ alignedZonedTime(slots => ({
  hour: slots.hour,
  minute: slots.minute,
  second: slots.second,
  millisecond: slots.millisecond,
  microsecond: 0,
  nanosecond: 0
}), nanoInMilli - 1);

const endOfMicrosecond = /*@__PURE__*/ alignedZonedTime(slots => ({
  hour: slots.hour,
  minute: slots.minute,
  second: slots.second,
  millisecond: slots.millisecond,
  microsecond: slots.microsecond,
  nanosecond: 0
}), nanoInMicro - 1);

function diffYears(record0, record1, options) {
  return diffZonedYears(getShimZonedDateTimeSlots(record0), getShimZonedDateTimeSlots(record1), options);
}

function diffMonths(record0, record1, options) {
  return diffZonedMonths(getShimZonedDateTimeSlots(record0), getShimZonedDateTimeSlots(record1), options);
}

function diffWeeks(record0, record1, options) {
  return diffZonedWeeks(getShimZonedDateTimeSlots(record0), getShimZonedDateTimeSlots(record1), options);
}

function diffDays(record0, record1, options) {
  return diffZonedDays(getShimZonedDateTimeSlots(record0), getShimZonedDateTimeSlots(record1), options);
}

const diffRecordTimeUnit$1 = /*@__PURE__*/ adaptRecordTimeUnitDiff(diffZonedEpochNanoTimeUnit, getShimZonedDateTimeSlots);

const diffHours$1 = /*@__PURE__*/ bindArgs(diffRecordTimeUnit$1, 5, nanoInHour);

const diffMinutes$1 = /*@__PURE__*/ bindArgs(diffRecordTimeUnit$1, 4, nanoInMinute);

const diffSeconds$1 = /*@__PURE__*/ bindArgs(diffRecordTimeUnit$1, 3, nanoInSec);

const diffMilliseconds$1 = /*@__PURE__*/ bindArgs(diffRecordTimeUnit$1, 2, nanoInMilli);

const diffMicroseconds$1 = /*@__PURE__*/ bindArgs(diffRecordTimeUnit$1, 1, nanoInMicro);

const diffNanoseconds$1 = /*@__PURE__*/ bindArgs(diffRecordTimeUnit$1, 0, 1);

function moveByTimeUnit(nanoInUnit, record, units) {
  const slots = getShimZonedDateTimeSlots(record);
  const epochNanoseconds = slots.epochNanoseconds + BigInt(toStrictInteger(units)) * BigInt(nanoInUnit);
  return createShimZonedDateTimeRecord({
    ...slots,
    epochNanoseconds: checkEpochNanoInBounds(epochNanoseconds)
  });
}

function roundToInterval(unit, computeInterval, record, options) {
  const slots = getShimZonedDateTimeSlots(record);
  const [, roundingMode] = refineRoundToOptions(unit, options);
  const epochNanoseconds = roundZonedEpochToInterval(computeInterval, slots, roundingMode);
  return createShimZonedDateTimeRecord({
    ...slots,
    epochNanoseconds: checkEpochNanoInBounds(epochNanoseconds)
  });
}

function aligned(computeAlignment, nanoDelta = 0) {
  return record => {
    const slots = getShimZonedDateTimeSlots(record);
    const epochNanoseconds = alignZonedEpoch(computeAlignment, slots) + BigInt(nanoDelta);
    return createShimZonedDateTimeRecord({
      ...slots,
      epochNanoseconds: checkEpochNanoInBounds(epochNanoseconds)
    });
  };
}

function alignedZonedTime(computeAlignment, nanoDelta = 0) {
  return record => {
    const slots = getShimZonedDateTimeSlots(record);
    const {timeZone: timeZone} = slots;
    const isoDateTime = zonedEpochSlotsToIso(slots);
    const alignedIsoDateTime = combineDateAndTime(isoDateTime, computeAlignment(isoDateTime));
    const epochNanoseconds = getMatchingInstantFor(timeZone, alignedIsoDateTime, isoDateTime.offsetNanoseconds, 2, 0, 1) + BigInt(nanoDelta);
    return createShimZonedDateTimeRecord({
      ...slots,
      epochNanoseconds: checkEpochNanoInBounds(epochNanoseconds)
    });
  };
}

function zonedTransform(transformIsoDate) {
  return (record, ...args) => {
    const slots = getShimZonedDateTimeSlots(record);
    const {calendar: calendar, timeZone: timeZone} = slots;
    const isoDateTime = zonedEpochSlotsToIso(slots);
    const isoDate = transformIsoDate(calendar, isoDateTime, ...args);
    const epochNanoseconds = getSingleInstantFor(timeZone, combineDateAndTime(isoDate, isoDateTime));
    return createShimZonedDateTimeRecord({
      ...slots,
      epochNanoseconds: checkEpochNanoInBounds(epochNanoseconds)
    });
  };
}

const getShimInstantSlots = getInstantSlots;

const ShimInstantRecord = /*@__PURE__*/ defineTemporalClass(InstantRecordBranding, class {
  get epochMilliseconds() {
    return getEpochMilli(getShimInstantSlots(this));
  }
  get epochNanoseconds() {
    return getEpochNano(getShimInstantSlots(this));
  }
  toJSON() {
    return formatInstantIsoAuto(getShimInstantSlots(this));
  }
  valueOf() {
    return forbiddenValueOf();
  }
});

function createShimInstantRecord(slots) {
  const instance = Object.create(ShimInstantRecord.prototype);
  return setInstantSlots(instance, slots), attachDebugString(instance), instance;
}

function create(epochNanoseconds) {
  const epochNano = checkEpochNanoInBounds(toBigInt(epochNanoseconds));
  return createShimInstantRecord(createEpochNanoSlots(epochNano));
}

function fromEpochMilliseconds(epochMilliseconds) {
  return createShimInstantRecord(epochMilliToInstant(epochMilliseconds));
}

function fromEpochNanoseconds(epochNanoseconds) {
  return createShimInstantRecord(epochNanoToInstant(epochNanoseconds));
}

function fromString(s) {
  return createShimInstantRecord(parseInstant(s));
}

function add(record, durationRecord) {
  const slots = getShimInstantSlots(record);
  const durationSlots = getShimDurationSlots(durationRecord);
  return createShimInstantRecord(createEpochNanoSlots(moveEpochNano(slots.epochNanoseconds, durationSlots)));
}

function subtract(record, durationRecord) {
  const slots = getShimInstantSlots(record);
  const durationSlots = getShimDurationSlots(durationRecord);
  return createShimInstantRecord(createEpochNanoSlots(moveEpochNano(slots.epochNanoseconds, negateDurationFields(durationSlots))));
}

function diff(record, otherRecord, options) {
  const slots = getShimInstantSlots(record);
  const otherSlots = getShimInstantSlots(otherRecord);
  return createShimDurationRecord(diffInstants(0, slots, otherSlots, options));
}

function equals(record, otherRecord) {
  const slots = getShimInstantSlots(record);
  const otherSlots = getShimInstantSlots(otherRecord);
  return instantsEqual(slots, otherSlots);
}

function compare(record, otherRecord) {
  const slots = getShimInstantSlots(record);
  const otherSlots = getShimInstantSlots(otherRecord);
  return compareZonedEpochSlots(slots, otherSlots);
}

function toZonedDateTimeISO(record, timeZoneId) {
  return createShimZonedDateTimeRecord(instantToZonedDateTime(getShimInstantSlots(record), queryTimeZone(refineTimeZoneId(timeZoneId))));
}

const createFormat = /*@__PURE__*/ createDateTimeFormatFactory(internals => ({
  A(record) {
    const slots = getShimInstantSlots(record);
    return [ internals.t, getEpochMilli(slots) ];
  },
  v(record0, record1) {
    const slots0 = getShimInstantSlots(record0);
    const slots1 = getShimInstantSlots(record1);
    return [ internals.t, getEpochMilli(slots0), getEpochMilli(slots1) ];
  }
}), options => transformInstantOptions(options, 1));

function toLocaleString(record, locales = void 0, options = {}) {
  const slots = getShimInstantSlots(record);
  return new RawDateTimeFormat(locales, transformInstantOptions(options)).format(getEpochMilli(slots));
}

function toString(record, options) {
  return formatInstantIso(refineTimeZoneId, getShimInstantSlots(record), options);
}

function toBasicString(record) {
  return formatInstantIsoAuto(getShimInstantSlots(record));
}

function toTemporal(record) {
  const slots = getShimInstantSlots(record);
  return new Temporal.Instant(slots.epochNanoseconds);
}

function moveByNanoseconds(record, nanoseconds) {
  const slots = getShimInstantSlots(record);
  return createShimInstantRecord(createEpochNanoSlots(checkEpochNanoInBounds(slots.epochNanoseconds + nanoseconds)));
}

function addHours(record, hours) {
  return moveByNanoseconds(record, BigInt(toStrictInteger(hours)) * bigNanoInHour);
}

function addMinutes(record, minutes) {
  return moveByNanoseconds(record, BigInt(toStrictInteger(minutes)) * bigNanoInMinute);
}

function addSeconds(record, seconds) {
  return moveByNanoseconds(record, BigInt(toStrictInteger(seconds)) * bigNanoInSec);
}

function addMilliseconds(record, milliseconds) {
  return moveByNanoseconds(record, BigInt(toStrictInteger(milliseconds)) * bigNanoInMilli);
}

function addMicroseconds(record, microseconds) {
  return moveByNanoseconds(record, BigInt(toStrictInteger(microseconds)) * bigNanoInMicro);
}

function addNanoseconds(record, nanoseconds) {
  return moveByNanoseconds(record, BigInt(toStrictInteger(nanoseconds)));
}

function subtractHours(record, hours) {
  return moveByNanoseconds(record, -BigInt(toStrictInteger(hours)) * bigNanoInHour);
}

function subtractMinutes(record, minutes) {
  return moveByNanoseconds(record, -BigInt(toStrictInteger(minutes)) * bigNanoInMinute);
}

function subtractSeconds(record, seconds) {
  return moveByNanoseconds(record, -BigInt(toStrictInteger(seconds)) * bigNanoInSec);
}

function subtractMilliseconds(record, milliseconds) {
  return moveByNanoseconds(record, -BigInt(toStrictInteger(milliseconds)) * bigNanoInMilli);
}

function subtractMicroseconds(record, microseconds) {
  return moveByNanoseconds(record, -BigInt(toStrictInteger(microseconds)) * bigNanoInMicro);
}

function subtractNanoseconds(record, nanoseconds) {
  return moveByNanoseconds(record, -BigInt(toStrictInteger(nanoseconds)));
}

function roundToUnit(smallestUnit, record, options) {
  const slots = getShimInstantSlots(record);
  const [roundingInc, roundingMode] = refineRoundToOptions(smallestUnit, options, 1);
  return createShimInstantRecord(createEpochNanoSlots(roundBigNanoToDayOriginInc(slots.epochNanoseconds, computeBigNanoInc(smallestUnit, roundingInc), roundingMode)));
}

const roundToHour = /*@__PURE__*/ bindArgs(roundToUnit, 5);

const roundToMinute = /*@__PURE__*/ bindArgs(roundToUnit, 4);

const roundToSecond = /*@__PURE__*/ bindArgs(roundToUnit, 3);

const roundToMillisecond = /*@__PURE__*/ bindArgs(roundToUnit, 2);

const roundToMicrosecond = /*@__PURE__*/ bindArgs(roundToUnit, 1);

const diffRecordTimeUnit = /*@__PURE__*/ adaptRecordTimeUnitDiff(diffInstantEpochNanoTimeUnit, getShimInstantSlots);

const diffHours = /*@__PURE__*/ bindArgs(diffRecordTimeUnit, 5, nanoInHour);

const diffMinutes = /*@__PURE__*/ bindArgs(diffRecordTimeUnit, 4, nanoInMinute);

const diffSeconds = /*@__PURE__*/ bindArgs(diffRecordTimeUnit, 3, nanoInSec);

const diffMilliseconds = /*@__PURE__*/ bindArgs(diffRecordTimeUnit, 2, nanoInMilli);

const diffMicroseconds = /*@__PURE__*/ bindArgs(diffRecordTimeUnit, 1, nanoInMicro);

const diffNanoseconds = /*@__PURE__*/ bindArgs(diffRecordTimeUnit, 0, 1);

const timeZoneId = getCurrentTimeZoneId;

function instant() {
  return createShimInstantRecord(createEpochNanoSlots(getCurrentEpochNano()));
}

function zonedDateTimeISO(timeZoneId = getCurrentTimeZoneId()) {
  const timeZone = queryTimeZone(refineTimeZoneId(timeZoneId));
  return createShimZonedDateTimeRecord(createZonedEpochNanoSlots(getCurrentEpochNano(), timeZone));
}

function plainDateTimeISO(timeZoneId = getCurrentTimeZoneId()) {
  const isoDateTime = getCurrentIsoDateTime(queryTimeZone(refineTimeZoneId(timeZoneId)));
  return createShimPlainDateTimeRecord(createDateTimeSlots(isoDateTime));
}

function plainDateISO(timeZoneId = getCurrentTimeZoneId()) {
  const isoDateTime = getCurrentIsoDateTime(queryTimeZone(refineTimeZoneId(timeZoneId)));
  return createShimPlainDateRecord(createDateSlots(isoDateTime));
}

function plainTimeISO(timeZoneId = getCurrentTimeZoneId()) {
  const isoDateTime = getCurrentIsoDateTime(queryTimeZone(refineTimeZoneId(timeZoneId)));
  return createShimPlainTimeRecord(createTimeSlots(isoDateTime));
}

export { abs, add, add$1, add$4 as add$2, add$2 as add$3, add$5 as add$4, add$3 as add$5, add$6, addDays, addDays$2 as addDays$1, addDays$1 as addDays$2, addHours, addHours$1, addHours$2, addHours$3, addMicroseconds, addMicroseconds$1, addMicroseconds$2, addMicroseconds$3, addMilliseconds, addMilliseconds$1, addMilliseconds$2, addMilliseconds$3, addMinutes, addMinutes$1, addMinutes$2, addMinutes$3, addMonths, addMonths$3 as addMonths$1, addMonths$1 as addMonths$2, addMonths$2 as addMonths$3, addNanoseconds, addNanoseconds$1, addNanoseconds$2, addNanoseconds$3, addSeconds, addSeconds$1, addSeconds$2, addSeconds$3, addWeeks, addWeeks$2 as addWeeks$1, addWeeks$1 as addWeeks$2, addYears, addYears$3 as addYears$1, addYears$1 as addYears$2, addYears$2 as addYears$3, blank, compare, compare$1, compare$4 as compare$2, compare$2 as compare$3, compare$5 as compare$4, compare$3 as compare$5, compare$6, create, create$1, create$5 as create$2, create$2 as create$3, create$6 as create$4, create$3 as create$5, create$4 as create$6, create$7, createFormat, createFormat$4 as createFormat$1, createFormat$1 as createFormat$2, createFormat$5 as createFormat$3, createFormat$2 as createFormat$4, createFormat$3 as createFormat$5, dayOfWeek, dayOfWeek$2 as dayOfWeek$1, dayOfWeek$1 as dayOfWeek$2, dayOfYear, dayOfYear$2 as dayOfYear$1, dayOfYear$1 as dayOfYear$2, daysInMonth, daysInMonth$3 as daysInMonth$1, daysInMonth$1 as daysInMonth$2, daysInMonth$2 as daysInMonth$3, daysInWeek, daysInWeek$2 as daysInWeek$1, daysInWeek$1 as daysInWeek$2, daysInYear, daysInYear$3 as daysInYear$1, daysInYear$1 as daysInYear$2, daysInYear$2 as daysInYear$3, diff, diff$1, diff$4 as diff$2, diff$2 as diff$3, diff$5 as diff$4, diff$3 as diff$5, diffDays, diffDays$2 as diffDays$1, diffDays$1 as diffDays$2, diffHours, diffHours$1, diffHours$2, diffHours$3, diffMicroseconds, diffMicroseconds$1, diffMicroseconds$2, diffMicroseconds$3, diffMilliseconds, diffMilliseconds$1, diffMilliseconds$2, diffMilliseconds$3, diffMinutes, diffMinutes$1, diffMinutes$2, diffMinutes$3, diffMonths, diffMonths$3 as diffMonths$1, diffMonths$1 as diffMonths$2, diffMonths$2 as diffMonths$3, diffNanoseconds, diffNanoseconds$1, diffNanoseconds$2, diffNanoseconds$3, diffSeconds, diffSeconds$1, diffSeconds$2, diffSeconds$3, diffWeeks, diffWeeks$2 as diffWeeks$1, diffWeeks$1 as diffWeeks$2, diffYears, diffYears$3 as diffYears$1, diffYears$1 as diffYears$2, diffYears$2 as diffYears$3, endOfDay, endOfDay$1, endOfHour, endOfHour$1, endOfHour$2, endOfMicrosecond, endOfMicrosecond$1, endOfMicrosecond$2, endOfMillisecond, endOfMillisecond$1, endOfMillisecond$2, endOfMinute, endOfMinute$1, endOfMinute$2, endOfMonth, endOfMonth$2 as endOfMonth$1, endOfMonth$1 as endOfMonth$2, endOfSecond, endOfSecond$1, endOfSecond$2, endOfWeek, endOfWeek$2 as endOfWeek$1, endOfWeek$1 as endOfWeek$2, endOfYear, endOfYear$3 as endOfYear$1, endOfYear$1 as endOfYear$2, endOfYear$2 as endOfYear$3, equals, equals$1, equals$5 as equals$2, equals$2 as equals$3, equals$6 as equals$4, equals$3 as equals$5, equals$4 as equals$6, fromEpochMilliseconds, fromEpochNanoseconds, fromFields, fromFields$4 as fromFields$1, fromFields$1 as fromFields$2, fromFields$5 as fromFields$3, fromFields$2 as fromFields$4, fromFields$3 as fromFields$5, fromFields$6, fromString, fromString$1, fromString$5 as fromString$2, fromString$2 as fromString$3, fromString$6 as fromString$4, fromString$3 as fromString$5, fromString$4 as fromString$6, fromString$7, getTimeZoneTransition, hoursInDay, inLeapYear, inLeapYear$3 as inLeapYear$1, inLeapYear$1 as inLeapYear$2, inLeapYear$2 as inLeapYear$3, instant, monthsInYear, monthsInYear$3 as monthsInYear$1, monthsInYear$1 as monthsInYear$2, monthsInYear$2 as monthsInYear$3, negated, offset, offsetNanoseconds, plainDateISO, plainDateTimeISO, plainTimeISO, round, roundToDay, roundToDay$1, roundToHour, roundToHour$1, roundToHour$2, roundToHour$3, roundToMicrosecond, roundToMicrosecond$1, roundToMicrosecond$2, roundToMicrosecond$3, roundToMillisecond, roundToMillisecond$1, roundToMillisecond$2, roundToMillisecond$3, roundToMinute, roundToMinute$1, roundToMinute$2, roundToMinute$3, roundToMonth, roundToMonth$2 as roundToMonth$1, roundToMonth$1 as roundToMonth$2, roundToSecond, roundToSecond$1, roundToSecond$2, roundToSecond$3, roundToWeek, roundToWeek$2 as roundToWeek$1, roundToWeek$1 as roundToWeek$2, roundToYear, roundToYear$3 as roundToYear$1, roundToYear$1 as roundToYear$2, roundToYear$2 as roundToYear$3, sign, startOfDay, startOfDay$1, startOfHour, startOfHour$1, startOfHour$2, startOfMicrosecond, startOfMicrosecond$1, startOfMicrosecond$2, startOfMillisecond, startOfMillisecond$1, startOfMillisecond$2, startOfMinute, startOfMinute$1, startOfMinute$2, startOfMonth, startOfMonth$2 as startOfMonth$1, startOfMonth$1 as startOfMonth$2, startOfSecond, startOfSecond$1, startOfSecond$2, startOfWeek, startOfWeek$2 as startOfWeek$1, startOfWeek$1 as startOfWeek$2, startOfYear, startOfYear$3 as startOfYear$1, startOfYear$1 as startOfYear$2, startOfYear$2 as startOfYear$3, subtract, subtract$1, subtract$4 as subtract$2, subtract$2 as subtract$3, subtract$5 as subtract$4, subtract$3 as subtract$5, subtract$6, subtractDays, subtractDays$2 as subtractDays$1, subtractDays$1 as subtractDays$2, subtractHours, subtractHours$1, subtractHours$2, subtractHours$3, subtractMicroseconds, subtractMicroseconds$1, subtractMicroseconds$2, subtractMicroseconds$3, subtractMilliseconds, subtractMilliseconds$1, subtractMilliseconds$2, subtractMilliseconds$3, subtractMinutes, subtractMinutes$1, subtractMinutes$2, subtractMinutes$3, subtractMonths, subtractMonths$3 as subtractMonths$1, subtractMonths$1 as subtractMonths$2, subtractMonths$2 as subtractMonths$3, subtractNanoseconds, subtractNanoseconds$1, subtractNanoseconds$2, subtractNanoseconds$3, subtractSeconds, subtractSeconds$1, subtractSeconds$2, subtractSeconds$3, subtractWeeks, subtractWeeks$2 as subtractWeeks$1, subtractWeeks$1 as subtractWeeks$2, subtractYears, subtractYears$3 as subtractYears$1, subtractYears$1 as subtractYears$2, subtractYears$2 as subtractYears$3, timeZoneId, toBasicString, toBasicString$1, toBasicString$5 as toBasicString$2, toBasicString$2 as toBasicString$3, toBasicString$6 as toBasicString$4, toBasicString$3 as toBasicString$5, toBasicString$4 as toBasicString$6, toBasicString$7, toInstant, toLocaleString, toLocaleString$1, toLocaleString$5 as toLocaleString$2, toLocaleString$2 as toLocaleString$3, toLocaleString$6 as toLocaleString$4, toLocaleString$3 as toLocaleString$5, toLocaleString$4 as toLocaleString$6, toLocaleString$7, toPlainDate, toPlainDate$3 as toPlainDate$1, toPlainDate$1 as toPlainDate$2, toPlainDate$2 as toPlainDate$3, toPlainDateTime, toPlainDateTime$1, toPlainMonthDay, toPlainTime, toPlainTime$1, toPlainYearMonth, toString, toString$1, toString$5 as toString$2, toString$2 as toString$3, toString$6 as toString$4, toString$3 as toString$5, toString$4 as toString$6, toString$7, toTemporal, toTemporal$1, toTemporal$5 as toTemporal$2, toTemporal$2 as toTemporal$3, toTemporal$6 as toTemporal$4, toTemporal$3 as toTemporal$5, toTemporal$4 as toTemporal$6, toTemporal$7, toZonedDateTime$1 as toZonedDateTime, toZonedDateTime as toZonedDateTime$1, toZonedDateTimeISO, total, weekOfYear, weekOfYear$2 as weekOfYear$1, weekOfYear$1 as weekOfYear$2, withCalendar, withCalendar$2 as withCalendar$1, withCalendar$1 as withCalendar$2, withDayOfMonth, withDayOfMonth$2 as withDayOfMonth$1, withDayOfMonth$1 as withDayOfMonth$2, withDayOfWeek, withDayOfWeek$2 as withDayOfWeek$1, withDayOfWeek$1 as withDayOfWeek$2, withDayOfYear, withDayOfYear$2 as withDayOfYear$1, withDayOfYear$1 as withDayOfYear$2, withFields, withFields$4 as withFields$1, withFields$1 as withFields$2, withFields$5 as withFields$3, withFields$2 as withFields$4, withFields$3 as withFields$5, withFields$6, withPlainTime, withPlainTime$1, withTimeZone, withWeekOfYear, withWeekOfYear$2 as withWeekOfYear$1, withWeekOfYear$1 as withWeekOfYear$2, yearOfWeek, yearOfWeek$2 as yearOfWeek$1, yearOfWeek$1 as yearOfWeek$2, zonedDateTimeISO };
