import Camp from "../models/campsModel.js";
import userModel from "../models/userModel.js";
import transporter from "../config/nodemailer.js";

const createRoles = ['admin', 'leader', 'pascal','pamela'];
const applyRoles = ['parent', 'child', 'admin', 'leader', 'pascal'];
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
      camp,
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

    const filter = {};

    if (search.trim()) {
      filter.$or = [
        { title: { $regex: search.trim(), $options: "i" } },
        { name: { $regex: search.trim(), $options: "i" } },
        { body: { $regex: search.trim(), $options: "i" } },
        { TripType: { $regex: search.trim(), $options: "i" } },
      ];
    }

    if (year) {
      filter.years = Number(year);
    }

    if (tripType) {
      filter.TripType = tripType;
    }

    const camps = await Camp.find(filter).sort({ createdAt: -1 });

    return res.status(200).json({
      success: true,
      camps,
    });
  } catch (error) {
    console.error("GET CAMPS ERROR:", error);

    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

export const getCampById = async (req, res) => {
  try {
    const { id } = req.params;

    const camp = await Camp.findById(id)
      .populate("createdBy", "firstName lastName email role")
      .populate("applicants.user", "firstName lastName email role");

    if (!camp) {
      return res.status(404).json({
        success: false,
        message: "Camp not found",
      });
    }

    return res.status(200).json({
      success: true,
      camp,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

export const updateCamp = async (req, res) => {
  try {
    const { id } = req.params;
    const userRoles = normalizeRoles(req.user?.role);

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
      new: true,
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
      camp: updatedCamp,
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
      camp,
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
      camp,
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