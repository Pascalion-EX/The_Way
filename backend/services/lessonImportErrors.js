export class LessonImportError extends Error {
  constructor(message, status = 422, code = "LESSON_IMPORT_FAILED") {
    super(message);
    this.status = status;
    this.code = code;
  }
}
