import { isoEpochFirstLeapYear, computeIsoFieldsFromParts, isoArgsToEpochDays, milliInUtcDay, computeIsoMonthCodeParts, computeIsoInLeapYear, isoMonthsInYear, computeIsoDaysInMonth, computeIsoDaysInYear, addIsoMonths, diffIsoMonthSlots, computeIsoYearMonthFieldsForMonthDay, bindArgs, memoize, isoDateToEpochMilli, epochMilliToIsoDateTime, diffEpochMilliDays, compareNumbers, throwRangeError, outOfBoundsDate, maxMilli, monthToMonthCodeNumber, monthCodeNumberToMonth, formatEpochMilliToPartsRecord, isoEpochOriginYear, RawDateTimeFormat, utcTimeZoneId, isoDateToEpochDays, epochDaysToIsoDate, noop } from "./internal.js";

function createGregoryAlignedCalendar(config) {
  const isoYearOffset = config.me || 0;
  function calendarYearToIsoYear(year) {
    return year - isoYearOffset;
  }
  function isoYearToCalendarYear(year) {
    return year + isoYearOffset;
  }
  return {
    k: config.k,
    ne: isoEpochFirstLeapYear + isoYearOffset,
    ge: config.ge,
    ae(isoDate) {
      return {
        ...isoDate,
        year: isoYearToCalendarYear(isoDate.year)
      };
    },
    de(year, month, day) {
      return computeIsoFieldsFromParts(calendarYearToIsoYear(year), month, day);
    },
    le(year, month, day) {
      return isoArgsToEpochDays(calendarYearToIsoYear(year), month, day) * milliInUtcDay;
    },
    L(_year, month) {
      return computeIsoMonthCodeParts(month);
    },
    u(monthCodeNumber, isLeapMonth) {
      const yearMonth = computeIsoYearMonthFieldsForMonthDay(monthCodeNumber, isLeapMonth);
      return yearMonth && {
        year: isoYearToCalendarYear(yearMonth.year),
        month: yearMonth.month
      };
    },
    q(year) {
      return computeIsoInLeapYear(calendarYearToIsoYear(year));
    },
    j() {
      return isoMonthsInYear;
    },
    o(year, month) {
      return computeIsoDaysInMonth(calendarYearToIsoYear(year), month);
    },
    i(year) {
      return computeIsoDaysInYear(calendarYearToIsoYear(year));
    },
    p() {},
    h(isoDate) {
      return config.h?.(isoDate, isoYearToCalendarYear(isoDate.year)) || {};
    },
    K(year, month, monthDelta) {
      const yearMonth = addIsoMonths(calendarYearToIsoYear(year), month, monthDelta);
      return {
        year: isoYearToCalendarYear(yearMonth.year),
        month: yearMonth.month
      };
    },
    _(year0, month0, year1, month1) {
      return diffIsoMonthSlots(calendarYearToIsoYear(year0), month0, calendarYearToIsoYear(year1), month1);
    }
  };
}

function createIntlScrapedCalendar(normCalendarId, config) {
  const intlData = createIntlScrapedCalendarData(normCalendarId);
  return {
    l: config.l,
    U: config.U,
    R: config.R,
    ae: intlData.je,
    de: bindArgs(computeIsoFieldsFromIntlParts, intlData),
    le: bindArgs(computeIntlEpochMilli, intlData),
    L: bindArgs(computeIntlMonthCodeParts, intlData, config.l),
    u: bindArgs(computeIntlYearMonthFieldsForMonthDay, intlData, config.l, config.ve),
    q: bindArgs(computeIntlInLeapYear, intlData, config.l),
    j: bindArgs(computeIntlMonthsInYear, intlData),
    o: bindArgs(computeIntlDaysInMonth, intlData),
    i: bindArgs(computeIntlDaysInYear, intlData),
    p: bindArgs(computeIntlLeapMonth, intlData, config.l),
    K: bindArgs(addIntlMonths, intlData),
    _: bindArgs(diffIntlMonthSlots, intlData)
  };
}

