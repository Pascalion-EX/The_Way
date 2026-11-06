export const PRAYER_LANGUAGES = ["arabic", "coptic", "english"];

export function getPrayerSlides(prayer, language) {
  if (Array.isArray(prayer?.slides?.[language])) return prayer.slides[language];
  return (prayer?.text?.[language] || "").split(/\n\s*\n/)
    .map((text) => text.trim()).filter(Boolean).map((text) => ({ text, image: "" }));
}
