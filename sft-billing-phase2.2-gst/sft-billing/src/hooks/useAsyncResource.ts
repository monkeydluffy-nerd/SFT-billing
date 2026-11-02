import { useEffect, useRef, useState, useCallback } from "react";

export interface AsyncResource<T> {
  data: T | undefined;
  loading: boolean;
  error: Error | undefined;
  reload: () => void;
}

/**
 * Every domain hook (useInvoices, useClients, usePayments, useActivity)
 * is a thin wrapper around this — one place implements "loading the
 * first time, reloadable, survives unmount" so no screen has to
 * reinvent its own fetch/loading/error dance.
 */
export function useAsyncResource<T>(fetcher: () => Promise<T>, deps: unknown[] = []): AsyncResource<T> {
  const [data, setData] = useState<T | undefined>(undefined);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | undefined>(undefined);
  const [reloadToken, setReloadToken] = useState(0);
  const isMounted = useRef(true);

  useEffect(() => {
    isMounted.current = true;
    return () => {
      isMounted.current = false;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(undefined);

    fetcher()
      .then((result) => {
        if (!cancelled && isMounted.current) setData(result);
      })
      .catch((err: unknown) => {
        if (!cancelled && isMounted.current) {
          setError(err instanceof Error ? err : new Error("Something went wrong loading this data."));
        }
      })
      .finally(() => {
        if (!cancelled && isMounted.current) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reloadToken, ...deps]);

  const reload = useCallback(() => setReloadToken((t) => t + 1), []);

  return { data, loading, error, reload };
}
