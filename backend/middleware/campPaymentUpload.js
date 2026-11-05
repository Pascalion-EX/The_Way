import multer from "multer";
import { IMAGE_TYPES, MAX_IMAGE_BYTES } from "../services/imageUploads.js";

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_IMAGE_BYTES, files: 1, fields: 8, fieldSize: 10 * 1024, parts: 9 },
  fileFilter: (_req, file, callback) => {
    if (!IMAGE_TYPES.has(file.mimetype)) {
      return callback(Object.assign(new Error("Choose a JPEG, PNG, or WebP payment screenshot."), { status: 415 }));
    }
    callback(null, true);
  },
}).single("paymentScreenshot");

export function uploadCampPayment(req, res, next) {
  // Retain JSON applications for leaders and free/legacy camps.
  if (!req.is("multipart/form-data")) return next();
  upload(req, res, (error) => {
    if (!error) return next();
    const tooLarge = error.code === "LIMIT_FILE_SIZE";
    return res.status(tooLarge ? 413 : error.status || 400).json({
      success: false,
      message: tooLarge ? "Payment screenshots must be 5 MB or smaller." :
        error.status === 415 ? error.message : "Upload one payment screenshot without extra files or fields.",
    });
  });
}
