import { normalizeVideoUrl, VIDEO_URL_ERROR, normalizeActivityVideoUrl, ACTIVITY_VIDEO_URL_ERROR } from "../../shared/videoUrls.mjs";

function validate(req, res, next, normalize, message) {
  if (req.body && Object.hasOwn(req.body, "video")) {
    const video = normalize(req.body.video);
    if (video === null) return res.status(400).json({ success: false, message });
    req.body.video = video;
  }
  return next();
}

export default function validateVideoUrl(req, res, next) {
  return validate(req, res, next, normalizeVideoUrl, VIDEO_URL_ERROR);
}

export function validateActivityVideoUrl(req, res, next) {
  return validate(req, res, next, normalizeActivityVideoUrl, ACTIVITY_VIDEO_URL_ERROR);
}
