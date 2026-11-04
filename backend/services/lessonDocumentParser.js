import { load } from "cheerio";
import { lessonDocumentExtension } from "../../shared/lessonImport.mjs";
import { LessonImportError } from "./lessonImportErrors.js";

const MAX_PARTITIONS = 100;
// Leave space for the other fields under the existing 100 KB lesson-save limit.
const MAX_DRAFT_BYTES = 80 * 1024;
const cleanText = (text) => text.replace(/\r\n?/g, "\n").replace(/\u00a0/g, " ").replace(/\n[ \t]+/g, "\n").trim();

export function partitionLessonBlocks(blocks, filename, documentTitle = "") {
  const fallbackTitle = filename.split(/[\\/]/).at(-1).replace(/\.[^.]+$/, "").replace(/[_-]+/g, " ").trim() || "Imported lesson";
  const firstHeading = blocks.find((block) => block.heading && block.text.trim());
  const title = cleanText(documentTitle || firstHeading?.text || fallbackTitle);
  const partitions = [];
  let sectionTitle = "Introduction";
  let content = [];
  const flush = () => {
    const body = cleanText(content.join("\n\n"));
    if (body) partitions.push({ title: sectionTitle, body });
    content = [];
  };
  for (const block of blocks) {
    const text = cleanText(block.text);
    if (!text) continue;
    if (block.heading) {
      flush();
      sectionTitle = text;
    } else {
      content.push(text);
    }
  }
  flush();
  if (!partitions.length) {
    throw new LessonImportError("No readable lesson content was found. Scanned PDFs need OCR before importing.", 422, "NO_DOCUMENT_TEXT");
  }
  if (!firstHeading) partitions[0].title = "Lesson content";
  const draft = { title, partitions };
  if (partitions.length > MAX_PARTITIONS || Buffer.byteLength(JSON.stringify(draft)) > MAX_DRAFT_BYTES) {
    throw new LessonImportError("This lesson is too long to import at once. Split it into smaller documents.", 413, "LESSON_IMPORT_TOO_LARGE");
  }
  return {
    draft,
    warnings: firstHeading ? [] : ["No headings were detected. The content was placed in one editable partition."],
  };
}

export function parseLessonHtml(html, filename) {
  const $ = load(html);
  const documentTitle = $("head > title").first().text();
  $("script, style, iframe, object, embed, template, noscript, head").remove();
  const blocks = [];
  let pending = "";
  const flush = () => {
    if (pending.trim()) blocks.push({ text: pending, heading: false });
    pending = "";
  };
  const blockTags = new Set(["p", "div", "section", "article", "header", "footer", "li", "ul", "ol", "blockquote", "pre", "table", "tr"]);
  const visit = (node) => {
    if (node.type === "text") { pending += node.data; return; }
    const tag = node.tagName;
    if (/^h[1-6]$/.test(tag)) {
      flush();
      blocks.push({ text: $(node).text(), heading: true });
      return;
    }
    if (tag === "br") { pending += "\n"; return; }
    if (tag === "img") return;
    const isBlock = blockTags.has(tag);
    if (isBlock) flush();
    if (tag === "li") pending += "• ";
    if (tag === "td" || tag === "th") pending += pending ? "\t" : "";
    for (const child of node.children || []) visit(child);
    if (isBlock) flush();
  };
  for (const node of $("body").contents().toArray()) visit(node);
  flush();
  return partitionLessonBlocks(blocks, filename, documentTitle);
}

// Only explicit text markers count as headings; ordinary prose stays together.
export function parseLessonText(text, filename) {
  const lines = cleanText(text).split("\n");
  const blocks = [];
  let paragraph = [];
  const flush = () => {
    if (paragraph.length) blocks.push({ text: paragraph.join("\n"), heading: false });
    paragraph = [];
  };
  for (let index = 0; index < lines.length; index++) {
    const line = lines[index].trim();
    const markdown = line.match(/^#{1,6}\s+(.+?)(?:\s+#+)?$/);
    const underlined = line && /^(?:={3,}|-{3,})$/.test(lines[index + 1]?.trim() || "");
    const label = line.length <= 120 && line.endsWith(":") && line.split(/\s+/).length <= 12;
    const capitals = line.length <= 120 && /\p{Lu}{2}/u.test(line) && /^[\p{Lu}\p{N}\p{M}\s.,'’&()\-:]+$/u.test(line);
    if ((markdown || underlined || label || capitals) && line.length <= 200) {
      flush();
      blocks.push({ text: markdown ? markdown[1] : line, heading: true });
      if (underlined) index++;
    } else if (!line) {
      flush();
    } else {
      paragraph.push(line);
    }
  }
  flush();
  return partitionLessonBlocks(blocks, filename);
}

export async function parseLessonDocument(buffer, filename) {
  const extension = lessonDocumentExtension(filename);
  if (extension === "docx") {
    if (buffer.readUInt16BE(0) !== 0x504b) throw new LessonImportError("This file is not a valid Word (.docx) document.");
    const { default: mammoth } = await import("mammoth");
    const { value } = await mammoth.convertToHtml({ buffer }, {
      externalFileAccess: false,
      includeEmbeddedStyleMap: false,
      styleMap: ["p[style-name='Title'] => h1:fresh"],
      // Images are added separately through the existing required image field.
      convertImage: mammoth.images.imgElement(async () => ({})),
    });
    return parseLessonHtml(value, filename);
  }
  if (extension === "pdf") {
    if (buffer.subarray(0, 5).toString() !== "%PDF-") throw new LessonImportError("This file is not a valid PDF document.");
    const { PDFParse } = await import("pdf-parse");
    const parser = new PDFParse({ data: new Uint8Array(buffer), isEvalSupported: false, verbosity: 0 });
    try {
      const { total } = await parser.getInfo();
      if (total > 200) throw new LessonImportError("PDFs must contain 200 pages or fewer.", 413, "LESSON_IMPORT_TOO_LARGE");
      const result = await parser.getText({ pageJoiner: "\n\n" });
      return parseLessonText(result.text, filename);
    } finally {
      await parser.destroy();
    }
  }
  if (!["html", "htm", "txt"].includes(extension)) {
    throw new LessonImportError("Choose a Word (.docx), PDF, HTML, or text document.", 415);
  }
  let text;
  try {
    text = new TextDecoder("utf-8", { fatal: true }).decode(buffer);
  } catch {
    throw new LessonImportError("Save HTML and text documents with UTF-8 encoding before importing.");
  }
  if (text.includes("\0")) throw new LessonImportError("This file is not a valid text document.");
  return extension === "txt" ? parseLessonText(text, filename) : parseLessonHtml(text, filename);
}
