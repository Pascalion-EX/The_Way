import multer from "multer";
import { requireStaff } from "./staffAuth.js";
import { createAuthRateLimit } from "./authRateLimit.js";
import { lessonDocumentFileError, MAX_LESSON_DOCUMENT_BYTES } from "../../shared/lessonImport.mjs";

// Lesson import uses the same current database roles as lesson creation.
export const requireLessonImporterRole = requireStaff;

export const lessonImportRateLimit = createAuthRateLimit({
  scope: "lesson-import-account", limit: 20, windowMs: 60 * 60 * 1000,
  key: (req) => req.userId,
  code: "LESSON_IMPORT_RATE_LIMITED",
  message: "Too many document imports. Please try again later.",
  unavailableMessage: "Document imports are temporarily unavailable. Please try again later.",
});

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_LESSON_DOCUMENT_BYTES, files: 1, fields: 0, parts: 1 },
  fileFilter: (_req, file, callback) => {
    const message = lessonDocumentFileError({ name: file.originalname, size: 1 });
    if (message) return callback(Object.assign(new Error(message), { status: 415 }));
    callback(null, true);
  },
}).single("document");

export function uploadLessonDocument(req, res, next) {
  if (!req.is("multipart/form-data") || (req.get("content-encoding") || "identity") !== "identity") {
    return res.status(415).json({ success: false, message: "Upload one document using multipart/form-data." });
  }
  upload(req, res, (error) => {
    if (error) {
      const tooLarge = error.code === "LIMIT_FILE_SIZE";
      return res.status(tooLarge ? 413 : error.status || 400).json({
        success: false,
        message: tooLarge ? "Documents must be 10 MB or smaller." : error.status === 415 ? error.message : "Upload one document in the document field, without extra files or fields.",
      });
    }
    const message = lessonDocumentFileError(req.file && { name: req.file.originalname, size: req.file.size });
    if (message) return res.status(400).json({ success: false, message });
    return next();
  });
}
