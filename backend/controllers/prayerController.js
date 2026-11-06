import mongoose from "mongoose";
import Prayer from "../models/prayerModel.js";
import { readPage, paginateQuery } from "../utils/pagination.js";
import { PRAYER_LANGUAGES, getPrayerSlides } from "../../shared/prayerSlides.mjs";

const publicFields = "_id title text slides createdAt updatedAt";
const publicPrayer = (prayer) => Object.fromEntries(publicFields.split(" ").map((field) => [field, prayer[field]]));

function prayerInput(body) {
  if (typeof body?.title !== "string" || !body.title.trim() || body.title.trim().length > 120) {
    throw Object.assign(new Error("Prayer title must be between 1 and 120 characters"), { status: 400 });
  }
  if (body.slides !== undefined && (!body.slides || typeof body.slides !== "object" || Array.isArray(body.slides))) {
    throw Object.assign(new Error("Prayer slides must be grouped by language"), { status: 400 });
  }
  if (body.slides === undefined && (!body.text || typeof body.text !== "object" || Array.isArray(body.text))) {
    throw Object.assign(new Error("Add prayer text in at least one language"), { status: 400 });
  }
  const text = {};
  const slides = {};
  for (const language of PRAYER_LANGUAGES) {
    if (body.slides === undefined) {
      const value = body.text[language] ?? "";
      if (typeof value !== "string") throw Object.assign(new Error("Prayer text must be plain text"), { status: 400 });
      text[language] = value.replace(/\r\n?/g, "\n").trim();
      slides[language] = getPrayerSlides({ text }, language);
    } else {
      const entries = body.slides[language] ?? [];
      if (!Array.isArray(entries)) {
        throw Object.assign(new Error("Prayer slides must be arrays"), { status: 400 });
      }
      slides[language] = entries.map((slide) => {
        if (!slide || typeof slide !== "object" || Array.isArray(slide) ||
            (slide.text !== undefined && typeof slide.text !== "string") ||
            (slide.image !== undefined && typeof slide.image !== "string")) {
          throw Object.assign(new Error("Each slide must contain text or an uploaded image"), { status: 400 });
        }
        const clean = { text: (slide.text || "").replace(/\r\n?/g, "\n").trim(), image: (slide.image || "").trim() };
        if (clean.image && !/^\/uploads\/[a-f0-9]{64}\.webp$/.test(clean.image)) {
          throw Object.assign(new Error("Upload a valid image for each slide"), { status: 400 });
        }
        if (!clean.text && !clean.image) throw Object.assign(new Error("Each slide must contain text or an uploaded image"), { status: 400 });
        return clean;
      });
      text[language] = slides[language].map((slide) => slide.text).filter(Boolean).join("\n\n");
    }
  }
  if (!Object.values(slides).some((entries) => entries.length)) {
    throw Object.assign(new Error("Add prayer text or an image in at least one language"), { status: 400 });
  }
  const input = { title: body.title.trim(), text, slides };
  // Check the submitted representation; text is derived for older clients.
  const submitted = body.slides === undefined ? { title: input.title, text } : { title: input.title, slides };
  if (Buffer.byteLength(JSON.stringify(submitted)) > 80 * 1024) {
    throw Object.assign(new Error("This prayer is too long. Use at most 80 KB of text."), { status: 413 });
  }
  return input;
}

const failure = (res, error, message) => res.status(error.status || 500).json({
  success: false, message: [400, 413].includes(error.status) ? error.message : message,
});

export async function getPrayers(req, res) {
  try {
    const page = readPage(req.query.page);
    const search = req.query.search ?? "";
    if (typeof search !== "string" || search.length > 200) {
      return res.status(400).json({ success: false, message: "Invalid prayer search" });
    }
    const filter = search.trim() ? { title: mongoose.trusted({
      $regex: search.trim().replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), $options: "i",
    }) } : {};
    const { items, pagination } = await paginateQuery(Prayer.find(filter).select("_id title").sort({ createdAt: -1, _id: -1 }).lean(), page);
    return res.json({ success: true, prayers: items.map(({ _id, title }) => ({ _id, title })), pagination });
  } catch (error) { return failure(res, error, "Unable to load prayers"); }
}

export async function getPrayer(req, res) {
  try {
    if (!mongoose.isObjectIdOrHexString(req.params.id)) {
      return res.status(400).json({ success: false, message: "Invalid prayer ID" });
    }
    const prayer = await Prayer.findById(req.params.id).select(publicFields).lean();
    if (!prayer) return res.status(404).json({ success: false, message: "Prayer not found" });
    return res.json({ success: true, prayer: publicPrayer(prayer) });
  } catch (error) { return failure(res, error, "Unable to load prayer"); }
}

export async function createPrayer(req, res) {
  try {
    const input = prayerInput(req.body);
    const prayer = await Prayer.create({ ...input, createdBy: req.userId, updatedBy: req.userId });
    return res.status(201).json({ success: true, message: "Prayer added", prayer: publicPrayer(prayer) });
  } catch (error) { return failure(res, error, "Unable to add prayer"); }
}

export async function updatePrayer(req, res) {
  try {
    if (!mongoose.isObjectIdOrHexString(req.params.id)) {
      return res.status(400).json({ success: false, message: "Invalid prayer ID" });
    }
    const input = prayerInput(req.body);
    const prayer = await Prayer.findByIdAndUpdate(req.params.id, { ...input, updatedBy: req.userId }, {
      returnDocument: "after", runValidators: true,
    }).select(publicFields).lean();
    if (!prayer) return res.status(404).json({ success: false, message: "Prayer not found" });
    return res.json({ success: true, message: "Prayer saved", prayer: publicPrayer(prayer) });
  } catch (error) { return failure(res, error, "Unable to save prayer"); }
}

export async function deletePrayer(req, res) {
  try {
    if (!mongoose.isObjectIdOrHexString(req.params.id)) {
      return res.status(400).json({ success: false, message: "Invalid prayer ID" });
    }
    const prayer = await Prayer.findByIdAndDelete(req.params.id).select("_id");
    if (!prayer) return res.status(404).json({ success: false, message: "Prayer not found" });
    return res.json({ success: true, message: "Prayer deleted" });
  } catch (error) { return failure(res, error, "Unable to delete prayer"); }
}
