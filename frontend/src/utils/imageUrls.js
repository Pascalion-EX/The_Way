const backendUrl = import.meta.env.VITE_BACKEND_URL || "";

export const contentImageUrl = (src, { thumbnail = false } = {}) => {
  if (typeof src !== "string" || !src.startsWith("/uploads/")) return src;
  const path = thumbnail && /^\/uploads\/[a-f0-9]{64}\.webp$/.test(src)
    ? src.replace("/uploads/", "/api/uploads/thumbnails/v1/") : src;
  return `${backendUrl.replace(/\/$/, "")}${path}`;
};
