import Event from "../models/EventModel.js";

import {
  generateCopticCalendarYear,
} from "../utils/copticFeasts.js";


// =========================================================
// DATE HELPERS
// =========================================================

const startOfUTCDay = (
  date
) => {
  return new Date(
    Date.UTC(
      date.getUTCFullYear(),
      date.getUTCMonth(),
      date.getUTCDate()
    )
  );
};


const addYearsUTC = (
  date,
  years
) => {
  const result =
    new Date(date);

  result.setUTCFullYear(
    result.getUTCFullYear() +
      years
  );

  return result;
};


const oneDayAfter = (
  date
) => {
  const result =
    new Date(date);

  result.setUTCDate(
    result.getUTCDate() + 1
  );

  return result;
};


// =========================================================
// CHECK WHETHER EVENT OVERLAPS RANGE
// =========================================================

const eventOverlapsRange = (
  event,
  rangeStart,
  rangeEnd
) => {
  const eventStart =
    event.startDate;

  /*
    Single-day event:

    if there is no endDate,
    treat it as ending the following day.
  */

  const eventEnd =
    event.endDate ||
    oneDayAfter(
      event.startDate
    );

  return (
    eventStart < rangeEnd &&
    eventEnd > rangeStart
  );
};


// =========================================================
// SEED NEXT 3 YEARS
// =========================================================

export const seedCopticCalendar =
  async (req, res) => {
    try {
      const userId =
        req.userId;

      if (!userId) {
        return res
          .status(401)
          .json({
            success: false,
            message:
              "Authentication required.",
          });
      }


      // ===================================================
      // EXACT THREE-YEAR WINDOW
      // ===================================================

      const today =
        startOfUTCDay(
          new Date()
        );

      const rangeEnd =
        addYearsUTC(
          today,
          3
        );


      // ===================================================
      // GENERATE SURROUNDING YEARS
      // ===================================================
      //
      // We include the previous Gregorian year because
      // a fasting period could begin before January and
      // continue into the requested range.
      //

      const firstYear =
        today.getUTCFullYear() -
        1;

      const finalYear =
        rangeEnd.getUTCFullYear();

      let generatedEvents = [];


      for (
        let year = firstYear;
        year <= finalYear;
        year++
      ) {
        const events =
          generateCopticCalendarYear(
            year
          );

        generatedEvents.push(
          ...events
        );
      }


      // ===================================================
      // KEEP ONLY EVENTS IN THREE-YEAR WINDOW
      // ===================================================

      generatedEvents =
        generatedEvents.filter(
          (event) =>
            eventOverlapsRange(
              event,
              today,
              rangeEnd
            )
        );


      // ===================================================
      // REMOVE DUPLICATES IN MEMORY
      // ===================================================

      const uniqueEvents =
        Array.from(
          new Map(
            generatedEvents.map(
              (event) => [
                event.calendarKey,
                event,
              ]
            )
          ).values()
        );


      if (
        uniqueEvents.length === 0
      ) {
        return res
          .status(200)
          .json({
            success: true,

            message:
              "No Coptic calendar events were found for the requested period.",

            created: 0,
            skipped: 0,
          });
      }


      // ===================================================
      // BULK UPSERT
      // ===================================================
      //
      // $setOnInsert means:
      //
      // existing event -> leave it alone
      // missing event  -> create it
      //
      // This makes the operation safe to run repeatedly.
      //

      const operations =
        uniqueEvents.map(
          (event) => ({
            updateOne: {
              filter: {
                calendarKey:
                  event.calendarKey,
              },

              update: {
                $setOnInsert: {
                  ...event,

                  createdBy:
                    userId,
                },
              },

              upsert: true,
            },
          })
        );


      const result =
        await Event.bulkWrite(
          operations,
          {
            ordered: false,
          }
        );


      const created =
        result.upsertedCount ||
        0;

      const skipped =
        uniqueEvents.length -
        created;


      return res
        .status(200)
        .json({
          success: true,

          message:
            "Coptic calendar generated successfully.",

          period: {
            from:
              today.toISOString(),

            to:
              rangeEnd.toISOString(),
          },

          total:
            uniqueEvents.length,

          created,

          skipped,
        });
    } catch (error) {
      console.error(
        "Seed Coptic calendar error:",
        error
      );


      // ===================================================
      // DUPLICATE INDEX SAFETY
      // ===================================================

      if (
        error?.code === 11000
      ) {
        return res
          .status(409)
          .json({
            success: false,

            message:
              "A generated Coptic calendar event already exists.",
          });
      }


      return res
        .status(500)
        .json({
          success: false,

          message:
            error.message ||
            "Failed to generate Coptic calendar.",
        });
    }
  };