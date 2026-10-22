// Stable IDs are stored on accounts. Keep existing IDs when adding new artwork.
export const AVATAR_PRESETS = Object.freeze([
  { id: "fox", label: "Fox" },
  { id: "cat", label: "Cat" },
  { id: "bear", label: "Bear" },
  { id: "panda", label: "Panda" },
  { id: "rabbit", label: "Rabbit" },
  { id: "owl", label: "Owl" },
  { id: "koala", label: "Koala" },
  { id: "lion", label: "Lion" },
  { id: "penguin", label: "Penguin" },
  { id: "frog", label: "Frog" },
  { id: "dog", label: "Dog" },
  { id: "tiger", label: "Tiger" },
].map(Object.freeze));

export const AVATAR_IDS = Object.freeze(AVATAR_PRESETS.map(({ id }) => id));

export const isValidAvatarId = (value) =>
  typeof value === "string" && (value === "" || AVATAR_IDS.includes(value));

export const getAvatarPreset = (id) => AVATAR_PRESETS.find((preset) => preset.id === id);
