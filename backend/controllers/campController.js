import { denyAccess } from "../services/accessDenials.js";
import Camp from "../models/campsModel.js";
import CampPaymentScreenshot from "../models/campPaymentScreenshotModel.js";
import { ImageUploadError, prepareUploadedImage } from "../services/imageUploads.js";
import userModel from "../models/userModel.js";
import transporter from "../config/nodemailer.js";
import mongoose from "mongoose";
import { campCardProjection, toCampCard, campSummaryProjection, toCampSummary, toStaffApplicant } from "../services/campResponses.js";
import { buildBrandedEmail } from "../services/emailTemplate.js";
import { createUnsubscribeUrl } from "../services/emailSubscriptions.js";
import { normalizeAuthEmail } from "../services/authEmail.js";
import { timeOperation } from "../services/performance.js";
import { getSecrets } from "../config/secrets.js";
import { readPage, paginationFor } from "../utils/pagination.js";

const createRoles = ['admin', 'leader', 'pascal','pamela'];
const applyRoles = ['parent', 'admin', 'leader', 'pascal'];
const tripTypeOptions = ['Camp', 'Trip', 'Outing', 'Other'];

const paymentSettings = (body, current = {}) => {
  const price = body.price === undefined ? current.price ?? 0 : body.price;
  const qr = body.paymentQrImage === undefined ? current.paymentQrImage ?? "" : body.paymentQrImage;
  if (typeof price !== "number" || !Number.isFinite(price) || price < 0 || price > 1_000_000_000 ||
      Math.abs(price * 100 - Math.round(price * 100)) > 0.00001) {
    throw Object.assign(new Error("Price must be a non-negative amount in EGP with at most two decimal places."), { status: 400 });
  }
  if (typeof qr !== "string" || (qr.trim() && !/^\/uploads\/[a-f0-9]{64}\.webp$/.test(qr.trim()))) {
    throw Object.assign(new Error("Upload a valid payment QR image."), { status: 400 });
  }
  if (price > 0 && !qr.trim()) {
    throw Object.assign(new Error("A payment QR image is required for paid trips."), { status: 400 });
  }
  return { price, paymentQrImage: qr.trim() };
};

const removePaymentScreenshots = async (filter) => {
  try { await CampPaymentScreenshot.deleteMany(filter); }
  catch { console.error("Unable to remove unused camp payment screenshots"); }
};

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
      return await denyAccess(req, res, {
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
      ...paymentSettings(req.body),
      createdBy: userId,
    });

    return res.status(201).json({
      success: true,
      message: "Camp created successfully",
      camp: toCampSummary(camp, userId),
    });
  } catch (error) {
    return res.status(error.status || 500).json({
      success: false,
      message: error.message,
    });
  }
};

