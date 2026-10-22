import {
  getDirectVideoUrl,
  getYouTubeEmbedUrl,
  VIDEO_IFRAME_ALLOW,
  VIDEO_IFRAME_SANDBOX,
} from "../../../shared/videoUrls.mjs";

export default function ContentVideo({ video, title }) {
  const embedUrl = getYouTubeEmbedUrl(video);
  const directUrl = getDirectVideoUrl(video);
  // Revalidate saved content too: old records and route state are untrusted.
  if (!embedUrl && !directUrl) {
    return <p className="mt-4 text-sm text-gray-500">This video link is unsupported. Please ask an editor to update it.</p>;
  }
  return (
    <>
      <div className="mt-4 overflow-hidden rounded-2xl border border-gray-200 bg-black">
        {embedUrl ? (
          <iframe
            src={embedUrl}
            title={title}
            className="aspect-video w-full"
            allow={VIDEO_IFRAME_ALLOW}
            sandbox={VIDEO_IFRAME_SANDBOX}
            referrerPolicy="strict-origin-when-cross-origin"
            allowFullScreen
          />
        ) : (
          <video src={directUrl} aria-label={title} controls preload="metadata" className="aspect-video w-full bg-black">
            Your browser does not support the video element.
          </video>
        )}
      </div>
      {embedUrl && (
        <a href={embedUrl} target="_blank" rel="noopener noreferrer" className="mt-3 inline-block break-all text-sm font-medium text-indigo-600 hover:underline">
          Open video link
        </a>
      )}
    </>
  );
}
