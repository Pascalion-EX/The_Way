import {
  getDirectVideoUrl,
  getYouTubeEmbedUrl,
  getPinterestPinUrl,
  getPinterestEmbedUrl,
  VIDEO_IFRAME_ALLOW,
  VIDEO_IFRAME_SANDBOX,
} from "../../../shared/videoUrls.mjs";

export default function ContentVideo({ video, title, allowPinterest = false }) {
  const pinterestUrl = allowPinterest ? getPinterestPinUrl(video) : "";
  const pinterestEmbedUrl = pinterestUrl ? getPinterestEmbedUrl(pinterestUrl) : "";
  const embedUrl = getYouTubeEmbedUrl(video) || pinterestEmbedUrl;
  const directUrl = getDirectVideoUrl(video);
  if (pinterestUrl && !pinterestEmbedUrl) {
    return (
      <div className="mt-4 rounded-2xl border border-gray-200 bg-gray-50 p-5">
        <a href={pinterestUrl} target="_blank" rel="noopener noreferrer" className="inline-flex rounded-xl bg-indigo-600 px-5 py-3 text-sm font-semibold text-white hover:bg-indigo-500">
          Open video on Pinterest
        </a>
      </div>
    );
  }
  // Revalidate saved content too: old records and route state are untrusted.
  if (!embedUrl && !directUrl) {
    return <p className="mt-4 text-sm text-gray-500">This video link is unsupported. Please ask an editor to update it.</p>;
  }
  return (
    <>
      <div className={`mt-4 overflow-hidden rounded-2xl border border-gray-200 ${pinterestEmbedUrl ? "bg-gray-50" : "bg-black"}`}>
        {embedUrl ? (
          <iframe
            src={embedUrl}
            title={title}
            className={pinterestEmbedUrl ? "h-[600px] w-full" : "aspect-video w-full"}
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
        <a href={pinterestUrl || embedUrl} target="_blank" rel="noopener noreferrer" className="mt-3 inline-block break-all text-sm font-medium text-indigo-600 hover:underline">
          {pinterestUrl ? "Open video on Pinterest" : "Open video link"}
        </a>
      )}
    </>
  );
}
