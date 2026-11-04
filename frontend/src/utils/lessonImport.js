import axios from "./axios.js";

// Includes upload time and the server's 30-second parsing deadline.
export const LESSON_IMPORT_TIMEOUT_MS = 90_000;

export async function requestLessonImport(backendUrl, file, signal) {
  const body = new FormData();
  body.append("document", file);
  try {
    return await axios.post(`${backendUrl}/api/lessons/import`, body, {
      signal,
      timeout: LESSON_IMPORT_TIMEOUT_MS,
    });
  } catch (failure) {
    if (["ECONNABORTED", "ETIMEDOUT"].includes(failure.code) || [408, 504].includes(failure.response?.status)) {
      throw new Error("The document import timed out. Please try again or choose a smaller document.");
    }
    if (failure.response?.status === 413 && !failure.response.data?.message) {
      throw new Error("The server rejected this upload as too large. Try a smaller document or contact the service team.");
    }
    throw failure;
  }
}
