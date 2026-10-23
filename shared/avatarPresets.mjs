// Legacy animal IDs are stored on accounts; preserve them for the character artwork.
// Image filenames can change independently of saved account IDs.
export const AVATAR_PRESETS = Object.freeze([
  { id: "fox", label: "Jesus", image: "jesus.png" },
  { id: "cat", label: "Mary", image: "mary.png" },
  { id: "bear", label: "Joseph", image: "joseph.png" },
  { id: "panda", label: "Peter", image: "peter.png" },
  { id: "rabbit", label: "John", image: "john.png" },
  { id: "owl", label: "Paul", image: "paul.png" },
  { id: "koala", label: "Mary Magdalene", image: "mary-magdalene.png" },
  { id: "lion", label: "John the Baptist", image: "john-the-baptist.png" },
  { id: "penguin", label: "Luke", image: "luke.png" },
  { id: "frog", label: "Mark", image: "mark.png" },
  { id: "dog", label: "Matthew", image: "matthew.png" },
  { id: "tiger", label: "Thomas", image: "thomas.png" },
].map(Object.freeze));

export const AVATAR_IDS = Object.freeze(AVATAR_PRESETS.map(({ id }) => id));

export const isValidAvatarId = (value) =>
  typeof value === "string" && (value === "" || AVATAR_IDS.includes(value));

export const getAvatarPreset = (id) => AVATAR_PRESETS.find((preset) => preset.id === id);