function createIntlScrapedCalendarData(normCalendarId) {
  const intlFormat = new RawDateTimeFormat("en-u-hc-h23", {
    calendar: normCalendarId,
    timeZone: utcTimeZoneId,
    era: "short",
    year: "numeric",
    month: "short",
    day: "numeric"
  });
  function rawEpochMilliToIntlFields(epochMilli) {
    return intlParts = formatEpochMilliToPartsRecord(intlFormat, epochMilli), {
      year: parseInt(intlParts.relatedYear || intlParts.year),
      month: 0,
      ye: intlParts.month,
      day: parseInt(intlParts.day)
    };
    var intlParts;
  }
  const queryYearData = (epochMilliToIntlFields => {
    const yearCorrection = epochMilliToIntlFields(0).year - isoEpochOriginYear;
    return memoize(function(year) {
      let epochMilli = isoArgsToEpochDays(year - yearCorrection) * milliInUtcDay;
      let intlFields;
      let iterations = 0;
      const millisReversed = [];
      const monthStringsReversed = [];
      do {
        epochMilli += 400 * milliInUtcDay;
      } while ((intlFields = epochMilliToIntlFields(epochMilli)).year <= year);
      do {
        epochMilli += (1 - intlFields.day) * milliInUtcDay, intlFields.year === year && (millisReversed.push(epochMilli), 
        monthStringsReversed.push(intlFields.ye)), epochMilli -= milliInUtcDay, 
        (++iterations > 500 || epochMilli < -maxMilli) && throwRangeError();
      } while ((intlFields = epochMilliToIntlFields(epochMilli)).year >= year);
      return {
        V: millisReversed.reverse(),
        oe: monthStringsReversed.reverse()
      };
    });
  })(rawEpochMilliToIntlFields);
  const queryFields = ((epochMilliToIntlFields, queryYearData) => memoize(isoDateFields => {
    const epochMilli = isoDateToEpochMilli(isoDateFields);
    const intlFields = epochMilliToIntlFields(epochMilli);
    return {
      ...intlFields,
      month: computeIntlMonthIndex(queryYearData, intlFields.year, epochMilli)
    };
  }, WeakMap))(rawEpochMilliToIntlFields, queryYearData);
  return {
    je: queryFields,
    I: queryYearData
  };
}

function computeIsoFieldsFromIntlParts(intlData, year, month, day) {
  return epochMilliToIsoDateTime(computeIntlEpochMilli(intlData, year, month, day));
}

function computeIntlEpochMilli(intlData, year, month = 1, day = 1) {
  return intlData.I(year).V[month - 1] + (day - 1) * milliInUtcDay;
}

function computeIntlMonthCodeParts(intlData, leapMonthMeta, year, month) {
  const leapMonth = computeIntlLeapMonth(intlData, leapMonthMeta, year);
  return [ monthToMonthCodeNumber(month, leapMonth), leapMonth === month ];
}

function computeIntlLeapMonth(intlData, leapMonthMeta, year) {
  if (void 0 === leapMonthMeta) {
    return;
  }
  const currentMonthStrings = intlData.I(year).oe;
  if (currentMonthStrings.length <= 12) {
    return;
  }
  if (leapMonthMeta < 0) {
    return -leapMonthMeta;
  }
  for (let i = 1; i < currentMonthStrings.length; i++) {
    if (currentMonthStrings[i] === currentMonthStrings[i - 1]) {
      return i + 1;
    }
  }
  for (let i = 0; i < currentMonthStrings.length; i++) {
    if (/bis$/i.test(currentMonthStrings[i])) {
      return i + 1;
    }
  }
  const prevMonthStrings = intlData.I(year - 1).oe;
  for (let i = 0; i < currentMonthStrings.length; i++) {
    if (currentMonthStrings[i] !== prevMonthStrings[i]) {
      return i + 1;
    }
  }
}

function computeIntlInLeapYear(intlData, leapMonthMeta, year) {
  if (void 0 !== leapMonthMeta) {
    return computeIntlMonthsInYear(intlData, year) > 12;
  }
  const daysInYear = computeIntlDaysInYear(intlData, year);
  return daysInYear > computeIntlDaysInYear(intlData, year - 1) || daysInYear > computeIntlDaysInYear(intlData, year + 1);
}

