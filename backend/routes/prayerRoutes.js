import express from "express";
import userAuth from "../middleware/userAuth.js";
import { getRequestIdentity } from "../services/requestIdentity.js";
import { denyAccess } from "../services/accessDenials.js";
import { canManagePrayers } from "../../shared/pageAccess.mjs";
import { getPrayers, getPrayer, createPrayer, updatePrayer, deletePrayer } from "../controllers/prayerController.js";

const router = express.Router();
router.use(userAuth);
router.use((_req, res, next) => { res.set("Cache-Control", "private, no-store"); next(); });

const requirePrayerManager = async (req, res, next) => {
  // Authentication reads current database roles on every request.
  if (!canManagePrayers(getRequestIdentity(req)?.role)) {
    return denyAccess(req, res, { success: false, code: "PRAYER_MANAGEMENT_REQUIRED", message: "Only admin, Pascal, and Pamela users can add, edit, or delete prayers" });
  }
  return next();
};

router.get("/", getPrayers);
router.get("/:id", getPrayer);
router.post("/", requirePrayerManager, createPrayer);
router.put("/:id", requirePrayerManager, updatePrayer);
router.delete("/:id", requirePrayerManager, deletePrayer);

export default router;
