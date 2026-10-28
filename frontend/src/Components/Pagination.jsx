export default function Pagination({ pagination, onPageChange, loading = false }) {
  const { page, pageSize, totalItems, totalPages } = pagination;
  if (!totalItems) return null;
  const firstPage = Math.max(1, Math.min(page - 2, totalPages - 4));
  const pages = Array.from({ length: Math.min(5, totalPages) }, (_, index) => firstPage + index);
  const buttonClass = "min-h-11 min-w-11 rounded-xl border px-3 py-2 text-sm font-medium transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600 disabled:cursor-not-allowed disabled:opacity-50";

  return (
    <nav aria-label="Pagination" className="mt-6 flex flex-col items-center justify-between gap-4 border-t border-gray-200 pt-5 sm:flex-row">
      <p aria-live="polite" className="text-sm text-gray-600">
        Showing {(page - 1) * pageSize + 1}–{Math.min(page * pageSize, totalItems)} of {totalItems}
      </p>
      <div className="flex flex-wrap items-center justify-center gap-2">
        <button type="button" className={`${buttonClass} border-gray-300 bg-white text-gray-700 hover:bg-gray-50`} disabled={loading || page === 1} onClick={() => onPageChange(page - 1)}>Previous</button>
        {pages.map((number) => (
          <button key={number} type="button" aria-label={`Page ${number}`} aria-current={number === page ? "page" : undefined} disabled={loading} onClick={() => onPageChange(number)}
            className={`${buttonClass} ${number === page ? "border-indigo-600 bg-indigo-600 text-white" : "border-gray-300 bg-white text-gray-700 hover:bg-gray-50"}`}>
            {number}
          </button>
        ))}
        <button type="button" className={`${buttonClass} border-gray-300 bg-white text-gray-700 hover:bg-gray-50`} disabled={loading || page === totalPages} onClick={() => onPageChange(page + 1)}>Next</button>
      </div>
    </nav>
  );
}
