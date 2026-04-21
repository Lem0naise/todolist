import { useState, useEffect } from "react";

export function useLocalCache<T>(
  key: string,
  liveData: T | null | undefined
): T | null | undefined {
  const [cached, setCached] = useState<T | null | undefined>(() => {
    try {
      const item = localStorage.getItem(`unitrack:${key}`);
      return item ? (JSON.parse(item) as T) : undefined;
    } catch {
      return undefined;
    }
  });

  useEffect(() => {
    if (liveData !== undefined && liveData !== null) {
      try {
        localStorage.setItem(`unitrack:${key}`, JSON.stringify(liveData));
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setCached(liveData);
      } catch {
        // localStorage might be full
      }
    }
  }, [key, liveData]);

  // Return live data if available, fall back to cache
  return liveData !== undefined ? liveData : cached;
}
