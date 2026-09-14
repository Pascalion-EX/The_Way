// =========================================================
// COPTIC CALENDAR UTILITIES
// =========================================================
//
// Handles:
//
// 1. Gregorian <-> Julian Day Number
// 2. Julian <-> Gregorian
// 3. Coptic <-> Gregorian
// 4. Coptic Orthodox Resurrection calculation
// 5. Holy Week / Holy Pascha calculations
// 6. Major movable dates
//
// IMPORTANT:
//
// "Holy Pascha" here means:
// Monday -> Wednesday of Holy Week.
//
// "Resurrection" means Easter / Resurrection Sunday.
//
// =========================================================


// =========================================================
// CONSTANTS
// =========================================================

// Integer Julian Day Number for:
//
// 1 Tout 1 AM
// 29 August 284 AD in the Julian calendar.
//
// Previous version used 1825029, which shifted
// Coptic dates one day backwards.
//
// Correct integer JDN:
const COPTIC_EPOCH_JDN = 1825030;


// =========================================================
// COPTIC MONTHS
// =========================================================

export const COPTIC_MONTHS = [
  "Tout",
  "Baba",
  "Hator",
  "Kiahk",
  "Toba",
  "Meshir",
  "Paremhat",
  "Parmouti",
  "Pashons",
  "Paoni",
  "Epip",
  "Mesori",
  "Nasie",
];


// =========================================================
// BASIC DATE HELPERS
// =========================================================

/**
 * Creates a JavaScript Date in UTC.
 *
 * Month is normal:
 *
 * 1 = January
 * 12 = December
 */
export const createUTCDate = (
  year,
  month,
  day
) => {
  return new Date(
    Date.UTC(
      year,
      month - 1,
      day
    )
  );
};


/**
 * Add or subtract days from a date.
 *
 * addDays(date, 5)
 * addDays(date, -5)
 */
export const addDays = (
  date,
  days
) => {
  const result = new Date(date);

  result.setUTCDate(
    result.getUTCDate() + days
  );

  return result;
};


/**
 * Converts JS Date into:
 *
 * YYYY-MM-DD
 */
export const formatDateISO = (
  date
) => {
  const year =
    date.getUTCFullYear();

  const month = String(
    date.getUTCMonth() + 1
  ).padStart(2, "0");

  const day = String(
    date.getUTCDate()
  ).padStart(2, "0");

  return `${year}-${month}-${day}`;
};


// =========================================================
// GREGORIAN -> JULIAN DAY NUMBER
// =========================================================

export const gregorianToJDN = (
  year,
  month,
  day
) => {
  const a = Math.floor(
    (14 - month) / 12
  );

  const y =
    year + 4800 - a;

  const m =
    month + 12 * a - 3;

  return (
    day +
    Math.floor(
      (153 * m + 2) / 5
    ) +
    365 * y +
    Math.floor(y / 4) -
    Math.floor(y / 100) +
    Math.floor(y / 400) -
    32045
  );
};


// =========================================================
// JULIAN DAY NUMBER -> GREGORIAN
// =========================================================

export const jdnToGregorian = (
  jdn
) => {
  const a =
    jdn + 32044;

  const b = Math.floor(
    (4 * a + 3) / 146097
  );

  const c =
    a -
    Math.floor(
      (146097 * b) / 4
    );

  const d = Math.floor(
    (4 * c + 3) / 1461
  );

  const e =
    c -
    Math.floor(
      (1461 * d) / 4
    );

  const m = Math.floor(
    (5 * e + 2) / 153
  );

  const day =
    e -
    Math.floor(
      (153 * m + 2) / 5
    ) +
    1;

  const month =
    m +
    3 -
    12 *
      Math.floor(m / 10);

  const year =
    100 * b +
    d -
    4800 +
    Math.floor(m / 10);

  return {
    year,
    month,
    day,

    date: createUTCDate(
      year,
      month,
      day
    ),
  };
};


// =========================================================
// JULIAN CALENDAR -> JULIAN DAY NUMBER
// =========================================================

export const julianToJDN = (
  year,
  month,
  day
) => {
  const a = Math.floor(
    (14 - month) / 12
  );

  const y =
    year + 4800 - a;

  const m =
    month + 12 * a - 3;

  return (
    day +
    Math.floor(
      (153 * m + 2) / 5
    ) +
    365 * y +
    Math.floor(y / 4) -
    32083
  );
};


// =========================================================
// JULIAN -> GREGORIAN
// =========================================================

export const julianToGregorian = (
  year,
  month,
  day
) => {
  const jdn =
    julianToJDN(
      year,
      month,
      day
    );

  return jdnToGregorian(
    jdn
  );
};


// =========================================================
// COPTIC LEAP YEAR
// =========================================================

/**
 * Coptic leap years occur every four years.
 *
 * A Coptic year has 6 days in Nasie when:
 *
 * year % 4 === 3
 */
export const isCopticLeapYear = (
  year
) => {
  return year % 4 === 3;
};


