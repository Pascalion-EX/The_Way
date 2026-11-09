import mongoose from "mongoose";

const CAMP_FIELDS = ["_id", "title", "name", "body", "TripType", "image", "price", "paymentQrImage", "years", "createdAt", "updatedAt"];
const CARD_FIELDS = ["_id", "title", "name", "image", "price"];

export const campCardProjection = (userId) => ({
  ...Object.fromEntries(CARD_FIELDS.map((field) => [field, 1])),
  hasApplied: { $in: [new mongoose.Types.ObjectId(userId), { $ifNull: ["$applicants.user", []] }] },
});

export const toCampCard = (camp) => ({
  ...Object.fromEntries(CARD_FIELDS.filter((field) => camp[field] !== undefined).map((field) => [field, camp[field]])),
  hasApplied: camp.hasApplied === true,
});

// Compute membership metadata in MongoDB without returning the roster to the
// application on member reads. Keep this projection inclusive as fields grow.
export const campSummaryProjection = (userId) => ({
  ...Object.fromEntries(CAMP_FIELDS.map((field) => [field, 1])),
  applicantCount: { $size: { $ifNull: ["$applicants", []] } },
  hasApplied: { $in: [new mongoose.Types.ObjectId(userId), { $ifNull: ["$applicants.user", []] }] },
});

export const toCampSummary = (camp, userId) => {
  const fields = Object.fromEntries(CAMP_FIELDS.filter((field) => camp[field] !== undefined).map((field) => [field, camp[field]]));
  const applicants = Array.isArray(camp.applicants) ? camp.applicants : null;
  return {
    ...fields,
    applicantCount: applicants ? applicants.length : camp.applicantCount ?? 0,
    hasApplied: applicants
      ? applicants.some((applicant) => String(applicant.user?._id ?? applicant.user) === String(userId))
      : camp.hasApplied === true,
  };
};

// Private records have their own allowlist, even after Mongoose population.
export const toStaffApplicant = (applicant, campId) => ({
  _id: applicant._id,
  appliedAt: applicant.appliedAt,
  ...Object.fromEntries(["applicationType", "childName", "childYear", "parentPhone", "servantName", "servantRole", "notes"]
    .filter((field) => applicant[field] !== undefined).map((field) => [field, applicant[field]])),
  ...(applicant.paymentScreenshot ? {
    paymentScreenshotUrl: `/api/camps/${campId}/applicants/${applicant._id}/payment`,
  } : {}),
  user: applicant.user ? {
    _id: applicant.user._id,
    name: applicant.user.name,
    email: applicant.user.email,
    role: applicant.user.role,
  } : null,
});
