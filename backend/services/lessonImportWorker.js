import { parentPort, workerData } from "node:worker_threads";
import { parseLessonDocument } from "./lessonDocumentParser.js";
import { LessonImportError } from "./lessonImportErrors.js";

try {
  const result = await parseLessonDocument(Buffer.from(workerData.buffer), workerData.filename);
  parentPort.postMessage({ success: true, ...result });
} catch (error) {
  parentPort.postMessage({
    success: false,
    message: error instanceof LessonImportError ? error.message : "This document could not be read. Check that it is a valid, unencrypted document and try again.",
    status: error instanceof LessonImportError ? error.status : 422,
    code: error instanceof LessonImportError ? error.code : "LESSON_IMPORT_FAILED",
  });
}
