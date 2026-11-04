import { Worker } from "node:worker_threads";
import { LessonImportError } from "./lessonImportErrors.js";

let activeImports = 0;

export async function extractLessonDraft(file, { timeoutMs = 30_000 } = {}) {
  if (activeImports >= 2) {
    throw new LessonImportError("Document imports are busy. Please try again shortly.", 503, "LESSON_IMPORT_BUSY");
  }
  activeImports++;
  let worker;
  let timer;
  try {
    return await new Promise((resolve, reject) => {
      worker = new Worker(new URL("./lessonImportWorker.js", import.meta.url), {
        workerData: { buffer: file.buffer, filename: file.originalname },
        resourceLimits: { maxOldGenerationSizeMb: 256 },
      });
      timer = setTimeout(() => {
        reject(new LessonImportError("This document took too long to read. Try a smaller document.", 422, "LESSON_IMPORT_TIMEOUT"));
      }, timeoutMs);
      worker.once("message", (result) => {
        if (result.success) resolve({ draft: result.draft, warnings: result.warnings });
        else reject(new LessonImportError(result.message, result.status, result.code));
      });
      worker.once("error", () => reject(new LessonImportError("This document could not be read. Try a smaller, valid document.")));
      worker.once("exit", () => reject(new LessonImportError("The document import stopped. Please try again.")));
    });
  } finally {
    clearTimeout(timer);
    await worker?.terminate();
    activeImports--;
  }
}
