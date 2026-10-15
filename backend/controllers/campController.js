import Camp from "../models/campsModel.js";
import userModel from "../models/userModel.js";
import transporter from "../config/nodemailer.js";
import mongoose from "mongoose";
import { campSummaryProjection, toCampSummary, toStaffApplicant } from "../services/campResponses.js";

const createRoles = ['admin', 'leader', 'pascal','pamela'];
const applyRoles = ['parent', 'admin', 'leader', 'pascal'];
const tripTypeOptions = ['Camp', 'Trip', 'Outing', 'Other'];

const normalizeRoles = (roleValue) => {
  if (Array.isArray(roleValue)) {
    return roleValue.map((role) => String(role).toLowerCase());
  }

  if (roleValue) {
    return [String(roleValue).toLowerCase()];
  }

  return [];
};

export const createCamp = async (req, res) => {
  try {
    const userId = req.userId;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "User not authenticated",
      });
    }

    const user = await userModel.findById(userId).select("-password");

    if (!user) {
      return res.status(401).json({
        success: false,
        message: "User not found",
      });
    }

    const userRoles = normalizeRoles(user.role);

    const isAuthorized = userRoles.some((role) => createRoles.includes(role));

    if (!isAuthorized) {
      return res.status(403).json({
        success: false,
        message: `Unauthorized to create camps. Your role is: ${
          userRoles.length > 0 ? userRoles.join(", ") : "no role found"
        }`,
      });
    }

    const { title, name, body, image, years, TripType } = req.body;

    if (!title || !name || !body || !TripType || !years) {
      return res.status(400).json({
        success: false,
        message: "Title, name, body, trip type, and years are required",
      });
    }

    if (!tripTypeOptions.includes(TripType)) {
      return res.status(400).json({
        success: false,
        message: "Trip type must be Camp, Trip, Outing, or Other",
      });
    }

    if (!Array.isArray(years) || years.length === 0) {
      return res.status(400).json({
        success: false,
        message: "Years must be a non-empty array",
      });
    }

    const cleanedYears = [...new Set(years.map(Number))]
      .filter((year) => Number.isInteger(year) && year >= 1 && year <= 12)
      .sort((a, b) => a - b);

    if (cleanedYears.length === 0) {
      return res.status(400).json({
        success: false,
        message: "Years must contain valid values from 1 to 12",
      });
    }

    const camp = await Camp.create({
      title: title.trim(),
      name: name.trim(),
      body: body.trim(),
      TripType,
      image: image?.trim() || "",
      years: cleanedYears,
      createdBy: userId,
    });

    return res.status(201).json({
      success: true,
      message: "Camp created successfully",
      camp: toCampSummary(camp, userId),
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

export const getAllCamps = async (req, res) => {
  try {
    const { search = "", year = "", tripType = "" } = req.query;

    if (typeof search !== "string" || search.length > 200 ||
        typeof year !== "string" || (year && !/^(?:[1-9]|1[0-2])$/.test(year)) ||
        typeof tripType !== "string" || (tripType && !tripTypeOptions.includes(tripType))) {
      return res.status(400).json({ success: false, message: "Invalid camp filters" });
    }

    const filter = {};

    if (search.trim()) {
      const escapedSearch = search.trim().replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      filter.$or = [
        { title: { $regex: escapedSearch, $options: "i" } },
        { name: { $regex: escapedSearch, $options: "i" } },
        { body: { $regex: escapedSearch, $options: "i" } },
        { TripType: { $regex: escapedSearch, $options: "i" } },
      ];
    }

    if (year) {
      filter.years = Number(year);
    }

    if (tripType) {
      filter.TripType = tripType;
    }

    const camps = await Camp.aggregate([
      { $match: filter }, { $sort: { createdAt: -1 } },
      { $project: campSummaryProjection(req.userId) },
    ]);

    return res.status(200).json({
      success: true,
      camps: camps.map((camp) => toCampSummary(camp, req.userId)),
    });
  } catch (error) {
    console.error("GET CAMPS ERROR:", error);

    return res.status(500).json({
      success: false,
      message: "Unable to load camps",
    });
  }
};

export const getCampById = async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.isObjectIdOrHexString(id)) {
      return res.status(400).json({ success: false, message: "Invalid camp ID" });
    }
    const [camp] = await Camp.aggregate([
      { $match: { _id: new mongoose.Types.ObjectId(id) } },
      { $project: campSummaryProjection(req.userId) },
    ]);

    if (!camp) {
      return res.status(404).json({
        success: false,
        message: "Camp not found",
      });
    }

    return res.status(200).json({
      success: true,
      camp: toCampSummary(camp, req.userId),
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Unable to load camp",
    });
  }
};

