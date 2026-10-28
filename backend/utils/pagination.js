const PAGE_SIZE = 5;

export function readPage(value) {
  if (value === undefined) return null;
  if (typeof value !== "string" || !/^[1-9]\d{0,8}$/.test(value)) {
    throw Object.assign(new Error("Page must be a positive whole number"), { status: 400 });
  }
  return Number(value);
}

export function paginationFor(totalItems, requestedPage) {
  const totalPages = Math.max(1, Math.ceil(totalItems / PAGE_SIZE));
  return {
    page: Math.min(requestedPage, totalPages),
    pageSize: PAGE_SIZE,
    totalItems,
    totalPages,
  };
}

export async function paginateQuery(query, page) {
  // Other consumers, including the curriculum lesson picker, still need a full list.
  if (page === null) return { items: await query };
  const totalItems = await query.model.countDocuments(query.getFilter());
  const pagination = paginationFor(totalItems, page);
  const items = await query
    .skip((pagination.page - 1) * pagination.pageSize)
    .limit(pagination.pageSize);
  return { items, pagination };
}
