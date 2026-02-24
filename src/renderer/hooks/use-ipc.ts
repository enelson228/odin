import { useState, useEffect, useCallback, useMemo } from 'react';

interface UseIpcResult<T> {
  data: T | null;
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

export function useIpc<T>(
  channel: keyof typeof window.odinApi,
  ...args: unknown[]
): UseIpcResult<T> {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Stable serialization of args to avoid re-renders from new array/object references
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const argsKey = useMemo(() => JSON.stringify(args), [JSON.stringify(args)]);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const apiMethod = window.odinApi[channel] as (...a: unknown[]) => Promise<unknown>;
      if (typeof apiMethod !== 'function') {
        throw new Error(`Unknown IPC channel: ${channel}`);
      }
      const result = await apiMethod(...args) as T;
      setData(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
    // argsKey is the stable serialized dep, not args directly
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [channel, argsKey]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return { data, loading, error, refetch: fetchData };
}
