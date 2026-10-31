import { useCallback, useEffect, useState } from "react";
import { toast } from "react-toastify";
import axios from "../utils/axios";

export default function usePaginatedList({ url, dataKey, initialFilters = {}, debounce = 0 }) {
  const [selection, setSelection] = useState({ page: 1, filters: initialFilters });
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [pagination, setPagination] = useState({ page: 1, pageSize: 6, totalItems: 0, totalPages: 1 });
  const [revision, setRevision] = useState(0);
  const requestUrl = `${url}?${new URLSearchParams({ ...selection.filters, page: selection.page })}`;

  const refresh = useCallback(() => setRevision((value) => value + 1), []);
  const setFilters = useCallback((filters) => {
    setSelection((previous) => ({
      page: 1,
      filters: typeof filters === "function" ? filters(previous.filters) : filters,
    }));
  }, []);
  const setPage = useCallback((page) => {
    setSelection((previous) => ({ ...previous, page }));
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    const load = async () => {
      try {
        const { data } = await axios.get(requestUrl, { signal: controller.signal });
        if (controller.signal.aborted) return;
        if (!data.success || !data.pagination) throw new Error(data.message || "Unable to load results");
        setItems(data[dataKey] || []);
        setPagination(data.pagination);
        // Deleting the final item on a page can move the last page backwards.
        setSelection((previous) => previous.page === data.pagination.page
          ? previous
          : { ...previous, page: data.pagination.page });
      } catch (error) {
        if (!controller.signal.aborted) {
          toast.error(error.response?.data?.message || error.message);
        }
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    };
    const timer = debounce ? setTimeout(load, debounce) : null;
    if (!debounce) load();
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [requestUrl, dataKey, debounce, revision]);

  return { items, setItems, loading, pagination, filters: selection.filters, setFilters, setPage, refresh };
}