// =========================================================
// VALIDATE COPTIC DATE
// =========================================================

const validateCopticDate = (
  year,
  month,
  day
) => {
  if (
    !Number.isInteger(year) ||
    year < 1
  ) {
    throw new Error(
      "Invalid Coptic year."
    );
  }

  if (
    !Number.isInteger(month) ||
    month < 1 ||
    month > 13
  ) {
    throw new Error(
      "Coptic month must be between 1 and 13."
    );
  }

  let maxDay;

  if (month <= 12) {
    maxDay = 30;
  } else {
    maxDay =
      isCopticLeapYear(year)
        ? 6
        : 5;
  }

  if (
    !Number.isInteger(day) ||
    day < 1 ||
    day > maxDay
  ) {
    throw new Error(
      `Invalid Coptic date: ${day}/${month}/${year}.`
    );
  }
};


// =========================================================
// COPTIC -> JULIAN DAY NUMBER
// =========================================================

export const copticToJDN = (
  year,
  month,
  day
) => {
  validateCopticDate(
    year,
    month,
    day
  );

  return (
    COPTIC_EPOCH_JDN -
    1 +
    365 * (year - 1) +
    Math.floor(year / 4) +
    30 * (month - 1) +
    day
  );
};


// =========================================================
// COPTIC -> GREGORIAN
// =========================================================

export const copticToGregorian = (
  year,
  month,
  day
) => {
  const jdn =
    copticToJDN(
      year,
      month,
      day
    );

  return jdnToGregorian(
    jdn
  );
};


// =========================================================
// JULIAN DAY NUMBER -> COPTIC
// =========================================================

export const jdnToCoptic = (
  jdn
) => {
  const year = Math.floor(
    (
      4 *
        (
          jdn -
          COPTIC_EPOCH_JDN
        ) +
      1463
    ) /
      1461
  );

  const firstDayOfYear =
    copticToJDN(
      year,
      1,
      1
    );

  const dayOfYear =
    jdn -
    firstDayOfYear;

  const month =
    Math.floor(
      dayOfYear / 30
    ) + 1;

  const day =
    dayOfYear -
    (month - 1) * 30 +
    1;

  return {
    year,
    month,
    day,

    monthName:
      COPTIC_MONTHS[
        month - 1
      ],
  };
};


// =========================================================
// GREGORIAN -> COPTIC
// =========================================================

export const gregorianToCoptic = (
  year,
  month,
  day
) => {
  const jdn =
    gregorianToJDN(
      year,
      month,
      day
    );

  return jdnToCoptic(
    jdn
  );
};


// =========================================================
// COPTIC ORTHODOX RESURRECTION
// =========================================================

/**
 * Calculates the Coptic Orthodox
 * Feast of the Resurrection.
 *
 * This uses the Julian Orthodox computus.
 *
 * The algorithm first determines the Easter
 * date in the JULIAN calendar.
 *
 * It then converts that date to Gregorian
 * using Julian Day Numbers.
 *
 * This avoids simply adding 13 days.
 */
export const calculateCopticResurrection = (
  year
) => {
  if (
    !Number.isInteger(year) ||
    year < 1
  ) {
    throw new Error(
      "Invalid Gregorian year."
    );
  }

  // Position within the 19-year lunar cycle
  const goldenNumber =
    year % 19;

  // Paschal full-moon calculation
  const paschalFullMoon =
    (
      19 *
        goldenNumber +
      15
    ) %
    30;

  // Weekday correction
  const weekdayCorrection =
    (
      year +
      Math.floor(
        year / 4
      ) +
      paschalFullMoon
    ) %
    7;

  const offset =
    paschalFullMoon -
    weekdayCorrection;

  // Result in Julian calendar
  const julianMonth =
    3 +
    Math.floor(
      (offset + 40) / 44
    );

  const julianDay =
    offset +
    28 -
    31 *
      Math.floor(
        julianMonth / 4
      );

  // Convert Julian -> Gregorian
  const gregorian =
    julianToGregorian(
      year,
      julianMonth,
      julianDay
    );

  return {
    year,

    julian: {
      year,
      month: julianMonth,
      day: julianDay,
    },

    gregorian: {
      year: gregorian.year,
      month: gregorian.month,
      day: gregorian.day,
    },

    date: gregorian.date,

    iso: formatDateISO(
      gregorian.date
    ),
  };
};


// =========================================================
// BACKWARDS COMPATIBILITY
// =========================================================

/**
 * Old function name.
 *
 * Internally this represents the
 * Resurrection Sunday anchor.
 *
 * Holy Pascha itself is calculated separately below.
 */
export const calculateCopticPascha =
  calculateCopticResurrection;


// =========================================================
// CALCULATE ALL PASCHAL / MOVABLE DATES
// =========================================================

