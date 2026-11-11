import { contentImageUrl } from "../utils/imageUrls.js";

export default function ContentImage({ src, thumbnail = false, ...props }) {
  return <img {...props} src={contentImageUrl(src, { thumbnail })} />;
}
