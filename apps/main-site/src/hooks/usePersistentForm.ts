import { useState, useEffect } from 'react';

export function usePersistentForm<T>(key: string, initialValue: T) {
  const [state, setState] = useState<T>(initialValue);
  const [isMounted, setIsMounted] = useState(false);

  // 1. Hydrate from sessionStorage on first client render
  useEffect(() => {
    setIsMounted(true);
    if (typeof window !== 'undefined') {
      try {
        const item = window.sessionStorage.getItem(key);
        if (item) {
          // Parse the stored json
          const parsed = JSON.parse(item);
          // Merge it with initialValue to ensure we don't drop new fields
          // but respect the saved values if they exist.
          if (typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed)) {
            setState({ ...initialValue, ...parsed });
          } else {
            setState(parsed);
          }
        }
      } catch (error) {
        console.error(`Error reading sessionStorage key "${key}":`, error);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  // 2. Save state to sessionStorage on every change (but ONLY after mount)
  useEffect(() => {
    if (isMounted && typeof window !== 'undefined') {
      try {
        window.sessionStorage.setItem(key, JSON.stringify(state));
      } catch (error) {
        console.error(`Error setting sessionStorage key "${key}":`, error);
      }
    }
  }, [key, state, isMounted]);

  return [state, setState] as const;
}
