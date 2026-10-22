import { normalizeVideoUrl, VIDEO_URL_ERROR } from "../../shared/videoUrls.mjs";

export default function validateVideoUrl(req, res, next) {
  if (req.body && Object.hasOwn(req.body, "video")) {
    const video = normalizeVideoUrl(req.body.video);
    if (video === null) return res.status(400).json({ success: false, message: VIDEO_URL_ERROR });
    req.body.video = video;
  }
  return next();
}