function computeIntlDaysInYear(intlData, year) {
  const milli = computeIntlEpochMilli(intlData, year);
  const milliNext = computeIntlEpochMilli(intlData, year + 1);
  return diffEpochMilliDays(milli, milliNext);
}

function computeIntlDaysInMonth(intlData, year, month) {
  const {V: monthEpochMillis} = intlData.I(year);
  let nextMonth = month + 1;
  let nextMonthEpochMilli = monthEpochMillis;
  return nextMonth > monthEpochMillis.length && (nextMonth = 1, nextMonthEpochMilli = intlData.I(year + 1).V), 
  diffEpochMilliDays(monthEpochMillis[month - 1], nextMonthEpochMilli[nextMonth - 1]);
}

function computeIntlMonthsInYear(intlData, year) {
  return intlData.I(year).V.length;
}

function computeIntlYearMonthFieldsForMonthDay(intlData, leapMonthMeta, getMonthDaySearchStartYear, monthCodeNumber, isLeapMonth, day) {
  const startIsoYear = getMonthDaySearchStartYear?.(monthCodeNumber, isLeapMonth, day) || isoEpochFirstLeapYear;
  const startCalendarDateFields = intlData.je({
    year: startIsoYear,
    month: isoMonthsInYear,
    day: 31
  });
  let {year: startYear, month: startMonth, day: startDay} = startCalendarDateFields;
  const startYearLeapMonth = computeIntlLeapMonth(intlData, leapMonthMeta, startYear);
  const startMonthCodeNumber = monthToMonthCodeNumber(startMonth, startYearLeapMonth);
  const startMonthIsLeap = startMonth === startYearLeapMonth;
  1 === (compareNumbers(monthCodeNumber, startMonthCodeNumber) || compareNumbers(Number(isLeapMonth), Number(startMonthIsLeap)) || compareNumbers(day, startDay)) && startYear--;
  for (let yearMove = 0; yearMove < 100; yearMove++) {
    const tryYear = startYear - yearMove;
    const tryLeapMonth = computeIntlLeapMonth(intlData, leapMonthMeta, tryYear);
    const tryMonth = monthCodeNumberToMonth(monthCodeNumber, isLeapMonth, tryLeapMonth);
    if (isLeapMonth === (tryMonth === tryLeapMonth) && day <= computeIntlDaysInMonth(intlData, tryYear, tryMonth)) {
      return {
        year: tryYear,
        month: tryMonth
      };
    }
  }
}

function addIntlMonths(intlData, year, month, monthDelta) {
  if (monthDelta) {
    if (Number.isSafeInteger(month += monthDelta) || throwRangeError(outOfBoundsDate), 
    monthDelta < 0) {
      for (;month < 1; ) {
        month += computeIntlMonthsInYear(intlData, --year);
      }
    } else {
      let monthsInYear;
      for (;month > (monthsInYear = computeIntlMonthsInYear(intlData, year)); ) {
        month -= monthsInYear, year++;
      }
    }
  }
  return {
    year: year,
    month: month
  };
}

function diffIntlMonthSlots(intlData, year0, month0, year1, month1) {
  const cmp = compareNumbers(year0, year1) || compareNumbers(month0, month1);
  if (!cmp) {
    return 0;
  }
  if (year0 === year1) {
    return month1 - month0;
  }
  if (cmp < 0) {
    let months = computeIntlMonthsInYear(intlData, year0) - month0 + month1;
    for (let year = year0 + 1; year < year1; year++) {
      months += computeIntlMonthsInYear(intlData, year);
    }
    return months;
  }
  return -diffIntlMonthSlots(intlData, year1, month1, year0, month0);
}

function computeIntlMonthIndex(queryYearData, year, epochMilli) {
  const {V: monthEpochMillis} = queryYearData(year);
  for (let i = monthEpochMillis.length - 1; i >= 0; i--) {
    if (epochMilli >= monthEpochMillis[i]) {
      return i + 1;
    }
  }
  throwRangeError();
}

const unixEpochJulianDay = 2440588;

