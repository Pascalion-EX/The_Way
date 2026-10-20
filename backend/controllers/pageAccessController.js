import userModel from "../models/userModel.js";
import { pageAccessRoles, canAccessPage } from "../../shared/pageAccess.mjs";
import { denyAccess } from "../services/accessDenials.js";

export async function checkPageAccess(req, res) {
  const pathname = req.body?.pathname;
  if (!pageAccessRoles(pathname)) {
    return res.status(400).json({ success: false, message: "Unknown restricted page." });
  }
  try {
    const user = await userModel.findById(req.userId).select("role");
    if (!user) return res.status(401).json({ success: false, message: "User not found." });
    if (!canAccessPage(pathname, user.role)) {
      return await denyAccess(req, res, { message: "You do not have permission to access this page." });
    }
    return res.json({ success: true });
  } catch {
    return res.status(503).json({ success: false, message: "Unable to check page access. Please try again later." });
  }
}
