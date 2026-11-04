export const MAX_LESSON_DOCUMENT_BYTES = 10 * 1024 * 1024;
export const LESSON_DOCUMENT_ACCEPT = ".docx,.pdf,.html,.htm,.txt";
export const LESSON_DOCUMENT_EXTENSIONS = ["docx", "pdf", "html", "htm", "txt"];

export function lessonDocumentExtension(filename) {
  return typeof filename === "string" ? filename.split(".").at(-1).toLowerCase() : "";
}

export function lessonDocumentFileError(file) {
  if (!file || !LESSON_DOCUMENT_EXTENSIONS.includes(lessonDocumentExtension(file.name))) {
    return "Choose a Word (.docx), PDF, HTML, or text document.";
  }
  if (file.size > MAX_LESSON_DOCUMENT_BYTES) return "Documents must be 10 MB or smaller.";
  if (!file.size) return "Choose a document that is not empty.";
  return null;
}