export const calculatePaschalDates = (
  year
) => {
  const resurrectionResult =
    calculateCopticResurrection(
      year
    );

  const resurrection =
    resurrectionResult.date;

  // =====================================================
  // JONAH'S FAST
  // =====================================================

  const jonahFastStart =
    addDays(
      resurrection,
      -69
    );

  const jonahFastEnd =
    addDays(
      resurrection,
      -67
    );

  // =====================================================
  // GREAT LENT
  // =====================================================

  const greatLentStart =
    addDays(
      resurrection,
      -55
    );

  // =====================================================
  // HOLY WEEK
  // =====================================================

  const lazarusSaturday =
    addDays(
      resurrection,
      -8
    );

  const palmSunday =
    addDays(
      resurrection,
      -7
    );

  // Holy Pascha:
  // Monday, Tuesday, Wednesday
  const holyPaschaStart =
    addDays(
      resurrection,
      -6
    );

  const holyPaschaEnd =
    addDays(
      resurrection,
      -4
    );

  const covenantThursday =
    addDays(
      resurrection,
      -3
    );

  const goodFriday =
    addDays(
      resurrection,
      -2
    );

  const brightSaturday =
    addDays(
      resurrection,
      -1
    );

  // =====================================================
  // HOLY FIFTY DAYS
  // =====================================================

  const thomasSunday =
    addDays(
      resurrection,
      7
    );

  const ascension =
    addDays(
      resurrection,
      39
    );

  const pentecost =
    addDays(
      resurrection,
      49
    );

  // =====================================================
  // APOSTLES' FAST
  // =====================================================

  // Monday after Pentecost
  const apostlesFastStart =
    addDays(
      resurrection,
      50
    );

  return {
    // Main anchor
    resurrection,

    // Jonah
    jonahFastStart,
    jonahFastEnd,

    // Great Lent
    greatLentStart,

    // Holy Week
    lazarusSaturday,
    palmSunday,

    holyPaschaStart,
    holyPaschaEnd,

    covenantThursday,
    goodFriday,
    brightSaturday,

    // Holy Fifty
    thomasSunday,
    ascension,
    pentecost,

    // Apostles
    apostlesFastStart,
  };
};


// =========================================================
// ISO VERSION
// =========================================================

/**
 * Same information as calculatePaschalDates(),
 * but all dates are returned as YYYY-MM-DD.
 *
 * Useful for debugging and API responses.
 */
export const calculatePaschalDatesISO = (
  year
) => {
  const dates =
    calculatePaschalDates(
      year
    );

  return {
    jonahFastStart:
      formatDateISO(
        dates.jonahFastStart
      ),

    jonahFastEnd:
      formatDateISO(
        dates.jonahFastEnd
      ),

    greatLentStart:
      formatDateISO(
        dates.greatLentStart
      ),

    lazarusSaturday:
      formatDateISO(
        dates.lazarusSaturday
      ),

    palmSunday:
      formatDateISO(
        dates.palmSunday
      ),

    holyPaschaStart:
      formatDateISO(
        dates.holyPaschaStart
      ),

    holyPaschaEnd:
      formatDateISO(
        dates.holyPaschaEnd
      ),

    covenantThursday:
      formatDateISO(
        dates.covenantThursday
      ),

    goodFriday:
      formatDateISO(
        dates.goodFriday
      ),

    brightSaturday:
      formatDateISO(
        dates.brightSaturday
      ),

    resurrection:
      formatDateISO(
        dates.resurrection
      ),

    thomasSunday:
      formatDateISO(
        dates.thomasSunday
      ),

    ascension:
      formatDateISO(
        dates.ascension
      ),

    pentecost:
      formatDateISO(
        dates.pentecost
      ),

    apostlesFastStart:
      formatDateISO(
        dates.apostlesFastStart
      ),
  };
};


// =========================================================
// DEBUG / TEST FUNCTION
// =========================================================

export const printPaschalDates = (
  year
) => {
  const dates =
    calculatePaschalDatesISO(
      year
    );

  console.log(
    `\n===== COPTIC CALENDAR ${year} =====`
  );

  console.log(
    "Jonah's Fast:",
    dates.jonahFastStart,
    "->",
    dates.jonahFastEnd
  );

  console.log(
    "Great Lent:",
    dates.greatLentStart
  );

  console.log(
    "Lazarus Saturday:",
    dates.lazarusSaturday
  );

  console.log(
    "Palm Sunday:",
    dates.palmSunday
  );

  console.log(
    "Holy Pascha:",
    dates.holyPaschaStart,
    "->",
    dates.holyPaschaEnd
  );

  console.log(
    "Covenant Thursday:",
    dates.covenantThursday
  );

  console.log(
    "Good Friday:",
    dates.goodFriday
  );

  console.log(
    "Bright Saturday:",
    dates.brightSaturday
  );

  console.log(
    "Resurrection:",
    dates.resurrection
  );

  console.log(
    "Thomas Sunday:",
    dates.thomasSunday
  );

  console.log(
    "Ascension:",
    dates.ascension
  );

  console.log(
    "Pentecost:",
    dates.pentecost
  );

  console.log(
    "Apostles' Fast starts:",
    dates.apostlesFastStart
  );
};