import { useEffect, useState } from "react";

/** True quando a viewport tem ≥1024px (breakpoint lg). SSR-safe. */
export function useIsDesktop() {
  const [is, setIs] = useState(() => {
    if (typeof window === "undefined") return false;
    return window.matchMedia("(min-width: 1024px)").matches;
  });
  useEffect(() => {
    const mq = window.matchMedia("(min-width: 1024px)");
    const handler = (e: MediaQueryListEvent) => setIs(e.matches);
    setIs(mq.matches);
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);
  return is;
}

/** True quando o usuário prefere movimento reduzido. */
export function usePrefersReducedMotion() {
  const [reduced, setReduced] = useState(() => {
    if (typeof window === "undefined") return false;
    return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  });
  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const handler = (e: MediaQueryListEvent) => setReduced(e.matches);
    setReduced(mq.matches);
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);
  return reduced;
}

/** localStorage-backed view mode toggle (Kanban/Calendário, Lista/Funil, etc.). */
export function useSavedView<T extends string>(key: string, fallback: T): [T, (v: T) => void] {
  const [v, setV] = useState<T>(() => {
    if (typeof window === "undefined") return fallback;
    return (window.localStorage.getItem(key) as T) || fallback;
  });
  useEffect(() => {
    try { window.localStorage.setItem(key, v); } catch { /* ignore */ }
  }, [key, v]);
  return [v, setV];
}
