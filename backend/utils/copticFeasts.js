import {
  addDays,
  calculatePaschalDates,
  copticToGregorian,
} from "./copticCalendarUtils.js";


// =========================================================
// FIND COPTIC DATE INSIDE A GREGORIAN YEAR
// =========================================================

/*
  Example:

  11 Toba may occur:

  2027 -> January 19
  2028 -> January 20

  Instead of hard-coding that shift, we calculate it.

  We try the nearby Coptic years and return whichever
  conversion falls inside the requested Gregorian year.
*/

const getCopticDateInGregorianYear = (
  gregorianYear,
  copticMonth,
  copticDay
) => {
  const possibleCopticYears = [
    gregorianYear - 285,
    gregorianYear - 284,
    gregorianYear - 283,
    gregorianYear - 282,
  ];

  for (const copticYear of possibleCopticYears) {
    const result =
      copticToGregorian(
        copticYear,
        copticMonth,
        copticDay
      );

    if (
      result.year ===
      gregorianYear
    ) {
      return result.date;
    }
  }

  throw new Error(
    `Could not find Coptic date ${copticDay}/${copticMonth} inside Gregorian year ${gregorianYear}.`
  );
};


// =========================================================
// NATIVITY
// =========================================================

/*
  Nativity needs special liturgical handling.

  Normally:
      29 Kiahk

  In the relevant Coptic leap-cycle year:
      28 Kiahk

  This keeps the liturgical relationship between
  Annunciation and Nativity correct.
*/

const getNativityDate = (
  gregorianYear
) => {
  /*
    During January:

    Gregorian 2027
        =
    Coptic 1743

    Gregorian 2028
        =
    Coptic 1744
  */

  const copticYear =
    gregorianYear - 284;

  /*
    Example:

    1744 % 4 === 0

    therefore Nativity uses
    28 Kiahk for that cycle.
  */

  const nativityDay =
    copticYear % 4 === 0
      ? 28
      : 29;

  const result =
    copticToGregorian(
      copticYear,
      4, // Kiahk
      nativityDay
    );

  return result.date;
};


// =========================================================
// EVENT BUILDER
// =========================================================

const buildEvent = ({
  year,
  key,
  title,
  description,
  eventType,
  startDate,
  endDate,
}) => {
  const event = {
    title,

    description,

    eventType,

    startDate,

    allDay: true,

    location: "",

    years: [],

    source:
      "coptic-calendar",

    calendarKey:
      `coptic:${year}:${key}`,

    generatedYear:
      year,
  };

  if (endDate) {
    event.endDate =
      endDate;
  }

  return event;
};


// =========================================================
// GENERATE ONE GREGORIAN YEAR
// =========================================================

