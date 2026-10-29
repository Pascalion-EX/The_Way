const backendUrl = import.meta.env.VITE_BACKEND_URL || "";

export const contentImageUrl = (src) => typeof src === "string" && src.startsWith("/uploads/")
  ? `${backendUrl.replace(/\/$/, "")}${src}` : src;