export const getAllCamps = async (req, res) => {
  try {
    const page = readPage(req.query.page);
    const { search = "", year = "", tripType = "", sortOrder = "" } = req.query;

    if (typeof search !== "string" || search.length > 200 ||
        typeof year !== "string" || (year && !/^(?:0|[1-9]|1[0-2])$/.test(year)) ||
        typeof tripType !== "string" || (tripType && !tripTypeOptions.includes(tripType)) ||
        !["", "asc", "desc"].includes(sortOrder)) {
      return res.status(400).json({ success: false, message: "Invalid camp filters" });
    }

    const filter = {};

    if (search.trim()) {
      const escapedSearch = search.trim().replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      filter.$or = ["title", "name", "body", "TripType"].map((field) => ({
        [field]: mongoose.trusted({ $regex: escapedSearch, $options: "i" }),
      }));
      const matchingYears = Array.from({ length: 12 }, (_, index) => index + 1)
        .filter((value) => String(value).includes(search.trim()));
      if (matchingYears.length) {
        filter.$or.push({ years: mongoose.trusted({ $in: matchingYears }) });
      }
    }

    if (Number(year) > 0) {
      filter.years = Number(year);
    }

    if (tripType) {
      filter.TripType = tripType;
    }

    const pagination = page === null ? undefined : paginationFor(await Camp.countDocuments(filter), page);
    const pipeline = [{ $match: filter }];
    if (sortOrder) {
      pipeline.push(
        { $addFields: { _sortYear: { $cond: [
          { $gt: [{ $size: { $ifNull: ["$years", []] } }, 0] },
          { $min: "$years" },
          9999,
        ] } } },
        { $sort: { _sortYear: sortOrder === "asc" ? 1 : -1, createdAt: -1, _id: -1 } },
      );
    } else {
      pipeline.push({ $sort: { createdAt: -1, _id: -1 } });
    }
    if (pagination) {
      pipeline.push(
        { $skip: (pagination.page - 1) * pagination.pageSize },
        { $limit: pagination.pageSize },
      );
    }
    pipeline.push({ $project: campCardProjection(req.userId) });
    const camps = await Camp.aggregate(pipeline);

    return res.status(200).json({
      success: true,
      camps: camps.map(toCampCard),
      pagination,
    });
  } catch (error) {
    console.error("GET CAMPS ERROR:", error);

    return res.status(error.status || 500).json({
      success: false,
      message: error.status === 400 ? error.message : "Unable to load camps",
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
      applicants: applicants.map((applicant) => toStaffApplicant(applicant, camp._id)),
    });
  } catch {
    return res.status(500).json({ success: false, message: "Unable to load camp applicants" });
  }
};

