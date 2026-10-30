// Inclusive projections keep list responses small as content fields grow.
// Year is used by the curriculum lesson picker.
export const lessonCardFields = "_id title name image year";
export const namedCardFields = "_id name image";
export const chantCardFields = "_id title image isFavorite";

export function toContentCard(record, fields) {
  return Object.fromEntries(fields.split(" ")
    .filter((field) => record[field] !== undefined)
    .map((field) => [field, record[field]]));
}
