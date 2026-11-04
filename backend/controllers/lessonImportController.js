import { extractLessonDraft } from "../services/lessonImports.js";
import { LessonImportError } from "../services/lessonImportErrors.js";

export async function importLessonDocument(req, res) {
  res.set("Cache-Control", "private, no-store");
  try {
    const result = await extractLessonDraft(req.file);
    return res.json({ success: true, ...result });
  } catch (error) {
    return res.status(error instanceof LessonImportError ? error.status : 500).json({
      success: false,
      code: error instanceof LessonImportError ? error.code : "LESSON_IMPORT_FAILED",
      message: error instanceof LessonImportError ? error.message : "Unable to import this document. Please try again.",
    });
  }
}
