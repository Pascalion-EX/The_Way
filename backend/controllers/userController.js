import bcrypt from "bcryptjs";
import userModel from "../models/userModel.js";
import { normalizeAuthEmail, passwordInputError } from "../../shared/authValidation.mjs";
import { isValidAvatarId } from "../../shared/avatarPresets.mjs";
import { canAccessAllAttendanceClasses } from "../../shared/attendanceAccess.mjs";

export const getUserData = async (req, res) => {
  try {
    const user = await userModel.findById(req.userId);

    if (!user) {
      return res.json({ success: false, message: "User not found" });
    }

    res.json({
      success: true,
      userData: {
        _id: user._id,
        name: user.name,
        avatarId: user.avatarId || "",
        isAccountVerified: user.isAccountVerified,
        role: user.role,
        email: user.email,
        emailUpdatesEnabled: user.emailUpdatesEnabled !== false,
        phone: user.phone,
        job: user.job || "",
        class: user.class,
        verificationEmailQueued: Boolean(user.emailJobs?.verification),
        otpResendAvailableAt: user.verifyOtpRequestedAt ? user.verifyOtpRequestedAt + 60_000 : 0,
      },
    });
  } catch (error) {
    res.json({ success: false, message: error.message });
  }
};

export const updateProfile = async (req, res) => {
  try {
    const userId = req.userId;

    if (!req.body || typeof req.body !== "object" || Array.isArray(req.body)) {
      return res.status(400).json({ success: false, message: "Profile data is required" });
    }

    const { name, email, phone, job, currentPassword } = req.body;
    const userClass = req.body.class;

    const updateData = {};
    if (Object.hasOwn(req.body, "emailUpdatesEnabled")) {
      if (typeof req.body.emailUpdatesEnabled !== "boolean") {
        return res.status(400).json({ success: false, message: "Email preference must be enabled or disabled" });
      }
      updateData.emailUpdatesEnabled = req.body.emailUpdatesEnabled;
    }

    if (Object.hasOwn(req.body, "avatarId")) {
      if (!isValidAvatarId(req.body.avatarId)) {
        return res.status(400).json({ success: false, message: "Choose an available profile picture" });
      }
      updateData.avatarId = req.body.avatarId;
    }

    if (name !== undefined) updateData.name = name;
    if (phone !== undefined) updateData.phone = phone;
    if (job !== undefined) {
      if (typeof job !== "string" || job.length > 200) {
        return res.status(400).json({ success: false, message: "Job must be text of up to 200 characters" });
      }
      updateData.job = job.trim();
    }
    if (userClass !== undefined) {
      const normalizedClass = typeof userClass === "string" && userClass.trim() !== "" ? Number(userClass) : userClass;
      if (!Number.isInteger(normalizedClass) || normalizedClass < 0 || normalizedClass > 12) {
        return res.status(400).json({
          success: false,
          message: "Class must be a whole number from 0 to 12. Use 0 for no class.",
        });
      }
      updateData.class = normalizedClass;
    }

    let normalizedEmail;
    if (email !== undefined) {
      normalizedEmail = normalizeAuthEmail(email);
      if (!normalizedEmail) {
        return res.status(400).json({ success: false, message: "A valid email address is required" });
      }
    }

    const currentUser = await userModel.findById(userId).select("email password role class");
    if (!currentUser) {
      return res.status(404).json({ success: false, message: "User not found" });
    }

    if (currentUser.role.includes("servant") && !canAccessAllAttendanceClasses(currentUser.role) &&
        updateData.class !== undefined) {
      if (updateData.class !== currentUser.class) {
        return res.status(403).json({
          success: false,
          message: "Only an administrator can change your assigned class.",
        });
      }
      delete updateData.class;
    }

    const emailChanged = normalizedEmail !== undefined &&
      normalizedEmail !== normalizeAuthEmail(currentUser.email);
    const filter = { _id: userId };
    const update = { $set: updateData };

    if (emailChanged) {
      if (typeof currentPassword !== "string" || !currentPassword) {
        return res.status(400).json({
          success: false,
          code: "REAUTHENTICATION_REQUIRED",
          message: "Enter your current password to change your email address",
        });
      }
      const passwordError = passwordInputError(currentPassword);
      if (passwordError) return res.status(400).json({ success: false, code: "INVALID_PASSWORD", message: passwordError });
      if (!await bcrypt.compare(currentPassword, currentUser.password)) {
        return res.status(403).json({ success: false, message: "Current password is incorrect" });
      }

      // Bind the write to the credentials we checked, preventing concurrent
      // password resets or email changes from bypassing reauthentication.
      filter.email = currentUser.email;
      filter.password = currentUser.password;
      filter.isAccountVerified = true;
      updateData.email = normalizedEmail;
      updateData.isAccountVerified = false;
      for (const prefix of ["verifyOtp", "resetOtp"]) {
        updateData[prefix] = "";
        updateData[`${prefix}ExpireAt`] = 0;
        updateData[`${prefix}RequestedAt`] = 0;
        updateData[`${prefix}Attempts`] = 0;
        updateData[`${prefix}Generation`] = "";
      }
      update.$unset = { emailJobs: "" };
    }
    if (!emailChanged && updateData.emailUpdatesEnabled === false) {
      update.$unset = { "emailJobs.welcome": "" };
    }

    const user = await userModel
      .findOneAndUpdate(filter, update, { returnDocument: "after", runValidators: true })
      .select("name email phone job class role isAccountVerified avatarId emailUpdatesEnabled");

    if (!user) {
      return res.status(emailChanged ? 409 : 404).json({
        success: false,
        message: emailChanged ? "Account changed. Please reload and try again." : "User not found",
      });
    }

    return res.json({
      success: true,
      message: emailChanged ? "Email updated. Please verify your new email address." : "Profile updated successfully",
      user,
    });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(409).json({ success: false, message: "Email address is already in use" });
    }
    return res.status(500).json({
      success: false,
      message: "Unable to update profile",
    });
  }
};