export const generateCopticCalendarYear = (
  year
) => {
  if (
    !Number.isInteger(year) ||
    year < 1900
  ) {
    throw new Error(
      "Invalid Gregorian year."
    );
  }

  const paschal =
    calculatePaschalDates(
      year
    );


  // =====================================================
  // FIXED FEASTS
  // =====================================================

  const nativity =
    getNativityDate(
      year
    );

  // 11 Toba
  const epiphany =
    getCopticDateInGregorianYear(
      year,
      5,
      11
    );

  // 6 Toba
  const circumcision =
    getCopticDateInGregorianYear(
      year,
      5,
      6
    );

  // 13 Toba
  const weddingAtCana =
    getCopticDateInGregorianYear(
      year,
      5,
      13
    );

  // 8 Meshir
  const entranceIntoTemple =
    getCopticDateInGregorianYear(
      year,
      6,
      8
    );

  // 29 Paremhat
  const annunciation =
    getCopticDateInGregorianYear(
      year,
      7,
      29
    );

  // 24 Pashons
  const entranceIntoEgypt =
    getCopticDateInGregorianYear(
      year,
      9,
      24
    );

  // 5 Epip
  const apostlesFeast =
    getCopticDateInGregorianYear(
      year,
      11,
      5
    );

  // 1 Mesori
  const stMaryFastStart =
    getCopticDateInGregorianYear(
      year,
      12,
      1
    );

  // 13 Mesori
  const transfiguration =
    getCopticDateInGregorianYear(
      year,
      12,
      13
    );

  // 16 Mesori
  const stMaryFeast =
    getCopticDateInGregorianYear(
      year,
      12,
      16
    );

  // 1 Tout
  const nayrouz =
    getCopticDateInGregorianYear(
      year,
      1,
      1
    );

  // 17 Tout
  const feastOfCross =
    getCopticDateInGregorianYear(
      year,
      1,
      17
    );

  // 16 Hator
  const nativityFastStart =
    getCopticDateInGregorianYear(
      year,
      3,
      16
    );

  const nextNativity =
    getNativityDate(
      year + 1
    );


  // =====================================================
  // EVENTS
  // =====================================================

  const events = [];


  // =====================================================
  // NATIVITY
  // =====================================================

  events.push(
    buildEvent({
      year,
      key: "nativity",

      title:
        "Feast of the Nativity",

      description:
        "Coptic Orthodox Feast of the Nativity of our Lord Jesus Christ.",

      eventType:
        "Feast",

      startDate:
        nativity,
    })
  );


  // =====================================================
  // CIRCUMCISION
  // =====================================================

  events.push(
    buildEvent({
      year,
      key:
        "circumcision",

      title:
        "Feast of the Circumcision",

      description:
        "Commemoration of the Circumcision of our Lord Jesus Christ.",

      eventType:
        "Feast",

      startDate:
        circumcision,
    })
  );


  // =====================================================
  // EPIPHANY
  // =====================================================

  events.push(
    buildEvent({
      year,
      key:
        "epiphany",

      title:
        "Feast of the Theophany (Epiphany)",

      description:
        "Coptic Orthodox Feast of the Theophany and Baptism of our Lord Jesus Christ.",

      eventType:
        "Feast",

      startDate:
        epiphany,
    })
  );


  // =====================================================
  // WEDDING AT CANA
  // =====================================================

  events.push(
    buildEvent({
      year,
      key:
        "wedding-cana",

      title:
        "Wedding at Cana",

      description:
        "Commemoration of our Lord's first miracle at Cana of Galilee.",

      eventType:
        "Feast",

      startDate:
        weddingAtCana,
    })
  );


  // =====================================================
  // ENTRANCE INTO THE TEMPLE
  // =====================================================

  events.push(
    buildEvent({
      year,
      key:
        "entrance-temple",

      title:
        "Entrance of Christ into the Temple",

      description:
        "Commemoration of the entrance of our Lord Jesus Christ into the Temple.",

      eventType:
        "Feast",

      startDate:
        entranceIntoTemple,
    })
  );


  // =====================================================
  // ANNUNCIATION
  // =====================================================

  events.push(
    buildEvent({
      year,
      key:
        "annunciation",

      title:
        "Feast of the Annunciation",

      description:
        "Coptic Orthodox Feast of the Annunciation.",

      eventType:
        "Feast",

      startDate:
        annunciation,
    })
  );


  // =====================================================
  // JONAH'S FAST
  // =====================================================

  events.push(
    buildEvent({
      year,
      key:
        "jonah-fast",

      title:
        "Jonah's Fast",

      description:
        "Three-day Fast of Nineveh.",

      eventType:
        "Fasting",

      startDate:
        paschal.jonahFastStart,

      /*
        jonahFastEnd is the final INCLUDED day.

        FullCalendar expects exclusive end,
        so add one day.
      */
      endDate:
        addDays(
          paschal.jonahFastEnd,
          1
        ),
    })
  );


  // =====================================================
  // GREAT LENT
  // =====================================================

  events.push(
    buildEvent({
      year,
      key:
        "great-lent",

      title:
        "Holy Great Fast",

      description:
        "The Holy Great Fast leading to the Feast of the Resurrection.",

      eventType:
        "Fasting",

      startDate:
        paschal.greatLentStart,

      /*
        Resurrection itself is not displayed
        as part of the fasting range.
      */
      endDate:
        paschal.resurrection,
    })
  );


  // =====================================================
  // LAZARUS SATURDAY
  // =====================================================

  events.push(
    buildEvent({
      year,
      key:
        "lazarus-saturday",

      title:
        "Lazarus Saturday",

      description:
        "Lazarus Saturday before Palm Sunday.",

      eventType:
        "Feast",

      startDate:
        paschal.lazarusSaturday,
    })
  );


  // =====================================================
  // PALM SUNDAY
  // =====================================================

  events.push(
    buildEvent({
      year,
      key:
        "palm-sunday",

      title:
        "Palm Sunday",

      description:
        "Coptic Orthodox Feast of Palm Sunday.",

      eventType:
        "Feast",

      startDate:
        paschal.palmSunday,
    })
  );


  // =====================================================
  // HOLY PASCHA
  // =====================================================

  events.push(
    buildEvent({
      year,
      key:
        "holy-pascha",

      title:
        "Holy Pascha",

      description:
        "Holy Pascha: Monday through Wednesday of Holy Week.",

      eventType:
        "Feast",

      startDate:
        paschal.holyPaschaStart,

      /*
        holyPaschaEnd is Wednesday.

        +1 makes Thursday the exclusive
        FullCalendar end date.
      */
      endDate:
        addDays(
          paschal.holyPaschaEnd,
          1
        ),
    })
  );


  // =====================================================
  // COVENANT THURSDAY
  // =====================================================

  events.push(
    buildEvent({
      year,
      key:
        "covenant-thursday",

      title:
        "Covenant Thursday",

      description:
        "Covenant Thursday of Holy Week.",

      eventType:
        "Feast",

      startDate:
        paschal.covenantThursday,
    })
  );


  // =====================================================
  // GOOD FRIDAY
  // =====================================================

  events.push(
    buildEvent({
      year,
      key:
        "good-friday",

      title:
        "Good Friday",

      description:
        "Good Friday of Holy Week.",

      eventType:
        "Feast",

      startDate:
        paschal.goodFriday,
    })
  );


  // =====================================================
  // BRIGHT SATURDAY
  // =====================================================

  events.push(
    buildEvent({
      year,
      key:
        "bright-saturday",

      title:
        "Bright Saturday",

      description:
        "Bright Saturday before the Feast of the Resurrection.",

      eventType:
        "Feast",

      startDate:
        paschal.brightSaturday,
    })
  );


  // =====================================================
  // RESURRECTION
  // =====================================================

  events.push(
    buildEvent({
      year,
      key:
        "resurrection",

      title:
        "Glorious Feast of the Resurrection",

      description:
        "The Glorious Feast of the Resurrection of our Lord Jesus Christ.",

      eventType:
        "Feast",

      startDate:
        paschal.resurrection,
    })
  );


  // =====================================================
  // THOMAS SUNDAY
  // =====================================================

  events.push(
    buildEvent({
      year,
      key:
        "thomas-sunday",

      title:
        "Thomas Sunday",

      description:
        "Thomas Sunday following the Feast of the Resurrection.",

      eventType:
        "Feast",

      startDate:
        paschal.thomasSunday,
    })
  );


  // =====================================================
  // ASCENSION
  // =====================================================

  events.push(
    buildEvent({
      year,
      key:
        "ascension",

      title:
        "Feast of the Ascension",

      description:
        "Coptic Orthodox Feast of the Ascension.",

      eventType:
        "Feast",

      startDate:
        paschal.ascension,
    })
  );


  // =====================================================
  // PENTECOST
  // =====================================================

  events.push(
    buildEvent({
      year,
      key:
        "pentecost",

      title:
        "Feast of Pentecost",

      description:
        "Coptic Orthodox Feast of Pentecost.",

      eventType:
        "Feast",

      startDate:
        paschal.pentecost,
    })
  );


  // =====================================================
  // APOSTLES' FAST
  // =====================================================

  if (
    paschal.apostlesFastStart <
    apostlesFeast
  ) {
    events.push(
      buildEvent({
        year,
        key:
          "apostles-fast",

        title:
          "Apostles' Fast",

        description:
          "The Fast of the Apostles.",

        eventType:
          "Fasting",

        startDate:
          paschal.apostlesFastStart,

        /*
          July 12 / Apostles Feast is excluded
          from fasting range.
        */
        endDate:
          apostlesFeast,
      })
    );
  }


  // =====================================================
  // APOSTLES' FEAST
  // =====================================================

  events.push(
    buildEvent({
      year,
      key:
        "apostles-feast",

      title:
        "Apostles' Feast",

      description:
        "Feast of Saints Peter and Paul and the Apostles.",

      eventType:
        "Feast",

      startDate:
        apostlesFeast,
    })
  );


  // =====================================================
  // ST MARY'S FAST
  // =====================================================

  events.push(
    buildEvent({
      year,
      key:
        "st-mary-fast",

      title:
        "St. Mary's Fast",

      description:
        "The Fast of St. Mary.",

      eventType:
        "Fasting",

      startDate:
        stMaryFastStart,

      // Feast day is exclusive.
      endDate:
        stMaryFeast,
    })
  );


  // =====================================================
  // TRANSFIGURATION
  // =====================================================

  events.push(
    buildEvent({
      year,
      key:
        "transfiguration",

      title:
        "Feast of the Transfiguration",

      description:
        "Coptic Orthodox Feast of the Transfiguration of our Lord Jesus Christ.",

      eventType:
        "Feast",

      startDate:
        transfiguration,
    })
  );


  // =====================================================
  // ST MARY'S FEAST
  // =====================================================

  events.push(
    buildEvent({
      year,
      key:
        "st-mary-feast",

      title:
        "Feast of St. Mary",

      description:
        "Coptic Orthodox Feast of St. Mary.",

      eventType:
        "Feast",

      startDate:
        stMaryFeast,
    })
  );


  // =====================================================
  // ENTRY INTO EGYPT
  // =====================================================

  events.push(
    buildEvent({
      year,
      key:
        "entry-egypt",

      title:
        "Entry of the Holy Family into Egypt",

      description:
        "Commemoration of the entry of our Lord Jesus Christ and the Holy Family into Egypt.",

      eventType:
        "Feast",

      startDate:
        entranceIntoEgypt,
    })
  );


  // =====================================================
  // NAYROUZ
  // =====================================================

  events.push(
    buildEvent({
      year,
      key:
        "nayrouz",

      title:
        "Nayrouz - Coptic New Year",

      description:
        "Beginning of the blessed Coptic year.",

      eventType:
        "Feast",

      startDate:
        nayrouz,
    })
  );


  // =====================================================
  // FEAST OF THE CROSS
  // =====================================================

  events.push(
    buildEvent({
      year,
      key:
        "cross",

      title:
        "Feast of the Cross",

      description:
        "Coptic Orthodox Feast of the Honorable Cross.",

      eventType:
        "Feast",

      startDate:
        feastOfCross,
    })
  );


  // =====================================================
  // NATIVITY FAST
  // =====================================================

  events.push(
    buildEvent({
      year,
      key:
        "nativity-fast",

      title:
        "Nativity Fast",

      description:
        "The Coptic Orthodox Nativity Fast.",

      eventType:
        "Fasting",

      startDate:
        nativityFastStart,

      /*
        Ends when Nativity begins.

        Since FullCalendar end is exclusive,
        this correctly displays the final
        fasting day before Nativity.
      */
      endDate:
        nextNativity,
    })
  );


  return events.sort(
    (a, b) =>
      a.startDate -
      b.startDate
  );
};