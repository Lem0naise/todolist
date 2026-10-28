import { useCallback, useEffect, useState } from "react";

const STORAGE_KEY = "unitrack:group-prefs";

type GroupPrefs = Record<string, boolean>;

function loadPrefs(): GroupPrefs {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return {};
    const prefs: GroupPrefs = {};
    for (const [key, value] of Object.entries(parsed)) {
      if (typeof value === "boolean") prefs[key] = value;
    }
    return prefs;
  } catch {
    return {};
  }
}

/**
 * Group collapse preferences are device-local (like the filter), so a collapsed
 * "Overdue" bucket stays tucked away after a reload without touching Convex.
 */
export function useGroupCollapse() {
  const [prefs, setPrefs] = useState<GroupPrefs>(loadPrefs);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs));
    } catch {
      // Storage can be unavailable/full — collapsing still works for the session.
    }
  }, [prefs]);

  const isCollapsed = useCallback(
    (key: string, defaultCollapsed = false) => prefs[key] ?? defaultCollapsed,
    [prefs],
  );

  const setCollapsed = useCallback((key: string, collapsed: boolean) => {
    setPrefs((prev) => ({ ...prev, [key]: collapsed }));
  }, []);

  const setManyCollapsed = useCallback((keys: string[], collapsed: boolean) => {
    if (keys.length === 0) return;
    setPrefs((prev) => {
      const next = { ...prev };
      for (const key of keys) next[key] = collapsed;
      return next;
    });
  }, []);

  return { isCollapsed, setCollapsed, setManyCollapsed };
}

/** Prefix keys so the same label in different views can't share collapse state. */
export const groupKey = {
  category: (category: string) => `category:${category}`,
  module: (name: string) => `module:${name}`,
  date: (key: string) => `date:${key}`,
};
