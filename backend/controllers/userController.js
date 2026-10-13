import userModel from "../models/userModel.js";

export const getUserData = async (req, res) => {
  try {
    const user = await userModel.findById(req.userId);

    if (!user) {
      return res.json({ success: false, message: "User not found" });
    }

    res.json({
      success: true,
      userData: {
        name: user.name,
        isAccountVerified: user.isAccountVerified,
        role: user.role,
        email: user.email,
        phone: user.phone,
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

    const { name, email, phone } = req.body;
    const userClass = req.body.class;

    const updateData = {};

    if (name !== undefined) updateData.name = name;
    if (email !== undefined) updateData.email = email;
    if (phone !== undefined) updateData.phone = phone;
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

    const user = await userModel
      .findByIdAndUpdate(userId, updateData, { new: true, runValidators: true })
      .select("-password -verifyOtp -resetOtp -verifyOtpAttempts -resetOtpAttempts -verifyOtpGeneration -resetOtpGeneration -emailJobs");

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    return res.json({
      success: true,
      message: "Profile updated successfully",
      user,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};