function createArithmeticCalendar(ops) {
  const monthDayReferenceDate = ops.G(2441683);
  const fromIsoDate = memoize(isoDate => ops.G(isoDateToEpochDays(isoDate) + 2440588), WeakMap);
  function computeDefaultMonthCodeParts(year, month) {
    const leapMonth = ops.p?.(year);
    return [ monthToMonthCodeNumber(month, leapMonth), month === leapMonth ];
  }
  return {
    k: ops.k,
    l: ops.l,
    U: ops.U,
    R: ops.R,
    ne: ops.ne,
    $: ops.$,
    fe: ops.fe,
    ae: fromIsoDate,
    de(year, month, day) {
      return epochDaysToIsoDate(ops.J(year, month, day) - 2440588);
    },
    le(year, month = 1, day = 1) {
      return (ops.J(year, month, day) - 2440588) * milliInUtcDay;
    },
    L(year, month) {
      return (ops.L || computeDefaultMonthCodeParts)(year, month);
    },
    u(monthCodeNumber, isLeapMonth, day) {
      return ops.u?.(monthCodeNumber, isLeapMonth, day) || ((monthCodeNumber, isLeapMonth, day) => {
        isLeapMonth = Boolean(isLeapMonth);
        let referenceYear = ops.ne || monthDayReferenceDate.year;
        const [referenceMonthCodeNumber, referenceIsLeapMonth] = computeDefaultMonthCodeParts(monthDayReferenceDate.year, monthDayReferenceDate.month);
        1 === (compareNumbers(monthCodeNumber, referenceMonthCodeNumber) || compareNumbers(Number(isLeapMonth), Number(referenceIsLeapMonth)) || compareNumbers(day, monthDayReferenceDate.day)) && referenceYear--;
        for (let yearDelta = 0; yearDelta < 100; yearDelta++) {
          for (const year of [ referenceYear - yearDelta, referenceYear + yearDelta ]) {
            const leapMonth = ops.p?.(year);
            const month = monthCodeNumberToMonth(monthCodeNumber, isLeapMonth, leapMonth);
            if (month <= ops.j(year) && isLeapMonth === (month === leapMonth) && day <= ops.o(year, month)) {
              return {
                year: year,
                month: month
              };
            }
          }
        }
      })(monthCodeNumber, isLeapMonth, day);
    },
    q: ops.q,
    j: ops.j,
    o: ops.o,
    i: ops.i,
    p: ops.p || noop,
    h(isoDate) {
      const parts = fromIsoDate(isoDate);
      return ops.h ? ops.h(parts) : {
        era: parts.era,
        eraYear: parts.eraYear
      };
    },
    K(year, month, monthDelta) {
      return ((computeMonthsInYear, year, month, monthDelta) => {
        if (monthDelta) {
          if (Number.isSafeInteger(month += monthDelta) || throwRangeError(outOfBoundsDate), 
          monthDelta < 0) {
            for (;month < 1; ) {
              month += computeMonthsInYear(--year);
            }
          } else {
            let monthsInYear;
            for (;month > (monthsInYear = computeMonthsInYear(year)); ) {
              month -= monthsInYear, year++;
            }
          }
        }
        return {
          year: year,
          month: month
        };
      })(ops.j, year, month, monthDelta);
    },
    _(year0, month0, year1, month1) {
      return diffArithmeticMonthSlots(ops.j, year0, month0, year1, month1);
    }
  };
}

function diffArithmeticMonthSlots(computeMonthsInYear, year0, month0, year1, month1) {
  const cmp = compareNumbers(year0, year1) || compareNumbers(month0, month1);
  if (!cmp) {
    return 0;
  }
  if (year0 === year1) {
    return month1 - month0;
  }
  if (cmp < 0) {
    let months = computeMonthsInYear(year0) - month0 + month1;
    for (let year = year0 + 1; year < year1; year++) {
      months += computeMonthsInYear(year);
    }
    return months;
  }
  return -diffArithmeticMonthSlots(computeMonthsInYear, year1, month1, year0, month0);
}

export { computeIntlDaysInMonth, computeIntlDaysInYear, computeIntlEpochMilli, createArithmeticCalendar, createGregoryAlignedCalendar, createIntlScrapedCalendar, createIntlScrapedCalendarData, unixEpochJulianDay };
