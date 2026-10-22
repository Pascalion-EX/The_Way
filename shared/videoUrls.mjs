const youtubeHosts = new Set(["youtube.com", "www.youtube.com", "m.youtube.com"]);
const privacyHosts = new Set(["youtube-nocookie.com", "www.youtube-nocookie.com"]);
const shareHosts = new Set(["youtu.be", "www.youtu.be"]);
const videoIdPattern = /^[A-Za-z0-9_-]{11}$/;

export const VIDEO_URL_ERROR = "Use an HTTPS YouTube video link or a direct .mp4, .webm, .ogv, or .m4v video URL.";
export const VIDEO_IFRAME_ALLOW = "autoplay; encrypted-media; picture-in-picture; fullscreen";
// YouTube needs scripts and its own origin for playback/API access. Forms,
// popups, downloads, and navigation of the parent page remain blocked.
export const VIDEO_IFRAME_SANDBOX = "allow-scripts allow-same-origin allow-presentation";

const parseVideoUrl = (value) => {
  if (typeof value !== "string") return null;
  const input = value.trim();
  if (!/^https:\/\//i.test(input) || /[\\\u0000-\u001f\u007f]/.test(input)) return null;
  try {
    const url = new URL(input);
    if (url.protocol !== "https:" || url.username || url.password || url.port) return null;
    return url;
  } catch {
    return null;
  }
};

export const getYouTubeEmbedUrl = (value) => {
  const url = parseVideoUrl(value);
  if (!url) return "";
  let videoId;
  if (shareHosts.has(url.hostname)) {
    videoId = /^\/([A-Za-z0-9_-]{11})\/?$/.exec(url.pathname)?.[1];
  } else if (youtubeHosts.has(url.hostname) || privacyHosts.has(url.hostname)) {
    const match = /^\/(embed|shorts|live)\/([A-Za-z0-9_-]{11})\/?$/.exec(url.pathname);
    if (match && (!privacyHosts.has(url.hostname) || match[1] === "embed")) videoId = match[2];
    else if (youtubeHosts.has(url.hostname) && url.pathname === "/watch") videoId = url.searchParams.get("v");
  }
  if (!videoIdPattern.test(videoId || "")) return "";

  // Never reuse an author-supplied embed URL or forward arbitrary parameters.
  const embed = new URL(`https://www.youtube.com/embed/${videoId}`);
  for (const key of ["start", "end"]) {
    const seconds = url.searchParams.get(key);
    if (/^(0|[1-9]\d{0,9})$/.test(seconds || "") && Number(seconds) <= 2147483647) {
      embed.searchParams.set(key, seconds);
    }
  }
  return embed.toString();
};

export const getDirectVideoUrl = (value) => {
  const url = parseVideoUrl(value);
  if (!url || youtubeHosts.has(url.hostname) || privacyHosts.has(url.hostname) || shareHosts.has(url.hostname)) return "";
  // These URLs are used only by <video>, never by an iframe or external link.
  return /\.(mp4|webm|ogv|m4v)$/i.test(url.pathname) ? url.toString() : "";
};

// Empty is optional; null signals invalid input, including non-string values.
export const normalizeVideoUrl = (value) => {
  if (value === undefined || (typeof value === "string" && !value.trim())) return "";
  return getYouTubeEmbedUrl(value) || getDirectVideoUrl(value) || null;
};

export const isValidVideoUrl = (value) => normalizeVideoUrl(value) !== null;
