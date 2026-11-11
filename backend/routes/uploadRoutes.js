import express from "express";
import userAuth from "../middleware/userAuth.js";
import { requireStaff } from "../middleware/staffAuth.js";
import { createAuthRateLimit } from "../middleware/authRateLimit.js";
import {
  IMAGE_TYPES, MAX_IMAGE_BYTES, UPLOADED_IMAGE_NAME, ImageUploadError,
  saveUploadedImage, uploadsDirectory,
} from "../services/imageUploads.js";
import { imageThumbnailPath } from "../services/imageThumbnails.js";

const uploadRateLimit = createAuthRateLimit({
  scope: "image-upload-account", limit: 60, windowMs: 60 * 60 * 1000,
  key: (req) => req.userId,
  code: "UPLOAD_RATE_LIMITED",
  message: "Too many image uploads. Please try again later.",
  unavailableMessage: "Image uploads are temporarily unavailable. Please try again later.",
});

export const createUploadRouter = ({ directory = uploadsDirectory() } = {}) => {
  const router = express.Router();
  router.get("/thumbnails/v1/:filename", async (req, res, next) => {
    const fail = (error) => {
      if (res.headersSent) return next(error);
      res.set("Cache-Control", "no-store");
      res.status(error.code === "ENOENT" || error.status === 404 ? 404 : 503).end();
    };
    try {
      const path = await imageThumbnailPath(req.params.filename, directory);
      res.set("X-Content-Type-Options", "nosniff");
      // The service validates the hash filename before selecting this hidden cache.
      res.sendFile(path, { dotfiles: "allow", immutable: true, maxAge: "1y" }, (error) => {
        if (error) fail(error);
      });
    } catch (error) {
      fail(error);
    }
  });
  router.post("/images", userAuth, requireStaff, (req, res, next) => {
    const type = req.get("content-type")?.split(";")[0].trim().toLowerCase();
    if (!IMAGE_TYPES.has(type) || (req.get("content-encoding") || "identity") !== "identity") {
      return res.status(415).json({ success: false, message: "Choose a JPEG, PNG, or WebP image." });
    }
    req.imageContentType = type;
    next();
  }, uploadRateLimit, express.raw({ type: () => true, limit: MAX_IMAGE_BYTES, inflate: false }), async (req, res) => {
    try {
      const image = await saveUploadedImage(req.body, req.imageContentType, directory);
      return res.status(201).json({ success: true, ...image });
    } catch (error) {
      return res.status(error instanceof ImageUploadError ? error.status : 503).json({
        success: false,
        message: error instanceof ImageUploadError ? error.message : "Unable to save the image. Please try again later.",
      });
    }
  });
  router.use((error, req, res, next) => {
    if (error.type !== "entity.too.large") return next(error);
    return res.status(413).json({ success: false, message: "Images must be 5 MB or smaller." });
  });
  return router;
};

// Development/standalone APIs serve the same files as Caddy does in Compose.
export const createUploadedImagesRouter = ({ directory = uploadsDirectory() } = {}) => {
  const router = express.Router();
  router.use((req, res, next) => {
    if (!["GET", "HEAD"].includes(req.method) || !UPLOADED_IMAGE_NAME.test(req.path.slice(1))) {
      return res.status(404).end();
    }
    res.set("X-Content-Type-Options", "nosniff");
    next();
  });
  router.use(express.static(directory, { dotfiles: "deny", index: false, fallthrough: false, immutable: true, maxAge: "1y" }));
  router.use((error, req, res, next) => {
    if (res.headersSent) return next(error);
    res.status(error.status === 404 ? 404 : 500).end();
  });
  return router;
};

export default createUploadRouter();
