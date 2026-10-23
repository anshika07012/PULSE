import { useCallback, useEffect, useRef, useState } from "react";

/** Loads data immediately and re-fetches it every `ms` milliseconds (the "live" feel). */
export function usePolling<T>(fetcher: () => Promise<T>, ms = 5000) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const fetcherRef = useRef(fetcher);
  fetcherRef.current = fetcher;

  const reload = useCallback(async () => {
    try {
      setData(await fetcherRef.current());
      setError("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    reload();
    const id = window.setInterval(reload, ms);
    return () => window.clearInterval(id);
  }, [reload, ms]);

  return { data, setData, error, loading, reload };
}

/** Re-renders every second so progress bars and clocks move smoothly. */
export function useNow(intervalMs = 1000) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), intervalMs);
    return () => window.clearInterval(id);
  }, [intervalMs]);
  return now;
}
