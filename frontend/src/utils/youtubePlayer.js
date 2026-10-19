export const getYouTubeEmbedUrl = (url) => {
  if (!url) return "";

  try {
    const parsed = new URL(url);
    if (!["https:", "http:"].includes(parsed.protocol)) return "";
    const hostname = parsed.hostname.replace(/^www\./, "");
    let videoId;

    if (hostname === "youtu.be") {
      videoId = parsed.pathname.split("/")[1];
    } else if (["youtube.com", "m.youtube.com", "youtube-nocookie.com"].includes(hostname)) {
      videoId = /^\/(embed|shorts|live)\//.test(parsed.pathname)
        ? parsed.pathname.split("/")[2]
        : parsed.searchParams.get("v");
    }

    if (!/^[\w-]{11}$/.test(videoId || "")) return "";
    const embed = new URL(`https://www.youtube.com/embed/${videoId}`);
    if (parsed.pathname.startsWith("/embed/")) embed.search = parsed.search;
    return embed.toString();
  } catch {
    return "";
  }
};

let apiPromise;

export const loadYouTubePlayerApi = () => {
  if (window.YT?.Player) return Promise.resolve(window.YT);
  if (apiPromise) return apiPromise;

  apiPromise = new Promise((resolve, reject) => {
    const previousCallback = window.onYouTubeIframeAPIReady;
    const script = document.createElement("script");
    const timeout = window.setTimeout(() => fail(), 20000);

    const fail = () => {
      window.clearTimeout(timeout);
      window.onYouTubeIframeAPIReady = previousCallback;
      script.remove();
      apiPromise = undefined;
      reject(new Error("YouTube could not load. Please reload and try again."));
    };

    window.onYouTubeIframeAPIReady = () => {
      window.clearTimeout(timeout);
      window.onYouTubeIframeAPIReady = previousCallback;
      resolve(window.YT);
      previousCallback?.();
    };
    script.src = "https://www.youtube.com/iframe_api";
    script.async = true;
    script.addEventListener("error", fail, { once: true });
    document.head.append(script);
  });

  return apiPromise;
};

export const formatMediaTime = (seconds) => {
  const total = Math.max(0, Math.floor(Number(seconds) || 0));
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const remainder = String(total % 60).padStart(2, "0");
  return hours
    ? `${hours}:${String(minutes).padStart(2, "0")}:${remainder}`
    : `${minutes}:${remainder}`;
};