export const getCampPaymentScreenshot = async (req, res) => {
  try {
    const { id, applicantId } = req.params;
    if (![id, applicantId].every((value) => mongoose.isObjectIdOrHexString(value))) {
      return res.status(400).json({ success: false, message: "Invalid camp or applicant ID" });
    }
    const camp = await Camp.findById(id).select("applicants");
    const applicant = camp?.applicants?.id(applicantId);
    const screenshot = applicant?.paymentScreenshot && await CampPaymentScreenshot.findOne({
      _id: applicant.paymentScreenshot, camp: id, user: applicant.user,
    }).select("+image");
    if (!screenshot) return res.status(404).json({ success: false, message: "Payment screenshot not found" });
    res.set("X-Content-Type-Options", "nosniff");
    res.set("Content-Disposition", 'inline; filename="payment-screenshot.webp"');
    return res.type("image/webp").send(screenshot.image);
  } catch {
    return res.status(500).json({ success: false, message: "Unable to load payment screenshot" });
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
      return await denyAccess(req, res, {
        success: false,
        message: "Unauthorized to update camps",
      });
    }

    const { title, name, body, image, years, TripType } = req.body;

    const updateData = {};

    if (req.body.price !== undefined || req.body.paymentQrImage !== undefined) {
      const current = await Camp.findById(id).select("price paymentQrImage");
      if (!current) return res.status(404).json({ success: false, message: "Camp not found" });
      Object.assign(updateData, paymentSettings(req.body, current));
    }

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
    return res.status(error.status || 500).json({
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
      return await denyAccess(req, res, {
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

    await removePaymentScreenshots({ camp: deletedCamp._id });

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
  let screenshotId;
  try {
    const { id } = req.params;
    const userId = req.userId;

    if (!mongoose.isObjectIdOrHexString(id)) {
      return res.status(400).json({ success: false, message: "Invalid camp ID" });
    }

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
      return await denyAccess(req, res, {
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
    } = req.body || {};

    if (!applicationType) {
      return res.status(400).json({
        success: false,
        message: "Application type is required",
      });
    }

    if (!["parent_for_child", "child_self", "leader"].includes(applicationType)) {
      return res.status(400).json({ success: false, message: "Invalid application type" });
    }
    const isStaff = userRoles.some((role) => createRoles.includes(role));
    if (!isStaff && applicationType !== "parent_for_child") {
      return res.status(403).json({ success: false, message: "Parents must apply using the parent application form" });
    }
    for (const value of [childName, parentPhone, leaderName, leaderRole, notes]) {
      if (value !== undefined && typeof value !== "string") {
        return res.status(400).json({ success: false, message: "Application details must be text" });
      }
    }
    if (applicationType !== "leader" &&
        (!Number.isInteger(Number(childYear)) || !camp.years.includes(Number(childYear)))) {
      return res.status(400).json({ success: false, message: "Select an available year for this trip" });
    }
    if (applicationType !== "leader" && camp.price > 0 && !req.file) {
      return res.status(400).json({ success: false, message: "A payment screenshot is required for this trip" });
    }

    if (applicationType === "parent_for_child") {
      if (!childName?.trim() || !childYear || !parentPhone?.trim()) {
        return res.status(400).json({
          success: false,
          message: "Child name, child year, and parent phone are required",
        });
      }
    }

    if (applicationType === "child_self") {
      if (!childName?.trim() || !childYear || !parentPhone?.trim()) {
        return res.status(400).json({
          success: false,
          message: "Name, year, and phone are required",
        });
      }
    }

    if (applicationType === "leader") {
      if (!leaderName?.trim() || !leaderRole?.trim() || !parentPhone?.trim()) {
        return res.status(400).json({
          success: false,
          message: "Leader name, leader role, and phone are required",
        });
      }
    }

    if (req.file) {
      const image = await prepareUploadedImage(req.file.buffer, req.file.mimetype);
      const screenshot = await CampPaymentScreenshot.create({ camp: camp._id, user: userId, image });
      screenshotId = screenshot._id;
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
      paymentScreenshot: screenshotId,
      appliedAt: new Date(),
    });

    await camp.save();

    return res.status(200).json({
      success: true,
      message: "Applied successfully",
      camp: toCampSummary(camp, userId),
    });
  } catch (error) {
    if (screenshotId) await removePaymentScreenshots({ _id: screenshotId });
    return res.status(error instanceof ImageUploadError ? error.status : 500).json({
      success: false,
      message: error instanceof ImageUploadError ? error.message : "Unable to submit application. Please try again.",
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

    await removePaymentScreenshots({ camp: camp._id, user: userId });

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
      return await denyAccess(req, res, {
        success: false,
        message: "Unauthorized to notify applicants",
      });
    }

    const camp = await Camp.findById(id).populate(
      "applicants.user",
      "email firstName lastName role emailUpdatesEnabled isBanned"
    );

    if (!camp) {
      return res.status(404).json({
        success: false,
        message: "Trip not found",
      });
    }

    const recipients = new Map();
    for (const applicant of camp.applicants) {
      const participant = applicant.user;
      const email = normalizeAuthEmail(participant?.email);
      if (email && participant.emailUpdatesEnabled !== false && !participant.isBanned) {
        recipients.set(email, { _id: participant._id, email });
      }
    }
    const skippedCount = camp.applicants.length - recipients.size;
    const participants = [...recipients.values()];
    let sentCount = 0;
    let failedCount = 0;
    // Each person needs their own unsubscribe capability. Keep SMTP work
    // bounded to the transport's two pooled connections and addresses private.
    for (let offset = 0; offset < participants.length; offset += 2) {
      const results = await Promise.allSettled(participants.slice(offset, offset + 2).map(async (participant) => {
        const email = buildBrandedEmail({
          kind: "camp", title: camp.title, text: message,
          unsubscribeUrl: createUnsubscribeUrl(participant),
        });
        await timeOperation("smtp", () => transporter.sendMail({
          from: getSecrets().senderEmail, to: participant.email, subject, ...email,
          text: `${camp.title}\n\n${email.text}`,
        }));
      }));
      sentCount += results.filter((result) => result.status === "fulfilled").length;
      failedCount += results.filter((result) => result.status === "rejected").length;
    }
    if (failedCount) {
      return res.status(502).json({ success: false, sentCount, failedCount, skippedCount,
        message: `Notification sent to ${sentCount} participant(s); ${failedCount} email(s) could not be sent.` });
    }

    return res.status(200).json({
      success: true,
      sentCount, skippedCount,
      message: sentCount ? `Notification sent to ${sentCount} participant(s)` : "No subscribed participant emails found. No emails were sent.",
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};