export const getCampApplicants = async (req, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.isObjectIdOrHexString(id)) {
      return res.status(400).json({ success: false, message: "Invalid camp ID" });
    }
    const camp = await Camp.findById(id).select("applicants")
      .populate("applicants.user", "name email role");
    if (!camp) return res.status(404).json({ success: false, message: "Camp not found" });
    const applicants = camp.applicants || [];
    return res.status(200).json({
      success: true, campId: camp._id,
      applicantCount: applicants.length,
      applicants: applicants.map(toStaffApplicant),
    });
  } catch {
    return res.status(500).json({ success: false, message: "Unable to load camp applicants" });
  }
};

export const updateCamp = async (req, res) => {
  try {
    const { id } = req.params;
    const user = await userModel.findById(req.userId).select("role");
    if (!user) return res.status(401).json({ success: false, message: "User not found" });
    const userRoles = normalizeRoles(user.role);

    const isAuthorized = userRoles.some((role) => createRoles.includes(role));

    if (!isAuthorized) {
      return res.status(403).json({
        success: false,
        message: "Unauthorized to update camps",
      });
    }

    const { title, name, body, image, years, TripType } = req.body;

    const updateData = {};

    if (title !== undefined) updateData.title = title.trim();
    if (name !== undefined) updateData.name = name.trim();
    if (body !== undefined) updateData.body = body.trim();
    if (image !== undefined) updateData.image = image.trim();

    if (TripType !== undefined) {
      if (!tripTypeOptions.includes(TripType)) {
        return res.status(400).json({
          success: false,
          message: "Trip type must be Camp, Trip, Outing, or Other",
        });
      }

      updateData.TripType = TripType;
    }

    if (years !== undefined) {
      if (!Array.isArray(years) || years.length === 0) {
        return res.status(400).json({
          success: false,
          message: "Years must be a non-empty array",
        });
      }

      const cleanedYears = [...new Set(years.map(Number))]
        .filter((year) => Number.isInteger(year) && year >= 1 && year <= 12)
        .sort((a, b) => a - b);

      if (cleanedYears.length === 0) {
        return res.status(400).json({
          success: false,
          message: "Years must contain valid values from 1 to 12",
        });
      }

      updateData.years = cleanedYears;
    }

    const updatedCamp = await Camp.findByIdAndUpdate(id, updateData, {
      returnDocument: "after",
      runValidators: true,
    });

    if (!updatedCamp) {
      return res.status(404).json({
        success: false,
        message: "Camp not found",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Camp updated successfully",
      camp: toCampSummary(updatedCamp, req.userId),
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

export const deleteCamp = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.userId;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "User not authenticated",
      });
    }

    const user = await userModel.findById(userId).select("-password");

    if (!user) {
      return res.status(401).json({
        success: false,
        message: "User not found",
      });
    }

    const userRoles = normalizeRoles(user.role);

    const isAuthorized = userRoles.some((role) => createRoles.includes(role));

    if (!isAuthorized) {
      return res.status(403).json({
        success: false,
        message: "Unauthorized to delete camps",
      });
    }

    const deletedCamp = await Camp.findByIdAndDelete(id);

    if (!deletedCamp) {
      return res.status(404).json({
        success: false,
        message: "Camp not found",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Camp deleted successfully",
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

export const applyToCamp = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.userId;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "User not authenticated",
      });
    }

    const user = await userModel.findById(userId).select("-password");

    if (!user) {
      return res.status(401).json({
        success: false,
        message: "User not found",
      });
    }

    const userRoles = normalizeRoles(user.role);

    const isAuthorized = userRoles.some((role) => applyRoles.includes(role));

    if (!isAuthorized) {
      return res.status(403).json({
        success: false,
        message: "Unauthorized to apply for trips",
      });
    }

    const camp = await Camp.findById(id);

    if (!camp) {
      return res.status(404).json({
        success: false,
        message: "Trip not found",
      });
    }

    const alreadyApplied = camp.applicants.some(
      (applicant) => applicant.user.toString() === userId.toString()
    );

    if (alreadyApplied) {
      return res.status(400).json({
        success: false,
        message: "You already applied to this trip",
      });
    }

    const {
      applicationType,
      childName,
      childYear,
      parentPhone,
      leaderName,
      leaderRole,
      notes,
    } = req.body;

    if (!applicationType) {
      return res.status(400).json({
        success: false,
        message: "Application type is required",
      });
    }

    if (applicationType === "parent_for_child") {
      if (!childName || !childYear || !parentPhone) {
        return res.status(400).json({
          success: false,
          message: "Child name, child year, and parent phone are required",
        });
      }
    }

    if (applicationType === "child_self") {
      if (!childName || !childYear || !parentPhone) {
        return res.status(400).json({
          success: false,
          message: "Name, year, and phone are required",
        });
      }
    }

    if (applicationType === "leader") {
      if (!leaderName || !leaderRole || !parentPhone) {
        return res.status(400).json({
          success: false,
          message: "Leader name, leader role, and phone are required",
        });
      }
    }

    camp.applicants.push({
      user: userId,
      applicationType,
      childName: childName?.trim() || "",
      childYear: childYear ? Number(childYear) : undefined,
      parentPhone: parentPhone?.trim() || "",
      leaderName: leaderName?.trim() || "",
      leaderRole: leaderRole?.trim() || "",
      notes: notes?.trim() || "",
      appliedAt: new Date(),
    });

    await camp.save();

    return res.status(200).json({
      success: true,
      message: "Applied successfully",
      camp: toCampSummary(camp, userId),
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

export const withdrawFromCamp = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.userId;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "User not authenticated",
      });
    }

    const camp = await Camp.findById(id);

    if (!camp) {
      return res.status(404).json({
        success: false,
        message: "Trip not found",
      });
    }

    const beforeCount = camp.applicants.length;

    camp.applicants = camp.applicants.filter(
      (applicant) => applicant.user.toString() !== userId.toString()
    );

    if (camp.applicants.length === beforeCount) {
      return res.status(400).json({
        success: false,
        message: "You have not applied to this trip",
      });
    }

    await camp.save();

    return res.status(200).json({
      success: true,
      message: "Application withdrawn successfully",
      camp: toCampSummary(camp, userId),
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};
export const notifyCampApplicants = async (req, res) => {
  try {
    const { id } = req.params;
    const { subject, message } = req.body;
    const userId = req.userId;

    const notifyRoles = ["admin", "leader", "pascal"];

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "User not authenticated",
      });
    }

    if (!subject || !message) {
      return res.status(400).json({
        success: false,
        message: "Subject and message are required",
      });
    }

    const user = await userModel.findById(userId).select("-password");

    if (!user) {
      return res.status(401).json({
        success: false,
        message: "User not found",
      });
    }

    const userRoles = normalizeRoles(user.role);

    const isAuthorized = userRoles.some((role) =>
      notifyRoles.includes(role)
    );

    if (!isAuthorized) {
      return res.status(403).json({
        success: false,
        message: "Unauthorized to notify applicants",
      });
    }

    const camp = await Camp.findById(id).populate(
      "applicants.user",
      "email firstName lastName role"
    );

    if (!camp) {
      return res.status(404).json({
        success: false,
        message: "Trip not found",
      });
    }

    const emails = [
      ...new Set(
        camp.applicants
          .map((applicant) => applicant.user?.email)
          .filter(Boolean)
      ),
    ];

    if (emails.length === 0) {
      return res.status(400).json({
        success: false,
        message: "No participant emails found",
      });
    }

    await transporter.sendMail({
      from: process.env.SENDER_EMAIL,
      bcc: emails,
      subject,
      html: `
        <div style="font-family: Arial, sans-serif; line-height: 1.6;">
          <h2>${camp.title}</h2>
          <p>${message.replace(/\n/g, "<br />")}</p>
        </div>
      `,
    });

    return res.status(200).json({
      success: true,
      message: `Notification sent to ${emails.length} participant(s)`,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};
