import Event from "../models/EventModel.js";
import mongoose from "mongoose";
import { validateEventUpdate, validEventDateRange } from "../services/eventValidation.js";

export const getEvents = async (req, res) => {
  try {
    const events = await Event.find()
      .populate("createdBy", "name role")
      .sort({ startDate: 1 });

    return res.status(200).json({
      success: true,
      events,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

export const getEventById = async (req, res) => {
  try {
    const event = await Event.findById(req.params.id).populate(
      "createdBy",
      "name role"
    );

    if (!event) {
      return res.status(404).json({
        success: false,
        message: "Event not found",
      });
    }

    return res.status(200).json({
      success: true,
      event,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

export const createEvent = async (req, res) => {
  try {
    const {
      title,
      description,
      eventType,
      startDate,
      endDate,
      allDay,
      location,
      years,
    } = req.body;

    if (!title || !eventType || !startDate) {
      return res.status(400).json({
        success: false,
        message: "Title, event type and start date are required",
      });
    }

    const event = await Event.create({
      title,
      description,
      eventType,
      startDate,
      endDate,
      allDay,
      location,
      years,
      createdBy: req.userId,
    });

    return res.status(201).json({
      success: true,
      message: "Event created successfully",
      event,
    });
  } catch (error) {
    console.error("Create event error:", error);

    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

export const updateEvent = async (req, res) => {
  const id = req.params?.id;
  if (!mongoose.isObjectIdOrHexString(id)) {
    return res.status(400).json({ success: false, message: "Invalid event ID" });
  }
  const validation = validateEventUpdate(req.body);
  if (!validation.success) {
    return res.status(400).json({ success: false, message: validation.message });
  }

  try {
    const event = await Event.findById(id).select("startDate endDate");

    if (!event) {
      return res.status(404).json({
        success: false,
        message: "Event not found",
      });
    }

    if (!validEventDateRange(validation.changes, event)) {
      return res.status(400).json({ success: false, message: "End date cannot be before start date" });
    }

    const updatedEvent = await Event.findOneAndUpdate(
      // Bind date validation to the values read above. Concurrent date edits
      // must not combine two individually valid changes into an invalid range.
      { _id: id, startDate: event.startDate, endDate: event.endDate ?? null },
      { $set: validation.changes },
      {
        returnDocument: "after",
        runValidators: true,
        strict: "throw",
        upsert: false,
      }
    );

    if (!updatedEvent) {
      return res.status(409).json({ success: false, message: "Event changed or was deleted. Reload and try again." });
    }

    return res.status(200).json({
      success: true,
      message: "Event updated successfully",
      event: updatedEvent,
    });
  } catch (error) {
    if (["ValidationError", "CastError", "StrictModeError"].includes(error.name)) {
      return res.status(400).json({ success: false, message: "Invalid event update" });
    }
    return res.status(500).json({
      success: false,
      message: "Unable to update event",
    });
  }
};

export const deleteEvent = async (req, res) => {
  try {
    const event = await Event.findById(req.params.id);

    if (!event) {
      return res.status(404).json({
        success: false,
        message: "Event not found",
      });
    }

    await event.deleteOne();

    return res.status(200).json({
      success: true,
      message: "Event deleted successfully",
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};
