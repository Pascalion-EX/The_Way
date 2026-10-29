import { contentImageUrl } from "../utils/imageUrls.js";

export default function ContentImage({ src, ...props }) {
  return <img {...props} src={contentImageUrl(src)} />;
}
